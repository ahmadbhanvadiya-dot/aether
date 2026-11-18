import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  Group,
  HalfFloatType,
  LinearFilter,
  Matrix3,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  ClampToEdgeWrapping,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three'
import { director, palette, SUN_START } from '../state/director'
import { quality, useExperience } from '../state/useExperience'
import { sunDirection } from './sun'
import {
  atmosphereFragment,
  cloudFragment,
  planetFragment,
  sphereVertex,
  terrainBakeFragment,
  terrainBakeVertex,
} from './shaders/planet'

const ATMOSPHERE_RADIUS = 1.09
const CLOUD_RADIUS = 1.008
const SEGMENTS = quality.tier === 'high' ? 160 : 96
const TILT = 0.36 // axial tilt, radians

const sunDir = new Vector3()

/** Terrain resolution. The bake runs once, under the prelude. */
const TERRAIN_SIZE = quality.tier === 'high' ? [4096, 2048] : [2048, 1024]

/** Evaluates the terrain noise once into an equirectangular half-float texture. */
function useTerrainTexture() {
  const gl = useThree((s) => s.gl)
  const target = useMemo(() => {
    const [w, h] = TERRAIN_SIZE
    const rt = new WebGLRenderTarget(w, h, {
      type: HalfFloatType,
      format: RGBAFormat,
      depthBuffer: false,
      generateMipmaps: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    })
    rt.texture.wrapS = RepeatWrapping
    rt.texture.wrapT = ClampToEdgeWrapping
    return rt
  }, [])

  useEffect(() => {
    const material = new ShaderMaterial({
      vertexShader: terrainBakeVertex,
      fragmentShader: terrainBakeFragment,
      defines: { OCTAVES: 8 },
      depthTest: false,
      depthWrite: false,
    })
    const geometry = new PlaneGeometry(2, 2)
    const scene = new Scene()
    scene.add(new Mesh(geometry, material))
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const previous = gl.getRenderTarget()
    gl.setRenderTarget(target)
    gl.render(scene, camera)
    gl.setRenderTarget(previous)

    material.dispose()
    geometry.dispose()
  }, [gl, target])

  useEffect(() => () => target.dispose(), [target])
  return target.texture
}

export function Planet() {
  const spin = useRef<Group>(null)
  const surfaceMesh = useRef<Mesh>(null)
  const motionPaused = useExperience((s) => s.motionPaused)
  const terrain = useTerrainTexture()

  const { surface, clouds, atmosphere } = useMemo(() => {
    const shared = {
      uSunDir: { value: new Vector3().copy(SUN_START) },
      uSunColor: { value: palette.sun },
      uIon: { value: palette.ion },
      uViolet: { value: palette.violet },
      uTime: { value: 0 },
      uTerrain: { value: terrain },
      uTexel: { value: new Vector2(1 / TERRAIN_SIZE[0], 1 / TERRAIN_SIZE[1]) },
      uModelRot: { value: new Matrix3() },
    }
    const defines = { OCTAVES: 1 }

    const surface = new ShaderMaterial({
      vertexShader: sphereVertex,
      fragmentShader: planetFragment,
      uniforms: shared,
      defines,
    })

    const clouds = new ShaderMaterial({
      vertexShader: sphereVertex,
      fragmentShader: cloudFragment,
      uniforms: shared,
      defines: { OCTAVES: quality.tier === 'high' ? 5 : 3 },
      transparent: true,
      depthWrite: false,
    })

    const atmosphere = new ShaderMaterial({
      vertexShader: sphereVertex,
      fragmentShader: atmosphereFragment,
      uniforms: {
        uSunDir: shared.uSunDir,
        uIon: shared.uIon,
        uViolet: shared.uViolet,
        uShell: { value: ATMOSPHERE_RADIUS },
        uIntensity: { value: 0 },
      },
      side: BackSide,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })

    return { surface, clouds, atmosphere }
  }, [terrain])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    if (!motionPaused && spin.current) spin.current.rotation.y += dt * 0.0175

    sunDirection(director.sun, sunDir)
    surface.uniforms.uSunDir.value.copy(sunDir)
    surface.uniforms.uTime.value = director.time
    if (surfaceMesh.current) {
      surfaceMesh.current.updateWorldMatrix(true, false)
      surface.uniforms.uModelRot.value.setFromMatrix4(surfaceMesh.current.matrixWorld)
    }
    // The ring is visible before the crescent: it ramps with the sky fade.
    atmosphere.uniforms.uIntensity.value = 0.3 + director.sky * 0.9
  })

  return (
    <group rotation={[0, 0, TILT]}>
      <group ref={spin} rotation={[0, 2.1, 0]}>
        <mesh ref={surfaceMesh} material={surface}>
          <sphereGeometry args={[1, SEGMENTS, SEGMENTS]} />
        </mesh>
        <mesh material={clouds} renderOrder={1}>
          <sphereGeometry args={[CLOUD_RADIUS, SEGMENTS, SEGMENTS]} />
        </mesh>
      </group>
      <mesh material={atmosphere} renderOrder={2}>
        <sphereGeometry args={[ATMOSPHERE_RADIUS, 96, 96]} />
      </mesh>
    </group>
  )
}
