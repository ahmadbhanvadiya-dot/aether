import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { discoveriesFor, FIND_BY_ID, HIDDEN, TOTAL_DISCOVERIES, VISIBLE } from '../data/discoveries'
import { LOCATION_BY_ID } from '../data/locations'
import type { PlanetId, WorldId } from '../data/planets'

/**
 * The single source of truth for progress, persisted to localStorage:
 * discoveries (with timestamps), first landings per world, when the
 * Observatory was last opened, and the sound preference.
 *
 * Storage access is wrapped so private browsing or blocked storage never
 * breaks the experience — progress then simply lasts for the session.
 */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      /* storage unavailable: keep progress in memory */
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}

interface ExplorationState {
  /** location id → timestamp of discovery */
  discovered: Record<string, number>
  /** world id → timestamp of the first landing on its surface */
  visited: Partial<Record<WorldId, number>>
  /** When the Observatory was last opened (0 = never). Newer discoveries animate in. */
  observatorySeenAt: number
  soundOn: boolean
  /** Master volume, 0 – 1 (Phase 7). Mute is `soundOn`. */
  volume: number
  /**
   * Phase 8: story fragments already presented (id → when). Not progress —
   * expedition progress is derived from `discovered` — only so a story event
   * plays once and the journal can mark what is new.
   */
  story: Record<string, number>
  markStory: (id: string) => void
  setVolume: (v: number) => void
  /** Records a catalogued discovery. Returns true only the first time (never for unknown ids). */
  discover: (id: string) => boolean
  /** Records the first landing on a world. */
  markVisited: (planet: WorldId) => void
  markObservatorySeen: () => void
  toggleSound: () => void
}

type Persisted = Pick<ExplorationState, 'discovered' | 'visited' | 'observatorySeenAt' | 'soundOn' | 'volume' | 'story'>

export const useExploration = create<ExplorationState>()(
  persist(
    (set, get) => ({
      discovered: {},
      visited: {},
      observatorySeenAt: 0,
      soundOn: true,
      volume: 0.8,
      story: {},
      markStory: (id) => {
        if (get().story[id]) return
        set((s) => ({ story: { ...s.story, [id]: Date.now() } }))
      },
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
      discover: (id) => {
        // Only catalogued discoveries, and each only once.
        if (!FIND_BY_ID[id] || get().discovered[id]) return false
        set((s) => ({ discovered: { ...s.discovered, [id]: Date.now() } }))
        return true
      },
      markVisited: (planet) => {
        if (get().visited[planet]) return
        set((s) => ({ visited: { ...s.visited, [planet]: Date.now() } }))
      },
      markObservatorySeen: () => set({ observatorySeenAt: Date.now() }),
      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
    }),
    {
      name: 'aether-exploration',
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s): Persisted => ({
        discovered: s.discovered,
        visited: s.visited,
        observatorySeenAt: s.observatorySeenAt,
        soundOn: s.soundOn,
        volume: s.volume,
        story: s.story,
      }),
      /**
       * v1 → v2: v1 stored only discoveries. A world with a discovery was
       * certainly landed on, so its visit time is its earliest discovery;
       * nothing is invented for worlds without one.
       */
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<Persisted>
        if (version < 2) {
          const visited: Partial<Record<PlanetId, number>> = {}
          for (const [id, at] of Object.entries(state.discovered ?? {})) {
            const planet = LOCATION_BY_ID[id]?.planet
            if (planet && (!visited[planet] || at < visited[planet]!)) visited[planet] = at
          }
          return {
            discovered: state.discovered ?? {},
            visited,
            observatorySeenAt: 0,
            soundOn: state.soundOn ?? true,
          }
        }
        return state as Persisted
      },
    },
  ),
)

/** Visible discoveries found (on one world, or everywhere). Hidden ones are counted by `hiddenCount`. */
/** Found and visible: Elys's in all (no world given), or one world's, Elys's or beyond. */
export function discoveredCount(discovered: Record<string, number>, planet?: WorldId) {
  const list = planet ? discoveriesFor(planet).filter((d) => d.kind !== 'secret') : VISIBLE
  return list.filter((d) => discovered[d.id]).length
}

export function hiddenCount(discovered: Record<string, number>, planet?: WorldId) {
  const list = planet ? discoveriesFor(planet).filter((d) => d.kind === 'secret') : HIDDEN
  return list.filter((d) => discovered[d.id]).length
}

/** Visible discoveries per world (the same on every world). */
export const PER_WORLD = VISIBLE.length / 6

export { TOTAL_DISCOVERIES }
