import gsap from 'gsap'
import type { CelestialEvent } from '../state/events'
import { sim, useSimulation } from '../state/simulation'
import { useSky } from '../state/sky'
import { useExperience } from '../state/useExperience'

/**
 * Phase 9 (moved in Phase 12 so the Observatory's record can use it too).
 */

/** Takes the clock to an event's peak (a short time‑lapse), pauses, and marks it on the dial. */
export function showEvent(e: CelestialEvent) {
  const sky = useSky.getState()
  useSimulation.getState().setPlaying(false)
  sky.setFocus(e)
  gsap.killTweensOf(sim)
  const reduced = useExperience.getState().reducedMotion
  if (reduced) {
    sim.day = e.peak
    return
  }
  sim.jumping = true
  gsap.to(sim, {
    day: e.peak,
    duration: Math.min(2.4, 0.9 + Math.log10(1 + Math.abs(e.peak - sim.day)) * 0.45),
    ease: 'power2.inOut',
    onComplete: () => void (sim.jumping = false),
  })
}

