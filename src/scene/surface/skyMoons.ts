import { Euler, Matrix4, Vector3 } from 'three'
import { ASTRONOMY, moonOffsetKm, planetKm } from '../../data/astronomy'
import { PLANET_BY_ID, type PlanetId } from '../../data/planets'
import type { SurfaceUniforms } from './env'

/**
 * Surface skies follow the simulation: each modelled moon is drawn where the
 * simulation has it, relative to Elys. The location's sky keeps its authored sun
 * (direction and drift); the moons are placed in a frame built from it, so the
 * angle between Elys and each moon — and therefore its phase — is the true one.
 *
 * The frame: Elys's direction maps to the local sun; the world's spin axis maps
 * to a celestial pole 45° up in the local north (latitudes are not modelled).
 * Moons are seen from the surface: the observer stands where the location's own
 * zenith points, carried into the system frame by the same mapping, so close moons
 * shift with parallax and an eclipse is seen where its shadow actually falls.
 */

const S = new Vector3()
const M = new Vector3()
const E2 = new Vector3()
const E3 = new Vector3()
const F2 = new Vector3()
const F3 = new Vector3()
const POLE_LOCAL = new Vector3(0, Math.SQRT1_2, -Math.SQRT1_2)
const OBS = new Vector3()
const pole = new Map<PlanetId, Vector3>()

function spinAxis(id: PlanetId) {
  let v = pole.get(id)
  if (!v) {
    const p = PLANET_BY_ID[id]
    const m = new Matrix4().makeRotationFromEuler(new Euler(p.inclination, 0, 0)).multiply(new Matrix4().makeRotationZ(p.axialTilt))
    v = new Vector3(0, 1, 0).applyMatrix4(m).normalize()
    pole.set(id, v)
  }
  return v
}

/** Elys's drawn angular radius in the sky shader (its disc edge, mu ≈ 0.9998). */
const SUN_RADIUS = 0.02

/**
 * Writes this frame's moon directions into the sky's `uMoons` (sizes are kept) and
 * returns how much of Elys's disc the moons cover (0 → 1): an eclipse seen from
 * the ground, which the scene then dims.
 */
export function placeMoons(u: SurfaceUniforms, planet: PlanetId, day: number, count: number) {
  const moons = ASTRONOMY[planet].moons
  if (!count || !moons.length) return 0
  // System frame: e1 toward Elys, e2 the spin axis made perpendicular to it.
  planetKm(planet, day, S).multiplyScalar(-1).normalize()
  E2.copy(spinAxis(planet)).addScaledVector(S, -spinAxis(planet).dot(S))
  if (E2.lengthSq() < 1e-6) return 0
  E2.normalize()
  E3.crossVectors(S, E2)
  // Local frame: f1 the sky's sun, f2 the pole made perpendicular to it.
  const f1 = u.uSunDir.value
  F2.copy(POLE_LOCAL).addScaledVector(f1, -POLE_LOCAL.dot(f1))
  if (F2.lengthSq() < 1e-6) return 0
  F2.normalize()
  F3.crossVectors(f1, F2)
  // The observer: the local zenith (0, 1, 0) expressed in the system frame, at the surface.
  OBS.copy(S).multiplyScalar(f1.y).addScaledVector(E2, F2.y).addScaledVector(E3, F3.y).normalize().multiplyScalar(PLANET_BY_ID[planet].radiusKm)
  let covered = 0
  for (let i = 0; i < Math.min(count, moons.length, 4); i++) {
    moonOffsetKm(moons[i], day, M).sub(OBS).normalize()
    const a = M.dot(S)
    const b = M.dot(E2)
    const c = M.dot(E3)
    const slot = u.uMoons.value[i]
    slot.x = f1.x * a + F2.x * b + F3.x * c
    slot.y = f1.y * a + F2.y * b + F3.y * c
    slot.z = f1.z * a + F2.z * b + F3.z * c
    // Overlap of the two discs (a simple linear estimate), capped by their area ratio.
    const sep = Math.acos(Math.max(-1, Math.min(1, a)))
    const rm = slot.w
    const overlap = Math.min(1, Math.max(0, (SUN_RADIUS + rm - sep) / (2 * Math.min(SUN_RADIUS, rm))))
    covered = Math.max(covered, overlap * Math.min(1, (rm / SUN_RADIUS) ** 2))
  }
  return covered
}
