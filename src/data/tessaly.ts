import type { WorldData } from './planets'
import type { StarLook } from '../scene/galaxy/Star'

/**
 * Phase 11c: Tessaly — a binary star and the one world that circles both.
 * Fictional, consistent with itself: the two suns orbit their common centre
 * (the scene's origin while Tessaly is the active system) every 14 standard days;
 * Liris circles the pair far enough out (about 3.4 × their separation) for a
 * stable circumbinary orbit.
 */

export interface Sun {
  name: string
  look: StarLook
  /** Mass in solar masses (sets each sun's share of the orbit). */
  mass: number
  /** Light it casts on the worlds (linear RGB). */
  light: [number, number, number]
}

export const SUN_A: Sun = {
  name: 'Tessaly A',
  look: { radius: 1.9, hot: [0.92, 0.96, 1.0], warm: [0.62, 0.74, 1.0], corona: '#D6E4FF' },
  mass: 1.1,
  light: [0.95, 0.98, 1.0],
}

export const SUN_B: Sun = {
  name: 'Tessaly B',
  look: { radius: 1.3, hot: [1.0, 0.9, 0.66], warm: [1.0, 0.52, 0.18], corona: '#FFC98A' },
  mass: 0.75,
  light: [1.0, 0.72, 0.42],
}

export const BINARY = {
  /** Scene units between the two suns. */
  separation: 7,
  periodDays: 14,
  phase: 0.6,
}

/** The one world of Tessaly: lit by both suns, a double terminator, two noons. */
export const LIRIS: WorldData = {
  id: 'liris',
  name: 'LIRIS',
  kind: 'terrestrial',
  classification: 'Twice-lit world',
  teaser: 'Two suns, two shadows, no true night.',
  description:
    'Liris circles both suns of Tessaly. For most of its year one or the other is in the sky, so its night is a short twilight between two days, and everything that stands casts two shadows of different colours.',
  facts: [
    { label: 'Radius', value: '5,860 km' },
    { label: 'Surface', value: '19 °C' },
    { label: 'Air', value: 'Nitrogen, oxygen, argon' },
  ],
  radius: 0.82,
  orbitRadius: 24,
  yearDays: 410,
  dayHours: 29,
  mass: 0.9,
  moonCount: 0,
  moons: [],
  phase: 2.2,
  inclination: 0.012,
  axialTilt: 0.22,
  radiusKm: 5_860,
  atmosphere: { day: '#B9A4FF', night: '#5A2F8C', shell: 1.1, density: 0.2, intensity: 1.05 },
  accent: '#C8B2FF',
  clouds: { color: '#FFF3EA', opacity: 0.8, speed: 0.007 },
}
