import { create } from 'zustand'
import { PLANETS, type PlanetId } from '../data/planets'

/**
 * boot      → shaders compiling, screen is black
 * arriving  → the opening sequence is playing
 * orbit     → idle on the title screen
 * warping   → skimming Vael's limb, then the jump to the Aether system
 * galaxy    → free exploration of the six worlds
 * returning → the jump back to Vael's title screen
 */
export type Phase = 'boot' | 'arriving' | 'orbit' | 'warping' | 'galaxy' | 'returning'

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
  setPhase: (phase: Phase) => void
  setSceneReady: () => void
  toggleMotion: () => void
  toggleCinema: () => void
  setFocus: (id: PlanetId | null) => void
  stepFocus: (direction: 1 | -1) => void
  setHovered: (id: PlanetId | null) => void
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
}))

/**
 * `?shot=orbit`, `?shot=galaxy` or `?shot=<planet id>` jumps straight to a
 * settled shot, for review and capture.
 */
export const debugShot = (() => {
  if (typeof window === 'undefined') return null
  const shot = new URLSearchParams(window.location.search).get('shot')
  if (shot === 'orbit' || shot === 'galaxy') return shot
  if (shot && PLANETS.some((p) => p.id === shot)) return shot as PlanetId
  return null
})()

/** Device tier, decided once. Small or touch-first screens get a lighter scene. */
export const quality = (() => {
  if (typeof window === 'undefined') return { tier: 'high' as const, coarse: false }
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  return { tier: coarse || small ? ('low' as const) : ('high' as const), coarse }
})()
