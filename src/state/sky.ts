import { create } from 'zustand'
import type { PlanetId } from '../data/planets'
import { computeEvents, KIND_ORDER, type CelestialEvent } from './events'
import { sim, useSimulation } from './simulation'

/**
 * Phase 9: what the sky is doing. A watcher (twice a second, not per frame)
 * re‑derives the events in progress and the next of each kind from the solved
 * list, and only touches React state when either changes. The full solve runs
 * again when the clock leaves the solved window or jumps.
 */

interface SkyState {
  /** Simulation day the lists were derived at. */
  day: number
  all: CelestialEvent[]
  now: CelestialEvent[]
  next: CelestialEvent[]
  /** An event chosen in the Observatory: the dial draws its line of sight. */
  focus: CelestialEvent | null
  setFocus: (e: CelestialEvent | null) => void
}

export const useSky = create<SkyState>()((set) => ({
  day: 0,
  all: [],
  now: [],
  next: [],
  focus: null,
  setFocus: (focus) => set({ focus }),
}))

/** The next event involving a world (from the current solve). */
export function nextFor(world: PlanetId, all: CelestialEvent[], day: number) {
  return all.find((e) => e.start > day && e.bodies.includes(world)) ?? null
}

const ids = (list: CelestialEvent[]) => list.map((e) => e.id).join('|')

let solvedFrom = Number.NaN
let solvedEpoch = -1
let timer = 0

function refresh() {
  const day = sim.day
  const epoch = useSimulation.getState().epoch
  let all = useSky.getState().all
  // Moon events are solved 90 days ahead: solve again after 30, or on any jump back.
  if (!(day >= solvedFrom && day < solvedFrom + 30) || epoch !== solvedEpoch) {
    all = computeEvents(day)
    solvedFrom = day
    solvedEpoch = epoch
  }
  const now = all.filter((e) => e.start <= day && e.end >= day)
  // The next of each kind, soonest first — at least a second of real time away, so
  // a short eclipse never sits under "Coming" while it is already happening.
  const lead = day + Math.max(sim.rate, 0.05)
  const next = KIND_ORDER.map((k) => all.find((e) => e.kind === k && e.start > lead))
    .filter((e): e is CelestialEvent => !!e)
    .sort((a, b) => a.peak - b.peak)
  const st = useSky.getState()
  const changed = all !== st.all || ids(now) !== ids(st.now) || ids(next) !== ids(st.next)
  const focus = st.focus && st.focus.end + 1 < day ? null : st.focus
  if (changed || focus !== st.focus) useSky.setState({ day, all, now, next, focus })
}

/** Starts the watcher (idempotent). */
export function watchSky() {
  if (timer) return
  refresh()
  timer = window.setInterval(refresh, 500)
}
