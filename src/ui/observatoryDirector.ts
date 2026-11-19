import gsap from 'gsap'
import { sound } from '../audio/sound'
import { DISCOVERY_BY_ID } from '../data/discoveries'
import type { PlanetId } from '../data/planets'
import { beginObservatory, galaxyCam, startGalaxyTravel } from '../scene/galaxy/GalaxyRig'
import { director } from '../state/director'
import { useExploration } from '../state/exploration'
import { systemProgress } from '../state/progress'
import { useExperience } from '../state/useExperience'
import { startAscent, startDescent } from './exploreDirector'
import { startScan } from './scanner'

/**
 * Phase 4 choreography. Opening raises the galaxy camera to the zenith above
 * Elys, so the real system becomes the planisphere; closing travels back to
 * the overview, or to a world's orbit and straight on down to its surface.
 */

const bars = () => document.querySelectorAll<HTMLElement>('[data-letterbox]')
let timeline: gsap.core.Timeline | null = null

export function openObservatory() {
  const st = useExperience.getState()
  // From a surface: climb to orbit first, then rise to the zenith.
  if (st.phase === 'surface') {
    startAscent(() => openObservatory())
    return
  }
  if (st.phase !== 'galaxy') return
  sound.unlock()

  // Start on the world in focus, else the most explored, else the first.
  const { discovered, visited } = useExploration.getState()
  const best = systemProgress(discovered, visited).mostExplored[0]?.id
  st.setObserved(st.focus ?? best ?? st.observed)

  beginObservatory()
  if (st.focus) st.setFocus(null)
  st.setHovered(null)
  director.observatory = 0
  st.setPhase('observatory')

  // Wide screens: the dial sits left of the reading column. Narrow: centred in
  // the room the reading column leaves below the header.
  const narrow = window.innerWidth <= 900 || window.innerWidth / window.innerHeight < 0.9
  const shift = narrow ? narrowShift() : 1

  timeline?.kill()
  const tl = gsap.timeline()
  timeline = tl
  if (st.reducedMotion) {
    tl.to(director, { observatory: 1, panelShift: shift, duration: 0.6, ease: 'power1.inOut' })
    return
  }
  sound.swell(3.2)
  tl.to(bars(), { scaleY: 1, duration: 0.8, ease: 'uiOut' }, 0)
    .to(director, { observatory: 1, duration: 2.8, ease: 'power3.inOut' }, 0.1)
    .to(director, { panelShift: shift, duration: 2.2, ease: 'power3.inOut' }, 0.6)
    .to(bars(), { scaleY: 0, duration: 1.2, ease: 'uiOut' }, 2.4)
}

/**
 * Narrow screens shift the view vertically by panelShift * 26% of the height
 * (see Warp). Solve for the shift that puts Elys in the middle of the reading
 * column's top margin. Layout offsets ignore the reveal transforms, and the
 * Observatory is laid out while hidden, so this can run before it shows.
 */
function narrowShift() {
  const wrap = document.querySelector<HTMLElement>('.obs-reading-wrap')
  const h = window.innerHeight
  if (!wrap) return 0.27
  const centre = wrap.offsetTop - parseFloat(getComputedStyle(wrap).marginTop) / 2
  return (h / 2 - centre) / (h * 0.26)
}

/** Back to the galaxy overview. */
export function closeObservatory() {
  leave(null)
}

/** Straight to a world's surface: orbit it, then descend. */
export function exploreFromObservatory(planet: PlanetId) {
  leave(planet)
}

/**
 * Revisit an archived discovery: travel to its world, land at its location,
 * then turn to it and reopen its record.
 */
export function revisitDiscovery(id: string) {
  const d = DISCOVERY_BY_ID[id]
  if (!d) return
  leave(d.planet, { location: d.location, then: () => startScan(id) })
}

function leave(planet: PlanetId | null, landing: { location?: string; then?: () => void } = {}) {
  const st = useExperience.getState()
  if (st.phase !== 'observatory') return
  sound.unlock()
  timeline?.kill()
  const tl = gsap.timeline({ onComplete: () => (director.observatory = 0) })
  timeline = tl
  if (!st.reducedMotion) {
    tl.to(bars(), { scaleY: 1, duration: 0.7, ease: 'uiOut' }, 0).to(
      bars(),
      { scaleY: 0, duration: 1.2, ease: 'uiOut' },
      planet ? 1.8 : 1.6,
    )
  }
  st.setPhase('galaxy')
  if (planet) {
    // Recorded while the Observatory still owns the camera, then flown to.
    st.setFocus(planet)
    galaxyCam.onArrive = () => startDescent(planet, landing)
  }
  startGalaxyTravel(planet)
}

export function stepObserved(direction: 1 | -1, order: PlanetId[]) {
  const st = useExperience.getState()
  const i = order.indexOf(st.observed)
  st.setObserved(order[(i + direction + order.length) % order.length])
}
