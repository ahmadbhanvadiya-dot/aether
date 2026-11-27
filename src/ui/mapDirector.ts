import gsap from 'gsap'
import { sound } from '../audio/sound'
import { beginMap, endMap, switchMapReturn } from '../scene/galaxy/GalaxyRig'
import type { SystemId } from '../data/systems'
import { director } from '../state/director'
import { useExperience } from '../state/useExperience'
import { useExploration } from '../state/exploration'
import { loadSystem } from '../system/chunks'

/**
 * Phase 11: the universe map, its own view (decided for Phase 11). From the
 * galaxy overview the camera rises out of the system and above the galaxy's disc;
 * closing returns to the overview exactly where it was. Opened from the HUD or U.
 */

let timeline: gsap.core.Timeline | null = null
const MAP_SHIFT = 0.95
/**
 * On narrow screens the panel sits below and the shift lifts the image; lift it
 * further there so the systems along the arm (Tessaly lies below Elys in this
 * view) stay above the panel. Same test as the view offset in Warp.tsx.
 */
const mapShift = () => {
  const w = window.innerWidth
  const h = window.innerHeight
  return w / h < 0.9 || w <= 900 ? 1.4 : MAP_SHIFT
}
const bars = () => document.querySelectorAll<HTMLElement>('[data-letterbox]')

export function openMap() {
  const st = useExperience.getState()
  // From the system overview only (a focused world first returns to it).
  if (st.phase !== 'galaxy' || st.focus) return
  sound.unlock()
  st.setHovered(null)
  st.setSiteOpen(false)
  st.setPhase('map')
  beginMap()
  timeline?.kill()
  const tl = gsap.timeline()
  timeline = tl
  // Keep the stars clear of the record panel: up on narrow screens, left on wide.
  if (st.reducedMotion) {
    tl.to(director, { map: 1, panelShift: mapShift(), duration: 0.6, ease: 'power1.inOut' })
    return
  }
  sound.swell(3.6)
  tl.to(director, { panelShift: mapShift(), duration: 2.6, ease: 'power3.inOut' }, 1.0)
  tl.to(bars(), { scaleY: 1, duration: 0.8, ease: 'uiOut' }, 0)
    .to(director, { map: 1, duration: 3.6, ease: 'power3.inOut' }, 0.1)
    .to(bars(), { scaleY: 0, duration: 1.2, ease: 'uiOut' }, 3.0)
}

export function closeMap() {
  const st = useExperience.getState()
  if (st.phase !== 'map') return
  timeline?.kill()
  const done = () => {
    endMap()
    useExperience.getState().setPhase('galaxy')
  }
  const tl = gsap.timeline({ onComplete: done })
  timeline = tl
  if (st.reducedMotion) {
    tl.to(director, { map: 0, panelShift: 0, duration: 0.6, ease: 'power1.inOut' })
    return
  }
  tl.to(director, { panelShift: 0, duration: 1.8, ease: 'power3.inOut' }, 0)
  tl.to(bars(), { scaleY: 1, duration: 0.7, ease: 'uiOut' }, 0)
    .to(director, { map: 0, duration: 3.0, ease: 'power3.inOut' }, 0.1)
    .to(bars(), { scaleY: 0, duration: 1.1, ease: 'uiOut' }, 2.4)
}

/**
 * Phase 11: the transit between systems. The map is the same picture from
 * either system (the galaxy and the map's view both shift with the active
 * system), so the switch happens unseen while the map is open: a marker crosses
 * the arm from here to there, the active system changes, and closing the map
 * descends into the new system's overview.
 */
export const transitFx = { from: 'elys' as SystemId, to: 'elys' as SystemId, t: 0, active: false }

export function travelTo(to: SystemId) {
  const st = useExperience.getState()
  if (st.phase !== 'map' || st.activeSystem === to || transitFx.active) return
  // Fetch the destination's code while the marker travels.
  void loadSystem(to).catch(() => {})
  Object.assign(transitFx, { from: st.activeSystem, to, t: 0, active: true })
  timeline?.kill()
  const from = st.activeSystem
  const arrive = () => {
    // Phase 11e: the map remembers the route.
    useExploration.getState().markRoute(from, to)
    switchMapReturn(from, to)
    useExperience.getState().setActiveSystem(to)
    Object.assign(transitFx, { t: 0, active: false })
    closeMap()
  }
  if (st.reducedMotion) {
    arrive()
    return
  }
  sound.swell(3.4)
  const tl = gsap.timeline({ onComplete: arrive })
  timeline = tl
  tl.to(transitFx, { t: 1, duration: 3.2, ease: 'power2.inOut' })
}
