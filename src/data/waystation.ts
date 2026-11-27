import type { Category } from './discoveries'

/** Phase 11d: the deep-space sites that are read from orbit. */
export type SiteId = 'waystation' | 'ring'
export const SITE_IDS: SiteId[] = ['waystation', 'ring']
export const isSiteId = (id: string): id is SiteId => (SITE_IDS as string[]).includes(id)

/**
 * Phase 11d: what can be read at the Waystation (and, since Expedition VI, at the ring). A site has no surface to land
 * on, so its finds are readings taken from orbit, each anchored to a point on the
 * station. Kept apart from the worlds' discoveries (Elys's 54 and Liris's 9 are
 * unchanged); recorded in the same `discovered` map, under `waystation.*` ids.
 *
 * Anchors are in the station's own frame (the turning structure), or in space
 * about it (`frame: 'space'`, for what drifts around it). `normal` points away
 * from the surface the reading sits on, so it can hide when that face turns away.
 */

export interface Reading {
  id: string
  site: SiteId
  name: string
  category: Category
  /** Shown before it is read. */
  hint: string
  description: string
  anchor: [number, number, number]
  normal: [number, number, number]
  frame: 'station' | 'space'
}

const RING = 5.6
const lamp = (i: number): [number, number, number] => {
  const a = (i / 9) * Math.PI * 2
  return [Math.cos(a) * RING, 0.32, Math.sin(a) * RING]
}
const lampNormal = (i: number): [number, number, number] => {
  const a = (i / 9) * Math.PI * 2
  return [Math.cos(a), 0.3, Math.sin(a)]
}

export const READINGS: Reading[] = [
  {
    site: 'waystation',
    id: 'waystation.survey-mark',
    name: 'The survey mark',
    category: 'structure',
    hint: 'A sign on the hub, still lit.',
    description:
      'Three rising lines over a circle, cut into the hub and lit from inside. It is the same mark as on the posts of Solara and the dial on Liris: this is where the survey began.',
    anchor: [0, -0.2, 1.25],
    normal: [0, 0, 1],
    frame: 'station',
  },
  {
    site: 'waystation',
    id: 'waystation.turning-lamp',
    name: 'A lamp keeping time',
    category: 'anomaly',
    hint: 'One of the surviving lamps.',
    description:
      'The lamp does not flicker at random. It pulses in the rhythm the Listening Array first heard: the signal from no point in the system came from here.',
    anchor: lamp(4),
    normal: lampNormal(4),
    frame: 'station',
  },
  {
    site: 'waystation',
    id: 'waystation.torn-ring',
    name: 'The torn ring',
    category: 'structure',
    hint: 'Where the outer ring ends.',
    description:
      'The outer ring did not decay. Its ends are clean, as if the missing part was taken away whole. Something left the Waystation, and took part of it along.',
    anchor: [-6.9, 1.8, -2.2],
    normal: [-0.9, 0.3, -0.3],
    frame: 'station',
  },
  {
    site: 'waystation',
    id: 'waystation.violet-dust',
    name: 'Violet dust',
    category: 'life',
    hint: 'A faint colour in the drifting dust.',
    description:
      'Among the grains of metal and ice, spores: the violet moss of Liris’s steppe, dry and still alive. The surveyors carried it here, or it carried itself.',
    anchor: [10.5, 3.2, 6.5],
    normal: [0, 0, 0],
    frame: 'space',
  },
]

/**
 * The keepers' ring: the Waystation's outer ring, cut free and fitted with
 * engines. An arc of the old ring (radius 7, a tube 0.9 thick, ±1.15 rad), shifted
 * so the arc's middle sits at the site's centre. Shared with the scene.
 */
export const RING_ARC = { radius: 7, tube: 0.9, half: 1.15, shift: -5.56 }
const arcPoint = (a: number, out = 0, up = 0): [number, number, number] => [
  (RING_ARC.radius + out) * Math.cos(a) + RING_ARC.shift,
  up,
  (RING_ARC.radius + out) * Math.sin(a),
]

READINGS.push(
  {
    site: 'ring',
    id: 'ring.cold-engines',
    name: 'Cold engines',
    category: 'structure',
    hint: 'The engines at the end of the arc.',
    description:
      'Three engines bolted to the cut end of the ring, burned out long ago. Since then the ring has only drifted, on the heading they gave it: toward the core.',
    anchor: arcPoint(RING_ARC.half + 0.08, 0, 0),
    normal: [-Math.sin(RING_ARC.half), 0, Math.cos(RING_ARC.half)],
    frame: 'station',
  },
  {
    site: 'ring',
    id: 'ring.violet-garden',
    name: 'The violet garden',
    category: 'life',
    hint: 'A violet light behind the windows.',
    description:
      'Behind the windows the ring is full of Liris’s moss, grown wall to wall and still in rows. Someone tended it, and not very long ago.',
    anchor: arcPoint(0, RING_ARC.tube + 0.05, 0),
    normal: [1, 0, 0],
    frame: 'station',
  },
  {
    site: 'ring',
    id: 'ring.answering-lamps',
    name: 'Answering lamps',
    category: 'anomaly',
    hint: 'Its lamps, still lit.',
    description:
      'The ring’s lamps answer the Waystation’s, note for note: here, here, here. Its fourth note is different. It does not say follow. It says wait.',
    anchor: arcPoint(-0.6, 0, RING_ARC.tube + 0.1),
    normal: [0.3, 0.9, -0.3],
    frame: 'station',
  },
)

export const READING_BY_ID: Record<string, Reading> = Object.fromEntries(READINGS.map((r) => [r.id, r]))

/** A site's readings. */
export const readingsFor = (site: SiteId) => READINGS.filter((r) => r.site === site)
/** How many of a site's readings have been taken. */
export const readingsFoundAt = (discovered: Record<string, number>, site: SiteId) => readingsFor(site).filter((r) => discovered[r.id]).length

/** What the interface says about each site (its record panel, the Observatory, the Journal). */
export const SITE_RECORDS: Record<
  SiteId,
  { name: string; kicker: string; kind: string; place: string; teaser: string; copy: string; facts: { label: string; value: string }[]; color: string }
> = {
  waystation: {
    name: 'The Waystation',
    kicker: 'Deep space · between the arms',
    kind: 'A survey station, derelict',
    place: 'between the arms',
    teaser: 'Three of its nine lamps still turn.',
    copy: 'A station the old survey left in the dark between the arms, turned out of the plane of the galaxy. Its hull carries their mark, three rising lines over a circle, and three of its nine lamps still turn, slower every year.',
    facts: [
      { label: 'Built', value: 'By the old survey' },
      { label: 'Lamps', value: 'Three of nine still turning' },
      { label: 'Light', value: 'No star; the galaxy’s core' },
      { label: 'Found', value: 'Expedition IV, from Liris' },
    ],
    color: '#9FE3FF',
  },
  ring: {
    name: 'The Keepers’ Ring',
    kicker: 'Deep space · toward the core',
    kind: 'A ring ship, adrift',
    place: 'toward the core',
    teaser: 'Violet light behind its windows.',
    copy: 'The Waystation’s outer ring, cut free and flown away by its keepers, now drifting toward the galaxy’s core on engines long cold. Violet light shows behind its windows.',
    facts: [
      { label: 'Built', value: 'Cut from the Waystation' },
      { label: 'Engines', value: 'Three, cold' },
      { label: 'Heading', value: 'Toward the core' },
      { label: 'Found', value: 'Expedition VI, following the moss' },
    ],
    color: '#C8A2FF',
  },
}
