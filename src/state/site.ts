import { create } from 'zustand'

/**
 * Phase 11d: the state of reading a deep-space site — which reading is being
 * taken, and whose card is open. Its own module so the scene, the interface and
 * the story director can all read it without importing each other.
 */

/** Read by the scene every frame (no React). */
export const readingFx = { id: null as string | null, progress: 0 }

export const useSite = create<{ scanning: string | null; card: string | null }>(() => ({ scanning: null, card: null }))
