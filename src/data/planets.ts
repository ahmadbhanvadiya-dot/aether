/**
 * The six worlds of the Aether system, in orbital order around Elys.
 * `kind` selects the surface recipe in scene/galaxy/shaders.ts.
 */
export type PlanetId = 'aurelis' | 'nyx' | 'solara' | 'vesper' | 'thalassa' | 'orion'

export type PlanetKind = 'terrestrial' | 'dark' | 'desert' | 'cloud' | 'ocean' | 'giant'

export interface PlanetFact {
  label: string
  value: string
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
  /** Seconds of scene time per orbit. */
  orbitPeriod: number
  /** Starting angle on the orbit, radians. */
  phase: number
  /** Orbit inclination, radians. */
  inclination: number
  axialTilt: number
  /** Self-rotation, radians per second of scene time. */
  spin: number
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
      { label: 'Day', value: '26 hours' },
      { label: 'Year', value: '341 days' },
      { label: 'Surface', value: '14 °C' },
      { label: 'Air', value: 'Nitrogen, oxygen' },
      { label: 'Moons', value: '1' },
    ],
    radius: 0.78,
    orbitRadius: 10,
    orbitPeriod: 80,
    phase: 0.6,
    inclination: 0.02,
    axialTilt: 0.41,
    spin: 0.09,
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
      { label: 'Day', value: '61 hours' },
      { label: 'Year', value: '612 days' },
      { label: 'Surface', value: '−140 °C' },
      { label: 'Air', value: 'Trace argon' },
      { label: 'Moons', value: 'None' },
    ],
    radius: 0.62,
    orbitRadius: 14.5,
    orbitPeriod: 130,
    phase: 2.4,
    inclination: -0.035,
    axialTilt: 0.12,
    spin: 0.05,
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
      { label: 'Day', value: '19 hours' },
      { label: 'Year', value: '902 days' },
      { label: 'Surface', value: '48 °C' },
      { label: 'Air', value: 'Thin CO₂, dust' },
      { label: 'Moons', value: '2' },
    ],
    radius: 0.88,
    orbitRadius: 19.5,
    orbitPeriod: 190,
    phase: 4.3,
    inclination: 0.03,
    axialTilt: 0.29,
    spin: 0.11,
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
      { label: 'Day', value: '5 days' },
      { label: 'Year', value: '1,420 days' },
      { label: 'Surface', value: '460 °C' },
      { label: 'Air', value: 'CO₂, sulfur haze' },
      { label: 'Moons', value: 'None' },
    ],
    radius: 0.96,
    orbitRadius: 25,
    orbitPeriod: 260,
    phase: 1.4,
    inclination: -0.02,
    axialTilt: 0.05,
    spin: 0.03,
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
      { label: 'Day', value: '31 hours' },
      { label: 'Year', value: '2,180 days' },
      { label: 'Surface', value: '22 °C' },
      { label: 'Air', value: 'Nitrogen, water vapour' },
      { label: 'Moons', value: '3' },
    ],
    radius: 1.05,
    orbitRadius: 31,
    orbitPeriod: 340,
    phase: 3.3,
    inclination: 0.025,
    axialTilt: 0.33,
    spin: 0.08,
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
      { label: 'Day', value: '10 hours' },
      { label: 'Year', value: '4,310 days' },
      { label: 'Cloud tops', value: '−150 °C' },
      { label: 'Air', value: 'Hydrogen, helium' },
      { label: 'Moons', value: '27' },
    ],
    radius: 2.3,
    orbitRadius: 41,
    orbitPeriod: 480,
    phase: 5.4,
    inclination: -0.015,
    axialTilt: 0.47,
    spin: 0.14,
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
