import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  DoubleSide,
  Group,
  HalfFloatType,
  LinearFilter,
  Matrix3,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from 'three'
import { orbitAngle } from '../../data/astronomy'
import type { PlanetData, PlanetKind } from '../../data/planets'
import { director, palette } from '../../state/director'
import { galaxy } from '../../state/galaxy'
import { sim, useSimulation } from '../../state/simulation'
import { quality, useExperience } from '../../state/useExperience'
import {
  bakeFragment,
  bakeVertex,
  ringFragment,
  ringVertex,
  worldAtmosphereFragment,
  worldCloudFragment,
  worldFragment,
  worldVertex,
} from './shaders'
import { Moons } from './Moons'

const KIND_IDS: Record<PlanetKind, number> = {
  terrestrial: 0,
  dark: 1,
  desert: 2,
  cloud: 3,
  ocean: 4,
  giant: 5,
}

const BUMP: Record<PlanetKind, number> = {
  terrestrial: 0.07,
  dark: 0.05,
  desert: 0.06,
  cloud: 0,
  ocean: 0.06,
  giant: 0,
}

const HAZE: Record<PlanetKind, number> = {
  terrestrial: 0.7,
  dark: 0.35,
  desert: 0.55,
  cloud: 1.0,
  ocean: 0.75,
  giant: 0.45,
}

const TEX = quality.tier === 'high' ? [1536, 768] : [1024, 512]
const SEGMENTS = quality.tier === 'high' ? 96 : 64

/** Bakes one world's terrain into a half-float equirectangular texture. */
function useWorldTexture(kind: PlanetKind, seed: number) {
  const gl = useThree((s) => s.gl)
  const target = useMemo(() => {
    const rt = new WebGLRenderTarget(TEX[0], TEX[1], {
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
      vertexShader: bakeVertex,
      fragmentShader: bakeFragment,
      defines: { KIND: KIND_IDS[kind], OCTAVES: 7 },
      uniforms: { uSeed: { value: seed } },
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
  }, [gl, target, kind, seed])

  useEffect(() => () => target.dispose(), [target])
  return target.texture
}

// ---------------------------------------------------------------------------
// Dotted orbit path, shared style with Ithra's ring around Vael.
// ---------------------------------------------------------------------------

const orbitVertex = /* glsl */ `
attribute float aIndex;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uCount;
uniform float uPhase;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(2.0 * uPixelRatio * (60.0 / -mv.z), 1.0 * uPixelRatio, 2.4 * uPixelRatio);
  float along = fract((aIndex / uCount) - uPhase);
  vAlpha = uOpacity * (0.35 + 0.65 * pow(1.0 - along, 4.0));
}
`

const orbitFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.15, length(c)) * vAlpha;
  gl_FragColor = vec4(uColor * a, a);
}
`

function useOrbitPath(radius: number, color: Color) {
  return useMemo(() => {
    const count = Math.round(radius * 18)
    const positions = new Float32Array(count * 3)
    const index = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      positions.set([Math.cos(a) * radius, 0, Math.sin(a) * radius], i * 3)
      index[i] = i
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('aIndex', new BufferAttribute(index, 1))
    const material = new ShaderMaterial({
      vertexShader: orbitVertex,
      fragmentShader: orbitFragment,
      uniforms: {
        uPixelRatio: { value: 1 },
        uOpacity: { value: 0 },
        uCount: { value: count },
        uPhase: { value: 0 },
        uColor: { value: color.clone().lerp(palette.sun, 0.3).multiplyScalar(1.3) },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    return { geometry, material }
  }, [radius, color])
}

// ---------------------------------------------------------------------------

const center = new Vector3()

export function World({ data, seed }: { data: PlanetData; seed: number }) {
  const orbitGroup = useRef<Group>(null)
  const body = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const surfaceMesh = useRef<Mesh>(null)
  const terrain = useWorldTexture(data.kind, seed)
  const setHovered = useExperience((s) => s.setHovered)
  const setFocus = useExperience((s) => s.setFocus)
  const dpr = useThree((s) => s.viewport.dpr)

  const accent = useMemo(() => new Color(data.accent), [data.accent])
  const orbit = useOrbitPath(data.orbitRadius, accent)

  const materials = useMemo(() => {
    const atmoDay = new Color(data.atmosphere.day)
    const atmoNight = new Color(data.atmosphere.night)
    const sunPos = new Vector3(0, 0, 0)
    // Eclipses: the moons' positions and radii, written by Moons each frame.
    // (w = 0 marks an unused slot; Vector4 defaults w to 1, which would be a moon at Elys.)
    const moonShadow = Array.from({ length: 5 }, () => new Vector4(0, 0, 0, 0))
    const surface = new ShaderMaterial({
      vertexShader: worldVertex,
      fragmentShader: worldFragment,
      defines: {
        KIND: KIND_IDS[data.kind],
        BUMP: BUMP[data.kind].toFixed(3),
        HAZE: HAZE[data.kind].toFixed(2),
        ...(data.rings ? { RINGS: 1 } : {}),
      },
      uniforms: {
        // Rings cast their shadow on the planet (ringed worlds only; see ringShadow).
        uCenter: { value: new Vector3() },
        uRingInner: { value: data.rings ? data.rings.inner * data.radius : 0 },
        uRingOuter: { value: data.rings ? data.rings.outer * data.radius : 0 },
        uSunPos: { value: sunPos },
        uSunColor: { value: palette.sun },
        uTerrain: { value: terrain },
        uTexel: { value: new Vector2(1 / TEX[0], 1 / TEX[1]) },
        uModelRot: { value: new Matrix3() },
        uTime: { value: 0 },
        uAtmoDay: { value: atmoDay },
        uAtmoNight: { value: atmoNight },
        uIon: { value: palette.ion },
        uViolet: { value: palette.violet },
        uHighlight: { value: 0 },
        uMoonShadow: { value: moonShadow },
      },
    })

    const clouds = data.clouds
      ? new ShaderMaterial({
          vertexShader: worldVertex,
          fragmentShader: worldCloudFragment,
          uniforms: {
            uSunPos: { value: sunPos },
            uSunColor: { value: palette.sun },
            uTerrain: { value: terrain },
            uTime: { value: 0 },
            uSpeed: { value: data.clouds.speed },
            uCloudColor: { value: new Color(data.clouds.color) },
            uOpacity: { value: data.clouds.opacity },
            uAtmoDay: { value: atmoDay },
            uMoonShadow: { value: moonShadow },
            // Phase 7: turning cyclones (Thalassa's storm belt; a few on Aurelis).
            uStorms: { value: data.kind === 'ocean' ? 1 : data.kind === 'terrestrial' ? 0.5 : 0 },
          },
          transparent: true,
          depthWrite: false,
        })
      : null

    const atmosphere = new ShaderMaterial({
      vertexShader: worldVertex,
      fragmentShader: worldAtmosphereFragment,
      uniforms: {
        uCenter: { value: new Vector3() },
        uRadius: { value: data.radius },
        uShell: { value: data.atmosphere.shell },
        uDensity: { value: data.atmosphere.density },
        uSunPos: { value: sunPos },
        uDay: { value: atmoDay },
        uNight: { value: atmoNight },
        uIntensity: { value: data.atmosphere.intensity },
      },
      side: BackSide,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })

    const rings = data.rings
      ? new ShaderMaterial({
          vertexShader: ringVertex,
          fragmentShader: ringFragment,
          uniforms: {
            uInner: { value: data.rings.inner * data.radius },
            uOuter: { value: data.rings.outer * data.radius },
            uSunPos: { value: sunPos },
            uSunColor: { value: palette.sun },
            uCenter: { value: new Vector3() },
            uPlanetR: { value: data.radius },
            uColorA: { value: new Color(data.rings.colorA) },
            uColorB: { value: new Color(data.rings.colorB) },
            uOpacity: { value: 0.9 },
            uTime: { value: 0 },
          },
          side: DoubleSide,
          transparent: true,
          depthWrite: false,
        })
      : null

    return { surface, clouds, atmosphere, rings, moonShadow }
  }, [data, terrain])

  useEffect(() => {
    galaxy.materials[data.id] = materials
  }, [data.id, materials])

  useFrame(() => {
    const t = director.time
    // Phase 9: position, rotation and rings follow the simulation clock.
    const angle = orbitAngle(data, sim.day)
    const r = data.orbitRadius
    if (body.current) {
      body.current.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r)
      body.current.getWorldPosition(center)
      galaxy.positions[data.id].copy(center)
    }
    // Drawn rotation is slowed (sim.spinScale) but keeps every world's true ratio and sense.
    if (spin.current) spin.current.rotation.y = ((Math.PI * 2 * sim.spinHours) / data.dayHours) % (Math.PI * 2)
    if (surfaceMesh.current) {
      surfaceMesh.current.updateWorldMatrix(true, false)
      materials.surface.uniforms.uModelRot.value.setFromMatrix4(surfaceMesh.current.matrixWorld)
    }

    const { focus, hovered } = useExperience.getState()
    const isFocus = focus === data.id
    const isHover = hovered === data.id
    const highlight = materials.surface.uniforms.uHighlight
    highlight.value += ((isHover && !isFocus ? 1 : 0) - highlight.value) * 0.12

    materials.surface.uniforms.uTime.value = t
    if (materials.clouds) materials.clouds.uniforms.uTime.value = t
    materials.atmosphere.uniforms.uCenter.value.copy(center)
    materials.surface.uniforms.uCenter.value.copy(center)
    if (materials.rings) {
      materials.rings.uniforms.uCenter.value.copy(center)
      materials.rings.uniforms.uTime.value = sim.spinHours * 2.1
    }

    // Orbit paths: quiet in overview, bright on hover, dim behind a focused world.
    // The orbit paths can be switched off (simulation controls); a hovered world still shows its own.
    const shown = useSimulation.getState().orbits
    const target = isHover ? 0.95 : !shown ? 0 : focus ? (isFocus ? 0.4 : 0.12) : 0.42
    const om = orbit.material.uniforms
    om.uOpacity.value += (target * director.galaxyIntro - om.uOpacity.value) * 0.08
    om.uPixelRatio.value = dpr
    om.uPhase.value = ((((angle / (Math.PI * 2)) % 1) + 1) % 1)
  })

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(data.id)
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    if (useExperience.getState().hovered === data.id) setHovered(null)
    document.body.style.cursor = ''
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    // Ignore the click that ends a drag-to-rotate.
    if (e.delta > 6) return
    const st = useExperience.getState()
    // In the Observatory a world on the dial is selected, not flown to.
    if (st.phase === 'observatory') {
      st.setObserved(data.id)
      return
    }
    if (st.phase !== 'galaxy') return
    document.body.style.cursor = ''
    setFocus(data.id)
  }

  const hitRadius = Math.max(data.radius * 1.6, 1.5)

  return (
    <group ref={orbitGroup} rotation={[data.inclination, 0, 0]}>
      <points geometry={orbit.geometry} material={orbit.material} frustumCulled={false} />
      <group ref={body}>
        <group rotation={[0, 0, data.axialTilt]}>
          <group ref={spin}>
            <mesh ref={surfaceMesh} material={materials.surface}>
              <sphereGeometry args={[data.radius, SEGMENTS, SEGMENTS]} />
            </mesh>
            {materials.clouds && (
              <mesh material={materials.clouds} renderOrder={1}>
                <sphereGeometry args={[data.radius * 1.012, SEGMENTS, SEGMENTS]} />
              </mesh>
            )}
          </group>
          <Moons data={data} shadows={materials.moonShadow} />
          {materials.rings && data.rings && (
            <mesh material={materials.rings} rotation={[Math.PI / 2, 0, 0]} renderOrder={3}>
              <ringGeometry args={[data.rings.inner * data.radius, data.rings.outer * data.radius, 192, 1]} />
            </mesh>
          )}
        </group>
        <mesh material={materials.atmosphere} renderOrder={2}>
          <sphereGeometry args={[data.radius * data.atmosphere.shell, 64, 64]} />
        </mesh>
        <mesh onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
          <sphereGeometry args={[hitRadius, 16, 16]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
    </group>
  )
}
