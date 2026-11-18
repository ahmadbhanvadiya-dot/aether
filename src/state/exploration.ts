import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { LOCATION_BY_ID, LOCATIONS, TOTAL_LOCATIONS } from '../data/locations'
import type { PlanetId } from '../data/planets'

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
  visited: Partial<Record<PlanetId, number>>
  /** When the Observatory was last opened (0 = never). Newer discoveries animate in. */
  observatorySeenAt: number
  soundOn: boolean
  /** Marks a location discovered. Returns true only the first time. */
  discover: (id: string) => boolean
  /** Records the first landing on a world. */
  markVisited: (planet: PlanetId) => void
  markObservatorySeen: () => void
  toggleSound: () => void
}

type Persisted = Pick<ExplorationState, 'discovered' | 'visited' | 'observatorySeenAt' | 'soundOn'>

export const useExploration = create<ExplorationState>()(
  persist(
    (set, get) => ({
      discovered: {},
      visited: {},
      observatorySeenAt: 0,
      soundOn: true,
      discover: (id) => {
        if (get().discovered[id]) return false
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

export function discoveredCount(discovered: Record<string, number>, planet?: PlanetId) {
  return LOCATIONS.filter((l) => (!planet || l.planet === planet) && discovered[l.id]).length
}

export { TOTAL_LOCATIONS }
