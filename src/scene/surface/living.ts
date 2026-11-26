import { Color, Vector2 } from 'three'
import type { WorldId } from '../../data/planets'
import { lerpEnv, sunVector, type EnvState, type SurfaceUniforms } from './env'

/**
 * Phase 7 (Living Universe): what keeps a surface alive between the authored
 * moments. Each frame it takes the location's environment (already blended by
 * the camera rig) and lets it breathe:
 *
 * - **Day–night drift**: Elys swings slowly in azimuth and elevation on a
 *   seven-minute cycle. It never crosses the horizon (a day scene stays day, a
 *   night scene stays night), the light warms as it lowers, and the sky follows.
 * - **Wind**: each world has its own prevailing wind; gusts vary its strength.
 *   The shaders read an *integrated* drift, so gusts change speed, never jump.
 * - **Weather**: cloud cover thickens and thins a little over minutes.
 *
 * It writes a drifted copy, never the stored environment, so nothing compounds.
 */

/** Prevailing winds in noise units per second (direction and strength per world). */
const WIND: Record<WorldId, [number, number]> = {
  aurelis: [0.012, 0.004],
  nyx: [0.006, -0.003],
  solara: [0.021, 0.006],
  vesper: [0.016, -0.006],
  thalassa: [0.014, 0.009],
  orion: [0.024, 0.0],
  liris: [0.01, 0.007],
}

/** Each world starts its cycle somewhere different, so they never feel in sync. */
const PHASE: Record<WorldId, number> = { aurelis: 0.4, nyx: 2.1, solara: 1.2, vesper: 3.3, thalassa: 4.6, orion: 5.4, liris: 0.9 }

const CYCLE = 420 // seconds

export const living = {
  drift: new Vector2(),
  wind: new Vector2(),
  gust: 1,
  /** 0 → 1 position in the light cycle (for sound and debugging). */
  phase: 0,
}

let scratch: EnvState | null = null
const lowLight = new Color()

/** Advances the wind and returns this frame's drifted environment. */
export function liveEnv(
  env: EnvState,
  u: SurfaceUniforms,
  planet: WorldId,
  time: number,
  dt: number,
  options: { reduced: boolean; paused: boolean; gust?: number },
): EnvState {
  // Copy (never mutate the stored environment).
  if (!scratch) scratch = { ...env, sunDir: env.sunDir.clone(), sunColor: env.sunColor.clone(), sun2Dir: env.sun2Dir.clone(), sun2Color: env.sun2Color.clone(), zenith: env.zenith.clone(), horizon: env.horizon.clone(), ground: env.ground.clone(), cloudColor: env.cloudColor.clone() }
  const out = lerpEnv(env, env, 0, scratch)

  // Wind: prevailing direction, gusting strength, integrated into a drift.
  const [wx, wz] = WIND[planet]
  living.gust = options.reduced ? 1 : 1 + 0.35 * Math.sin(time * 0.07) + 0.15 * Math.sin(time * 0.23 + 1.7)
  // Cinematic pass: a gust event (Solara) drives the wind up to ~2.5×, integrated, so it never jumps.
  // A third, slower term keeps the gusting from settling into one obvious rhythm.
  if (!options.reduced) living.gust *= (1 + 0.12 * Math.sin(time * 0.031 + 4.2)) * (1 + 1.5 * (options.gust ?? 0))
  if (!options.paused) living.drift.x += wx * living.gust * dt * (options.reduced ? 0.5 : 1)
  if (!options.paused) living.drift.y += wz * living.gust * dt * (options.reduced ? 0.5 : 1)
  living.wind.set(wx, wz)
  u.uWind.value.copy(living.wind)
  u.uDrift.value.copy(living.drift)
  u.uLive.value = options.reduced ? 0 : 1

  // Light: a slow swing of Elys that keeps the scene on its side of the horizon.
  const ph = (time / CYCLE) * Math.PI * 2 + PHASE[planet]
  living.phase = (((ph / (Math.PI * 2)) % 1) + 1) % 1
  const elev = Math.asin(Math.max(-1, Math.min(1, out.sunDir.y)))
  const az = Math.atan2(out.sunDir.x, -out.sunDir.z)
  const amp = Math.min(0.07, Math.max(0.015, Math.abs(elev) * 0.45))
  let e = elev + amp * Math.sin(ph)
  e = elev >= 0 ? Math.max(e, 0.02) : Math.min(e, -0.02)
  sunVector(e, az + 0.28 * Math.sin(ph * 0.5 + 0.7), out.sunDir)
  // A second sun crosses the sky with the first (the same day passing), keeping
  // their authored separation but for a slight wobble: Tessaly's pair turning.
  if (out.sun2Color.r + out.sun2Color.g + out.sun2Color.b > 0) {
    const e2 = Math.asin(Math.max(-1, Math.min(1, out.sun2Dir.y)))
    const az2 = Math.atan2(out.sun2Dir.x, -out.sun2Dir.z)
    const amp2 = Math.min(0.07, Math.max(0.015, Math.abs(e2) * 0.45))
    let f = e2 + amp2 * Math.sin(ph + 0.6)
    f = e2 >= 0 ? Math.max(f, 0.02) : Math.min(f, -0.02)
    sunVector(f, az2 + 0.28 * Math.sin(ph * 0.5 + 0.7) + 0.06 * Math.sin(ph * 1.7), out.sun2Dir)
  }

  // As Elys lowers the light warms toward its own colour at the horizon; higher, it brightens a touch.
  const k = Math.sin(ph)
  out.sunColor.multiplyScalar(1 + 0.08 * k)
  out.zenith.multiplyScalar(1 + 0.05 * k)
  lowLight.copy(env.sunColor)
  out.horizon.lerp(lowLight, 0.07 * Math.max(0, -k) * (elev > 0 ? 1 : 0.4))

  // Weather breathes: cover drifts a little where there are clouds at all.
  if (out.cloudCover > 0.03) {
    out.cloudCover = Math.min(0.98, Math.max(0.02, out.cloudCover + 0.05 * Math.sin(time * 0.021 + 1.3) + 0.03 * Math.sin(time * 0.057)))
  }
  return out
}
