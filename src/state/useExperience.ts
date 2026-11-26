import { create } from 'zustand'
import type { SystemId } from '../data/systems'
import { LOCATION_BY_ID, PLACE_BY_ID } from '../data/locations'
import { isElysWorld, PLANETS, type PlanetId, type WorldId } from '../data/planets'

/**
 * boot      → shaders compiling, screen is black
 * arriving  → the opening sequence is playing
 * orbit     → idle on the title screen
 * warping   → skimming Vael's limb, then the jump to the Aether system
 * galaxy    → free exploration of the six worlds
 * returning → the jump back to Vael's title screen
 * descending → from a world's orbit down through its atmosphere
 * surface    → exploring a world's surface
 * ascending  → back up to the world's orbit
 * observatory → the archive: the system seen from the zenith as a planisphere
 */
export type Phase =
  | 'boot'
  | 'arriving'
  | 'orbit'
  | 'warping'
  | 'galaxy'
  | 'returning'
  | 'descending'
  | 'surface'
  | 'ascending'
  | 'observatory'
  /** Phase 11: the universe map, above the galaxy. */
  | 'map'

interface ExperienceState {
  phase: Phase
  sceneReady: boolean
  motionPaused: boolean
  reducedMotion: boolean
  /** Cinema mode hides the interface so only the scene remains. */
  cinema: boolean
  /** The world the camera is travelling to or orbiting. */
  focus: WorldId | null
  /** The world under the pointer (or highlighted from the index). */
  hovered: WorldId | null
  /** The world whose surface is mounted (from descent start until ascent ends). */
  exploring: WorldId | null
  /** The surface location the camera is at or travelling to. */
  location: string | null
  /** The signal under the pointer on the surface. */
  signalHovered: boolean
  /** The latest discovery notification. */
  notice: Notice | null
  /** The world selected on the Observatory dial. */
  observed: PlanetId
  /** Phase 6 scanner: the discovery being scanned, the one whose card is open. */
  scanning: string | null
  card: string | null
  /** When the current card opened (ms), to tell a fresh discovery from a revisit. */
  cardAt: number
  /** Hidden discoveries noticed this visit (looked at long enough); scannable once noticed. */
  detected: Record<string, true>
  /** Phase 8: story fragments waiting to be presented, the one open now, and the journal. */
  storyQueue: string[]
  story: string | null
  journal: boolean
  /**
   * Phase 12: what the Observatory's record shows when it is not a world — a moon,
   * place, discovery, event, expedition or story record (chosen from the search).
   * Choosing a world on the dial clears it.
   */
  obsFocus: ObsFocus | null
  /** Phase 11: the star system the scene shows (Elys, or another once it is reached). */
  activeSystem: SystemId
  /** Phase 11d: a deep-space site's record is open (the HUD steps aside as for a world's). */
  siteOpen: boolean
  setSiteOpen: (open: boolean) => void
  setActiveSystem: (id: SystemId) => void
  setObsFocus: (focus: ObsFocus | null, planet?: PlanetId | null) => void
  /** Phase 10: something failed (a chunk, WebGL, a slow start); shown by FaultUI. */
  fault: Fault | null
  setFault: (fault: Fault | null) => void
  setPhase: (phase: Phase) => void
  setSceneReady: () => void
  toggleMotion: () => void
  toggleCinema: () => void
  setFocus: (id: WorldId | null) => void
  stepFocus: (direction: 1 | -1) => void
  setHovered: (id: WorldId | null) => void
  setExploring: (id: WorldId | null) => void
  setLocation: (id: string | null) => void
  setSignalHovered: (v: boolean) => void
  setNotice: (n: Notice | null) => void
  setObserved: (id: PlanetId) => void
  setScanning: (id: string | null) => void
  setCard: (id: string | null) => void
  detect: (id: string) => void
  queueStory: (ids: string[]) => void
  setStory: (id: string | null) => void
  setJournal: (open: boolean) => void
}

/** Phase 12: a non-world selection in the Observatory. */
export interface ObsFocus {
  kind: 'moon' | 'location' | 'discovery' | 'event' | 'expedition' | 'record'
  id: string
}

/** A failure the visitor should know about, with the one action that helps. */
export interface Fault {
  id: string
  title: string
  detail: string
  /** Offer a reload (progress is saved, so it is always safe). */
  reload?: boolean
  /** Can be dismissed and exploring continues. */
  dismissible?: boolean
}

export interface Notice {
  id: string
  title: string
  detail: string
}

const prefersReduced =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const useExperience = create<ExperienceState>((set) => ({
  phase: 'boot',
  sceneReady: false,
  motionPaused: false,
  reducedMotion: prefersReduced,
  cinema: false,
  focus: null,
  hovered: null,
  exploring: null,
  location: null,
  signalHovered: false,
  notice: null,
  observed: 'aurelis',
  scanning: null,
  card: null,
  cardAt: 0,
  detected: {},
  storyQueue: [],
  story: null,
  journal: false,
  obsFocus: null,
  activeSystem: 'elys',
  setActiveSystem: (activeSystem) => set({ activeSystem, focus: null, hovered: null, siteOpen: false }),
  siteOpen: false,
  setSiteOpen: (siteOpen) => set({ siteOpen }),
  // Turning the dial to the item's world and showing the item are one update.
  setObsFocus: (obsFocus, planet) => set(planet ? { obsFocus, observed: planet } : { obsFocus }),
  fault: null,
  setFault: (fault) => set({ fault }),
  setPhase: (phase) => set({ phase }),
  setSceneReady: () => set({ sceneReady: true }),
  toggleMotion: () => set((s) => ({ motionPaused: !s.motionPaused })),
  toggleCinema: () => set((s) => ({ cinema: !s.cinema })),
  setFocus: (focus) => set({ focus, hovered: null }),
  stepFocus: (direction) =>
    set((s) => {
      // Stepping walks Elys's worlds; a lone world elsewhere has nowhere to step.
      if (!s.focus || !isElysWorld(s.focus)) return {}
      const index = PLANETS.findIndex((p) => p.id === s.focus)
      const next = (index + direction + PLANETS.length) % PLANETS.length
      return { focus: PLANETS[next].id, hovered: null }
    }),
  setHovered: (hovered) => set({ hovered }),
  setExploring: (exploring) => set({ exploring }),
  setLocation: (location) => set({ location }),
  setSignalHovered: (signalHovered) => set({ signalHovered }),
  setNotice: (notice) => set({ notice }),
  setObserved: (observed) => set({ observed, obsFocus: null }),
  setScanning: (scanning) => set({ scanning }),
  setCard: (card) => set(card ? { card, cardAt: Date.now() } : { card }),
  detect: (id) => set((s) => (s.detected[id] ? s : { detected: { ...s.detected, [id]: true } })),
  queueStory: (ids) => set((s) => ({ storyQueue: [...s.storyQueue, ...ids.filter((id) => !s.storyQueue.includes(id))] })),
  setStory: (story) => set((s) => ({ story, storyQueue: story ? s.storyQueue.filter((id) => id !== story) : s.storyQueue })),
  setJournal: (journal) => set({ journal }),
}))

/**
 * `?shot=orbit`, `?shot=galaxy`, `?shot=<planet id>` or `?shot=<location id>`
 * jumps straight to a settled shot, for review and capture.
 */
export const debugShot = (() => {
  if (typeof window === 'undefined') return null
  const shot = new URLSearchParams(window.location.search).get('shot')
  if (shot === 'orbit' || shot === 'galaxy' || shot === 'observatory') return shot
  // Phase 11: Tessaly is story-gated; until its expedition exists, only development can reach it.
  if ((shot === 'tessaly' || shot === 'waystation') && import.meta.env.DEV) return shot
  if (shot && PLANETS.some((p) => p.id === shot)) return shot as PlanetId
  if (shot && LOCATION_BY_ID[shot]) return `loc:${shot}` as const
  // Liris's places, like Tessaly itself, only in development for now.
  if (shot && import.meta.env.DEV && PLACE_BY_ID[shot]) return `loc:${shot}` as const
  return null
})()

/** Device tier, decided once. Small or touch-first screens get a lighter scene. */
export const quality = (() => {
  if (typeof window === 'undefined') return { tier: 'high' as const, coarse: false }
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  return { tier: coarse || small ? ('low' as const) : ('high' as const), coarse }
})()
