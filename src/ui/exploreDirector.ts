import gsap from 'gsap'
import { sound } from '../audio/sound'
import { LOCATION_BY_ID, locationsFor } from '../data/locations'
import { PLANET_BY_ID, type PlanetId } from '../data/planets'
import { beginGalaxyAscent, beginGalaxyDescent, primeGalaxyFocus } from '../scene/galaxy/GalaxyRig'
import { beginTravel, surfaceCam } from '../scene/surface/SurfaceRig'
import { prepareSurface, surface } from '../scene/surface/world'
import { director } from '../state/director'
import { discoveredCount, TOTAL_LOCATIONS, useExploration } from '../state/exploration'
import { useExperience } from '../state/useExperience'

/**
 * Phase 3 choreography: descent from orbit, travel between locations,
 * discovery, and the ascent back to orbit. A plain module (not a component)
 * so the 3D signal, the panel and keyboard shortcuts can all call it.
 */

/** Signal bloom, tweened on discovery and read by the 3D signal each frame. */
export const signalFx = { bloom: 0 }

let timeline: gsap.core.Timeline | null = null
let travelTween: gsap.core.Tween | null = null

const bars = () => document.querySelectorAll<HTMLElement>('[data-letterbox]')
const veil = () => document.querySelector<HTMLElement>('[data-atmo-veil]')
const titleCard = () => document.querySelector<HTMLElement>('[data-title-card]')

function reduced() {
  return useExperience.getState().reducedMotion
}

function paintVeil(planet: PlanetId) {
  const v = veil()
  if (!v) return
  const c = PLANET_BY_ID[planet].atmosphere.day
  v.style.background = `radial-gradient(120% 100% at 50% 60%, ${c} 0%, ${c}cc 35%, #070c22 100%)`
}

/** The location name card: rises in, holds, fades. Rare, so it gets time. */
export function showTitleCard(hold = 3.6) {
  const card = titleCard()
  if (!card) return
  gsap.killTweensOf(card)
  const r = reduced()
  gsap
    .timeline()
    .fromTo(card, { opacity: 0, y: r ? 0 : 14 }, { opacity: 1, y: 0, duration: 1.1, ease: 'uiOut' })
    .to(card, { opacity: 0, y: r ? 0 : -6, duration: 0.8, ease: 'uiOut' }, `+=${hold}`)
}

function firstLocationFor(planet: PlanetId) {
  const locs = locationsFor(planet)
  const found = useExploration.getState().discovered
  return (locs.find((l) => !found[l.id]) ?? locs[0]).id
}

// ---------------------------------------------------------------------------
// Descent
// ---------------------------------------------------------------------------

export function startDescent(planet: PlanetId) {
  const st = useExperience.getState()
  if (st.phase !== 'galaxy' || st.focus !== planet) return
  sound.unlock()
  prepareSurface(planet)
  st.setLocation(firstLocationFor(planet))
  st.setExploring(planet)
  st.setHovered(null)
  st.setPhase('descending')
  paintVeil(planet)
  // Two frames: the surface mounts and compiles its shaders before anything moves.
  requestAnimationFrame(() => requestAnimationFrame(runDescent))
}

function switchToSurface() {
  director.space = 'surface'
  director.landing = 0
  surfaceCam.mode = 'landing'
  const planet = useExperience.getState().exploring
  if (planet) useExploration.getState().markVisited(planet)
}

function runDescent() {
  timeline?.kill()
  beginGalaxyDescent()
  const { setPhase } = useExperience.getState()
  const tl = gsap.timeline({ onComplete: () => setPhase('surface') })
  timeline = tl

  if (reduced()) {
    tl.to(veil(), { opacity: 1, duration: 0.5, ease: 'power1.inOut' })
      .call(switchToSurface)
      .set(director, { landing: 1, descent: 1, panelShift: 0 })
      .to(veil(), { opacity: 0, duration: 0.7, ease: 'power1.inOut' })
      .call(() => showTitleCard(3))
    return
  }

  tl.to(bars(), { scaleY: 1, duration: 0.9, ease: 'uiOut' }, 0)
    .to(director, { panelShift: 0, duration: 1.2, ease: 'power3.inOut' }, 0)
    .to(director, { descent: 1, duration: 3.4, ease: 'power2.in' }, 0.2)
    .call(() => sound.wind(6, 'down'), undefined, 0.3)
    .to(veil(), { opacity: 1, duration: 1.0, ease: 'power2.in' }, 2.6)
    .call(switchToSurface, undefined, 3.65)
    .to(veil(), { opacity: 0, duration: 1.8, ease: 'power2.out' }, 3.8)
    .to(director, { landing: 1, duration: 5.2, ease: 'power3.out' }, 3.65)
    .call(() => showTitleCard(), undefined, 6.4)
    .to(bars(), { scaleY: 0, duration: 1.3, ease: 'uiOut' }, 7.4)
}

// ---------------------------------------------------------------------------
// Ascent
// ---------------------------------------------------------------------------

function switchToGalaxy() {
  director.space = 'galaxy'
  director.descent = 1
  beginGalaxyAscent()
}

/** Climbs back to orbit; `then` runs once the galaxy view has settled (e.g. open the Observatory). */
export function startAscent(then?: () => void) {
  const st = useExperience.getState()
  if (st.phase !== 'surface') return
  sound.unlock()
  travelTween?.kill()
  timeline?.kill()
  surfaceCam.mode = 'landing'
  st.setSignalHovered(false)
  st.setPhase('ascending')
  const card = titleCard()
  if (card) gsap.to(card, { opacity: 0, duration: 0.3 })
  const planet = st.exploring!
  paintVeil(planet)

  const finish = () => {
    const s = useExperience.getState()
    s.setPhase('galaxy')
    s.setExploring(null)
    s.setLocation(null)
    then?.()
  }
  const tl = gsap.timeline({ onComplete: finish })
  timeline = tl

  if (reduced()) {
    tl.to(veil(), { opacity: 1, duration: 0.5, ease: 'power1.inOut' })
      .call(switchToGalaxy)
      .set(director, { descent: 0, landing: 0, panelShift: 1 })
      .to(veil(), { opacity: 0, duration: 0.7, ease: 'power1.inOut' })
    return
  }

  tl.to(bars(), { scaleY: 1, duration: 0.9, ease: 'uiOut' }, 0)
    .to(director, { landing: 0, duration: 2.8, ease: 'power2.in' }, 0.1)
    .call(() => sound.wind(5, 'up'), undefined, 0.2)
    .to(veil(), { opacity: 1, duration: 0.9, ease: 'power2.in' }, 2.0)
    .call(switchToGalaxy, undefined, 2.95)
    .to(veil(), { opacity: 0, duration: 1.5, ease: 'power2.out' }, 3.05)
    .to(director, { descent: 0, duration: 3.4, ease: 'power3.out' }, 2.95)
    .to(director, { panelShift: 1, duration: 1.4, ease: 'power3.inOut' }, 4.8)
    .to(bars(), { scaleY: 0, duration: 1.3, ease: 'uiOut' }, 5.2)
}

// ---------------------------------------------------------------------------
// Travel between locations
// ---------------------------------------------------------------------------

export function travelTo(id: string) {
  const st = useExperience.getState()
  if (st.phase !== 'surface' || st.location === id) return
  if (surfaceCam.mode !== 'free' && surfaceCam.mode !== 'travel') return
  const target = surface.poses[id]
  if (!target) return
  sound.unlock()
  travelTween?.kill()
  st.setSignalHovered(false)

  if (reduced()) {
    // A quick dip through the sky color instead of a flight.
    const v = veil()
    const sky = '#' + surface.envs[id].horizon.getHexString()
    if (v) v.style.background = sky
    travelTween = gsap.to(v, {
      opacity: 1,
      duration: 0.4,
      ease: 'power1.inOut',
      onComplete: () => {
        st.setLocation(id)
        surfaceCam.lookYaw = 0
        surfaceCam.lookPitch = 0
        surfaceCam.mode = 'free'
        gsap.to(v, { opacity: 0, duration: 0.6, ease: 'power1.inOut' })
        showTitleCard(2.4)
      },
    })
    return
  }

  beginTravel()
  st.setLocation(id)
  const distance = surfaceCam.from.pos.distanceTo(target.pos)
  const duration = Math.min(7, Math.max(4, 3.2 + distance / 420))
  sound.swell(duration)
  travelTween = gsap.to(surfaceCam, {
    t: 1,
    duration,
    ease: 'power3.inOut',
    onComplete: () => {
      surfaceCam.mode = 'free'
      showTitleCard(2.4)
    },
  })
}

export function stepLocation(direction: 1 | -1) {
  const { exploring, location } = useExperience.getState()
  if (!exploring) return
  const locs = locationsFor(exploring)
  const i = locs.findIndex((l) => l.id === location)
  travelTo(locs[(i + direction + locs.length) % locs.length].id)
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export function discoverCurrent() {
  const { location, exploring, setNotice } = useExperience.getState()
  if (!location || !exploring) return
  sound.unlock()
  const isNew = useExploration.getState().discover(location)
  const r = reduced()
  gsap.killTweensOf(signalFx)
  if (!isNew) {
    // Already found: a small acknowledgement, nothing more.
    gsap.fromTo(signalFx, { bloom: 0.25 }, { bloom: 0, duration: 0.6, ease: 'power2.out' })
    return
  }
  sound.chime()
  gsap.fromTo(signalFx, { bloom: r ? 0.4 : 1 }, { bloom: 0, duration: r ? 0.8 : 1.6, ease: 'power2.out' })
  const loc = LOCATION_BY_ID[location]
  const found = useExploration.getState().discovered
  setNotice({
    id: `${location}-${Date.now()}`,
    title: loc.finding,
    detail: `${discoveredCount(found, exploring)} of 3 on ${PLANET_BY_ID[exploring].name}, ${discoveredCount(found)} of ${TOTAL_LOCATIONS} in all`,
  })
}

// ---------------------------------------------------------------------------
// Review shortcut: ?shot=<location id> starts on a surface, as if descended.
// ---------------------------------------------------------------------------

export function jumpToLocation(id: string) {
  const loc = LOCATION_BY_ID[id]
  if (!loc) return
  const st = useExperience.getState()
  prepareSurface(loc.planet)
  director.space = 'surface'
  Object.assign(director, { landing: 1, descent: 1, panelShift: 0 })
  st.setFocus(loc.planet)
  primeGalaxyFocus(loc.planet)
  st.setLocation(id)
  st.setExploring(loc.planet)
  useExploration.getState().markVisited(loc.planet)
  surfaceCam.mode = 'free'
  st.setPhase('surface')
}
