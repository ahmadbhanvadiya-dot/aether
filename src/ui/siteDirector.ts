import gsap from 'gsap'
import { sound } from '../audio/sound'
import { isSiteId, READING_BY_ID } from '../data/waystation'
import { useExploration } from '../state/exploration'
import { readingFx, useSite } from '../state/site'
import { noteDiscovery } from './storyDirector'
import { useExperience } from '../state/useExperience'

/**
 * Phase 11d: taking readings at the Waystation from orbit. Select a marker on
 * the station: the scan holds on it (a light gathers at the point, the scanner's
 * tone rises), then the reading is recorded and its card opens. A reading
 * already taken opens its card at once.
 */

export { readingFx, useSite }

let tween: gsap.core.Tween | null = null
let stopTone: (() => void) | null = null

const here = () => {
  const st = useExperience.getState()
  return st.phase === 'galaxy' && isSiteId(st.activeSystem)
}

export function startReading(id: string) {
  if (!here() || !READING_BY_ID[id] || READING_BY_ID[id].site !== useExperience.getState().activeSystem) return
  sound.unlock()
  // The record panel steps aside for the reading.
  useExperience.getState().setSiteOpen(false)
  if (useExploration.getState().discovered[id]) {
    cancelReading()
    useSite.setState({ card: id })
    return
  }
  if (useSite.getState().scanning === id) return
  cancelReading()
  const reduced = useExperience.getState().reducedMotion
  const duration = reduced ? 0.5 : 2.4
  Object.assign(readingFx, { id, progress: 0 })
  useSite.setState({ scanning: id, card: null })
  stopTone = sound.scan(duration)
  tween = gsap.to(readingFx, {
    progress: 1,
    duration,
    ease: 'power1.inOut',
    onComplete: () => {
      tween = null
      stopTone = null
      // Phase 11d: a reading can complete an objective too (Expedition V): queue its story.
      const before = useExploration.getState().discovered
      if (useExploration.getState().discover(id)) noteDiscovery(before, useExploration.getState().discovered)
      sound.burst()
      sound.chime()
      Object.assign(readingFx, { id: null, progress: 0 })
      useSite.setState({ scanning: null, card: id })
    },
  })
}

/** Stops a reading in progress; nothing is recorded. */
export function cancelReading() {
  tween?.kill()
  tween = null
  stopTone?.()
  stopTone = null
  Object.assign(readingFx, { id: null, progress: 0 })
  if (useSite.getState().scanning) useSite.setState({ scanning: null })
}

export function closeReadingCard() {
  useSite.setState({ card: null })
}

/** Leaving the Waystation (the map, a transit) stops any reading and closes its card. */
useExperience.subscribe((s, prev) => {
  if (s.phase === prev.phase && s.activeSystem === prev.activeSystem) return
  // Leaving a site, or changing site, stops the reading.
  if (s.phase !== 'galaxy' || !isSiteId(s.activeSystem) || s.activeSystem !== prev.activeSystem) {
    cancelReading()
    if (useSite.getState().card) useSite.setState({ card: null })
  }
})
