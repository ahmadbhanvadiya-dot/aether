import { Euler, Matrix4, Vector3 } from 'three'
import { PLANETS } from './planets'

/**
 * Phase 11: the star systems of the universe, and where they lie in the galaxy
 * AETHER already draws. Elys is system one — its worlds, data and progress are
 * unchanged. Others are registered here first (for the map) and get their worlds
 * later, each as its own on-demand pack.
 *
 * Unlocking is story-gated (decided for Phase 11): a system is reachable once an
 * expedition leads there; before that it can be hinted at, never visited.
 */

/** The spiral galaxy's placement in the scene (shared with SpiralGalaxy.tsx). */
export const GALAXY = {
  position: new Vector3(-250, -70, -330),
  rotation: new Euler(0.42, 0.6, 0.18),
  radius: 360,
}

/** The galaxy's local frame → the scene, and back. */
const toScene = new Matrix4().makeRotationFromEuler(GALAXY.rotation).setPosition(GALAXY.position)
const toLocal = toScene.clone().invert()

export type SystemId = 'elys' | 'tessaly' | 'waystation' | 'ring'

export interface StarSystem {
  id: SystemId
  name: string
  /** Shown before it is known (sealed). */
  unknownName: string
  star: string
  description: string
  /** Shown once its expedition has opened it (Phase 11). */
  openDescription?: string
  /** Its colour on the map. */
  color: string
  worlds: number
  /** World position (the scene's frame; Elys is the origin). */
  position: Vector3
  /** 'home' is always reachable; 'story' opens with an expedition (Tessaly: Expedition III). */
  unlock: 'home' | 'story'
  /** Phase 11d: a star system, or a site in deep space (no star, no worlds). */
  kind: 'system' | 'site'
  /** What the site is, for the map's record (sites only). */
  siteKind?: string
  /** How the HUD names it while you are there. */
  status: string
  /** Story-gated: the expedition after which it shows on the map (unnamed), and the one that opens it. */
  knownAfter?: string
  opensWith?: string
  /** Shown on the map while it is known but sealed. */
  sealedNote?: string
}

/** The galaxy's plane normal in the scene, pointing to the side the camera usually sees. */
export const GALAXY_NORMAL = new Vector3(0, 1, 0).applyEuler(GALAXY.rotation).normalize()

/** A point in the galaxy's own frame (its disc in local x–z) → the scene's frame, and back. */
const fromGalaxy = (local: Vector3) => local.clone().applyMatrix4(toScene)
const toGalaxy = (world: Vector3) => world.clone().applyMatrix4(toLocal)

/** Elys sits out in an arm; Tessaly a little further round the same arm; the Waystation in the gap behind. */
const elysLocal = toGalaxy(new Vector3(0, 0, 0))
const tessalyLocal = (() => {
  const r = Math.hypot(elysLocal.x, elysLocal.z) * 0.93
  const a = Math.atan2(elysLocal.z, elysLocal.x) + 0.32
  return new Vector3(Math.cos(a) * r, elysLocal.y + 4, Math.sin(a) * r)
})()
/** Between the arms, back the other way from Elys and lifted out of the disc (where the third stones point). */
const waystationLocal = (() => {
  const r = Math.hypot(elysLocal.x, elysLocal.z) * 0.86
  const a = Math.atan2(elysLocal.z, elysLocal.x) - 0.24
  return new Vector3(Math.cos(a) * r, elysLocal.y + 14, Math.sin(a) * r)
})()
/** The keepers' ring: a third of the way from the Waystation toward the core, still above the disc. */
const ringLocal = waystationLocal.clone().multiplyScalar(0.66).setY(waystationLocal.y * 0.8 + 6)

export const SYSTEMS: StarSystem[] = [
  {
    id: 'elys',
    name: 'Elys',
    unknownName: 'Elys',
    star: 'A yellow-white star',
    description: 'Home: the Aether system, six worlds around a calm yellow-white star.',
    color: '#FFE2B0',
    worlds: PLANETS.length,
    position: new Vector3(0, 0, 0),
    unlock: 'home',
    kind: 'system',
    status: 'The Aether system',
  },
  {
    id: 'tessaly',
    name: 'Tessaly',
    unknownName: 'An unresolved double star',
    star: 'Two suns, one white and one gold',
    description: 'A double star further round the arm. Its light dims and brightens on a rhythm of its own. Nothing yet leads there.',
    openDescription:
      'A double star further round the arm: a white sun and a gold one, fourteen days about each other, and one world, Liris, circling both. Expedition III measured the way.',
    color: '#FFD49A',
    worlds: 1,
    position: fromGalaxy(tessalyLocal),
    unlock: 'story',
    kind: 'system',
    status: 'The Tessaly system',
    knownAfter: 'exp-second-sky',
    opensWith: 'exp-double-star',
    sealedNote: 'Expedition III, in the Journal, measures the way there.',
  },
  {
    id: 'waystation',
    name: 'The Waystation',
    unknownName: 'A darkness between the arms',
    star: 'None',
    siteKind: 'A survey station, derelict',
    description: 'Between the arms, one patch of the galaxy is a little darker than it should be. Nothing yet leads there.',
    openDescription:
      'A station the old survey left in the dark between the arms, out of the plane of the galaxy. No star lights it; three of its nine lamps still turn. Expedition IV found it from Liris.',
    color: '#9FE3FF',
    worlds: 0,
    position: fromGalaxy(waystationLocal),
    unlock: 'story',
    kind: 'site',
    status: 'The Waystation',
    knownAfter: 'exp-double-star',
    opensWith: 'exp-third-shadow',
    sealedNote: 'Expedition IV, in the Journal, finds the way there.',
  },
  {
    id: 'ring',
    name: 'The Keepers\u2019 Ring',
    unknownName: 'A small ring, drifting',
    star: 'None',
    siteKind: 'A ring ship, adrift',
    description: 'Something ring-shaped crosses the light of the core, too small for a world and too regular for a rock. Nothing yet leads there.',
    openDescription:
      'The Waystation\u2019s outer ring, cut free and flown away by its keepers, drifting toward the core on engines long cold. Expedition VI followed the moss to it.',
    color: '#C8A2FF',
    worlds: 0,
    position: fromGalaxy(ringLocal),
    unlock: 'story',
    kind: 'site',
    status: 'The Keepers\u2019 Ring',
    knownAfter: 'exp-keepers',
    opensWith: 'exp-violet',
    sealedNote: 'Expedition VI, in the Journal, follows the moss there.',
  },
]

export const SYSTEM_BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s])) as Record<SystemId, StarSystem>

/** Where the map looks: between Elys and the galaxy's core, from above the disc. */
export const MAP_VIEW = (() => {
  const target = new Vector3().lerpVectors(SYSTEMS[0].position, GALAXY.position, 0.42)
  const out = SYSTEMS[0].position.clone().sub(GALAXY.position).normalize()
  const position = target.clone().addScaledVector(GALAXY_NORMAL, 560).addScaledVector(out, 220)
  return { target, position }
})()

