import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { director, pointer, telemetry } from '../../state/director'
import { quality, useExperience } from '../../state/useExperience'
import { cloneEnv, lerpEnv, type EnvState } from './env'

/** Copies values (never references) so stored environments stay untouched. */
function copyEnv(src: EnvState, dst: EnvState) {
  lerpEnv(src, src, 0, dst)
}
import { forward, surface, type Pose } from './world'

type Mode = 'landing' | 'free' | 'travel'

/** Mutable surface camera state, driven by the explore director's tweens. */
export const surfaceCam = {
  mode: 'landing' as Mode,
  /** Travel progress, tweened 0 → 1. */
  t: 0,
  from: { pos: new Vector3(), yaw: 0, pitch: 0 } as Pose,
  fromEnv: null as EnvState | null,
  /** The visitor's own look offsets (drag), relative to the location pose. */
  lookYaw: 0,
  lookPitch: 0,
  /** What the camera actually shows this frame. */
  current: { pos: new Vector3(), yaw: 0, pitch: 0 } as Pose,
}

/** Starts a flight from wherever the camera is to `toId`'s pose. */
export function beginTravel() {
  const c = surfaceCam.current
  surfaceCam.from.pos.copy(c.pos)
  surfaceCam.from.yaw = c.yaw
  surfaceCam.from.pitch = c.pitch
  surfaceCam.fromEnv = surface.env ? cloneEnv(surface.env) : null
  surfaceCam.lookYaw = 0
  surfaceCam.lookPitch = 0
  surfaceCam.t = 0
  surfaceCam.mode = 'travel'
}

function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

const UP = new Vector3(0, 1, 0)
const dir = new Vector3()
const back = new Vector3()
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
    if (director.space !== 'surface' || !surface.env) return
    const { location, motionPaused, reducedMotion, phase } = useExperience.getState()
    if (!location) return
    const pose = surface.poses[location]
    if (!pose) return
    const dt = Math.min(delta, 1 / 20)
    const c = surfaceCam.current

    switch (surfaceCam.mode) {
      case 'landing': {
        const L = director.landing
        const far = 1 - L
        forward(pose.yaw, 0, back).multiplyScalar(-1)
        c.pos.copy(pose.pos).addScaledVector(back, far * 140).addScaledVector(UP, far * far * 360 + far * 20)
        c.yaw = pose.yaw + far * 0.5
        c.pitch = MathUtils.lerp(-0.75, pose.pitch, MathUtils.smoothstep(L, 0, 1))
        copyEnv(surface.envs[location], surface.env)
        if (phase === 'surface' && L >= 0.999) {
          surfaceCam.mode = 'free'
          smooth.yaw = 0
          smooth.pitch = 0
        }
        break
      }
      case 'travel': {
        const e = surfaceCam.t
        const from = surfaceCam.from
        const distance = from.pos.distanceTo(pose.pos)
        c.pos.lerpVectors(from.pos, pose.pos, e)
        c.pos.y += Math.sin(Math.PI * e) * (50 + distance * 0.12)
        // Never skim through the ground.
        const minY = surface.floor(c.pos.x, c.pos.z) + 6
        if (e > 0.02 && e < 0.98) c.pos.y = Math.max(c.pos.y, minY)
        c.yaw = lerpAngle(from.yaw, pose.yaw, e)
        c.pitch = MathUtils.lerp(from.pitch, pose.pitch, e) - Math.sin(Math.PI * e) * 0.12
        if (surfaceCam.fromEnv) lerpEnv(surfaceCam.fromEnv, surface.envs[location], e, surface.env)
        break
      }
      case 'free': {
        // Mouse position adds a slight parallax; touch uses drag only.
        const allow = !motionPaused && !reducedMotion && !quality.coarse
        smooth.px = MathUtils.damp(smooth.px, allow ? pointer.x : 0, 2.2, dt)
        smooth.py = MathUtils.damp(smooth.py, allow ? pointer.y : 0, 2.2, dt)
        smooth.yaw = MathUtils.damp(smooth.yaw, surfaceCam.lookYaw, 8, dt)
        smooth.pitch = MathUtils.damp(smooth.pitch, surfaceCam.lookPitch, 8, dt)
        const breathe = motionPaused || reducedMotion ? 0 : Math.sin(director.time * 0.45) * 0.012
        c.pos.copy(pose.pos)
        c.pos.y += breathe
        c.yaw = pose.yaw + smooth.yaw + smooth.px * 0.06
        c.pitch = MathUtils.clamp(pose.pitch + smooth.pitch - smooth.py * 0.035, -1.2, 1.2)
        copyEnv(surface.envs[location], surface.env)
        break
      }
    }

    camera.position.copy(c.pos)
    forward(c.yaw, c.pitch, dir)
    target.copy(c.pos).add(dir)
    camera.up.copy(UP)
    camera.lookAt(target)

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
