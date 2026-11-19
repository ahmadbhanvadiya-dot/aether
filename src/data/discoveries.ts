import { LOCATION_BY_ID, LOCATIONS } from './locations'
import { PLANETS, type PlanetId } from './planets'

/**
 * Phase 6: the catalogue of everything that can be found. One static list,
 * keyed by id; what the visitor has found lives only in the exploration store
 * (`discovered[id] = timestamp`), the same map Phase 3 signals use, so there is
 * one source of truth for progress.
 *
 * - `signal`: each location's original discovery signal (id = the location id,
 *   so progress saved before Phase 6 stays valid).
 * - `poi`: points of interest placed around each location, faintly visible.
 * - `secret`: hidden discoveries, invisible until the visitor looks toward
 *   them for a moment. Optional: they never count against completion.
 */

export type Category = 'geology' | 'structure' | 'atmosphere' | 'life' | 'anomaly'

export const CATEGORIES: Record<Category, { label: string; plural: string }> = {
  geology: { label: 'Geological formation', plural: 'Geological formations' },
  structure: { label: 'Ancient structure', plural: 'Ancient structures' },
  atmosphere: { label: 'Atmospheric phenomenon', plural: 'Atmospheric phenomena' },
  life: { label: 'Unusual lifeform', plural: 'Unusual lifeforms' },
  anomaly: { label: 'Celestial anomaly', plural: 'Celestial anomalies' },
}

export const CATEGORY_ORDER: Category[] = ['geology', 'structure', 'atmosphere', 'life', 'anomaly']

export type DiscoveryKind = 'signal' | 'poi' | 'secret'

/**
 * Where a find sits, relative to its location's camera pose: a bearing from
 * the pose's heading (radians, + is to the right), a distance (scene units),
 * and either a height above the ground (`rise`) or an elevation angle into the
 * sky (`elev`). Signals use their location's existing signal position.
 */
export interface Placement {
  bearing: number
  distance: number
  rise?: number
  elev?: number
}

export interface DiscoveryData {
  id: string
  kind: DiscoveryKind
  planet: PlanetId
  location: string
  name: string
  category: Category
  description: string
  placement?: Placement
  /** Hidden discoveries: the report the Observatory shows before one is found. */
  lead?: string
}

type Entry = Omit<DiscoveryData, 'kind' | 'planet' | 'location' | 'id'> & { key: string }

/** Categories for the Phase 3 signals (their name and text come from the location). */
const SIGNAL_CATEGORY: Record<string, Category> = {
  'aurelis-glass-shelf': 'geology',
  'aurelis-halvard-ridge': 'structure',
  'aurelis-sounding-lagoon': 'geology',
  'nyx-vein-fields': 'geology',
  'nyx-cathedral': 'anomaly',
  'nyx-quiet-caldera': 'structure',
  'solara-amber-sea': 'structure',
  'solara-rustgate': 'structure',
  'solara-salt-mirror': 'geology',
  'vesper-violet-abyss': 'anomaly',
  'vesper-thunderhead-choir': 'atmosphere',
  'vesper-rose-terraces': 'life',
  'thalassa-ember-atoll': 'geology',
  'thalassa-long-storm': 'anomaly',
  'thalassa-lantern-current': 'life',
  'orion-ringrise': 'atmosphere',
  'orion-amber-eye': 'atmosphere',
  'orion-polar-lanterns': 'anomaly',
}

/** Points of interest: two per location. */
const POIS: Record<string, Entry[]> = {
  // ---------------------------------------------------------------- AURELIS
  'aurelis-glass-shelf': [
    {
      key: 'tide-gardens',
      name: 'Tidal glass gardens',
      category: 'life',
      description:
        'Colonies of clear-shelled polyps grow on the drowned quartz. At low sun they catch the light, and the shallows glitter for kilometres.',
      placement: { bearing: -0.34, distance: 70, rise: 0.6 },
    },
    {
      key: 'folded-strata',
      name: 'The folded strata',
      category: 'geology',
      description:
        'A cliff where the coast has buckled like cloth: forty bands of white and grey rock, each laid down by a flood older than the last.',
      placement: { bearing: 0.55, distance: 150, rise: 12 },
    },
  ],
  'aurelis-halvard-ridge': [
    {
      key: 'snow-lichen',
      name: 'Snow lichen',
      category: 'life',
      description:
        'A lichen that feeds on starlight filtered through the ice. It glows a faint green beneath fresh snow, and grows nowhere else on Aurelis.',
      placement: { bearing: -0.3, distance: 60, rise: 0.5 },
    },
    {
      key: 'curtain-aurora',
      name: 'The low curtain',
      category: 'atmosphere',
      description:
        'On Halvard the aurora descends below the summit. Its lower edge ripples across the snowfield like a hem in the wind.',
      placement: { bearing: 0.45, distance: 420, elev: 0.26 },
    },
  ],
  'aurelis-sounding-lagoon': [
    {
      key: 'spiral-coral',
      name: 'Spiral coral',
      category: 'life',
      description:
        'Coral that grows in one unbroken spiral two hundred metres across, centred on the vent. Each turn is a year of warm water.',
      placement: { bearing: -0.32, distance: 90, rise: 0.4 },
    },
    {
      key: 'drowned-causeway',
      name: 'The drowned causeway',
      category: 'structure',
      description:
        'A line of fitted stone blocks runs under the lagoon toward the open sea. The joints are finer than any tool known on Aurelis could cut.',
      placement: { bearing: 0.5, distance: 120, rise: 0.3 },
    },
  ],
  // -------------------------------------------------------------------- NYX
  'nyx-vein-fields': [
    {
      key: 'glass-fumaroles',
      name: 'Glass-capped fumaroles',
      category: 'geology',
      description:
        'Vents sealed by their own cooled glass. Each holds a bubble of violet gas that brightens and fades on a nine-minute cycle.',
      placement: { bearing: 0.5, distance: 80, rise: 1 },
    },
    {
      key: 'vein-moths',
      name: 'Vein moths',
      category: 'life',
      description:
        'Pale, wide-winged creatures that ride the warm air above the cracks and never land. They steer by the violet light below.',
      placement: { bearing: -0.32, distance: 45, rise: 6 },
    },
  ],
  'nyx-cathedral': [
    {
      key: 'fallen-column',
      name: 'The fallen column',
      category: 'geology',
      description:
        'One column has broken and fallen. Inside, the crystal is hollow and ringed like a tree: three hundred thousand rings.',
      placement: { bearing: -0.34, distance: 110, rise: 2 },
    },
    {
      key: 'starward-stair',
      name: 'The starward stair',
      category: 'structure',
      description:
        'Steps cut into the slope, climbing toward the point the columns lean to. They stop halfway up, at nothing.',
      placement: { bearing: 0.55, distance: 140, rise: 6 },
    },
  ],
  'nyx-quiet-caldera': [
    {
      key: 'frozen-lake',
      name: 'The double-starred lake',
      category: 'geology',
      description:
        'The caldera floor holds a lake frozen so clear the stars show twice. It has not thawed in recorded time.',
      placement: { bearing: 0.45, distance: 120, rise: 0.4 },
    },
    {
      key: 'second-shadow',
      name: 'The second shadow',
      category: 'anomaly',
      description:
        'Under a single star the slab casts two shadows. The second points to a place on the rim where nothing stands.',
      placement: { bearing: -0.3, distance: 160, rise: 1 },
    },
  ],
  // ----------------------------------------------------------------- SOLARA
  'solara-amber-sea': [
    {
      key: 'singing-dune',
      name: 'The singing dune',
      category: 'geology',
      description:
        'When the wind crosses its crest, this dune sounds one low, continuous note. The pitch drops a semitone every century.',
      placement: { bearing: -0.34, distance: 220, rise: 30 },
    },
    {
      key: 'glass-burrows',
      name: 'Glass burrows',
      category: 'life',
      description:
        'Tunnels lined with fused sand, made by something that moves through the dunes on heat alone. The burrows are still warm.',
      placement: { bearing: 0.45, distance: 70, rise: 0.6 },
    },
  ],
  'solara-rustgate': [
    {
      key: 'hanging-gardens',
      name: 'Hanging gardens',
      category: 'life',
      description:
        'Rust-coloured ferns grow from the canyon walls, fed by seep water. They close at noon and open after dark.',
      placement: { bearing: -0.32, distance: 90, rise: 18 },
    },
    {
      key: 'balanced-stone',
      name: 'The balanced stone',
      category: 'geology',
      description:
        'A boulder the size of a house rests on a point no wider than a hand. The wind has been shaping it for a million years.',
      placement: { bearing: 0.5, distance: 130, rise: 10 },
    },
  ],
  'solara-salt-mirror': [
    {
      key: 'mirage-towers',
      name: 'Mirage towers',
      category: 'atmosphere',
      description:
        'In the afternoon heat a city rises from the far edge of the lake: towers, bridges, lights. It reflects nothing on Solara.',
      placement: { bearing: 0.5, distance: 620, elev: 0.04 },
    },
    {
      key: 'survey-rings',
      name: 'Survey rings',
      category: 'structure',
      description:
        'Iron posts set in perfect circles across the basin, rusted to red lace. Whoever surveyed this lake expected to measure it again.',
      placement: { bearing: -0.32, distance: 100, rise: 1 },
    },
  ],
  // ----------------------------------------------------------------- VESPER
  'vesper-violet-abyss': [
    {
      key: 'cloud-whales',
      name: 'Cloud whales',
      category: 'life',
      description:
        'Gas-filled bodies kilometres long drift along the edge of the gulf, feeding on the charge that gathers at the storm tops.',
      placement: { bearing: -0.34, distance: 300, rise: 30 },
    },
    {
      key: 'downward-lightning',
      name: 'Downward lightning',
      category: 'atmosphere',
      description:
        'Lightning that strikes down into the gulf and never up. Its light takes seconds to fade from the cloud walls.',
      placement: { bearing: 0.45, distance: 260, rise: 10 },
    },
  ],
  'vesper-thunderhead-choir': [
    {
      key: 'red-sprites',
      name: 'Red sprites',
      category: 'atmosphere',
      description:
        'Jellyfish-shaped flashes high above the thunderheads, lasting a few thousandths of a second. Here they repeat in time with the choir.',
      placement: { bearing: 0.5, distance: 520, elev: 0.25 },
    },
    {
      key: 'storm-kites',
      name: 'Storm kites',
      category: 'life',
      description:
        'Membranous flyers that ride the updrafts between towers and glow after each flash, like embers in a draught.',
      placement: { bearing: -0.32, distance: 120, rise: 25 },
    },
  ],
  'vesper-rose-terraces': [
    {
      key: 'layer-bridge',
      name: 'The layer bridge',
      category: 'atmosphere',
      description:
        'A column of cloud links two terraces, rising and falling like a slow breath. It forms at the same place every dawn.',
      placement: { bearing: -0.34, distance: 220, rise: 20 },
    },
    {
      key: 'pollen-tide',
      name: 'The pollen tide',
      category: 'life',
      description:
        'Clouds of fine golden spores released by the drifting seeds at first light. They tint the whole terminator pink.',
      placement: { bearing: 0.45, distance: 160, rise: 10 },
    },
  ],
  // --------------------------------------------------------------- THALASSA
  'thalassa-ember-atoll': [
    {
      key: 'pillow-lava',
      name: 'Pillow lava shelf',
      category: 'geology',
      description:
        'Where the lava met the sea it froze into heaps of glassy black pillows. They still crack and tick as they cool.',
      placement: { bearing: -0.34, distance: 70, rise: 0.6 },
    },
    {
      key: 'first-colonists',
      name: 'The first colonists',
      category: 'life',
      description:
        'Mats of orange bacteria already spread across the steaming rock. The atoll is three years old and already alive.',
      placement: { bearing: 0.45, distance: 90, rise: 1 },
    },
  ],
  'thalassa-long-storm': [
    {
      key: 'eyewall',
      name: 'The eyewall',
      category: 'atmosphere',
      description:
        'A wall of cloud fifteen kilometres high that turns once every nine hours. From here it fills half the sky.',
      placement: { bearing: 0.5, distance: 700, elev: 0.15 },
    },
    {
      key: 'standing-wave',
      name: 'The standing wave',
      category: 'anomaly',
      description:
        'A wave that does not move: a hill of water held in place where two deep currents meet. It has stood for eight days.',
      placement: { bearing: -0.32, distance: 140, rise: 6 },
    },
  ],
  'thalassa-lantern-current': [
    {
      key: 'lantern-jellies',
      name: 'Lantern jellies',
      category: 'life',
      description:
        'Bell-shaped drifters, each lit from within, that link their tentacles into glowing chains a kilometre long.',
      placement: { bearing: 0.45, distance: 60, rise: 0.6 },
    },
    {
      key: 'sunken-spire',
      name: 'The sunken spire',
      category: 'structure',
      description:
        'A tower stands twenty metres below the surface, and the lights gather around it as though it were a reef.',
      placement: { bearing: -0.34, distance: 110, rise: 0.3 },
    },
  ],
  // ------------------------------------------------------------------ ORION
  'orion-ringrise': [
    {
      key: 'ring-shadow',
      name: 'The ring shadow',
      category: 'anomaly',
      description:
        'The rings lay a shadow across the clouds a thousand kilometres wide, its edges razor sharp, sliding north with the seasons.',
      placement: { bearing: 0.5, distance: 500, rise: 1 },
    },
    {
      key: 'ammonia-blooms',
      name: 'Ammonia blooms',
      category: 'atmosphere',
      description:
        'White plumes well up from warmer layers below and spread into anvils that last a day before they sink again.',
      placement: { bearing: -0.32, distance: 300, rise: 20 },
    },
  ],
  'orion-amber-eye': [
    {
      key: 'spiral-lightning',
      name: 'Spiral lightning',
      category: 'atmosphere',
      description:
        "Lightning follows the storm's spiral arms down into the eye, outlining it in pale blue for an instant.",
      placement: { bearing: 0.45, distance: 400, rise: 5 },
    },
    {
      key: 'rim-drifters',
      name: 'Rim drifters',
      category: 'life',
      description:
        'Floating membranes that ride the edge of the storm, folding and unfolding with the pressure. They have circled the eye for generations.',
      placement: { bearing: -0.34, distance: 150, rise: 15 },
    },
  ],
  'orion-polar-lanterns': [
    {
      key: 'polar-hexagon',
      name: 'The polar hexagon',
      category: 'atmosphere',
      description: 'A six-sided jet stream circles the pole, its edges as straight as if they had been ruled.',
      placement: { bearing: -0.34, distance: 600, rise: 1 },
    },
    {
      key: 'ring-spokes',
      name: 'Ring spokes',
      category: 'anomaly',
      description:
        'Dark radial spokes appear across the rings and vanish within hours, never in the same place twice.',
      placement: { bearing: 0.45, distance: 900, elev: 0.35 },
    },
  ],
}

/** Hidden discoveries: one per world, away from the view you arrive with. */
const SECRETS: Record<PlanetId, Entry & { location: string }> = {
  aurelis: {
    key: 'watchers-ring',
    location: 'aurelis-halvard-ridge',
    name: "The watcher's ring",
    category: 'structure',
    description:
      'A circle of standing ice behind the summit. Each block is aligned to a star that is no longer in the sky.',
    lead: 'Climbers say the ridge is not the highest thing on Halvard. Look back the way you came.',
    placement: { bearing: Math.PI, distance: 120, rise: 4 },
  },
  nyx: {
    key: 'unlit-eye',
    location: 'nyx-quiet-caldera',
    name: 'The unlit eye',
    category: 'anomaly',
    description:
      'A round, exact patch of sky above the caldera where no stars show. It moves with the slab, not with the heavens.',
    lead: 'On the polar rim, one part of the sky is emptier than the rest.',
    placement: { bearing: 2.4, distance: 900, elev: 0.36 },
  },
  solara: {
    key: 'second-arch',
    location: 'solara-rustgate',
    name: 'The second arch',
    category: 'structure',
    description:
      'A twin of the great arch, buried to its keystone behind the canyon wall. Its glyphs are a mirror image of the first.',
    lead: 'Every gate is built to face another.',
    placement: { bearing: Math.PI, distance: 140, rise: 2 },
  },
  vesper: {
    key: 'ghost-moon',
    location: 'vesper-rose-terraces',
    name: 'The ghost moon',
    category: 'anomaly',
    description:
      'A moon Vesper does not have, seen only from the dawn terraces, low in the west. It goes through phases.',
    lead: 'Turn away from the dawn, and wait.',
    placement: { bearing: Math.PI, distance: 1200, elev: 0.12 },
  },
  thalassa: {
    key: 'breathing-sea',
    location: 'thalassa-ember-atoll',
    name: 'The breathing sea',
    category: 'life',
    description:
      'Behind the atoll the sea rises and falls on a slow rhythm of its own: one creature, kilometres wide, just under the surface.',
    lead: 'The newest land has a neighbour older than the ocean. It is not in front of you.',
    placement: { bearing: 2.6, distance: 260, rise: 0.6 },
  },
  orion: {
    key: 'retrograde-moonlet',
    location: 'orion-polar-lanterns',
    name: 'The retrograde moonlet',
    category: 'anomaly',
    description: 'A small moon crossing the ring arch the wrong way, against every other body in the system.',
    lead: 'Count the lanterns overhead. One of them is going the wrong way.',
    placement: { bearing: -2.2, distance: 1400, elev: 0.4 },
  },
}

function build(): DiscoveryData[] {
  const out: DiscoveryData[] = []
  for (const loc of LOCATIONS) {
    out.push({
      id: loc.id,
      kind: 'signal',
      planet: loc.planet,
      location: loc.id,
      name: loc.finding,
      category: SIGNAL_CATEGORY[loc.id],
      description: loc.lore,
    })
    for (const { key, ...e } of POIS[loc.id] ?? []) {
      out.push({ ...e, id: `${loc.id}.${key}`, kind: 'poi', planet: loc.planet, location: loc.id })
    }
  }
  for (const p of PLANETS) {
    const { key, location, ...e } = SECRETS[p.id]
    out.push({ ...e, id: `${location}.${key}`, kind: 'secret', planet: p.id, location })
  }
  return out
}

export const DISCOVERIES: DiscoveryData[] = build()

export const DISCOVERY_BY_ID: Record<string, DiscoveryData> = Object.fromEntries(DISCOVERIES.map((d) => [d.id, d]))

if (import.meta.env.DEV) {
  if (Object.keys(DISCOVERY_BY_ID).length !== DISCOVERIES.length) throw new Error('Duplicate discovery id')
  for (const d of DISCOVERIES) if (!LOCATION_BY_ID[d.location]) throw new Error(`Unknown location for ${d.id}`)
}

/** Everything the visitor is expected to find (hidden discoveries are extra). */
export const VISIBLE = DISCOVERIES.filter((d) => d.kind !== 'secret')
export const HIDDEN = DISCOVERIES.filter((d) => d.kind === 'secret')
export const TOTAL_DISCOVERIES = VISIBLE.length

export const discoveriesFor = (planet: PlanetId) => DISCOVERIES.filter((d) => d.planet === planet)
export const discoveriesAt = (location: string) => DISCOVERIES.filter((d) => d.location === location)
