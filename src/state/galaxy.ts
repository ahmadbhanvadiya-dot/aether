import { Vector3 } from 'three'
import { PLANETS, type PlanetId } from '../data/planets'

/** Live world positions of the six worlds, written by the scene every frame. */
export const galaxy = {
  positions: Object.fromEntries(PLANETS.map((p) => [p.id, new Vector3()])) as Record<PlanetId, Vector3>,
}
