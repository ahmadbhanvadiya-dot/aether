import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { PlanetId } from '../data/planets'
import { LOCATIONS, TOTAL_LOCATIONS } from '../data/locations'

/**
 * Discoveries and the sound preference, persisted to localStorage.
 * Storage access is wrapped so private browsing or blocked storage never breaks
 * the experience — progress simply lasts for the session.
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
  soundOn: boolean
  /** Marks a location discovered. Returns true only the first time. */
  discover: (id: string) => boolean
  toggleSound: () => void
}

export const useExploration = create<ExplorationState>()(
  persist(
    (set, get) => ({
      discovered: {},
      soundOn: true,
      discover: (id) => {
        if (get().discovered[id]) return false
        set((s) => ({ discovered: { ...s.discovered, [id]: Date.now() } }))
        return true
      },
      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
    }),
    {
      name: 'aether-exploration',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ discovered: s.discovered, soundOn: s.soundOn }),
    },
  ),
)

export function discoveredCount(discovered: Record<string, number>, planet?: PlanetId) {
  return LOCATIONS.filter((l) => (!planet || l.planet === planet) && discovered[l.id]).length
}

export { TOTAL_LOCATIONS }
