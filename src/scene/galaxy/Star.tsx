import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, Color, Mesh, ShaderMaterial } from 'three'
import { director } from '../../state/director'
import { coronaFragment, coronaVertex, starFragment, worldVertex } from './shaders'

export const STAR_RADIUS = 2.4

/** Elys: a granulated photosphere and a camera-facing corona. */
export function Star() {
  const corona = useRef<Mesh>(null)

  const { surface, glow } = useMemo(() => {
    const surface = new ShaderMaterial({
      vertexShader: worldVertex,
      fragmentShader: starFragment,
      uniforms: { uTime: { value: 0 } },
      defines: { OCTAVES: 4 },
    })
    const glow = new ShaderMaterial({
      vertexShader: coronaVertex,
      fragmentShader: coronaFragment,
      uniforms: { uTime: { value: 0 }, uColor: { value: new Color('#FFD9A0').multiplyScalar(1.6) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    return { surface, glow }
  }, [])

  useFrame(({ camera }) => {
    surface.uniforms.uTime.value = director.time
    glow.uniforms.uTime.value = director.time
    if (corona.current) corona.current.quaternion.copy(camera.quaternion)
  })

  return (
    <group>
      <mesh material={surface}>
        <sphereGeometry args={[STAR_RADIUS, 96, 96]} />
      </mesh>
      <mesh ref={corona} material={glow} renderOrder={4}>
        <planeGeometry args={[STAR_RADIUS * 9, STAR_RADIUS * 9]} />
      </mesh>
    </group>
  )
}
