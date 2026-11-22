import { LIRIS } from './tessaly'
/**
 * The six worlds of the Aether system, in orbital order around Elys.
 * `kind` selects the surface recipe in scene/galaxy/shaders.ts.
 */
export type PlanetId = 'aurelis' | 'nyx' | 'solara' | 'vesper' | 'thalassa' | 'orion'

/**
 * Phase 11: every world the scene can draw — Elys's six, and worlds of other
 * systems (Tessaly's Liris). Elys-only data (astronomy, surfaces, discoveries)
 * stays keyed by PlanetId; the scene's own maps are keyed by WorldId.
 */
export type WorldId = PlanetId | 'liris'
export type WorldData = Omit<PlanetData, 'id'> & { id: WorldId }

export type PlanetKind = 'terrestrial' | 'dark' | 'desert' | 'cloud' | 'ocean' | 'giant'

export interface PlanetFact {
  label: string
  value: string
}

export interface MoonSpec {
  name: string
  /** Orbit radius, km (the physics) and in planet radii (the drawing, compressed). */
  km: number
  drawn: number
  radiusKm: number
  /** Angle at the epoch, radians; orbit inclination to the equator, radians. */
  phase: number
  inclination?: number
  retrograde?: boolean
  color: string
}

export interface PlanetData {
  id: PlanetId
  name: string
  kind: PlanetKind
  /** Short classification shown under the name. */
  classification: string
  /** One line for the hover label. */
  teaser: string
  /** Panel body copy. */
  description: string
  facts: PlanetFact[]
  /** Scene units. */
  radius: number
  orbitRadius: number
  /**
   * Phase 9 astronomy (fictional, internally consistent; see data/astronomy.ts).
   * Year in standard days (24 h); day in hours (negative: retrograde rotation);
   * mass in Aurelis‑like units of 5.97 × 10²⁴ kg; moons that are modelled.
   */
  yearDays: number
  dayHours: number
  mass: number
  moons: MoonSpec[]
  /** Moons known in total (Orion has many more than are modelled). */
  moonCount: number
  /** Angle on the orbit at the simulation's epoch, radians. */
  phase: number
  /** Orbit inclination, radians. */
  inclination: number
  axialTilt: number
  /** Real radius in km, for the altitude readout. */
  radiusKm: number
  /** Atmosphere: day colour, night colour, shell thickness (× radius), falloff, intensity. */
  atmosphere: { day: string; night: string; shell: number; density: number; intensity: number }
  /** Accent colour for interface details. */
  accent: string
  clouds?: { color: string; opacity: number; speed: number }
  rings?: { inner: number; outer: number; colorA: string; colorB: string }
}

export const PLANETS: PlanetData[] = [
  {
    id: 'aurelis',
    name: 'AURELIS',
    kind: 'terrestrial',
    classification: 'Blue terrestrial world',
    teaser: 'Shallow seas and green-gold continents.',
    description:
      'The gentlest world around Elys. Aurelis has shallow seas, slow weather and continents the colour of late summer. Its clouds never fully close, so its oceans are always in view.',
    facts: [
      { label: 'Radius', value: '6,210 km' },
      { label: 'Surface', value: '14 °C' },
      { label: 'Air', value: 'Nitrogen, oxygen' },
    ],
    radius: 0.78,
    orbitRadius: 10,
    yearDays: 341,
    dayHours: 26,
    mass: 1.05,
    moonCount: 1,
    moons: [{ name: 'Pell', km: 380_000, drawn: 2.9, radiusKm: 1_600, phase: 2.1, color: '#C9C4BC' }],
    phase: 0.6,
    inclination: 0.015,
    axialTilt: 0.41,
    radiusKm: 6_210,
    atmosphere: { day: '#6FB6FF', night: '#4A3FA8', shell: 1.1, density: 0.18, intensity: 1.1 },
    accent: '#6FB6FF',
    clouds: { color: '#F4F7FF', opacity: 0.85, speed: 0.006 },
  },
  {
    id: 'nyx',
    name: 'NYX',
    kind: 'dark',
    classification: 'Dark world',
    teaser: 'A black world veined with violet light.',
    description:
      "Nyx reflects almost nothing. Its crust is a glassy basalt that drinks in Elys's light, and along its fault lines something underneath glows a faint violet. No probe that landed has reported back.",
    facts: [
      { label: 'Radius', value: '4,980 km' },
      { label: 'Surface', value: '−140 °C' },
      { label: 'Air', value: 'Trace argon' },
    ],
    radius: 0.62,
    orbitRadius: 14.5,
    yearDays: 612,
    dayHours: 61,
    mass: 0.45,
    moonCount: 0,
    moons: [],
    phase: 2.4,
    inclination: -0.035,
    axialTilt: 0.12,
    radiusKm: 4_980,
    atmosphere: { day: '#7C5CFF', night: '#3A2A8A', shell: 1.05, density: 0.2, intensity: 0.35 },
    accent: '#8C6CFF',
  },
  {
    id: 'solara',
    name: 'SOLARA',
    kind: 'desert',
    classification: 'Golden desert world',
    teaser: 'Endless dune seas under a copper sky.',
    description:
      'One desert from pole to pole. Dune seas the size of continents migrate a few metres a day, and canyon systems cut the highlands into gold and rust. Its thin air turns copper at dusk.',
    facts: [
      { label: 'Radius', value: '7,340 km' },
      { label: 'Surface', value: '48 °C' },
      { label: 'Air', value: 'Thin CO₂, dust' },
    ],
    radius: 0.88,
    orbitRadius: 19.5,
    yearDays: 902,
    dayHours: 19,
    mass: 1.6,
    moonCount: 2,
    moons: [
      { name: 'Kesh', km: 40_000, drawn: 1.9, radiusKm: 140, phase: 0.4, color: '#B49A82' },
      { name: 'Oro', km: 110_000, drawn: 2.8, radiusKm: 380, phase: 3.6, color: '#C8A889' },
    ],
    phase: 4.3,
    inclination: 0.04,
    axialTilt: 0.29,
    radiusKm: 7_340,
    atmosphere: { day: '#F2B66B', night: '#7A3E5A', shell: 1.07, density: 0.2, intensity: 0.8 },
    accent: '#F2B66B',
    clouds: { color: '#E9C38E', opacity: 0.35, speed: 0.004 },
  },
  {
    id: 'vesper',
    name: 'VESPER',
    kind: 'cloud',
    classification: 'Violet atmospheric world',
    teaser: 'Wrapped in endless violet cloud.',
    description:
      "Nobody has seen Vesper's surface. Its atmosphere is ninety times denser than Earth's, banded in violet and rose, and it turns faster than the planet beneath it. Lightning flickers across the night side.",
    facts: [
      { label: 'Radius', value: '8,050 km' },
      { label: 'Surface', value: '460 °C' },
      { label: 'Air', value: 'CO₂, sulfur haze' },
    ],
    radius: 0.96,
    orbitRadius: 25,
    yearDays: 1420,
    dayHours: -120,
    mass: 2.1,
    moonCount: 0,
    moons: [],
    phase: 1.4,
    inclination: -0.01,
    axialTilt: 0.05,
    radiusKm: 8_050,
    atmosphere: { day: '#C9A2FF', night: '#5B3BB0', shell: 1.16, density: 0.32, intensity: 1.35 },
    accent: '#B48CFF',
  },
  {
    id: 'thalassa',
    name: 'THALASSA',
    kind: 'ocean',
    classification: 'Deep ocean world',
    teaser: 'One ocean, three hundred kilometres deep.',
    description:
      'Thalassa has no continents, only scattered volcanic islands and a single ocean hundreds of kilometres deep. Cyclones wander for years across it, and its currents glow teal where life gathers.',
    facts: [
      { label: 'Radius', value: '9,120 km' },
      { label: 'Surface', value: '22 °C' },
      { label: 'Air', value: 'Nitrogen, water vapour' },
    ],
    radius: 1.05,
    orbitRadius: 31,
    yearDays: 2180,
    dayHours: 31,
    mass: 2.6,
    moonCount: 3,
    moons: [
      { name: 'Tamar', km: 150_000, drawn: 2.0, radiusKm: 900, phase: 1.1, color: '#C4CCD6' },
      { name: 'Brine', km: 290_000, drawn: 2.6, radiusKm: 1_300, phase: 4.0, color: '#D8DCE0' },
      { name: 'Cael', km: 520_000, drawn: 3.3, radiusKm: 600, phase: 5.5, color: '#A9A39C' },
    ],
    phase: 3.3,
    inclination: -0.06,
    axialTilt: 0.33,
    radiusKm: 9_120,
    atmosphere: { day: '#46D2E6', night: '#2A4FA8', shell: 1.1, density: 0.2, intensity: 1.15 },
    accent: '#46D2E6',
    clouds: { color: '#F2FBFF', opacity: 0.9, speed: 0.008 },
  },
  {
    id: 'orion',
    name: 'ORION',
    kind: 'giant',
    classification: 'Ringed gas giant',
    teaser: 'A banded giant crowned with rings.',
    description:
      'Orion holds more mass than the other five worlds combined. Its bands are storms that circle the planet in hours, and its rings of ice and dust are thin enough to see stars through. An amber storm has turned in its southern belt for centuries.',
    facts: [
      { label: 'Radius', value: '61,400 km' },
      { label: 'Cloud tops', value: '−150 °C' },
      { label: 'Air', value: 'Hydrogen, helium' },
    ],
    radius: 2.3,
    orbitRadius: 41,
    yearDays: 4310,
    dayHours: 10,
    mass: 410,
    moonCount: 27,
    moons: [
      { name: 'Heron', km: 420_000, drawn: 2.6, radiusKm: 1_800, phase: 0.3, color: '#D9CDB8' },
      { name: 'Calder', km: 680_000, drawn: 2.95, radiusKm: 2_400, phase: 2.6, color: '#B9A58C' },
      { name: 'Vane', km: 1_080_000, drawn: 3.3, radiusKm: 1_500, phase: 4.4, color: '#E6E1D8' },
      { name: 'Ashe', km: 1_900_000, drawn: 3.8, radiusKm: 2_600, phase: 1.5, color: '#9C8F84' },
      // Discovered on the surface (Phase 6): it crosses the ring arch the wrong way.
      { name: 'The retrograde moonlet', km: 1_300_000, drawn: 3.1, radiusKm: 45, phase: 3.3, inclination: 0.5, retrograde: true, color: '#E8D2B0' },
    ],
    phase: 5.4,
    inclination: 0.065,
    axialTilt: 0.47,
    radiusKm: 61_400,
    atmosphere: { day: '#F0D2A6', night: '#6B4A7A', shell: 1.05, density: 0.25, intensity: 0.7 },
    accent: '#E8C79A',
    rings: { inner: 1.35, outer: 2.35, colorA: '#E9DCC4', colorB: '#A89880' },
  },
]

export const PLANET_BY_ID = Object.fromEntries(PLANETS.map((p) => [p.id, p])) as Record<
  PlanetId,
  PlanetData
>

export const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth']

/** Every world the interface can name, Elys's and beyond (Phase 11). */
export const WORLD_BY_ID = { ...PLANET_BY_ID, liris: LIRIS } as Record<WorldId, WorldData>
export const isElysWorld = (id: WorldId): id is PlanetId => id !== 'liris'
