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

export type SystemId = 'elys' | 'tessaly'

export interface StarSystem {
  id: SystemId
  name: string
  /** Shown before it is known (sealed). */
  unknownName: string
  star: string
  description: string
  /** Its colour on the map. */
  color: string
  worlds: number
  /** World position (the scene's frame; Elys is the origin). */
  position: Vector3
  /** 'home' is always reachable; 'story' opens with an expedition (not yet written for Tessaly). */
  unlock: 'home' | 'story'
}

/** The galaxy's plane normal in the scene, pointing to the side the camera usually sees. */
export const GALAXY_NORMAL = new Vector3(0, 1, 0).applyEuler(GALAXY.rotation).normalize()

/** A point in the galaxy's own frame (its disc in local x–z) → the scene's frame, and back. */
const fromGalaxy = (local: Vector3) => local.clone().applyMatrix4(toScene)
const toGalaxy = (world: Vector3) => world.clone().applyMatrix4(toLocal)

/** Elys sits out in an arm; Tessaly a little further round the same arm. */
const elysLocal = toGalaxy(new Vector3(0, 0, 0))
const tessalyLocal = (() => {
  const r = Math.hypot(elysLocal.x, elysLocal.z) * 0.93
  const a = Math.atan2(elysLocal.z, elysLocal.x) + 0.32
  return new Vector3(Math.cos(a) * r, elysLocal.y + 4, Math.sin(a) * r)
})()

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
  },
  {
    id: 'tessaly',
    name: 'Tessaly',
    unknownName: 'An unresolved double star',
    star: 'Two suns, one white and one gold',
    description: 'A double star further round the arm. Its light dims and brightens on a rhythm of its own. Nothing yet leads there.',
    color: '#FFD49A',
    worlds: 1,
    position: fromGalaxy(tessalyLocal),
    unlock: 'story',
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

