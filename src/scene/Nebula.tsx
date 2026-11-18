import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import {
  BackSide,
  CubeCamera,
  HalfFloatType,
  Mesh,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  WebGLCubeRenderTarget,
} from 'three'
import { director, palette } from '../state/director'
import { quality } from '../state/useExperience'
import { nebulaFragment, nebulaVertex } from './shaders/space'

/**
 * Renders the nebula sky sphere once into a cube map and uses it as the
 * scene background. The sky costs one texture lookup per pixel afterwards.
 */
export function Nebula() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const size = quality.tier === 'high' ? 1024 : 512
    const target = new WebGLCubeRenderTarget(size, { type: HalfFloatType, generateMipmaps: false })
    const bakeScene = new Scene()
    const material = new ShaderMaterial({
      vertexShader: nebulaVertex,
      fragmentShader: nebulaFragment,
      uniforms: {
        uVoid: { value: palette.void },
        uMidnight: { value: palette.midnight },
        uAbyss: { value: palette.abyss },
        uIon: { value: palette.ion },
        uViolet: { value: palette.violet },
      },
      defines: { OCTAVES: 5 },
      side: BackSide,
      depthWrite: false,
    })
    const geometry = new SphereGeometry(50, 64, 32)
    bakeScene.add(new Mesh(geometry, material))

    const cubeCamera = new CubeCamera(1, 100, target)
    cubeCamera.update(gl, bakeScene)

    scene.background = target.texture
    scene.backgroundIntensity = 0

    return () => {
      scene.background = null
      target.dispose()
      material.dispose()
      geometry.dispose()
    }
  }, [gl, scene])

  useFrame(() => {
    scene.backgroundIntensity = director.sky
    scene.backgroundRotation.y = director.time * 0.0016
  })

  return null
}
