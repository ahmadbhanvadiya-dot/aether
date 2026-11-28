import { FIND_BY_ID } from './discoveries'
import { READING_BY_ID } from './waystation'

/**
 * Phase 8: expeditions. Static content only — progress is never stored. An
 * objective is complete when every discovery it names is in the exploration
 * store (`discovered[id]`), and only after the objective before it, so a find
 * on one world opens the next lead on another. See state/expeditions.ts.
 */

export type FragmentKind = 'transmission' | 'record' | 'log' | 'clue'

export const FRAGMENT_KINDS: Record<FragmentKind, string> = {
  transmission: 'Transmission',
  record: 'Ancient record',
  log: 'Research log',
  clue: 'Environmental clue',
}

export interface Fragment {
  id: string
  kind: FragmentKind
  title: string
  /** Where it came from, as the instruments state it. */
  source: string
  body: string[]
}

export interface Objective {
  id: string
  title: string
  /** What to do and where, shown once the objective is open. */
  brief: string
  /** Catalogued discoveries that complete it (all of them). */
  requires: string[]
  /** Revealed when it completes. */
  fragment: Fragment
}

export interface Expedition {
  id: string
  /** Display code, e.g. "Expedition I". */
  code: string
  title: string
  /** Opens with the expedition. */
  intro: Fragment
  /** When it opens: after the first discovery anywhere, or after another expedition. */
  unlock: { firstDiscovery: true } | { after: string }
  objectives: Objective[]
  /** Written when the last objective completes. */
  closing: Fragment
}

export const EXPEDITIONS: Expedition[] = [
  {
    id: 'exp-listening-array',
    code: 'Expedition I',
    title: 'The Listening Array',
    unlock: { firstDiscovery: true },
    intro: {
      id: 'la-intro',
      kind: 'transmission',
      title: 'Your scan was answered',
      source: 'Origin unresolved',
      body: [
        'Four seconds after your first record was written, a narrow signal arrived from no point in the system.',
        'It repeats every 6.2 seconds: a low tone, a pause, three rising notes.',
        'The Observatory cannot place it. It sounds like something listening back.',
      ],
    },
    objectives: [
      {
        id: 'la-1',
        title: 'The tone in the water',
        brief: "The signal's lowest note matches a frequency recorded on Aurelis. Find the source of the hum at the Sounding Lagoon.",
        requires: ['aurelis-sounding-lagoon'],
        fragment: {
          id: 'la-1-log',
          kind: 'log',
          title: 'The vent and the note',
          source: 'Aurelis · the Sounding Lagoon',
          body: [
            'The vent hums at 41.2 hertz. So does the signal.',
            'The coral grows in a spiral around it, as if the reef were shaped to carry the sound outward.',
            'A match on two worlds is a coincidence. On three it is a design.',
          ],
        },
      },
      {
        id: 'la-2',
        title: 'The singing salt',
        brief: "The signal's rising notes are brittle and high. Solara's salt flats ring in the afternoon heat: scan the crystal spiral at the Salt Mirror.",
        requires: ['solara-salt-mirror'],
        fragment: {
          id: 'la-2-record',
          kind: 'record',
          title: 'Survey ring seven',
          source: 'Solara · the Salt Mirror',
          body: [
            'Iron posts stand in rings across the basin. Stamped into each is the same mark: three rising lines over a circle.',
            'The crystal spiral rings the same three rising notes.',
            'Someone came here to tune it.',
          ],
        },
      },
      {
        id: 'la-3',
        title: 'Where the columns lean',
        brief: 'The mark points to Nyx. At the Cathedral of Shards every column leans toward one point in the sky. Scan the column that tracks Elys, and the stair that climbs toward it.',
        requires: ['nyx-cathedral', 'nyx-cathedral.starward-stair'],
        fragment: {
          id: 'la-3-clue',
          kind: 'clue',
          title: 'The angle of the stair',
          source: 'Nyx · Cathedral of Shards',
          body: [
            'The stair stops halfway, but its angle does not.',
            "Extended, it points away from Elys: north, past Orion's pole, at something small that moves the wrong way.",
          ],
        },
      },
      {
        id: 'la-4',
        title: 'The wrong-way moon',
        brief: "Something circles Orion against the grain of the whole system. From the Polar Lanterns, look up and count the lights. One of them is going the wrong way.",
        requires: ['orion-polar-lanterns.retrograde-moonlet'],
        fragment: {
          id: 'la-4-transmission',
          kind: 'transmission',
          title: 'Source resolved',
          source: 'Orion · the retrograde moonlet',
          body: [
            'The signal stopped when the moonlet was scanned.',
            'A second later it began again, from the moonlet itself and slower: the same three rising notes, then a fourth that has never been heard.',
            'Whatever built the array was not listening to Elys. It was listening to this.',
          ],
        },
      },
    ],
    closing: {
      id: 'la-closing',
      kind: 'record',
      title: 'The Listening Array',
      source: 'Expedition record',
      body: [
        'Four worlds, one instrument: a vent, a salt flat, a cathedral of crystal and a moon that should not exist.',
        'The array still plays. The fourth note is a question.',
      ],
    },
  },
  {
    id: 'exp-second-sky',
    code: 'Expedition II',
    title: 'The Second Sky',
    unlock: { after: 'exp-listening-array' },
    intro: {
      id: 'ss-intro',
      kind: 'transmission',
      title: 'The fourth note',
      source: 'Orion · the retrograde moonlet',
      body: [
        'The fourth note is not addressed to you. It is addressed to the sky.',
        'Fourier analysis finds four more voices folded inside it. Each points at something that is there only some of the time.',
      ],
    },
    objectives: [
      {
        id: 'ss-1',
        title: 'An emptier sky',
        brief: "Over Nyx's polar rim one patch of sky holds no stars at all. Find it from the Quiet Caldera.",
        requires: ['nyx-quiet-caldera.unlit-eye'],
        fragment: {
          id: 'ss-1-log',
          kind: 'log',
          title: 'Starless',
          source: 'Nyx · the Quiet Caldera',
          body: [
            'The dark patch is exactly round and moves with the slab, not with the stars.',
            'It is not empty. It is covered.',
          ],
        },
      },
      {
        id: 'ss-2',
        title: 'A moon that comes and goes',
        brief: 'Vesper has no moons. From the Rose Terraces, at dawn, look the other way.',
        requires: ['vesper-rose-terraces.ghost-moon'],
        fragment: {
          id: 'ss-2-record',
          kind: 'record',
          title: 'Phases of nothing',
          source: 'Vesper · the Rose Terraces',
          body: [
            'The ghost moon has phases, so something lights it. Elys is on the other side of the sky.',
          ],
        },
      },
      {
        id: 'ss-3',
        title: 'Cities on the salt',
        brief: 'In the afternoon heat the Salt Mirror shows a city that is not there. Scan the mirage.',
        requires: ['solara-salt-mirror.mirage-towers'],
        fragment: {
          id: 'ss-3-clue',
          kind: 'clue',
          title: 'A reflection of elsewhere',
          source: 'Solara · the Salt Mirror',
          body: [
            "The towers do not match any place on Solara. Their lights blink in the array's rhythm.",
          ],
        },
      },
      {
        id: 'ss-4',
        title: 'Spokes',
        brief: "Dark spokes cross Orion's rings and vanish within hours. Scan them from the Polar Lanterns while they last.",
        requires: ['orion-polar-lanterns.ring-spokes'],
        fragment: {
          id: 'ss-4-transmission',
          kind: 'transmission',
          title: 'A shadow with a shape',
          source: 'Orion · the rings',
          body: [
            'Laid end to end, the spokes draw the same mark as the survey posts: three rising lines over a circle.',
            'The second sky is a shadow, cast on everything at once, by something nobody has seen.',
          ],
        },
      },
    ],
    closing: {
      id: 'ss-closing',
      kind: 'record',
      title: 'The Second Sky',
      source: 'Expedition record',
      body: [
        'A covered patch of stars, a moon lit from the wrong side, a city in the heat and a mark across the rings.',
        'Each is a shadow of the same thing. It is closer than Elys.',
      ],
    },
  },
  {
    id: 'exp-double-star',
    code: 'Expedition III',
    title: 'The Double Star',
    unlock: { after: 'exp-second-sky' },
    intro: {
      id: 'ds-intro',
      kind: 'transmission',
      title: 'Closer than Elys',
      source: 'The array · all four voices',
      body: [
        'The second sky is a shadow, and a shadow needs a light. The array has been pointing at it all along.',
        'Find where the second light falls on Elys, and measure where it comes from.',
      ],
    },
    objectives: [
      {
        id: 'ds-1',
        title: 'Two shadows',
        brief: 'At the Quiet Caldera on Nyx, the slab casts one shadow too many. Scan the second shadow.',
        requires: ['nyx-quiet-caldera.second-shadow'],
        fragment: {
          id: 'ds-1-log',
          kind: 'log',
          title: 'A light nobody sees',
          source: 'Nyx · the Quiet Caldera',
          body: [
            'The second shadow is faint, but its edge is sharp: a point of light, far off and steady.',
            'It falls along the arm of the galaxy, away from the core.',
          ],
        },
      },
      {
        id: 'ds-2',
        title: 'A star that is gone',
        brief: "Climbers on Aurelis talk of a ring of ice behind Halvard Ridge, set to stars that have left the sky. Find it.",
        requires: ['aurelis-halvard-ridge.watchers-ring'],
        fragment: {
          id: 'ds-2-record',
          kind: 'record',
          title: 'The block that points nowhere',
          source: 'Aurelis · the watcher’s ring',
          body: [
            'Every block but one matches a star still in the sky. The last points where the second shadow points.',
            'When the ring was cut, that star was bright enough to see. It has dimmed since, or something stands in front of it.',
          ],
        },
      },
      {
        id: 'ds-3',
        title: 'A baseline',
        brief: "The iron rings around Solara's Salt Mirror were set out to be measured again. Scan them.",
        requires: ['solara-salt-mirror.survey-rings'],
        fragment: {
          id: 'ds-3-log',
          kind: 'log',
          title: 'Parallax',
          source: 'Solara · the survey rings',
          body: [
            'The rings are a baseline. Sighted across them at opposite ends of Solara’s year, the vanished star shifts by a hair.',
            'That hair gives its distance: far, but not beyond reach. Someone wanted to go there.',
          ],
        },
      },
      {
        id: 'ds-4',
        title: 'Twice the stars',
        brief: 'The frozen lake at the Quiet Caldera shows every star twice. Scan it, and look for the one star that shows as two.',
        requires: ['nyx-quiet-caldera.frozen-lake'],
        fragment: {
          id: 'ds-4-transmission',
          kind: 'transmission',
          title: 'Resolved',
          source: 'Nyx · the double-starred lake',
          body: [
            'In the ice the vanished star splits in two: a white sun and a gold one, close together.',
            'The array answers with a name in the old survey’s hand: Tessaly.',
          ],
        },
      },
    ],
    closing: {
      id: 'ds-closing',
      kind: 'record',
      title: 'The Double Star',
      source: 'Expedition record',
      body: [
        'Two suns, fourteen days about each other, and between them one world, lit from both sides.',
        'The survey measured the way and left it open. Tessaly is on the map. Open the galaxy map to travel there.',
      ],
    },
  },
  {
    id: 'exp-third-shadow',
    code: 'Expedition IV',
    title: 'The Third Shadow',
    unlock: { after: 'exp-double-star' },
    intro: {
      id: 'ts-intro',
      kind: 'transmission',
      title: 'The surveyors',
      source: 'The array · Tessaly',
      body: [
        'The old survey did more than measure Tessaly. It crossed to it, and built on Liris.',
        'Find what the surveyors left there. Their mark is on all of it.',
      ],
    },
    objectives: [
      {
        id: 'ts-1',
        title: 'A dial for two suns',
        brief: "On Liris's Twofold Shore, something at the foot of the stacks answers both suns. Scan the signal.",
        requires: ['liris-twofold-shore'],
        fragment: {
          id: 'ts-1-log',
          kind: 'log',
          title: 'Read in two lights',
          source: 'Liris · the Twofold Shore',
          body: [
            'The dial carries the survey mark: three rising lines over a circle.',
            'Its hours are cut for both suns, and a third ring of hours for neither.',
          ],
        },
      },
      {
        id: 'ts-2',
        title: 'Built in pairs',
        brief: 'On the ridge at Between Days, cairns stand in pairs, one for each sun. Scan them.',
        requires: ['liris-between-days.paired-cairns'],
        fragment: {
          id: 'ts-2-record',
          kind: 'record',
          title: 'A third stone',
          source: 'Liris · the paired cairns',
          body: [
            'Behind every pair sits a third stone, low and easy to miss.',
            'All the third stones face the same way: out of the galaxy\u2019s plane, at a patch of sky where nothing shines.',
          ],
        },
      },
      {
        id: 'ts-3',
        title: 'The third shadow',
        brief: 'At the Long Noon the arch casts one shadow too many. Turn around from the arch, toward both suns, and look along the near slope of the dune until it shows.',
        requires: ['liris-long-noon.third-shadow'],
        fragment: {
          id: 'ts-3-transmission',
          kind: 'transmission',
          title: 'Something in the way',
          source: 'Liris · the Long Noon',
          body: [
            'The third shadow is not cast by a light. It is cast against one: something dark, between the arms, hides a patch of the galaxy behind it.',
            'The array finds it at once. It has been answering all along.',
          ],
        },
      },
    ],
    closing: {
      id: 'ts-closing',
      kind: 'record',
      title: 'The Third Shadow',
      source: 'Expedition record',
      body: [
        'Between the arms, where there is no star, the surveyors left a station. Its lamps still turn, slower every year.',
        'The Waystation is on the map. Open the galaxy map to travel there.',
      ],
    },
  },
  {
    id: 'exp-keepers',
    code: 'Expedition V',
    title: 'The Keepers',
    unlock: { after: 'exp-third-shadow' },
    intro: {
      id: 'kp-intro',
      kind: 'transmission',
      title: 'Left in order',
      source: 'The Waystation · its lamps',
      body: [
        'The Waystation is not empty because it was abandoned. It is empty because it was left in order.',
        'Read it as its keepers left it: the mark, the lamp, the ring, the dust.',
      ],
    },
    objectives: [
      {
        id: 'kp-1',
        title: 'Whose mark',
        brief: 'At the Waystation, read the survey mark lit on the hub.',
        requires: ['waystation.survey-mark'],
        fragment: {
          id: 'kp-1-record',
          kind: 'record',
          title: 'Forty-one',
          source: 'The Waystation · the survey mark',
          body: ['Under the mark, a list of names too worn to read, and a count: forty-one surveyors.'],
        },
      },
      {
        id: 'kp-2',
        title: 'Keeping time',
        brief: 'One of the surviving lamps pulses in a rhythm you have heard before. Read it.',
        requires: ['waystation.turning-lamp'],
        fragment: {
          id: 'kp-2-transmission',
          kind: 'transmission',
          title: 'The same four notes',
          source: 'The Waystation · a lamp',
          body: [
            'The lamp is the Listening Array\u2019s source. It has sent the same four notes since the keepers left: here, here, here, follow.',
          ],
        },
      },
      {
        id: 'kp-3',
        title: 'What was taken',
        brief: 'The outer ring ends cleanly. Read where it was cut.',
        requires: ['waystation.torn-ring'],
        fragment: {
          id: 'kp-3-log',
          kind: 'log',
          title: 'A ship of the ring',
          source: 'The Waystation · the torn ring',
          body: ['The missing ring was not lost. It was cut free and fitted with engines: the keepers left in a piece of their own station.'],
        },
      },
      {
        id: 'kp-4',
        title: 'Seeds',
        brief: 'Something living drifts in the dust about the station. Read it.',
        requires: ['waystation.violet-dust'],
        fragment: {
          id: 'kp-4-clue',
          kind: 'clue',
          title: 'Carried both ways',
          source: 'The Waystation · the dust',
          body: ['The moss came from Liris to here, and from here it went on, in the ring.', 'Wherever the keepers went, something grows violet there now.'],
        },
      },
    ],
    closing: {
      id: 'kp-closing',
      kind: 'record',
      title: 'The Keepers',
      source: 'Expedition record',
      body: [
        'Forty-one surveyors measured the way to Tessaly, built the Waystation, and left in its outer ring with Liris\u2019s moss aboard.',
        'The lamp still calls them home. Where they went is not yet on any map, but the moss they carried is everywhere they stopped.',
      ],
    },
  },
  {
    id: 'exp-violet',
    code: 'Expedition VI',
    title: 'Something Grows Violet',
    unlock: { after: 'exp-keepers' },
    intro: {
      id: 'vi-intro',
      kind: 'transmission',
      title: 'Follow the moss',
      source: 'The array · the Waystation\u2019s lamp',
      body: [
        'Wherever the keepers went, something grows violet there now. The moss is their trail.',
        'Find it where it should not be, and it will point the way the ring went.',
      ],
    },
    objectives: [
      {
        id: 'vi-1',
        title: 'The moss that turns',
        brief: "On Liris's Long Noon, the moss under the arch turns all day. Scan it, and watch where it turns at night.",
        requires: ['liris-long-noon'],
        fragment: {
          id: 'vi-1-log',
          kind: 'log',
          title: 'A third direction',
          source: 'Liris · the Long Noon',
          body: [
            'By day the moss turns to one sun, then the other. In the short night between them it turns to neither: to one point between the arms, toward the core.',
          ],
        },
      },
      {
        id: 'vi-2',
        title: 'Steered by violet',
        brief: "On Nyx, in the Vein Fields, pale moths steer by a violet light below. Scan them.",
        requires: ['nyx-vein-fields.vein-moths'],
        fragment: {
          id: 'vi-2-record',
          kind: 'record',
          title: 'Not Nyx\u2019s light',
          source: 'Nyx · the Vein Fields',
          body: [
            'The light the moths steer by is not the crystal\u2019s. It is the moss, grown deep in the cracks where the warm air rises: the keepers stopped on Nyx.',
          ],
        },
      },
      {
        id: 'vi-3',
        title: 'A tower under the sea',
        brief: "In Thalassa's Lantern Current, the lights gather around a sunken spire. Scan it.",
        requires: ['thalassa-lantern-current.sunken-spire'],
        fragment: {
          id: 'vi-3-clue',
          kind: 'clue',
          title: 'Grown over the mark',
          source: 'Thalassa · the sunken spire',
          body: [
            'The spire carries the survey mark, and the moss has grown over it in a long violet line. The line points up, out of the sea, toward the core.',
          ],
        },
      },
      {
        id: 'vi-4',
        title: 'A smaller ring',
        brief: "From Orion's Ringrise, watch the shadow the rings lay on the clouds. Scan it.",
        requires: ['orion-ringrise.ring-shadow'],
        fragment: {
          id: 'vi-4-transmission',
          kind: 'transmission',
          title: 'Not Orion\u2019s',
          source: 'Orion · the Ringrise',
          body: [
            'One shadow on the clouds is not cast by Orion\u2019s rings. It is smaller, and it moves the other way: a ring crossing the light of the core.',
            'The array finds it at once. Its lamps are answering.',
          ],
        },
      },
    ],
    closing: {
      id: 'vi-closing',
      kind: 'record',
      title: 'Something Grows Violet',
      source: 'Expedition record',
      body: [
        'Liris, Nyx, Thalassa, Orion: the keepers left the moss wherever they stopped, and every patch of it leans the same way.',
        'The Keepers\u2019 Ring is on the map. Open the galaxy map to travel there.',
      ],
    },
  },
  {
    id: 'exp-gardener',
    code: 'Expedition VII',
    title: 'The Gardener',
    unlock: { after: 'exp-violet' },
    intro: {
      id: 'gd-intro',
      kind: 'transmission',
      title: 'Wait',
      source: 'The Keepers\u2019 Ring · its lamps',
      body: [
        'The ring\u2019s lamps do not say follow. They say wait.',
        'Someone tended its garden not long ago. Go back to where the moss grows, and stay a while.',
      ],
    },
    objectives: [
      {
        id: 'gd-1',
        title: 'Fresh rows',
        brief: "Under the arch on Liris's Long Noon, stay a while and watch the moss.",
        requires: ['liris-long-noon.fresh-rows'],
        fragment: {
          id: 'gd-1-log',
          kind: 'log',
          title: 'Laid in rows',
          source: 'Liris · the Long Noon',
          body: [
            'Stay long enough and the moss under the arch moves: not with the suns, but row by row, as if combed. Nothing you can see is combing it.',
          ],
        },
      },
      {
        id: 'gd-2',
        title: 'A lamp in the cracks',
        brief: 'In the Vein Fields on Nyx, stay by the cracks until something answers.',
        requires: ['nyx-vein-fields.moss-lamp'],
        fragment: {
          id: 'gd-2-transmission',
          kind: 'transmission',
          title: 'Here, here, here',
          source: 'Nyx · the Vein Fields',
          body: ['Deep in a crack the moss has grown into a lamp. It plays the Waystation\u2019s three notes, and then the ring\u2019s fourth: wait.'],
        },
      },
      {
        id: 'gd-3',
        title: 'Lanterns in order',
        brief: "In Thalassa's Lantern Current, stay over the sunken spire until the lights settle.",
        requires: ['thalassa-lantern-current.tended-lights'],
        fragment: {
          id: 'gd-3-record',
          kind: 'record',
          title: 'Kept',
          source: 'Thalassa · the Lantern Current',
          body: [
            'The lanterns are not drifting. They are kept: set back into their rows whenever the current breaks them, by something that never comes up into the light.',
          ],
        },
      },
      {
        id: 'gd-4',
        title: 'The count',
        brief: "From Orion's Ringrise, watch the clouds under the rings until something in them holds still.",
        requires: ['orion-ringrise.forty-one-lights'],
        fragment: {
          id: 'gd-4-clue',
          kind: 'clue',
          title: 'Forty-one',
          source: 'Orion · the Ringrise',
          body: ['Forty-one points of violet, held still against the wind: the number of names under the survey mark.'],
        },
      },
    ],
    closing: {
      id: 'gd-closing',
      kind: 'record',
      title: 'The Gardener',
      source: 'Expedition record',
      body: [
        'The keepers did not carry the moss. The moss carried them: forty-one surveyors, grown into a garden that keeps their lamps, their rows and their count.',
        'It never asked to be followed. It asked you to wait, because it was waiting for you.',
      ],
    },
  },
]

export const EXPEDITION_BY_ID: Record<string, Expedition> = Object.fromEntries(EXPEDITIONS.map((e) => [e.id, e]))

/** Every fragment with the expedition (and objective) it belongs to. */
export const FRAGMENTS: { fragment: Fragment; expedition: Expedition; objective?: Objective }[] = EXPEDITIONS.flatMap((e) => [
  { fragment: e.intro, expedition: e },
  ...e.objectives.map((o) => ({ fragment: o.fragment, expedition: e, objective: o })),
  { fragment: e.closing, expedition: e },
])
export const FRAGMENT_BY_ID = Object.fromEntries(FRAGMENTS.map((f) => [f.fragment.id, f]))

/** Which expeditions a discovery serves (for its record and archive entry). */
export function expeditionsFor(discoveryId: string) {
  return EXPEDITIONS.filter((e) => e.objectives.some((o) => o.requires.includes(discoveryId)))
}

if (import.meta.env.DEV) {
  for (const e of EXPEDITIONS)
    for (const o of e.objectives)
      for (const r of o.requires) if (!FIND_BY_ID[r] && !READING_BY_ID[r]) throw new Error(`Expedition ${e.id}: unknown discovery ${r}`)
  if (Object.keys(FRAGMENT_BY_ID).length !== FRAGMENTS.length) throw new Error('Duplicate fragment id')
}
