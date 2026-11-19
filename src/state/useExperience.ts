import { create } from 'zustand'
import { LOCATION_BY_ID } from '../data/locations'
import { PLANETS, type PlanetId } from '../data/planets'

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

interface ExperienceState {
  phase: Phase
  sceneReady: boolean
  motionPaused: boolean
  reducedMotion: boolean
  /** Cinema mode hides the interface so only the scene remains. */
  cinema: boolean
  /** The world the camera is travelling to or orbiting. */
  focus: PlanetId | null
  /** The world under the pointer (or highlighted from the index). */
  hovered: PlanetId | null
  /** The world whose surface is mounted (from descent start until ascent ends). */
  exploring: PlanetId | null
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
  setPhase: (phase: Phase) => void
  setSceneReady: () => void
  toggleMotion: () => void
  toggleCinema: () => void
  setFocus: (id: PlanetId | null) => void
  stepFocus: (direction: 1 | -1) => void
  setHovered: (id: PlanetId | null) => void
  setExploring: (id: PlanetId | null) => void
  setLocation: (id: string | null) => void
  setSignalHovered: (v: boolean) => void
  setNotice: (n: Notice | null) => void
  setObserved: (id: PlanetId) => void
  setScanning: (id: string | null) => void
  setCard: (id: string | null) => void
  detect: (id: string) => void
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
  setPhase: (phase) => set({ phase }),
  setSceneReady: () => set({ sceneReady: true }),
  toggleMotion: () => set((s) => ({ motionPaused: !s.motionPaused })),
  toggleCinema: () => set((s) => ({ cinema: !s.cinema })),
  setFocus: (focus) => set({ focus, hovered: null }),
  stepFocus: (direction) =>
    set((s) => {
      const index = PLANETS.findIndex((p) => p.id === s.focus)
      const next = (index + direction + PLANETS.length) % PLANETS.length
      return { focus: PLANETS[next].id, hovered: null }
    }),
  setHovered: (hovered) => set({ hovered }),
  setExploring: (exploring) => set({ exploring }),
  setLocation: (location) => set({ location }),
  setSignalHovered: (signalHovered) => set({ signalHovered }),
  setNotice: (notice) => set({ notice }),
  setObserved: (observed) => set({ observed }),
  setScanning: (scanning) => set({ scanning }),
  setCard: (card) => set(card ? { card, cardAt: Date.now() } : { card }),
  detect: (id) => set((s) => (s.detected[id] ? s : { detected: { ...s.detected, [id]: true } })),
}))

/**
 * `?shot=orbit`, `?shot=galaxy`, `?shot=<planet id>` or `?shot=<location id>`
 * jumps straight to a settled shot, for review and capture.
 */
export const debugShot = (() => {
  if (typeof window === 'undefined') return null
  const shot = new URLSearchParams(window.location.search).get('shot')
  if (shot === 'orbit' || shot === 'galaxy' || shot === 'observatory') return shot
  if (shot && PLANETS.some((p) => p.id === shot)) return shot as PlanetId
  if (shot && LOCATION_BY_ID[shot]) return `loc:${shot}` as const
  return null
})()

/** Device tier, decided once. Small or touch-first screens get a lighter scene. */
export const quality = (() => {
  if (typeof window === 'undefined') return { tier: 'high' as const, coarse: false }
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  return { tier: coarse || small ? ('low' as const) : ('high' as const), coarse }
})()
