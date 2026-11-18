import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { director, labels, PLANET_RADIUS_KM, pointer, telemetry } from '../state/director'
import { quality, useExperience } from '../state/useExperience'
import { baseFov } from './Warp'

const FRAME_LANDSCAPE = 0.62 // planet disc as a fraction of viewport height
const FRAME_PORTRAIT = 0.8 // …or of viewport width on tall screens

/** Distance at which a unit sphere fills `fraction` of the limiting viewport axis. */
function framingDistance(aspect: number) {
  // Use the base FOV, not the live one, so the warp's FOV kick never moves the camera.
  const halfV = MathUtils.degToRad(baseFov('vael', aspect) / 2)
  const tanV = Math.tan(halfV)
  const tanH = tanV * aspect
  const byHeight = 1 / Math.sin(Math.atan(FRAME_LANDSCAPE * tanV))
  const byWidth = 1 / Math.sin(Math.atan(FRAME_PORTRAIT * tanH))
  return Math.max(byHeight, byWidth)
}

const base = new Vector3()
const lookTarget = new Vector3()
const orbitPos = new Vector3()
const orbitLook = new Vector3()
const drift = new Vector3()
const projected = new Vector3()
const km = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Close pass over the sunlit limb — the first beat of the jump to the galaxy. */
const LOW_ORBIT_POS = new Vector3(0.18, 0.86, 1.05)
const LOW_ORBIT_LOOK = new Vector3(0.32, 1.45, -1.4)

export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const motionPaused = useExperience((s) => s.motionPaused)
  const reducedMotion = useExperience((s) => s.reducedMotion)
  const smoothPointer = useRef({ x: 0, y: 0 })

  useFrame((_, delta) => {
    if (director.space !== 'vael') return
    const dt = Math.min(delta, 1 / 20)
    const aspect = size.width / size.height
    const distance = framingDistance(aspect)

    // Arrival: a long curved approach that settles on the framing distance.
    const a = director.arrival
    const far = 1 - a
    base.set(-1.6 * far, 0.9 * far, distance * (1 + 4.2 * far))
    lookTarget.set(0, 0, 0)

    // Pointer drift (mouse position, or one-finger drag on touch): damped and small.
    const driftOn = !motionPaused && !reducedMotion
    const tx = driftOn ? pointer.x : 0
    const ty = driftOn ? pointer.y : 0
    const follow = quality.coarse ? 4 : 2.2
    smoothPointer.current.x = MathUtils.damp(smoothPointer.current.x, tx, follow, dt)
    smoothPointer.current.y = MathUtils.damp(smoothPointer.current.y, ty, follow, dt)
    const sp = smoothPointer.current
    drift.set(sp.x * 0.34, -sp.y * 0.22, 0).multiplyScalar(distance / 4.5)

    // Dive: blend toward the low-orbit shot.
    const d = director.dive
    orbitPos.copy(base).add(drift).lerp(LOW_ORBIT_POS, d)
    orbitLook.copy(lookTarget).lerp(LOW_ORBIT_LOOK, d)
    // Keep a little drift alive in low orbit too.
    orbitPos.addScaledVector(drift, d * 0.12)

    camera.position.copy(orbitPos)
    camera.lookAt(orbitLook)
    camera.rotateZ(-0.06 * far + sp.x * -0.012)

    telemetry.altitudeKm = (camera.position.length() - 1) * PLANET_RADIUS_KM
    telemetry.readout = `Altitude ${km.format(Math.round(telemetry.altitudeKm / 10) * 10)} km`

    // Project Ithra for its DOM label.
    camera.updateMatrixWorld()
    projected.copy(labels.ithra).project(camera)
    const t = telemetry.ithra
    t.x = (projected.x * 0.5 + 0.5) * size.width
    t.y = (-projected.y * 0.5 + 0.5) * size.height
    t.visible = projected.z < 1 && Math.abs(projected.x) < 0.94 && Math.abs(projected.y) < 0.9
  })

  return null
}
