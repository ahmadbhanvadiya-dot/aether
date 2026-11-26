import type { Category } from './discoveries'

/**
 * Phase 11d: what can be read at the Waystation. A site has no surface to land
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

export const READING_BY_ID: Record<string, Reading> = Object.fromEntries(READINGS.map((r) => [r.id, r]))
export const READINGS_TOTAL = READINGS.length

/** How many readings have been taken. */
export const readingsFound = (discovered: Record<string, number>) => READINGS.filter((r) => discovered[r.id]).length
