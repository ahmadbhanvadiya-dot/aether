import { Color, Vector2, Vector3, Vector4 } from 'three'
import type { LocationData, SurfaceSettings } from '../../data/locations'

/**
 * The blended light and weather of the current surface view. Every surface
 * material references the same uniform objects, so one update per frame
 * moves the whole environment between locations.
 */
export interface EnvState {
  sunDir: Vector3
  sunColor: Color
  zenith: Color
  horizon: Color
  ground: Color
  fog: number
  stars: number
  aurora: number
  lightning: number
  rain: number
  waves: number
  waterGlow: number
  fissure: number
  mirror: number
  cloudHeight: number
  cloudCover: number
  cloudColor: Color
  motes: number
  ringLat: number
  /** The view direction the rings arch across (set from the camera pose). */
  ringYaw: number
}

export function sunVector(elev: number, azim: number, out = new Vector3()) {
  return out.set(Math.cos(elev) * Math.sin(azim), Math.sin(elev), -Math.cos(elev) * Math.cos(azim))
}

export function envFromLocation(loc: LocationData, groundAtCamera: number): EnvState {
  const e = loc.env
  const cloudHeight = e.cloudHeight < 0 ? groundAtCamera - 34 : e.cloudHeight
  return {
    sunDir: sunVector(e.sun[0], e.sun[1]),
    sunColor: new Color(e.sunColor),
    zenith: new Color(e.zenith),
    horizon: new Color(e.horizon),
    ground: new Color(e.ground),
    fog: e.fog,
    stars: e.stars,
    aurora: e.aurora,
    lightning: e.lightning,
    rain: e.rain,
    waves: e.waves,
    waterGlow: e.waterGlow,
    fissure: e.fissure,
    mirror: e.mirror,
    cloudHeight,
    cloudCover: e.cloudCover,
    cloudColor: new Color(e.cloudColor),
    motes: e.motes,
    ringLat: e.ringLat,
    ringYaw: 0,
  }
}

export function cloneEnv(e: EnvState): EnvState {
  return {
    ...e,
    sunDir: e.sunDir.clone(),
    sunColor: e.sunColor.clone(),
    zenith: e.zenith.clone(),
    horizon: e.horizon.clone(),
    ground: e.ground.clone(),
    cloudColor: e.cloudColor.clone(),
  }
}

const NUMERIC = [
  'fog',
  'stars',
  'aurora',
  'lightning',
  'rain',
  'waves',
  'waterGlow',
  'fissure',
  'mirror',
  'cloudHeight',
  'cloudCover',
  'motes',
  'ringLat',
  'ringYaw',
] as const

export function lerpEnv(a: EnvState, b: EnvState, t: number, out: EnvState) {
  out.sunDir.copy(a.sunDir).lerp(b.sunDir, t).normalize()
  out.sunColor.copy(a.sunColor).lerp(b.sunColor, t)
  out.zenith.copy(a.zenith).lerp(b.zenith, t)
  out.horizon.copy(a.horizon).lerp(b.horizon, t)
  out.ground.copy(a.ground).lerp(b.ground, t)
  out.cloudColor.copy(a.cloudColor).lerp(b.cloudColor, t)
  for (const k of NUMERIC) out[k] = a[k] + (b[k] - a[k]) * t
  return out
}

/** Directions for a world's moons in its sky (fixed, so they feel like places). */
const MOON_DIRS = [
  { dir: new Vector3(-0.55, 0.32, -0.77), size: 0.018 },
  { dir: new Vector3(0.72, 0.18, -0.66), size: 0.009 },
  { dir: new Vector3(0.2, 0.5, 0.84), size: 0.006 },
  { dir: new Vector3(-0.85, 0.42, 0.3), size: 0.004 },
]

export function createSurfaceUniforms(settings: SurfaceSettings) {
  const moons = MOON_DIRS.map((m, i) =>
    i < settings.moons ? new Vector4(...m.dir.clone().normalize().toArray(), m.size) : new Vector4(0, 1, 0, 0),
  )
  return {
    uSunDir: { value: new Vector3(0, 1, 0) },
    uSunColor: { value: new Color() },
    uZenith: { value: new Color() },
    uHorizon: { value: new Color() },
    uGround: { value: new Color() },
    uFog: { value: 0.001 },
    uStars: { value: 0 },
    uAurora: { value: 0 },
    uFlash: { value: 0 },
    uFlashDir: { value: new Vector3(1, 0.2, 0).normalize() },
    uTime: { value: 0 },
    uMoons: { value: moons },
    uRings: { value: settings.rings ? 1 : 0 },
    uRingLat: { value: 0 },
    uRingYaw: { value: 0 },
    uFissure: { value: 0 },
    uMirror: { value: 0 },
    uWaves: { value: 0 },
    uWaterGlow: { value: 0 },
    uCloudCover: { value: 0 },
    uCloudColor: { value: new Color() },
    uCloudHeight: { value: 100 },
    uRain: { value: 0 },
    uMotes: { value: 0 },
    uPalette: { value: settings.palette.map((c) => new Color(c)) },
    uWaterDeep: { value: new Color(settings.waterDeep) },
    uWaterShallow: { value: new Color(settings.waterShallow) },
    uWind: { value: new Vector2(0, 0) },
    /** Phase 7: integrated wind (shaders advect with this, so gusts never jump) and motion allowance. */
    uDrift: { value: new Vector2(0, 0) },
    uLive: { value: 1 },
    /**
     * Overhaul: the world's occasional event (an eruption on Nyx, a dust devil on
     * Solara, a meteor or a break in the clouds on Aurelis, a deep storm on Orion):
     * its direction from the camera, and x = strength 0 → 1, y = progress 0 → 1.
     */
    uEventDir: { value: new Vector3(1, 0.05, 0).normalize() },
    uEvent: { value: new Vector2(0, 0) },
    /** Overhaul: a discovery's light wave across the ground (xyz = where, w = progress 0 → 1). */
    uReveal: { value: new Vector4(0, 0, 0, 0) },
    uRevealColor: { value: new Color(settings.glow) },
    uLocA: { value: [new Vector4(), new Vector4(), new Vector4()] },
    uLocB: { value: [new Vector4(), new Vector4(), new Vector4()] },
  }
}

export type SurfaceUniforms = ReturnType<typeof createSurfaceUniforms>

export function applyEnv(u: SurfaceUniforms, e: EnvState) {
  u.uSunDir.value.copy(e.sunDir)
  u.uSunColor.value.copy(e.sunColor)
  u.uZenith.value.copy(e.zenith)
  u.uHorizon.value.copy(e.horizon)
  u.uGround.value.copy(e.ground)
  u.uFog.value = e.fog
  u.uStars.value = e.stars
  u.uAurora.value = e.aurora
  u.uRingLat.value = e.ringLat
  u.uRingYaw.value = e.ringYaw
  u.uFissure.value = e.fissure
  u.uMirror.value = e.mirror
  u.uWaves.value = e.waves
  u.uWaterGlow.value = e.waterGlow
  u.uCloudCover.value = e.cloudCover
  u.uCloudColor.value.copy(e.cloudColor)
  u.uCloudHeight.value = e.cloudHeight
  u.uRain.value = e.rain
  u.uMotes.value = e.motes
}
