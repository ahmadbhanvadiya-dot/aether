import gsap from 'gsap'
import { sound } from '../audio/sound'
import { scanFx } from '../scene/motion'
import { surfaceCam } from '../scene/surface/SurfaceRig'
import { useExploration } from '../state/exploration'
import { expeditionStates, unlockedFragments } from '../state/expeditions'
import { useExperience } from '../state/useExperience'

/**
 * Phase 8: story events. A discovery that completes an objective (or opens an
 * expedition) queues the fragments it unlocked; they play one at a time, after
 * the discovery's own record is closed, never during a scan, flight or descent.
 * On a surface the camera frames the moment (letterbox, a slight narrowing, a
 * look upward); elsewhere the transmission simply appears. Every fragment can be
 * dismissed and replayed from the journal.
 */

type Found = Record<string, number>

const bars = () => document.querySelectorAll<HTMLElement>('[data-letterbox]')
let framing: gsap.core.Timeline | null = null
let framedPitch = 0

/** Called by the scanner when a discovery is recorded: queue whatever it unlocked. */
export function noteDiscovery(before: Found, after: Found) {
  const prev = new Set(unlockedFragments(expeditionStates(before)).map((f) => f.fragment.id))
  const seen = useExploration.getState().story
  const fresh = unlockedFragments(expeditionStates(after))
    .filter((f) => !prev.has(f.fragment.id) && !seen[f.fragment.id])
    .map((f) => f.fragment.id)
  if (fresh.length) useExperience.getState().queueStory(fresh)
}

/** Can a story event start now without interrupting anything? */
export function storyCanPlay() {
  const st = useExperience.getState()
  if (st.story || st.card || st.scanning || st.journal) return false
  if (st.phase === 'surface') return surfaceCam.mode === 'free'
  return st.phase === 'galaxy' || st.phase === 'observatory'
}

/** Presents the next queued fragment, with framing on a surface. */
export function presentNext() {
  const st = useExperience.getState()
  const next = st.storyQueue[0]
  if (!next || !storyCanPlay()) return
  open(next, true)
}

/** Replays any unlocked fragment (from the journal). */
export function replayStory(id: string) {
  useExperience.getState().setJournal(false)
  open(id, false)
}

function open(id: string, live: boolean) {
  const st = useExperience.getState()
  st.setStory(id)
  sound.unlock()
  sound.transmission()
  const reduced = st.reducedMotion
  framing?.kill()
  if (st.phase === 'surface' && live && !reduced) {
    // The camera lifts its gaze a little and narrows; the letterbox closes: watch.
    framedPitch = Math.min(0.5, surfaceCam.lookPitch + 0.1) - surfaceCam.lookPitch
    surfaceCam.lookPitch += framedPitch
    surfaceCam.lookRate = 1.6
    framing = gsap
      .timeline()
      .to(bars(), { scaleY: 1, duration: 1.1, ease: 'uiOut' }, 0)
      .to(scanFx, { zoom: 4, duration: 2.4, ease: 'power2.inOut' }, 0)
  } else framedPitch = 0
}

/** Closes the open fragment (it is then marked as seen) and moves the queue on. */
export function dismissStory() {
  const st = useExperience.getState()
  const id = st.story
  if (!id) return
  useExploration.getState().markStory(id)
  st.setStory(null)
  framing?.kill()
  if (framedPitch) {
    surfaceCam.lookPitch -= framedPitch
    framedPitch = 0
  }
  surfaceCam.lookRate = 8
  framing = gsap
    .timeline()
    .to(bars(), { scaleY: 0, duration: 1.1, ease: 'uiOut' }, 0)
    .to(scanFx, { zoom: 0, duration: 1.6, ease: 'power2.inOut' }, 0)
}

/** Leaving a surface mid-story: drop the framing but keep the fragment queued for later. */
export function suspendStory() {
  const st = useExperience.getState()
  // An unseen fragment waits for later; a replay simply closes.
  if (st.story && !useExploration.getState().story[st.story]) st.queueStory([st.story])
  st.setStory(null)
  framing?.kill()
  framedPitch = 0
}
