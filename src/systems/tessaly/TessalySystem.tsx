import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, Group, Vector3 } from 'three'
import { Star } from '../../scene/galaxy/Star'
import { World, type TwoSuns } from '../../scene/galaxy/World'
import { sim } from '../../state/simulation'
import { BINARY, LIRIS, SUN_A, SUN_B } from '../../data/tessaly'

/**
 * Phase 11c: the Tessaly system in orbit — two suns turning about their common
 * centre (the scene's origin) on the simulation clock, and Liris lit by both.
 * Loaded on demand, mounted only while Tessaly is the active system.
 */
export default function TessalySystem() {
  const groupA = useRef<Group>(null)
  const groupB = useRef<Group>(null)

  // Shared with Liris's materials: the lights move with the suns every frame.
  const light = useMemo<TwoSuns>(
    () => ({
      a: new Vector3(),
      colorA: new Color().setRGB(...SUN_A.light),
      b: new Vector3(),
      colorB: new Color().setRGB(...SUN_B.light),
    }),
    [],
  )

  useFrame(() => {
    // Each sun's distance from the centre is inverse to its mass.
    const total = SUN_A.mass + SUN_B.mass
    const rA = (BINARY.separation * SUN_B.mass) / total
    const rB = (BINARY.separation * SUN_A.mass) / total
    const a = BINARY.phase - ((sim.day / BINARY.periodDays) % 1) * Math.PI * 2
    light.a.set(Math.cos(a) * rA, 0, Math.sin(a) * rA)
    light.b.set(-Math.cos(a) * rB, 0, -Math.sin(a) * rB)
    groupA.current?.position.copy(light.a)
    groupB.current?.position.copy(light.b)
  })

  return (
    <group>
      <Star look={SUN_A.look} group={groupA} />
      <Star look={SUN_B.look} group={groupB} />
      <World data={LIRIS} seed={7.3} light={light} />
    </group>
  )
}
