import { lazy, Suspense } from 'react'
import { PLANETS } from '../../data/planets'
import { useExperience } from '../../state/useExperience'
import { loadTessaly } from '../../system/chunks'
import { SpiralGalaxy } from './SpiralGalaxy'
import { Star } from './Star'
import { World } from './World'

const TessalySystem = lazy(loadTessaly)

/**
 * The spiral galaxy, and the one star system mounted in it: Elys and its six
 * worlds, or (Phase 11) another system — always at the scene's origin, so every
 * camera move works the same; the galaxy is placed around it.
 */
export function GalaxySystem() {
  const active = useExperience((s) => s.activeSystem)
  return (
    <group>
      <SpiralGalaxy />
      {active === 'elys' ? (
        <>
          <Star />
          {PLANETS.map((planet, i) => (
            <World key={planet.id} data={planet} seed={i * 1.37 + 0.5} />
          ))}
        </>
      ) : (
        <Suspense fallback={null}>
          <TessalySystem />
        </Suspense>
      )}
    </group>
  )
}
