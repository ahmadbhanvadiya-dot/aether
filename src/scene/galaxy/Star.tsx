import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import { AdditiveBlending, Color, Group, Mesh, ShaderMaterial } from 'three'
import { director } from '../../state/director'
import { coronaFragment, coronaVertex, starFragment, worldVertex } from './shaders'

export const STAR_RADIUS = 2.4

export interface StarLook {
  radius: number
  /** Limb-to-centre colours of the photosphere (linear RGB, as the shader uses them), and the corona's. */
  hot: [number, number, number]
  warm: [number, number, number]
  corona: string
}

/** Elys's own look (the default; exactly the values the shader had built in). */
export const ELYS_LOOK: StarLook = { radius: STAR_RADIUS, hot: [1.0, 0.95, 0.84], warm: [1.0, 0.6, 0.26], corona: '#FFD9A0' }

/**
 * A star: a granulated photosphere and a camera-facing corona. Elys by default;
 * Phase 11 passes other looks (Tessaly's two suns) and a group ref to move it.
 */
export function Star({ look = ELYS_LOOK, group }: { look?: StarLook; group?: RefObject<Group | null> }) {
  const corona = useRef<Mesh>(null)
  const radius = look.radius

  const { surface, glow } = useMemo(() => {
    const surface = new ShaderMaterial({
      vertexShader: worldVertex,
      fragmentShader: starFragment,
      uniforms: { uTime: { value: 0 }, uHot: { value: new Color().setRGB(...look.hot) }, uWarm: { value: new Color().setRGB(...look.warm) } },
      defines: { OCTAVES: 4 },
    })
    const glow = new ShaderMaterial({
      vertexShader: coronaVertex,
      fragmentShader: coronaFragment,
      uniforms: { uTime: { value: 0 }, uColor: { value: new Color(look.corona).multiplyScalar(1.6) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    return { surface, glow }
  }, [look])

  useFrame(({ camera }) => {
    surface.uniforms.uTime.value = director.time
    glow.uniforms.uTime.value = director.time
    if (corona.current) corona.current.quaternion.copy(camera.quaternion)
  })

  return (
    <group ref={group}>
      <mesh material={surface}>
        <sphereGeometry args={[radius, 96, 96]} />
      </mesh>
      <mesh ref={corona} material={glow} renderOrder={4}>
        <planeGeometry args={[radius * 9, radius * 9]} />
      </mesh>
    </group>
  )
}
