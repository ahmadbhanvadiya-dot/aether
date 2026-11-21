import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { EPOCH } from '../data/astronomy'

/**
 * Phase 9: the one simulation clock. Every orbit, spin, moon, ring and celestial
 * event reads `sim.day`. The scene advances it once per frame (SimulationClock in
 * Experience.tsx); React state changes only on discrete actions (play, speed,
 * orbits, reset), never per frame.
 */

export interface Speed {
  label: string
  /** Standard days per real second. */
  perSec: number
}

export const SPEEDS: Speed[] = [
  { label: '1 hour', perSec: 1 / 24 },
  { label: '1 day', perSec: 1 },
  { label: '5 days', perSec: 5 },
  { label: '1 month', perSec: 30 },
  { label: '1 year', perSec: 365.25 },
]
export const DEFAULT_SPEED = 2

/**
 * While the camera is attached to a world (flying, focused, descending) the
 * clock eases down to this so the destination does not run away from it.
 */
export const ATTACHED_MAX = 5

/**
 * On the ground (descending, on a surface, climbing back) time runs at its real
 * pace: the sky's moons stand where the simulation has them and barely move.
 */
export const GROUND_RATE = 1 / 86_400

/** Fastest drawn rotation (Orion's), radians per second: true rotation would strobe. */
const SPIN_SHOWN = 0.3

export const sim = {
  /** Simulation time, standard days. */
  day: EPOCH,
  /** Current rate, days per second, eased toward the target. */
  rate: SPEEDS[DEFAULT_SPEED].perSec,
  /** Accumulated drawn rotation, hours (slowed; see `spinScale`). */
  spinHours: 0,
  /** Drawn rotation ÷ true rotation, this frame (1 = true speed). */
  spinScale: 1,
  /** True while a jump to an event is tweening `day`. */
  jumping: false,
}

/** Advances the clock by one frame. `cap` limits the rate (camera attached to a world). */
export function stepSimulation(dt: number, target: number, cap: number, snap: boolean) {
  const goal = Math.min(target, cap)
  // Slowing is quick (a destination must not run away at the start of a flight);
  // speeding up is gentle.
  const tau = goal < sim.rate ? 0.1 : 0.45
  sim.rate = snap ? goal : sim.rate + (goal - sim.rate) * (1 - Math.exp(-dt / tau))
  if (Math.abs(sim.rate - goal) < 1e-4) sim.rate = goal
  if (!sim.jumping) sim.day += sim.rate * dt
  // Rotation: the fastest world turns at SPIN_SHOWN × a gentle function of the speed,
  // never faster than true; everything else keeps its true ratio to it.
  const trueFastest = (sim.rate * 24 * Math.PI * 2) / 10
  const shown = SPIN_SHOWN * Math.min(1.8, Math.max(0.6, (sim.rate / 5) ** 0.3))
  sim.spinScale = trueFastest > shown ? shown / trueFastest : 1
  sim.spinHours += sim.rate * 24 * sim.spinScale * (sim.jumping ? 0 : dt)
}

export function resetSimulation() {
  sim.day = EPOCH
  sim.spinHours = 0
  sim.jumping = false
  useSimulation.getState().bump()
}

interface SimulationState {
  playing: boolean
  speed: number
  orbits: boolean
  /** Increments on resets and jumps, so derived views can recompute. */
  epoch: number
  togglePlaying: () => void
  setPlaying: (v: boolean) => void
  setSpeed: (i: number) => void
  stepSpeed: (d: number) => void
  toggleOrbits: () => void
  bump: () => void
}

export const useSimulation = create<SimulationState>()(
  persist(
    (set, get) => ({
      playing: true,
      speed: DEFAULT_SPEED,
      orbits: true,
      epoch: 0,
      togglePlaying: () => set({ playing: !get().playing }),
      setPlaying: (playing) => set({ playing }),
      setSpeed: (i) => set({ speed: Math.max(0, Math.min(SPEEDS.length - 1, i)) }),
      stepSpeed: (d) => get().setSpeed(get().speed + d),
      toggleOrbits: () => set({ orbits: !get().orbits }),
      bump: () => set({ epoch: get().epoch + 1 }),
    }),
    {
      name: 'aether-simulation',
      version: 1,
      // The time itself is not stored: every visit starts at the epoch.
      partialize: (s) => ({ speed: s.speed, orbits: s.orbits }),
    },
  ),
)

/** "Day 10,214 · 06:40" */
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export function formatSimDay(day: number) {
  const d = Math.floor(day)
  const minutes = Math.floor((day - d) * 1440)
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `Day ${whole.format(d)} · ${hh}:${mm}`
}

/** "in 214 days", "in 6 hours", "in 3.2 years" */
export function formatUntil(days: number) {
  if (days < 0) return 'now'
  if (days < 1) return `in ${whole.format(Math.max(1, days * 24))} ${days * 24 < 1.5 ? 'hour' : 'hours'}`
  if (days < 730) return `in ${whole.format(days)} ${days < 1.5 ? 'day' : 'days'}`
  return `in ${(days / 365.25).toFixed(1)} years`
}
