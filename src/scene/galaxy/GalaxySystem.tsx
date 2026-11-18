import { PLANETS } from '../../data/planets'
import { SpiralGalaxy } from './SpiralGalaxy'
import { Star } from './Star'
import { World } from './World'

/** Elys, its six worlds, and the spiral galaxy they live in. */
export function GalaxySystem() {
  return (
    <group>
      <SpiralGalaxy />
      <Star />
      {PLANETS.map((planet, i) => (
        <World key={planet.id} data={planet} seed={i * 1.37 + 0.5} />
      ))}
    </group>
  )
}
