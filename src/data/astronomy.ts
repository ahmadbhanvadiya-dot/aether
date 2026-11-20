import { Euler, Matrix4, Vector3 } from 'three'
import { PLANETS, PLANET_BY_ID, type MoonSpec, type PlanetData, type PlanetFact, type PlanetId } from './planets'

/**
 * Phase 9: the astronomy of the Aether system. Fictional, but internally
 * consistent: every derived value below comes from a world's year, day and mass
 * through Kepler's third law, and the scene, the events and the Observatory all
 * read positions from the same functions.
 *
 * Units: time in standard days (24 h); distance in km (physics) or AU (display).
 * The scene draws the same angles at compressed distances (`orbitRadius`).
 */

/** Elys: 0.92 solar masses, radius 650,000 km. */
export const ELYS = { mass: 0.92, radiusKm: 650_000 }
export const AU_KM = 149_597_871
/** G × (one mass unit, 5.97e24 kg) in km³/s². */
const GM_UNIT = 398_600
const YEAR = 365.25
/** The simulation's epoch, in standard days; positions at the epoch are each world's `phase`. */
export const EPOCH = 10_000

export interface MoonInfo extends MoonSpec {
  planet: PlanetId
  periodDays: number
}

export interface Astronomy {
  /** Semi‑major axis, AU (circular orbits). */
  au: number
  km: number
  yearDays: number
  dayHours: number
  retrograde: boolean
  axialTiltDeg: number
  moons: MoonInfo[]
}

/** Kepler III around Elys: a³ = M T² (AU, solar masses, years). */
function semiMajorAU(yearDays: number) {
  return Math.cbrt(ELYS.mass * (yearDays / YEAR) ** 2)
}

/** Kepler III around a world: T = 2π √(a³ / GM). */
function moonPeriodDays(p: PlanetData, km: number) {
  return (2 * Math.PI * Math.sqrt(km ** 3 / (GM_UNIT * p.mass))) / 86_400
}

export const ASTRONOMY = Object.fromEntries(
  PLANETS.map((p) => {
    const au = semiMajorAU(p.yearDays)
    return [
      p.id,
      {
        au,
        km: au * AU_KM,
        yearDays: p.yearDays,
        dayHours: Math.abs(p.dayHours),
        retrograde: p.dayHours < 0,
        axialTiltDeg: (p.axialTilt * 180) / Math.PI,
        moons: p.moons.map((m) => ({ ...m, planet: p.id, periodDays: moonPeriodDays(p, m.km) })),
      } satisfies Astronomy,
    ]
  }),
) as Record<PlanetId, Astronomy>

export const MOONS: MoonInfo[] = PLANETS.flatMap((p) => ASTRONOMY[p.id].moons)

// ---------------------------------------------------------------------------
// Positions. The same rotations as the scene graph (World.tsx): the orbit plane
// tilted by `inclination` about x; the equator (and the moons' plane) tilted by
// `axialTilt` about z.

/** Orbital angle at a simulation day (decreasing: the system turns one way). */
export function orbitAngle(p: PlanetData, day: number) {
  return p.phase - ((day - EPOCH) / p.yearDays) * Math.PI * 2
}

const incl = Object.fromEntries(PLANETS.map((p) => [p.id, new Matrix4().makeRotationX(p.inclination)])) as Record<PlanetId, Matrix4>
const equator = Object.fromEntries(
  PLANETS.map((p) => [p.id, new Matrix4().makeRotationFromEuler(new Euler(p.inclination, 0, 0)).multiply(new Matrix4().makeRotationZ(p.axialTilt))]),
) as Record<PlanetId, Matrix4>

/** Heliocentric position, km. */
export function planetKm(id: PlanetId, day: number, out: Vector3) {
  const p = PLANET_BY_ID[id]
  const a = orbitAngle(p, day)
  const r = ASTRONOMY[id].km
  return out.set(Math.cos(a) * r, 0, Math.sin(a) * r).applyMatrix4(incl[id])
}

/** Angle of a moon on its orbit at a simulation day. */
export function moonAngle(m: MoonInfo, day: number) {
  return m.phase - (m.retrograde ? -1 : 1) * ((day - EPOCH) / m.periodDays) * Math.PI * 2
}

/** A moon's position in its world's tilted frame (before the equator tilt), for any radius. */
export function moonLocal(m: MoonInfo, day: number, radius: number, out: Vector3) {
  const a = moonAngle(m, day)
  out.set(Math.cos(a) * radius, 0, Math.sin(a) * radius)
  if (m.inclination) out.applyAxisAngle(X_AXIS, m.inclination)
  return out
}

const X_AXIS = new Vector3(1, 0, 0)

/** A moon's offset from its world, km, in the system frame. */
export function moonOffsetKm(m: MoonInfo, day: number, out: Vector3) {
  return moonLocal(m, day, m.km, out).applyMatrix4(equator[m.planet])
}

// ---------------------------------------------------------------------------
// Display.

const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const num2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatDuration(days: number) {
  if (days < 2) return `${num.format(days * 24)} hours`
  return `${num.format(days)} days`
}

export function formatDay(hours: number, retrograde: boolean) {
  const v = hours >= 100 ? `${num.format(hours / 24)} days` : `${num.format(hours)} hours`
  return retrograde ? `${v}, retrograde` : v
}

export const formatAU = (au: number) => `${num2.format(au)} AU`

/** The fact list shown in the galaxy panel and the Observatory: Day, Year and Moons come from the astronomy. */
export function planetFacts(p: PlanetData): PlanetFact[] {
  const a = ASTRONOMY[p.id]
  const [radius, ...rest] = p.facts
  return [
    radius,
    { label: 'Day', value: formatDay(a.dayHours, a.retrograde) },
    { label: 'Year', value: `${num.format(a.yearDays)} days` },
    ...rest,
    { label: 'Moons', value: p.moonCount === 0 ? 'None' : num.format(p.moonCount) },
  ]
}

/** Scene distance from Elys → AU, interpolated between the drawn orbits (the scene is compressed). */
const STOPS = [[0, 0], ...PLANETS.map((p) => [p.orbitRadius, ASTRONOMY[p.id].au])].sort((a, b) => a[0] - b[0])
export function sceneToAU(r: number) {
  for (let i = 1; i < STOPS.length; i++) {
    const [r0, a0] = STOPS[i - 1]
    const [r1, a1] = STOPS[i]
    if (r <= r1 || i === STOPS.length - 1) return a0 + ((r - r0) / (r1 - r0)) * (a1 - a0)
  }
  return 0
}
