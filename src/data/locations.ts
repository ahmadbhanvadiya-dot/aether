import type { PlanetId } from './planets'

/**
 * Phase 3 exploration content. Each world has one continuous surface and three
 * locations on it. A location bends the terrain locally (lift / roughness /
 * set piece), places the camera, a landmark and a discovery signal, and sets
 * the light and weather. Coordinates are scene units (1 unit = 10 m).
 */

export type ShapeKind =
  | 'none'
  | 'coast' // a = slope, b = direction (radians)
  | 'crater' // a = radius, b = depth
  | 'canyon' // a = width, b = depth
  | 'volcano' // a = radius, b = height
  | 'atoll' // a = ring radius, b = ring height
  | 'abyss' // a = radius, b = depth (cloud decks)

export type LandmarkKind = 'none' | 'spires' | 'monolith' | 'arch' | 'geyser'

export type MotesKind = 'dust' | 'ash' | 'snow' | 'spray' | 'haze'

export interface LocationEnv {
  /** Elys: elevation and azimuth in radians. */
  sun: [number, number]
  sunColor: string
  zenith: string
  horizon: string
  /** Haze color below the horizon. */
  ground: string
  fog: number
  stars: number
  aurora: number
  lightning: number
  rain: number
  waves: number
  waterGlow: number
  fissure: number
  mirror: number
  /** Cloud layer: absolute height, cover 0–1. */
  cloudHeight: number
  cloudCover: number
  cloudColor: string
  motes: number
  /** Orion only: the observer's latitude, for the ring view. */
  ringLat: number
}

export interface LocationData {
  id: string
  planet: PlanetId
  name: string
  region: string
  /** Shown before discovery. */
  hint: string
  /** Revealed on discovery. */
  lore: string
  /** Name of what the signal turns out to be. */
  finding: string
  center: [number, number]
  /** Local terrain shaping. */
  terrain: { radius: number; lift: number; rough: number; shape: ShapeKind; a: number; b: number }
  camera: { at: [number, number]; eye: number; pitch: number; yawOffset?: number }
  landmark: { kind: LandmarkKind; at: [number, number]; scale: number; y?: number }
  /** Signal height above the landmark base (or the ground / water). */
  signalHeight: number
  env: LocationEnv
}

const base: Omit<LocationEnv, 'sun' | 'sunColor' | 'zenith' | 'horizon' | 'ground'> = {
  fog: 0.0016,
  stars: 0,
  aurora: 0,
  lightning: 0,
  rain: 0,
  waves: 0.2,
  waterGlow: 0,
  fissure: 0,
  mirror: 0,
  cloudHeight: 160,
  cloudCover: 0,
  cloudColor: '#F2F5FF',
  motes: 0.3,
  ringLat: 0,
}

export const LOCATIONS: LocationData[] = [
  // ---------------------------------------------------------------- AURELIS
  {
    id: 'aurelis-glass-shelf',
    planet: 'aurelis',
    name: 'The Glass Shelf',
    region: 'Northern coast of Aurelis',
    hint: 'A light flickers among the sea stacks.',
    lore: 'Sea stacks of pale quartz stand in water so clear the seabed shows a hundred metres down. At low sun the whole shelf turns to glass.',
    finding: 'Quartz resonance in the sea stacks',
    center: [0, 0],
    terrain: { radius: 300, lift: -12, rough: 0.15, shape: 'coast', a: 0.16, b: 0 },
    camera: { at: [60, 0], eye: 2.2, pitch: -0.02 },
    landmark: { kind: 'spires', at: [-80, -50], scale: 1, y: -6 },
    signalHeight: 30,
    env: {
      ...base,
      sun: [0.14, 0.5],
      sunColor: '#FFE7C8',
      zenith: '#1C4C8F',
      horizon: '#9CC6E8',
      ground: '#4C6E8A',
      fog: 0.0011,
      cloudHeight: 150,
      cloudCover: 0.45,
      motes: 0.15,
    },
  },
  {
    id: 'aurelis-halvard-ridge',
    planet: 'aurelis',
    name: 'Halvard Ridge',
    region: 'Central highlands of Aurelis',
    hint: 'Something glows on the summit above the clouds.',
    lore: 'The highest ridge on Aurelis sits above the weather. On clear nights the aurora hangs so low it seems to brush the snow.',
    finding: 'An ice cairn older than any settlement',
    center: [950, -520],
    terrain: { radius: 340, lift: 70, rough: 1.15, shape: 'none', a: 0, b: 0 },
    camera: { at: [0, 0], eye: 2.5, pitch: 0.06 },
    landmark: { kind: 'monolith', at: [-24, -46], scale: 0.55 },
    signalHeight: 12,
    env: {
      ...base,
      sun: [-0.16, 2.6],
      sunColor: '#C9D6FF',
      zenith: '#050A1E',
      horizon: '#1A2650',
      ground: '#0D1430',
      fog: 0.0009,
      stars: 1,
      aurora: 1,
      cloudHeight: -1, // resolved below the camera at runtime
      cloudCover: 0.75,
      cloudColor: '#9FB2E6',
      motes: 0.5,
    },
  },
  {
    id: 'aurelis-sounding-lagoon',
    planet: 'aurelis',
    name: 'The Sounding Lagoon',
    region: 'Equatorial reefs of Aurelis',
    hint: 'The water above the reef is warm, and something hums.',
    lore: 'A warm spring vents beneath the lagoon, and the water hums at a pitch you feel before you hear. Fish gather in rings around it.',
    finding: 'A singing thermal vent',
    center: [-820, 760],
    terrain: { radius: 320, lift: -3, rough: 0.12, shape: 'atoll', a: 150, b: 7 },
    camera: { at: [0, 150], eye: 2, pitch: -0.06 },
    landmark: { kind: 'geyser', at: [-8, 30], scale: 0.8 },
    signalHeight: 9,
    env: {
      ...base,
      sun: [0.95, 1.3],
      sunColor: '#FFF6E6',
      zenith: '#2468C2',
      horizon: '#BFE3F5',
      ground: '#5B93B5',
      fog: 0.0008,
      cloudHeight: 180,
      cloudCover: 0.3,
      waves: 0.08,
      motes: 0.1,
    },
  },

  // ---------------------------------------------------------------- NYX
  {
    id: 'nyx-vein-fields',
    planet: 'nyx',
    name: 'The Vein Fields',
    region: 'Equatorial plains of Nyx',
    hint: 'One fissure burns brighter than the rest.',
    lore: 'Cracks a hand’s width across run for hundreds of kilometres, each lit from below by the same slow violet pulse.',
    finding: 'A vent breathing violet light',
    center: [0, 0],
    terrain: { radius: 320, lift: 2, rough: 0.3, shape: 'none', a: 0, b: 0 },
    camera: { at: [30, 70], eye: 2, pitch: -0.05 },
    landmark: { kind: 'geyser', at: [-10, -60], scale: 1 },
    signalHeight: 10,
    env: {
      ...base,
      sun: [0.1, 4.2],
      sunColor: '#B9B4D8',
      zenith: '#07051A',
      horizon: '#2A2050',
      ground: '#141028',
      fog: 0.0018,
      stars: 0.8,
      fissure: 1,
      motes: 0.7,
    },
  },
  {
    id: 'nyx-cathedral',
    planet: 'nyx',
    name: 'Cathedral of Shards',
    region: 'Southern highlands of Nyx',
    hint: 'One of the crystal columns is warm.',
    lore: 'Crystal columns taller than towers grow from the slopes, all leaning toward the same point in the sky. Nobody knows what they are tracking.',
    finding: 'A column that tracks Elys',
    center: [860, 640],
    terrain: { radius: 320, lift: 14, rough: 0.9, shape: 'none', a: 0, b: 0 },
    camera: { at: [0, 60], eye: 2.2, pitch: 0.12 },
    landmark: { kind: 'spires', at: [0, -70], scale: 1.6, y: -2 },
    signalHeight: 44,
    env: {
      ...base,
      sun: [0.22, 5.1],
      sunColor: '#C4BEE6',
      zenith: '#06041A',
      horizon: '#241A48',
      ground: '#100C22',
      fog: 0.0016,
      stars: 0.6,
      fissure: 0.5,
      motes: 0.5,
    },
  },
  {
    id: 'nyx-quiet-caldera',
    planet: 'nyx',
    name: 'The Quiet Caldera',
    region: 'Polar rim of Nyx',
    hint: 'Something stands alone on the caldera floor.',
    lore: 'A perfect black slab stands at the centre of the caldera. Its surface is warm to the touch and older than the crater around it.',
    finding: 'A slab that predates its crater',
    center: [-940, -420],
    terrain: { radius: 360, lift: 8, rough: 0.35, shape: 'crater', a: 220, b: 48 },
    camera: { at: [0, 200], eye: 2.4, pitch: -0.08 },
    landmark: { kind: 'monolith', at: [0, 0], scale: 1.4 },
    signalHeight: 40,
    env: {
      ...base,
      sun: [-0.08, 1.2],
      sunColor: '#9C98C8',
      zenith: '#050414',
      horizon: '#1E1838',
      ground: '#0E0B1C',
      fog: 0.0011,
      stars: 1,
      fissure: 0.35,
      motes: 0.3,
    },
  },

  // ---------------------------------------------------------------- SOLARA
  {
    id: 'solara-amber-sea',
    planet: 'solara',
    name: 'The Amber Sea',
    region: 'Western dune sea of Solara',
    hint: 'A shape breaks the line of the dunes.',
    lore: 'Dunes three hundred metres high roll toward the horizon like a frozen swell. Every few years they uncover something, then bury it again.',
    finding: 'An obelisk the wind uncovered',
    center: [0, 0],
    terrain: { radius: 300, lift: 0, rough: 1, shape: 'none', a: 0, b: 0 },
    camera: { at: [0, 60], eye: 2.2, pitch: -0.04 },
    landmark: { kind: 'monolith', at: [26, -110], scale: 0.9, y: -4 },
    signalHeight: 26,
    env: {
      ...base,
      sun: [0.07, 0.4],
      sunColor: '#FFB46A',
      zenith: '#3A2A52',
      horizon: '#F0A060',
      ground: '#8A5A3A',
      fog: 0.0014,
      motes: 0.8,
    },
  },
  {
    id: 'solara-rustgate',
    planet: 'solara',
    name: 'Rustgate Canyon',
    region: 'Southern badlands of Solara',
    hint: 'Light catches under the stone arch.',
    lore: 'Wind has cut the plateau into a maze of red walls. At its heart a stone arch frames both moons when they rise together.',
    finding: 'Wind-cut glyphs beneath the arch',
    center: [760, -860],
    terrain: { radius: 340, lift: 24, rough: 0.55, shape: 'canyon', a: 46, b: 62 },
    camera: { at: [-15.9, 60], eye: 2.2, pitch: 0.1 },
    landmark: { kind: 'arch', at: [15.9, -60], scale: 1 },
    signalHeight: 9,
    env: {
      ...base,
      sun: [0.55, 2.2],
      sunColor: '#FFE2B0',
      zenith: '#5A86B8',
      horizon: '#E8C49A',
      ground: '#9A6440',
      fog: 0.0012,
      motes: 0.55,
    },
  },
  {
    id: 'solara-salt-mirror',
    planet: 'solara',
    name: 'The Salt Mirror',
    region: 'Eastern basin of Solara',
    hint: 'The crystals ring when you come close.',
    lore: 'A dry lakebed so flat it reflects the sky. Salt crystals grow in slow spirals across it, and they ring faintly in the afternoon heat.',
    finding: 'A crystal spiral that sings',
    center: [-860, 640],
    terrain: { radius: 380, lift: 1.5, rough: 0.03, shape: 'none', a: 0, b: 0 },
    camera: { at: [0, 70], eye: 1.8, pitch: -0.02 },
    landmark: { kind: 'spires', at: [0, -40], scale: 0.7 },
    signalHeight: 7,
    env: {
      ...base,
      sun: [0.2, 3.4],
      sunColor: '#FFE6C4',
      zenith: '#24508F',
      horizon: '#BFC6CC',
      ground: '#8E8676',
      fog: 0.0006,
      mirror: 1,
      motes: 0.2,
    },
  },

  // ---------------------------------------------------------------- VESPER
  {
    id: 'vesper-violet-abyss',
    planet: 'vesper',
    name: 'The Violet Abyss',
    region: 'Upper cloud deck of Vesper',
    hint: 'A signal rises out of the gulf.',
    lore: 'Between two storm towers the cloud deck falls away into a violet gulf with no visible floor. Probes dropped into it never stop transmitting wind.',
    finding: 'A probe still transmitting from below',
    center: [0, 0],
    terrain: { radius: 320, lift: 0, rough: 1, shape: 'abyss', a: 230, b: 90 },
    camera: { at: [0, 250], eye: 22, pitch: -0.12 },
    landmark: { kind: 'none', at: [0, 40], scale: 1 },
    signalHeight: 70,
    env: {
      ...base,
      sun: [0.42, 0.9],
      sunColor: '#F2DCFF',
      zenith: '#3A2470',
      horizon: '#C69AE6',
      ground: '#6A4A9A',
      fog: 0.0019,
      lightning: 0.3,
      cloudHeight: 95,
      cloudCover: 0.35,
      cloudColor: '#E6D2FF',
      motes: 0.35,
    },
  },
  {
    id: 'vesper-thunderhead-choir',
    planet: 'vesper',
    name: 'Thunderhead Choir',
    region: 'Night side of Vesper',
    hint: 'Between the flashes, a steady light.',
    lore: 'On Vesper’s night side the storms flash in rhythm, one tower answering another across thousands of kilometres.',
    finding: 'A rhythm in the lightning',
    center: [940, 420],
    terrain: { radius: 320, lift: 0, rough: 1.4, shape: 'none', a: 0, b: 0 },
    camera: { at: [0, 0], eye: 24, pitch: 0.02 },
    landmark: { kind: 'none', at: [-30, -90], scale: 1 },
    signalHeight: 22,
    env: {
      ...base,
      sun: [-0.3, 3.0],
      sunColor: '#B8A2E8',
      zenith: '#0C0828',
      horizon: '#3A2668',
      ground: '#221640',
      fog: 0.0016,
      lightning: 1,
      cloudHeight: 110,
      cloudCover: 0.25,
      cloudColor: '#6A55A8',
      motes: 0.2,
    },
  },
  {
    id: 'vesper-rose-terraces',
    planet: 'vesper',
    name: 'The Rose Terraces',
    region: 'Dawn terminator of Vesper',
    hint: 'Something rests on the highest terrace.',
    lore: 'At the edge of dawn the cloud layers separate into terraces of rose and lilac, each moving at its own speed.',
    finding: 'A drifting seed the size of a house',
    center: [-760, -760],
    terrain: { radius: 320, lift: 6, rough: 1.9, shape: 'none', a: 0, b: 0 },
    camera: { at: [0, 60], eye: 20, pitch: -0.04 },
    landmark: { kind: 'none', at: [20, -80], scale: 1 },
    signalHeight: 18,
    env: {
      ...base,
      sun: [0.05, 5.6],
      sunColor: '#FFC2D8',
      zenith: '#41306E',
      horizon: '#F2A6C2',
      ground: '#8E5A8A',
      fog: 0.0017,
      cloudHeight: 70,
      cloudCover: 0.4,
      cloudColor: '#FFD6E6',
      motes: 0.3,
    },
  },

  // ---------------------------------------------------------------- THALASSA
  {
    id: 'thalassa-ember-atoll',
    planet: 'thalassa',
    name: 'Ember Atoll',
    region: 'Western archipelago of Thalassa',
    hint: 'Steam rises from a vent on the slope.',
    lore: 'A young volcano breaks the surface here, wrapped in steam. Its black sand beaches are the newest land on the planet.',
    finding: 'New land, still warm',
    center: [0, 0],
    terrain: { radius: 340, lift: -5, rough: 0.15, shape: 'volcano', a: 260, b: 92 },
    camera: { at: [0, 228], eye: 2.2, pitch: 0.12 },
    landmark: { kind: 'geyser', at: [36, 118], scale: 1.4 },
    signalHeight: 14,
    env: {
      ...base,
      sun: [0.09, 5.0],
      sunColor: '#FFB27A',
      zenith: '#1E2E5A',
      horizon: '#E89A78',
      ground: '#3A3A52',
      fog: 0.0012,
      cloudHeight: 170,
      cloudCover: 0.5,
      cloudColor: '#FFD8C4',
      waves: 0.35,
      motes: 0.3,
    },
  },
  {
    id: 'thalassa-long-storm',
    planet: 'thalassa',
    name: 'The Long Storm',
    region: 'Southern cyclone belt of Thalassa',
    hint: 'A light holds steady above the swell.',
    lore: 'This cyclone has circled the southern ocean for eleven years. Inside the rain bands the sea rises in hills you can watch for minutes.',
    finding: 'A buoy that has ridden the storm for a decade',
    center: [940, -620],
    terrain: { radius: 320, lift: -30, rough: 0.1, shape: 'none', a: 0, b: 0 },
    camera: { at: [0, 60], eye: 5, pitch: 0.02 },
    landmark: { kind: 'none', at: [-20, -70], scale: 1 },
    signalHeight: 7,
    env: {
      ...base,
      sun: [0.3, 1.5],
      sunColor: '#A8B8C8',
      zenith: '#1A222E',
      horizon: '#4C5A66',
      ground: '#222C36',
      fog: 0.0042,
      lightning: 0.6,
      rain: 1,
      waves: 1,
      cloudHeight: 80,
      cloudCover: 0.95,
      cloudColor: '#56626E',
      motes: 0.8,
    },
  },
  {
    id: 'thalassa-lantern-current',
    planet: 'thalassa',
    name: 'Lantern Current',
    region: 'Eastern deep of Thalassa',
    hint: 'The current is brightest around one point.',
    lore: 'At night this current glows from end to end. Whatever lights it moves against the flow, as if heading somewhere.',
    finding: 'A shoal swimming against the current',
    center: [-860, 700],
    terrain: { radius: 320, lift: -24, rough: 0.2, shape: 'volcano', a: 40, b: 30 },
    camera: { at: [0, 70], eye: 2.6, pitch: -0.06 },
    landmark: { kind: 'none', at: [10, -30], scale: 1 },
    signalHeight: 5,
    env: {
      ...base,
      sun: [-0.25, 2.2],
      sunColor: '#9FB8D8',
      zenith: '#02060E',
      horizon: '#0C2236',
      ground: '#04121E',
      fog: 0.0012,
      stars: 0.9,
      waterGlow: 1,
      waves: 0.15,
      cloudHeight: 200,
      cloudCover: 0.15,
      cloudColor: '#4A6A8A',
      motes: 0.15,
    },
  },

  // ---------------------------------------------------------------- ORION
  {
    id: 'orion-ringrise',
    planet: 'orion',
    name: 'Ringrise',
    region: 'Equatorial cloud tops of Orion',
    hint: 'A light drifts along the cloud tops.',
    lore: 'From the equator the rings are a single blade of light cutting the sky in half, sharp enough to read by.',
    finding: 'Ice from the rings, falling as snow',
    center: [0, 0],
    terrain: { radius: 320, lift: 0, rough: 1, shape: 'none', a: 0, b: 0 },
    camera: { at: [0, 60], eye: 26, pitch: 0.3 },
    landmark: { kind: 'none', at: [-30, -90], scale: 1 },
    signalHeight: 18,
    env: {
      ...base,
      sun: [0.35, 0.6],
      sunColor: '#FFF0D6',
      zenith: '#3E5C8E',
      horizon: '#E8D6B8',
      ground: '#A88A66',
      fog: 0.0014,
      cloudHeight: 120,
      cloudCover: 0.25,
      cloudColor: '#FFF4E2',
      ringLat: 0.42,
      motes: 0.3,
    },
  },
  {
    id: 'orion-amber-eye',
    planet: 'orion',
    name: 'The Amber Eye',
    region: 'Great southern storm of Orion',
    hint: 'A signal circles the eye of the storm.',
    lore: 'The great storm is wider than Aurelis. From its rim the clouds spiral down into an amber dark that has turned for three centuries.',
    finding: 'A pressure core that never moves',
    center: [920, 520],
    terrain: { radius: 360, lift: 0, rough: 1.2, shape: 'abyss', a: 260, b: 70 },
    camera: { at: [0, 300], eye: 30, pitch: -0.2 },
    landmark: { kind: 'none', at: [0, 60], scale: 1 },
    signalHeight: 52,
    env: {
      ...base,
      sun: [0.5, 2.0],
      sunColor: '#FFE2B8',
      zenith: '#4A5A86',
      horizon: '#E0B890',
      ground: '#8A5A3A',
      fog: 0.0013,
      cloudHeight: 140,
      cloudCover: 0.2,
      cloudColor: '#FFE6CC',
      ringLat: 0.95,
      motes: 0.4,
    },
  },
  {
    id: 'orion-polar-lanterns',
    planet: 'orion',
    name: 'Polar Lanterns',
    region: 'Northern high latitudes of Orion',
    hint: 'One of the lanterns is closer than the others.',
    lore: 'Near the pole the rings stand high overhead in a full arch, and Orion’s moons cross it like slow lanterns.',
    finding: 'A moonlet skimming the cloud tops',
    center: [-860, -760],
    terrain: { radius: 320, lift: 0, rough: 0.8, shape: 'none', a: 0, b: 0 },
    camera: { at: [0, 60], eye: 24, pitch: 0.18 },
    landmark: { kind: 'none', at: [24, -80], scale: 1 },
    signalHeight: 34,
    env: {
      ...base,
      sun: [-0.04, 4.4],
      sunColor: '#E6C8FF',
      zenith: '#060A1E',
      horizon: '#2C2A4E',
      ground: '#1E1A30',
      fog: 0.0011,
      stars: 0.9,
      aurora: 0.45,
      cloudHeight: 140,
      cloudCover: 0.1,
      cloudColor: '#8E86B8',
      ringLat: 0.8,
      motes: 0.15,
    },
  },
]

export const LOCATION_BY_ID = Object.fromEntries(LOCATIONS.map((l) => [l.id, l])) as Record<string, LocationData>

export function locationsFor(planet: PlanetId) {
  return LOCATIONS.filter((l) => l.planet === planet)
}

export const TOTAL_LOCATIONS = LOCATIONS.length

/**
 * Per-world surface settings that do not change between locations.
 */
export interface SurfaceSettings {
  seed: number
  /** Which terrain recipe the surface shader uses. */
  kind: 'terrestrial' | 'dark' | 'desert' | 'deck' | 'ocean' | 'giant'
  water: boolean
  waterDeep: string
  waterShallow: string
  palette: [string, string, string, string, string]
  motes: MotesKind
  moteColor: string
  moons: number
  rings: boolean
  /** Landmark material. */
  rock: string
  glow: string
}

export const SURFACES: Record<PlanetId, SurfaceSettings> = {
  aurelis: {
    seed: 11,
    kind: 'terrestrial',
    water: true,
    waterDeep: '#062A48',
    waterShallow: '#1E8FA8',
    // sand, lowland, highland, rock, snow
    palette: ['#C9B58E', '#3E5A2A', '#6B6A3E', '#5E5A58', '#EEF2F8'],
    motes: 'snow',
    moteColor: '#EAF2FF',
    moons: 1,
    rings: false,
    rock: '#9A9C9E',
    glow: '#6FB6FF',
  },
  nyx: {
    seed: 23,
    kind: 'dark',
    water: false,
    waterDeep: '#000000',
    waterShallow: '#000000',
    // basalt low, basalt high, glass, ash, crystal
    palette: ['#2A2734', '#3A3548', '#4A4260', '#4E4858', '#8C6CFF'],
    motes: 'ash',
    moteColor: '#9C80FF',
    moons: 0,
    rings: false,
    rock: '#120F1C',
    glow: '#8C6CFF',
  },
  solara: {
    seed: 37,
    kind: 'desert',
    water: false,
    waterDeep: '#000000',
    waterShallow: '#000000',
    // sand, sand light, rock, rust, salt
    palette: ['#C4893F', '#E0B26A', '#8A5634', '#6A3420', '#CFC7B8'],
    motes: 'dust',
    moteColor: '#F2C88C',
    moons: 2,
    rings: false,
    rock: '#9A5A36',
    glow: '#F2B66B',
  },
  vesper: {
    seed: 41,
    kind: 'deck',
    water: false,
    waterDeep: '#000000',
    waterShallow: '#000000',
    // deep, mid, light, rose, highlight
    palette: ['#3A2268', '#7A5AB8', '#C9B0EE', '#D890B8', '#F6ECFF'],
    motes: 'haze',
    moteColor: '#E2D0FF',
    moons: 0,
    rings: false,
    rock: '#C9B0EE',
    glow: '#B48CFF',
  },
  thalassa: {
    seed: 53,
    kind: 'ocean',
    water: true,
    waterDeep: '#021A26',
    waterShallow: '#0E6A72',
    // black sand, rock, moss, ash, foam
    palette: ['#1C1C22', '#2E2E34', '#2E4A2A', '#4A4A50', '#E6F2F2'],
    motes: 'spray',
    moteColor: '#DDEEF2',
    moons: 3,
    rings: false,
    rock: '#26262C',
    glow: '#46D2E6',
  },
  orion: {
    seed: 67,
    kind: 'giant',
    water: false,
    waterDeep: '#000000',
    waterShallow: '#000000',
    // brown, tan, cream, slate, amber
    palette: ['#6A4430', '#B08458', '#EADCC0', '#7C808E', '#D8743A'],
    motes: 'haze',
    moteColor: '#FFE8CC',
    moons: 4,
    rings: true,
    rock: '#EADCC0',
    glow: '#E8C79A',
  },
}
