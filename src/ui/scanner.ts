import gsap from 'gsap'
import { MathUtils } from 'three'
import { sound } from '../audio/sound'
import { DISCOVERY_BY_ID } from '../data/discoveries'
import { scanFx, signalFx } from '../scene/motion'
import { surfaceCam } from '../scene/surface/SurfaceRig'
import { surface } from '../scene/surface/world'
import { useExploration } from '../state/exploration'
import { useExperience } from '../state/useExperience'

/**
 * Phase 6 scanner. One scan at a time: the camera turns to the target and
 * narrows slightly, a beam rises at the target and a ring fills around it;
 * when the ring closes the discovery is written to the exploration store (the
 * only place progress lives) and its card opens. A scan can be cancelled
 * (Esc) before it completes, and then nothing is saved.
 *
 * `scanFx` (in scene/motion) holds the per-frame values the 3D beam and the DOM ring read.
 */

export { scanFx }

/** Scan length in seconds (reduced motion: shorter, no camera move or beam). */
const SCAN = 2.4
const SCAN_REDUCED = 1.2

let timeline: gsap.core.Timeline | null = null
let stopTone: (() => void) | null = null

const reduced = () => useExperience.getState().reducedMotion

/** Turns the surface view toward a discovery (relative to the location's pose). */
export function aimAt(id: string) {
  const loc = useExperience.getState().location
  const pose = loc ? surface.poses[loc] : null
  const target = surface.targets[id]
  if (!pose || !target) return
  const c = surfaceCam.current.pos
  const dx = target.x - c.x
  const dy = target.y - c.y
  const dz = target.z - c.z
  const yaw = Math.atan2(dx, -dz)
  const pitch = Math.atan2(dy, Math.hypot(dx, dz))
  let dYaw = (yaw - pose.yaw) % (Math.PI * 2)
  if (dYaw > Math.PI) dYaw -= Math.PI * 2
  if (dYaw < -Math.PI) dYaw += Math.PI * 2
  surfaceCam.lookYaw = dYaw
  surfaceCam.lookPitch = MathUtils.clamp(pitch - pose.pitch, -0.55, 0.5)
  // A slow, deliberate turn (instant for reduced motion).
  surfaceCam.lookRate = reduced() ? 40 : 2.4
}

/** Can this discovery be scanned (or reopened) from where the camera is now? */
export function canScan(id: string) {
  const st = useExperience.getState()
  const d = DISCOVERY_BY_ID[id]
  if (!d || st.phase !== 'surface' || surfaceCam.mode !== 'free') return false
  if (d.location !== st.location) return false
  const found = !!useExploration.getState().discovered[id]
  return d.kind !== 'secret' || found || !!st.detected[id]
}

/**
 * Select a discovery: unfound ones are scanned; found ones turn the view to
 * them and reopen their card (no second scan, nothing saved twice).
 */
export function startScan(id: string) {
  const st = useExperience.getState()
  if (st.scanning || !canScan(id)) return
  sound.unlock()
  aimAt(id)
  if (useExploration.getState().discovered[id]) {
    st.setCard(id)
    return
  }
  st.setCard(null)
  st.setScanning(id)
  timeline?.kill()
  Object.assign(scanFx, { target: id, progress: 0, beam: 0, pulse: 0 })
  const r = reduced()
  const length = r ? SCAN_REDUCED : SCAN
  stopTone = sound.scan(length)
  const tl = gsap.timeline()
  timeline = tl
  tl.to(scanFx, { progress: 1, duration: length, ease: r ? 'none' : 'power1.inOut' }, 0)
  if (!r) {
    tl.to(scanFx, { zoom: 6, duration: 1.3, ease: 'power2.inOut' }, 0).to(
      scanFx,
      { beam: 1, duration: 0.9, ease: 'power2.out' },
      0.2,
    )
  }
  tl.call(() => complete(id), undefined, length)
}

function complete(id: string) {
  stopTone = null
  // The store decides: true only the first time this id is recorded.
  const isNew = useExploration.getState().discover(id)
  if (isNew) sound.chime()
  if (isNew && DISCOVERY_BY_ID[id].kind === 'signal') {
    gsap.fromTo(signalFx, { bloom: reduced() ? 0.4 : 1 }, { bloom: 0, duration: reduced() ? 0.8 : 1.6, ease: 'power2.out' })
  }
  const st = useExperience.getState()
  st.setScanning(null)
  st.setCard(id)
  surfaceCam.lookRate = 8
  const r = reduced()
  const tl = gsap.timeline({ onComplete: () => (scanFx.target = null) })
  timeline = tl
  tl.fromTo(scanFx, { pulse: 0 }, { pulse: 1, duration: r ? 0.6 : 1.6, ease: 'power2.out' }, 0)
    .to(scanFx, { beam: 0, duration: r ? 0.3 : 1.4, ease: 'power2.in' }, r ? 0 : 0.3)
    .to(scanFx, { zoom: 0, duration: r ? 0.3 : 1.8, ease: 'power2.inOut' }, 0.1)
}

/** Stops a scan in progress; nothing is recorded. */
export function cancelScan() {
  const st = useExperience.getState()
  if (!st.scanning) return
  timeline?.kill()
  stopTone?.()
  stopTone = null
  st.setScanning(null)
  surfaceCam.lookRate = 8
  const tl = gsap.timeline({ onComplete: () => (scanFx.target = null) })
  timeline = tl
  tl.to(scanFx, { progress: 0, beam: 0, zoom: 0, duration: 0.4, ease: 'power2.out' })
}

export function closeCard() {
  useExperience.getState().setCard(null)
}

/** Clears scanner state when the camera leaves (flight, climb, new world). */
export function resetScanner() {
  timeline?.kill()
  stopTone?.()
  stopTone = null
  Object.assign(scanFx, { target: null, progress: 0, beam: 0, pulse: 0, zoom: 0 })
  surfaceCam.lookRate = 8
  const st = useExperience.getState()
  if (st.scanning) st.setScanning(null)
  if (st.card) st.setCard(null)
}

/** A hidden discovery has been looked at long enough: it can now be seen and scanned. */
export function noticeHidden(id: string) {
  const st = useExperience.getState()
  if (st.detected[id] || useExploration.getState().discovered[id]) return
  st.detect(id)
  sound.shimmer()
  st.setNotice({
    id: `${id}-noticed-${Date.now()}`,
    title: 'Something hidden is here',
    detail: 'An unidentified object has appeared. Select it to scan.',
  })
}
