import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { Color, MathUtils, Vector3 } from 'three'

/**
 * The journey's shared choreography: one set of eases, durations and path
 * helpers used by every camera rig and director, so travel in space, entry,
 * flights over a surface and the climb back out all move with one hand.
 *
 * Tweens drive a linear clock (`t`, 0 → 1); the rigs shape it with these
 * eases each frame. Position and orientation can then follow different curves
 * from the same clock (aim first, then accelerate).
 */

gsap.registerPlugin(CustomEase)

/** Gentle acceleration, a long cruise, a long deceleration. Starts at rest. */
export const approach = CustomEase.create('aetherApproach', 'M0,0 C0.46,0 0.14,1 1,1')
/** Already moving: starts at unit speed (matches the incoming velocity), then settles. */
export const cruise = CustomEase.create('aetherCruise', 'M0,0 C0.3,0.3 0.16,1 1,1')
/** A dive that gathers speed, then eases as the air thickens. */
export const entry = CustomEase.create('aetherEntry', 'M0,0 C0.42,0 0.36,0.86 1,1')
/** Arrives moving and decelerates to rest (landing glide, pull-back to orbit). */
export const glide = CustomEase.create('aetherGlide', 'M0,0 C0.24,0.52 0.3,1 1,1')
/** Lifts off slowly and leaves fast (the climb that hands over to orbit). */
export const climb = CustomEase.create('aetherClimb', 'M0,0 C0.5,0 0.72,0.42 1,1')

export const smooth01 = (x: number) => MathUtils.smoothstep(x, 0, 1)
export const window01 = (x: number, a: number, b: number) => MathUtils.smoothstep(x, a, b)

/** Durations in seconds. Reduced motion replaces every move with a short haze crossfade. */
export const DURATION = {
  /** Galaxy travel, by distance in scene units. */
  approach: (distance: number) => MathUtils.clamp(2.3 + distance / 38, 2.7, 4.6),
  /** Orbit → atmosphere (galaxy space). */
  entry: 4.4,
  /** Glide from the haze down to the location (surface space). */
  landing: 6.2,
  /** Surface flight, by distance in scene units. */
  flight: (distance: number) => MathUtils.clamp(3.8 + distance / 360, 4.4, 7.6),
  /** Surface → haze. */
  climb: 3.2,
  /** Haze → the world's orbit view. */
  pullBack: 4.4,
  /** Reduced motion: fade into the haze, and out of it. */
  reducedIn: 0.5,
  reducedOut: 0.7,
} as const

/** Cubic Bézier point. */
export function bezier(out: Vector3, p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number) {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return out.set(
    a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    a * p0.z + b * p1.z + c * p2.z + d * p3.z,
  )
}

/** Cubic Bézier tangent (unnormalised). */
export function bezierTangent(out: Vector3, p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number) {
  const u = 1 - t
  const a = 3 * u * u
  const b = 6 * u * t
  const c = 3 * t * t
  return out.set(
    a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x),
    a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y),
    a * (p1.z - p0.z) + b * (p2.z - p1.z) + c * (p3.z - p2.z),
  )
}

/** Shortest-way angle interpolation. */
export function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/**
 * The atmosphere the camera is passing through, shared by the galaxy and
 * surface spaces so the hand-over between them is one continuous haze.
 * `director.atmo` is its density; the rigs write the local up vector, and the
 * directors set the colours per world and location.
 */
export const atmosphereFx = {
  /** Horizon (lower) and zenith (upper) colours of the haze. */
  low: new Color('#6FB6FF'),
  high: new Color('#132056'),
  /** Orbit colours, blended toward the sky colours as the haze thickens. */
  orbitLow: new Color('#6FB6FF'),
  orbitHigh: new Color('#132056'),
  skyLow: new Color('#6FB6FF'),
  skyHigh: new Color('#132056'),
  /** Local vertical at the camera (world space), for the horizon line. */
  up: new Vector3(0, 1, 0),
  /** How far the visible horizon sits below the local horizontal (rad): a planet's limb seen from altitude. */
  dip: 0,
  /** How fast cloud wisps stream past, 0 → still. */
  flow: 0,
}

/** Movement shared by rigs for parallax effects (near dust, FOV breathing). */
export const travelFx = {
  /** 0 → at rest, 1 → full cruise. Damped. */
  speed: 0,
}

/** Phase 6 scanner effects, tweened by ui/scanner and read by the scene and the DOM each frame. */
export const scanFx = {
  /** The discovery the effects belong to (stays set while the completion plays out). */
  target: null as string | null,
  /** Ring fill, 0 → 1. */
  progress: 0,
  /** Beam height at the target, 0 → 1. */
  beam: 0,
  /** Completion pulse, 0 → 1 (expanding ring in the scene and on screen). */
  pulse: 0,
  /** Field-of-view narrowing while scanning, in degrees. */
  zoom: 0,
}

/** Signal bloom, tweened on discovery and read by the 3D signal each frame. */
export const signalFx = { bloom: 0 }
