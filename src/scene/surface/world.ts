import { Vector3 } from 'three'
import { locationsFor, SURFACES, type LocationData, type SurfaceSettings } from '../../data/locations'
import type { PlanetId } from '../../data/planets'
import { cloneEnv, envFromLocation, type EnvState } from './env'
import { KIND_IDS, locFields, makeHeightFn } from './terrain'

export interface Pose {
  pos: Vector3
  yaw: number
  pitch: number
}

/**
 * Everything the CPU knows about the world being explored: the height
 * function, each location's camera pose, landmark base, signal position and
 * environment. Built once per descent by `prepareSurface`.
 */
export const surface = {
  planet: null as PlanetId | null,
  settings: null as SurfaceSettings | null,
  locations: [] as LocationData[],
  height: (() => 0) as (x: number, z: number) => number,
  /** Ground or sea surface, whichever is higher. */
  floor: (() => 0) as (x: number, z: number) => number,
  poses: {} as Record<string, Pose>,
  landmarkBase: {} as Record<string, Vector3>,
  signals: {} as Record<string, Vector3>,
  envs: {} as Record<string, EnvState>,
  /** The blended environment currently applied. */
  env: null as EnvState | null,
}

/** Direction the camera faces for a given yaw / pitch. */
export function forward(yaw: number, pitch: number, out = new Vector3()) {
  return out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
}

export function prepareSurface(planet: PlanetId) {
  if (surface.planet === planet && surface.env) return surface
  const settings = SURFACES[planet]
  const locations = locationsFor(planet)
  const height = makeHeightFn(KIND_IDS[settings.kind], settings.seed, locFields(locations))
  const floor = settings.water ? (x: number, z: number) => Math.max(height(x, z), 0) : height

  const poses: Record<string, Pose> = {}
  const landmarkBase: Record<string, Vector3> = {}
  const signals: Record<string, Vector3> = {}
  const envs: Record<string, EnvState> = {}

  for (const loc of locations) {
    const [cx, cz] = loc.center
    const camX = cx + loc.camera.at[0]
    const camZ = cz + loc.camera.at[1]
    const camY = floor(camX, camZ) + loc.camera.eye

    const lx = cx + loc.landmark.at[0]
    const lz = cz + loc.landmark.at[1]
    const groundAtLandmark = loc.landmark.kind === 'none' ? floor(lx, lz) : height(lx, lz)
    const base = new Vector3(lx, groundAtLandmark + (loc.landmark.y ?? 0), lz)
    // Geysers vent at the surface of the water when they sit below it.
    if (loc.landmark.kind === 'geyser' && settings.water) base.y = Math.max(base.y, 0)
    landmarkBase[loc.id] = base

    const signal = base.clone()
    signal.y += loc.signalHeight
    signals[loc.id] = signal

    const dx = signal.x - camX
    const dz = signal.z - camZ
    const yaw = Math.atan2(dx, -dz) + (loc.camera.yawOffset ?? 0)
    const flat = Math.hypot(dx, dz)
    const aim = Math.atan2(signal.y - camY, flat)
    const pitch = aim * 0.55 + loc.camera.pitch

    poses[loc.id] = { pos: new Vector3(camX, camY, camZ), yaw, pitch }
    envs[loc.id] = envFromLocation(loc, camY)
    envs[loc.id].ringYaw = yaw
  }

  Object.assign(surface, {
    planet,
    settings,
    locations,
    height,
    floor,
    poses,
    landmarkBase,
    signals,
    envs,
    env: cloneEnv(envs[locations[0].id]),
  })
  return surface
}
