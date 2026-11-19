import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { director, pointer, telemetry } from '../../state/director'
import { quality, useExperience } from '../../state/useExperience'
import { approach, atmosphereFx, bezier, bezierTangent, cruise, lerpAngle, scanFx, travelFx } from '../motion'
import { cloneEnv, lerpEnv, type EnvState } from './env'
import { forward, surface, type Pose } from './world'

/** Copies values (never references) so stored environments stay untouched. */
function copyEnv(src: EnvState, dst: EnvState) {
  lerpEnv(src, src, 0, dst)
}

type Mode = 'landing' | 'free' | 'travel' | 'climb'

/**
 * How far below the horizon the camera looks where the surface hands over to
 * orbit (and back). Matches the orbital entry view, so the horizon sits at
 * the same height on both sides of the switch.
 */
export const HANDOVER_PITCH = -0.14

/** Mutable surface camera state, driven by the explore director's tweens. */
export const surfaceCam = {
  mode: 'landing' as Mode,
  /** Flight progress, a linear clock tweened 0 → 1 (eased here). */
  t: 0,
  from: { pos: new Vector3(), yaw: 0, pitch: 0 } as Pose,
  fromEnv: null as EnvState | null,
  /** Flight path control points and whether the flight began already moving. */
  p1: new Vector3(),
  p2: new Vector3(),
  momentum: false,
  /** Climb back to orbit, tweened 0 → 1 (already eased), from `climbFrom`. */
  climb: 0,
  /** Seconds since the climb began (tweened linearly), and the velocity it began with. */
  climbClock: 0,
  climbVel: new Vector3(),
  climbFrom: { pos: new Vector3(), yaw: 0, pitch: 0 } as Pose,
  /** The visitor's own look offsets (drag), relative to the location pose. */
  lookYaw: 0,
  lookPitch: 0,
  /** How quickly the view follows lookYaw / lookPitch (slower while the scanner aims). */
  lookRate: 8,
  /** Ambient drift amount, 0 → 1. Eases in after every arrival, so it never jumps. */
  drift: 0,
  /** What the camera actually shows this frame. */
  current: { pos: new Vector3(), yaw: 0, pitch: 0 } as Pose,
  /** Measured velocity (units/s), for momentum when a flight is redirected. */
  vel: new Vector3(),
  prev: new Vector3(),
  hasPrev: false,
  roll: 0,
  /** Field-of-view widening from flight speed (degrees, damped). */
  speedKick: 0,
}

/**
 * Starts a flight from wherever the camera is to `to`. The path is a cubic
 * Bézier that leaves along the current heading (or current motion, when a
 * flight is redirected) and arrives along the destination's heading, lifted
 * high enough to clear the ground between them. Returns the flight's
 * duration: shorter than asked when a fast flight is redirected nearby, so it
 * keeps its speed instead of braking hard.
 */
export function beginTravel(to: Pose, duration: number) {
  const c = surfaceCam.current
  const from = surfaceCam.from
  from.pos.copy(c.pos)
  from.yaw = c.yaw
  from.pitch = c.pitch
  surfaceCam.fromEnv = surface.env ? cloneEnv(surface.env) : null
  surfaceCam.lookYaw = 0
  surfaceCam.lookPitch = 0

  const L = from.pos.distanceTo(to.pos)
  // Clearance: the highest ground under the straight line, plus air.
  let highest = -Infinity
  for (let i = 0; i <= 24; i++) {
    tmp.lerpVectors(from.pos, to.pos, i / 24)
    highest = Math.max(highest, surface.floor(tmp.x, tmp.z))
  }
  const ends = (from.pos.y + to.pos.y) / 2
  // The Bézier's midpoint rises 0.75 × lift above the ends' mean.
  const lift = Math.max(36 + L * 0.07, (highest + 34 - ends) / 0.75)

  const speed = surfaceCam.vel.length()
  surfaceCam.momentum = surfaceCam.mode === 'travel' && speed > (L / duration) * 0.15
  if (surfaceCam.momentum) {
    duration = MathUtils.clamp((1.5 * L) / speed, 2.4, duration)
    surfaceCam.p1.copy(surfaceCam.vel).multiplyScalar(duration / 3)
    if (surfaceCam.p1.length() > L * 0.5) surfaceCam.p1.setLength(L * 0.5)
    surfaceCam.p1.add(from.pos)
    surfaceCam.p1.y = Math.max(surfaceCam.p1.y, from.pos.y + lift * 0.6)
  } else {
    forward(from.yaw, 0, tmp)
    surfaceCam.p1.copy(from.pos).addScaledVector(tmp, L * 0.32)
    surfaceCam.p1.y = from.pos.y + lift
  }
  forward(to.yaw, 0, tmp)
  surfaceCam.p2.copy(to.pos).addScaledVector(tmp, -L * 0.42)
  surfaceCam.p2.y = to.pos.y + lift

  // Arrival eases the drift and look offsets back in, from zero, so nothing jumps.
  surfaceCam.drift = 0
  smooth.yaw = 0
  smooth.pitch = 0
  surfaceCam.t = 0
  surfaceCam.mode = 'travel'
  return duration
}

/** Starts the climb back to orbit from wherever the camera is now (even mid-flight). */
export function beginClimb() {
  const c = surfaceCam.current
  surfaceCam.climbFrom.pos.copy(c.pos)
  surfaceCam.climbFrom.yaw = c.yaw
  surfaceCam.climbFrom.pitch = c.pitch
  surfaceCam.climb = 0
  surfaceCam.climbClock = 0
  // Leaving mid-flight: the flight's motion carries on and bleeds away.
  surfaceCam.climbVel.copy(surfaceCam.mode === 'travel' ? surfaceCam.vel : tmp.set(0, 0, 0))
  surfaceCam.drift = 0
  surfaceCam.mode = 'climb'
}

const UP = new Vector3(0, 1, 0)
const tmp = new Vector3()
const dir = new Vector3()
const back = new Vector3()
const right = new Vector3()
const target = new Vector3()
const projected = new Vector3()
const smooth = { yaw: 0, pitch: 0, px: 0, py: 0 }
const m = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function SurfaceRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)

  // Drag to look around (mouse and touch). Clicks on the signal still work:
  // R3F ignores clicks that moved more than a few pixels.
  useEffect(() => {
    const el = gl.domElement
    let dragging = false
    let lx = 0
    let ly = 0
    const down = (e: PointerEvent) => {
      if (director.space !== 'surface' || surfaceCam.mode !== 'free') return
      dragging = true
      lx = e.clientX
      ly = e.clientY
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      surfaceCam.lookYaw += (e.clientX - lx) * 0.0035
      surfaceCam.lookPitch = MathUtils.clamp(surfaceCam.lookPitch - (e.clientY - ly) * 0.003, -0.55, 0.5)
      lx = e.clientX
      ly = e.clientY
    }
    const up = () => {
      dragging = false
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl])

  useFrame((_, delta) => {
    if (director.space !== 'surface' || !surface.env) {
      surfaceCam.hasPrev = false
      return
    }
    const { location, motionPaused, reducedMotion, phase } = useExperience.getState()
    if (!location) return
    const pose = surface.poses[location]
    if (!pose) return
    const dt = Math.min(Math.max(delta, 1 / 240), 1 / 20)
    const c = surfaceCam.current
    const live = !motionPaused && !reducedMotion
    let rollTarget = 0

    switch (surfaceCam.mode) {
      case 'landing': {
        // A long glide in from high above and behind the location, down through
        // the cloud layer, levelling onto the location's view as it slows.
        const L = director.landing
        const far = 1 - L
        forward(pose.yaw, 0, back).multiplyScalar(-1)
        c.pos
          .copy(pose.pos)
          .addScaledVector(back, far * 640)
          .addScaledVector(UP, Math.pow(far, 1.7) * 520 + far * 26)
        c.pos.y = Math.max(c.pos.y, surface.floor(c.pos.x, c.pos.z) + 14 + far * 30)
        c.yaw = pose.yaw + far * 0.22
        c.pitch = MathUtils.lerp(HANDOVER_PITCH, pose.pitch, MathUtils.smootherstep(L, 0.12, 1))
        copyEnv(surface.envs[location], surface.env)
        if (phase === 'surface' && L >= 0.999) {
          surfaceCam.mode = 'free'
          surfaceCam.drift = 0
          smooth.yaw = 0
          smooth.pitch = 0
        }
        break
      }
      case 'climb': {
        // Rising away from the ground along the current heading, the view
        // settling onto the horizon as the land falls away.
        const a = surfaceCam.climb
        const from = surfaceCam.climbFrom
        forward(from.yaw, 0, tmp)
        c.pos
          .copy(from.pos)
          .addScaledVector(tmp, a * 420)
          .addScaledVector(UP, Math.pow(a, 1.5) * 560 + a * 18)
        // Any motion carried over from an interrupted flight, decaying (τ = 0.8 s).
        const carry = 0.8 * (1 - Math.exp(-surfaceCam.climbClock / 0.8))
        c.pos.addScaledVector(surfaceCam.climbVel, carry)
        c.pos.y = Math.max(c.pos.y, surface.floor(c.pos.x, c.pos.z) + 10)
        c.yaw = from.yaw + a * 0.12
        c.pitch = MathUtils.lerp(from.pitch, HANDOVER_PITCH, MathUtils.smootherstep(a, 0, 0.55))
        copyEnv(surface.envs[location], surface.env)
        break
      }
      case 'travel': {
        const t = surfaceCam.t
        const from = surfaceCam.from
        const e = surfaceCam.momentum ? cruise(t) : approach(t)
        bezier(c.pos, from.pos, surfaceCam.p1, surfaceCam.p2, pose.pos, e)
        // Never skim through the ground.
        c.pos.y = Math.max(c.pos.y, surface.floor(c.pos.x, c.pos.z) + 8)
        // Face where we're going: the path's heading in the middle, the start
        // and end headings at either end (they agree with the path's tangents).
        bezierTangent(tmp, from.pos, surfaceCam.p1, surfaceCam.p2, pose.pos, e)
        const flat = Math.hypot(tmp.x, tmp.z)
        const pathYaw = flat > 1e-3 ? Math.atan2(tmp.x, -tmp.z) : pose.yaw
        const pathPitch = MathUtils.clamp(Math.atan2(tmp.y, Math.max(flat, 1e-3)) * 0.4 - 0.08, -0.35, 0.2)
        // (Only a redirected flight needs the start blend: its tangent is its velocity.)
        const wStart = 1 - MathUtils.smoothstep(e, 0, surfaceCam.momentum ? 0.2 : 0.06)
        const wEnd = MathUtils.smoothstep(e, 0.86, 1)
        const prevYaw = c.yaw
        c.yaw = lerpAngle(lerpAngle(pathYaw, from.yaw, wStart), pose.yaw, wEnd)
        c.pitch = MathUtils.lerp(MathUtils.lerp(pathPitch, from.pitch, wStart), pose.pitch, wEnd)
        // A slight bank into turns (at most ~3°).
        if (live) rollTarget = MathUtils.clamp(-lerpAngle(0, c.yaw - prevYaw, 1) / dt * 0.3, -0.05, 0.05)
        if (surfaceCam.fromEnv) lerpEnv(surfaceCam.fromEnv, surface.envs[location], MathUtils.smoothstep(e, 0.1, 0.9), surface.env)
        break
      }
      case 'free': {
        // Mouse position adds a slight parallax; touch uses drag only.
        const allow = live && !quality.coarse
        smooth.px = MathUtils.damp(smooth.px, allow ? pointer.x : 0, 2.2, dt)
        smooth.py = MathUtils.damp(smooth.py, allow ? pointer.y : 0, 2.2, dt)
        smooth.yaw = MathUtils.damp(smooth.yaw, surfaceCam.lookYaw, surfaceCam.lookRate, dt)
        smooth.pitch = MathUtils.damp(smooth.pitch, surfaceCam.lookPitch, surfaceCam.lookRate, dt)
        // Ambient drift: slow, incommensurate swells in position and view, so
        // the world feels alive. Eases in after arriving; stops when paused.
        surfaceCam.drift = MathUtils.damp(surfaceCam.drift, live ? 1 : 0, 0.55, dt)
        const k = surfaceCam.drift
        const T = director.time
        forward(pose.yaw, 0, tmp)
        right.set(Math.cos(pose.yaw), 0, Math.sin(pose.yaw))
        c.pos
          .copy(pose.pos)
          .addScaledVector(right, (Math.sin(T * 0.11) * 1.5 + Math.sin(T * 0.27 + 1.3) * 0.5) * k)
          .addScaledVector(UP, Math.sin(T * 0.17 + 0.4) * 0.6 * k)
          .addScaledVector(tmp, Math.sin(T * 0.07 + 2.1) * 1.0 * k)
        c.pos.y = Math.max(c.pos.y, surface.floor(c.pos.x, c.pos.z) + 3)
        const driftYaw = Math.sin(T * 0.13 + 0.7) * 0.016 + Math.sin(T * 0.31) * 0.005
        const driftPitch = Math.sin(T * 0.19 + 1.1) * 0.009
        c.yaw = pose.yaw + smooth.yaw + (smooth.px * 0.06 + driftYaw) * k
        c.pitch = MathUtils.clamp(pose.pitch + smooth.pitch + (driftPitch - smooth.py * 0.035) * k, -1.2, 1.2)
        copyEnv(surface.envs[location], surface.env)
        break
      }
    }

    // Velocity (momentum for redirected flights) and speed (FOV breathing).
    if (surfaceCam.hasPrev) {
      tmp.subVectors(c.pos, surfaceCam.prev).divideScalar(dt)
      surfaceCam.vel.lerp(tmp, 1 - Math.exp(-12 * dt))
    } else surfaceCam.vel.set(0, 0, 0)
    surfaceCam.prev.copy(c.pos)
    surfaceCam.hasPrev = true
    const flying = surfaceCam.mode === 'travel' && live
    travelFx.speed = MathUtils.damp(travelFx.speed, flying ? Math.min(1, surfaceCam.vel.length() / 160) : 0, 3, dt)
    // Speed widens the view in flight; a scan narrows it (scanFx.zoom is already eased).
    surfaceCam.speedKick = MathUtils.damp(surfaceCam.speedKick, flying ? travelFx.speed * 3 : 0, 3, dt)
    director.fovKick = surfaceCam.speedKick - scanFx.zoom
    surfaceCam.roll = MathUtils.damp(surfaceCam.roll, rollTarget, 3, dt)

    camera.position.copy(c.pos)
    forward(c.yaw, c.pitch, dir)
    target.copy(c.pos).add(dir)
    camera.up.copy(UP)
    if (Math.abs(surfaceCam.roll) > 1e-4) camera.up.applyAxisAngle(dir, surfaceCam.roll)
    camera.lookAt(target)
    atmosphereFx.up.copy(UP)
    atmosphereFx.dip = 0

    // Readout: height above the ground (or sea, or cloud tops).
    const above = Math.max(0, (c.pos.y - surface.floor(c.pos.x, c.pos.z)) * 10)
    const deck = surface.settings?.kind === 'deck' || surface.settings?.kind === 'giant'
    telemetry.readout = `${deck ? 'Above the cloud tops' : 'Altitude'} ${m.format(Math.round(above / 10) * 10)} m`

    // Signal position for its DOM label.
    const s = surface.signals[location]
    const sig = telemetry.signal
    if (s) {
      camera.updateMatrixWorld()
      projected.copy(s).project(camera)
      sig.x = (projected.x * 0.5 + 0.5) * size.width
      sig.y = (-projected.y * 0.5 + 0.5) * size.height
      sig.visible = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1
    } else sig.visible = false
  })

  return null
}
