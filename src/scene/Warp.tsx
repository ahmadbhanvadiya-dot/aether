import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineSegments,
  PerspectiveCamera,
  ShaderMaterial,
} from 'three'
import { director, type Space } from '../state/director'
import { quality } from '../state/useExperience'
import { warpFragment, warpVertex } from './galaxy/shaders'

/** Base field of view for each space; the warp adds a kick on top. */
export function baseFov(space: Space, aspect: number) {
  if (space === 'vael') return aspect < 0.8 ? 44 : 34
  if (space === 'surface') return aspect < 0.8 ? 68 : 55
  return aspect < 0.8 ? 60 : 46
}

/**
 * Owns the projection: base FOV per space, the warp FOV kick, and the view
 * offset that slides a focused world clear of the info panel.
 */
export function Projection() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)

  useFrame(() => {
    const aspect = size.width / size.height
    camera.fov = baseFov(director.space, aspect) + director.warp * 32 + director.fovKick
    // Surfaces reach the horizon; space scenes don't need the depth range.
    const surface = director.space === 'surface'
    camera.near = surface ? 0.3 : 0.05
    camera.far = surface ? 6000 : 1200

    const shift = director.panelShift
    // Either sign: on tall phones the dial's room can lie below the centre (negative).
    if (Math.abs(shift) > 0.001) {
      const w = size.width
      const h = size.height
      if (aspect < 0.9 || w <= 900) camera.setViewOffset(w, h, 0, h * 0.26 * shift, w, h)
      else camera.setViewOffset(w, h, w * 0.17 * shift, 0, w, h)
    } else if (camera.view?.enabled) {
      camera.clearViewOffset()
    }
    camera.updateProjectionMatrix()
  })
  return null
}

/** Streaks of light rushing past the lens during the jump. */
export function WarpStreaks() {
  const group = useRef<Group>(null)
  const count = quality.tier === 'high' ? 1400 : 600

  const { line, material } = useMemo(() => {
    const seeds = new Float32Array(count * 2 * 3)
    const ends = new Float32Array(count * 2)
    const positions = new Float32Array(count * 2 * 3)
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 2.2 + Math.pow(Math.random(), 0.6) * 16
      const z = Math.random() * 120
      for (let k = 0; k < 2; k++) {
        seeds.set([Math.cos(a) * r, Math.sin(a) * r, z], (i * 2 + k) * 3)
        ends[i * 2 + k] = k
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 3))
    geometry.setAttribute('aEnd', new BufferAttribute(ends, 1))
    const material = new ShaderMaterial({
      vertexShader: warpVertex,
      fragmentShader: warpFragment,
      uniforms: {
        uTime: { value: 0 },
        uWarp: { value: 0 },
        uColor: { value: new Color('#BFD8FF').multiplyScalar(1.4) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    })
    const line = new LineSegments(geometry, material)
    line.frustumCulled = false
    line.renderOrder = 10
    return { line, material }
  }, [count])

  useFrame(({ camera }, delta) => {
    material.uniforms.uTime.value += Math.min(delta, 1 / 20) * (0.2 + director.warp)
    material.uniforms.uWarp.value = director.warp
    if (group.current) {
      group.current.visible = director.warp > 0.005
      group.current.position.copy(camera.position)
      group.current.quaternion.copy(camera.quaternion)
    }
  })

  return (
    <group ref={group}>
      <primitive object={line} />
    </group>
  )
}

/** Renders its children only while the camera is in the given space(s). */
export function Space({ space, children }: { space: Space | Space[]; children: ReactNode }) {
  const group = useRef<Group>(null)
  useFrame(() => {
    if (!group.current) return
    group.current.visible = Array.isArray(space) ? space.includes(director.space) : director.space === space
  })
  return <group ref={group}>{children}</group>
}

/**
 * Compiles every material in both spaces up front (under the prelude), so the
 * first jump to the galaxy never stalls on shader compilation.
 */
export function Precompile() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    gl.compile(scene, camera)
  }, [gl, scene, camera])
  return null
}
