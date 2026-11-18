import type { ShaderMaterial } from 'three'
import { Vector3 } from 'three'
import { PLANETS, type PlanetId } from '../data/planets'

/** Live world positions of the six worlds, written by the scene every frame. */
export interface WorldMaterials {
  surface: ShaderMaterial
  clouds: ShaderMaterial | null
  atmosphere: ShaderMaterial
  rings: ShaderMaterial | null
}

export const galaxy = {
  positions: Object.fromEntries(PLANETS.map((p) => [p.id, new Vector3()])) as Record<PlanetId, Vector3>,
  /** Each world's live materials, reused to render the Observatory's thumbnails. */
  materials: {} as Partial<Record<PlanetId, WorldMaterials>>,
}
