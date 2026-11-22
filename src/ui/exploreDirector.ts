import gsap from 'gsap'
import { sound } from '../audio/sound'
import { locationsFor, PLACE_BY_ID } from '../data/locations'
import { isElysWorld, WORLD_BY_ID, type WorldId } from '../data/planets'
import { beginGalaxyAscent, beginGalaxyDescent, primeGalaxyFocus } from '../scene/galaxy/GalaxyRig'
import { atmosphereFx, climb, DURATION, entry, glide, signalFx } from '../scene/motion'
import { loadSurfaceScene } from '../scene/surface/lazy'
import { CHUNK_FAULT } from '../system/chunks'
import { beginClimb, beginTravel, surfaceCam } from '../scene/surface/SurfaceRig'
import { prepareSurface, surface } from '../scene/surface/world'
import { director } from '../state/director'
import { useExploration } from '../state/exploration'
import { locationProgress } from '../state/progress'
import { useExperience } from '../state/useExperience'
import { resetScanner } from './scanner'

/**
 * Phase 3 choreography: descent from orbit, travel between locations,
 * discovery, and the ascent back to orbit. A plain module (not a component)
 * so the 3D signal, the panel and keyboard shortcuts can all call it.
 *
 * Entry and climb are one continuous move across two spaces: the galaxy rig
 * glides into the top of the atmosphere while the in-scene haze thickens
 * (director.atmo), the spaces switch inside the haze, and the surface rig
 * carries on gliding down through the clouds as it thins. Every timeline is
 * killed before another starts, and every camera move starts from the pose
 * the camera actually has, so interruptions never jump.
 */

/** Haze density reached at the space switch: past 1 so the layer is fully opaque there. */
const HANDOVER = 1.15

/** Signal bloom (lives in scene/motion; re-exported for the scene). */
export { signalFx }

/** Runs once the current descent has landed (e.g. Revisit: open a discovery). */
let afterLanding: (() => void) | null = null

let timeline: gsap.core.Timeline | null = null
let travelTween: gsap.core.Tween | null = null

const bars = () => document.querySelectorAll<HTMLElement>('[data-letterbox]')
const titleCard = () => document.querySelector<HTMLElement>('[data-title-card]')

function reduced() {
  return useExperience.getState().reducedMotion
}

/**
 * The haze's colours for a world and location: the planet's limb as seen
 * from orbit, deepening into the location's own sky (horizon and zenith), so
 * the colours on both sides of the space switch are the same.
 */
function tintAtmosphere(planet: WorldId, locationId: string) {
  const p = WORLD_BY_ID[planet]
  atmosphereFx.orbitLow.set(p.atmosphere.day)
  atmosphereFx.orbitHigh.set(p.atmosphere.night).multiplyScalar(0.5)
  const env = surface.envs[locationId]
  if (env) {
    atmosphereFx.skyLow.copy(env.horizon)
    atmosphereFx.skyHigh.copy(env.zenith)
  }
}

/** Stops the haze wherever it is (a killed timeline must not leave it hanging). */
function settleHaze() {
  gsap.killTweensOf(director, 'atmo')
  gsap.killTweensOf(atmosphereFx, 'flow')
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

/** The first location with something still to find (else the first). */
function firstLocationFor(planet: WorldId) {
  const locs = locationsFor(planet)
  const found = useExploration.getState().discovered
  return (locs.find((l) => {
    const p = locationProgress(l, found)
    return p.found < p.total
  }) ?? locs[0]).id
}

// ---------------------------------------------------------------------------
// Descent
// ---------------------------------------------------------------------------

/**
 * Descends to `planet`. Lands at `options.location` when given (Revisit), else
 * the first location with something left to find; `options.then` runs after landing.
 */
export function startDescent(planet: WorldId, options: { location?: string; then?: () => void } = {}) {
  const st = useExperience.getState()
  if (st.phase !== 'galaxy' || st.focus !== planet) return
  sound.unlock()
  prepareSurface(planet)
  resetScanner()
  // Hidden discoveries must be found again on each visit until they are scanned.
  useExperience.setState({ detected: {} })
  afterLanding = options.then ?? null
  const first =
    options.location && PLACE_BY_ID[options.location]?.planet === planet ? options.location : firstLocationFor(planet)
  st.setLocation(first)
  st.setExploring(planet)
  st.setHovered(null)
  st.setPhase('descending')
  tintAtmosphere(planet, first)
  // The surface code (prefetched long before, normally) must be loaded; then two
  // frames: the surface mounts and compiles its shaders before anything moves.
  loadSurfaceScene().then(
    () => requestAnimationFrame(() => requestAnimationFrame(runDescent)),
    // Phase 10: the surface code could not be loaded. Stay in orbit and say so.
    () => {
      const s = useExperience.getState()
      s.setExploring(null)
      s.setLocation(null)
      s.setPhase('galaxy')
      s.setFault({ id: `surface-${Date.now()}`, ...CHUNK_FAULT })
    },
  )
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
  settleHaze()
  beginGalaxyDescent()
  const { setPhase } = useExperience.getState()
  const tl = gsap.timeline({
    onComplete: () => {
      setPhase('surface')
      const then = afterLanding
      afterLanding = null
      // The surface camera hands over to free look on its next frame; wait for it.
      let tries = 0
      const run = () => {
        if (surfaceCam.mode === 'free' || tries++ > 30) then?.()
        else requestAnimationFrame(run)
      }
      if (then) requestAnimationFrame(run)
    },
  })
  timeline = tl
  director.atmo = 0
  atmosphereFx.flow = 0

  if (reduced()) {
    // No travel: the air gathers in place, the ground appears through it.
    tl.to(director, { atmo: HANDOVER, duration: DURATION.reducedIn, ease: 'power1.inOut' })
      .call(switchToSurface)
      .set(director, { landing: 1, descent: 1, panelShift: 0 })
      .to(director, { atmo: 0, duration: DURATION.reducedOut, ease: 'power1.inOut' })
      .call(() => showTitleCard(3))
    return
  }

  // Orbit → the top of the atmosphere (galaxy space).
  const E = DURATION.entry
  const at = 0.15 + E // the space switch, inside the haze
  tl.to(bars(), { scaleY: 1, duration: 0.9, ease: 'uiOut' }, 0)
    .to(director, { panelShift: 0, duration: 1.4, ease: 'power2.inOut' }, 0)
    .to(director, { descent: 1, duration: E, ease: entry }, 0.15)
    .call(() => sound.wind(7, 'down'), undefined, 0.4)
    .to(director, { atmo: HANDOVER, duration: 1.9, ease: 'power2.in' }, at - 1.9)
    .to(atmosphereFx, { flow: 1.3, duration: 2.2, ease: 'power1.in' }, at - 2.2)
    // The switch, then the glide down through the location's sky and clouds.
    .call(switchToSurface, undefined, at)
    .to(director, { landing: 1, duration: DURATION.landing, ease: glide }, at)
    .to(director, { atmo: 0, duration: 3.0, ease: 'power2.out' }, at + 0.05)
    .to(atmosphereFx, { flow: 0.2, duration: 3.2, ease: 'power1.out' }, at)
    .call(() => showTitleCard(), undefined, at + DURATION.landing - 2.4)
    .to(bars(), { scaleY: 0, duration: 1.3, ease: 'uiOut' }, at + DURATION.landing - 1.6)
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
  settleHaze()
  resetScanner()
  // Climb from wherever the camera is, even mid-flight between locations.
  beginClimb()
  st.setSignalHovered(false)
  st.setPhase('ascending')
  const card = titleCard()
  if (card) gsap.to(card, { opacity: 0, duration: 0.3 })
  const planet = st.exploring!
  tintAtmosphere(planet, st.location!)

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
    tl.to(director, { atmo: HANDOVER, duration: DURATION.reducedIn, ease: 'power1.inOut' })
      .call(switchToGalaxy)
      .set(director, { descent: 0, landing: 0, panelShift: 1 })
      .to(director, { atmo: 0, duration: DURATION.reducedOut, ease: 'power1.inOut' })
    return
  }

  const C = DURATION.climb
  tl.to(bars(), { scaleY: 1, duration: 0.9, ease: 'uiOut' }, 0)
    .to(surfaceCam, { climb: 1, duration: C, ease: climb }, 0)
    .to(surfaceCam, { climbClock: C, duration: C, ease: 'none' }, 0)
    .call(() => sound.wind(6, 'up'), undefined, 0.2)
    .to(director, { atmo: HANDOVER, duration: 1.7, ease: 'power2.in' }, C - 1.7)
    .to(atmosphereFx, { flow: 1.3, duration: 1.8, ease: 'power1.in' }, C - 1.8)
    // The switch, then the pull-back that reveals the limb and the whole world.
    .call(switchToGalaxy, undefined, C)
    .to(director, { descent: 0, duration: DURATION.pullBack, ease: glide }, C)
    .to(director, { atmo: 0, duration: 1.5, ease: 'power2.out' }, C + 0.05)
    .to(atmosphereFx, { flow: 0, duration: 2.2, ease: 'power1.out' }, C)
    .to(director, { panelShift: 1, duration: 1.6, ease: 'power2.inOut' }, C + DURATION.pullBack - 1.6)
    .to(bars(), { scaleY: 0, duration: 1.3, ease: 'uiOut' }, C + DURATION.pullBack - 1.2)
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
  resetScanner()
  st.setSignalHovered(false)

  if (reduced()) {
    // A quick dip through the destination's sky instead of a flight.
    settleHaze()
    tintAtmosphere(st.exploring!, id)
    atmosphereFx.flow = 0
    travelTween = gsap.to(director, {
      atmo: HANDOVER,
      duration: 0.4,
      ease: 'power1.inOut',
      onComplete: () => {
        st.setLocation(id)
        surfaceCam.lookYaw = 0
        surfaceCam.lookPitch = 0
        surfaceCam.mode = 'free'
        travelTween = gsap.to(director, { atmo: 0, duration: 0.6, ease: 'power1.inOut' })
        showTitleCard(2.4)
      },
    })
    return
  }

  const distance = surfaceCam.current.pos.distanceTo(target.pos)
  const duration = beginTravel(target, DURATION.flight(distance))
  st.setLocation(id)
  sound.swell(duration)
  travelTween = gsap.to(surfaceCam, {
    t: 1,
    duration,
    ease: 'none',
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
// Review shortcut: ?shot=<location id> starts on a surface, as if descended.
// ---------------------------------------------------------------------------

export function jumpToLocation(id: string) {
  const loc = PLACE_BY_ID[id]
  if (!loc) return
  const st = useExperience.getState()
  // Phase 11: the place's own system (Liris is Tessaly's).
  const system = isElysWorld(loc.planet) ? 'elys' : 'tessaly'
  if (st.activeSystem !== system) st.setActiveSystem(system)
  prepareSurface(loc.planet)
  resetScanner()
  director.space = 'surface'
  Object.assign(director, { landing: 1, descent: 1, panelShift: 0 })
  st.setFocus(loc.planet)
  primeGalaxyFocus(loc.planet)
  st.setLocation(id)
  st.setExploring(loc.planet)
  useExploration.getState().markVisited(loc.planet)
  director.atmo = 0
  surfaceCam.mode = 'free'
  surfaceCam.drift = 0
  st.setPhase('surface')
}
