import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'
import { director, palette } from '../state/director'
import { quality, useExperience } from '../state/useExperience'
import { dustFragment, dustVertex, starFragment, starVertex } from './shaders/space'

/** Deterministic PRNG so the sky is the same on every visit. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Rough stellar colour temperatures, weighted toward white/blue-white.
const STAR_TINTS = [
  { color: new Color('#AFC6FF'), weight: 0.22 },
  { color: new Color('#DCE4FF'), weight: 0.34 },
  { color: new Color('#FFFFFF'), weight: 0.26 },
  { color: new Color('#FFE9CF'), weight: 0.13 },
  { color: new Color('#FFC59A'), weight: 0.05 },
]

function pickTint(r: number) {
  let acc = 0
  for (const tint of STAR_TINTS) {
    acc += tint.weight
    if (r <= acc) return tint.color
  }
  return STAR_TINTS[0].color
}

function useStarGeometry(count: number) {
  return useMemo(() => {
    const rand = mulberry32(7)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Uniform on the sphere, slightly concentrated toward a galactic band
      const u = rand() * 2 - 1
      const theta = rand() * Math.PI * 2
      let x = Math.sqrt(1 - u * u) * Math.cos(theta)
      let y = u
      let z = Math.sqrt(1 - u * u) * Math.sin(theta)
      if (rand() < 0.35) {
        y *= 0.25
        const len = Math.hypot(x, y, z)
        x /= len
        y /= len
        z /= len
      }
      const radius = 70 + rand() * 330
      positions.set([x * radius, y * radius, z * radius], i * 3)

      // Power-law brightness: most stars are faint, a few are bright
      const size = 0.7 + Math.pow(rand(), 9) * 3.6 + rand() * 0.6
      sizes[i] = size

      const tint = pickTint(rand())
      const brightness = 0.45 + Math.min(size / 3.2, 1) * 0.75
      colors.set([tint.r * brightness, tint.g * brightness, tint.b * brightness], i * 3)
      phases[i] = rand()
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3))
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1))
    geometry.setAttribute('aPhase', new BufferAttribute(phases, 1))
    return geometry
  }, [count])
}

export function Starfield() {
  const count = quality.tier === 'high' ? 6500 : 2800
  const geometry = useStarGeometry(count)
  const dpr = useThree((s) => s.viewport.dpr)
  const points = useRef<Points>(null)
  const reducedMotion = useExperience((s) => s.reducedMotion)

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: starVertex,
        fragmentShader: starFragment,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uFade: { value: 0 },
          uTwinkle: { value: reducedMotion ? 0 : 1 },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [reducedMotion],
  )

  useFrame(({ camera }) => {
    material.uniforms.uTime.value = director.time
    material.uniforms.uPixelRatio.value = dpr
    material.uniforms.uFade.value = director.sky
    if (points.current) {
      points.current.rotation.y = director.time * 0.0016
      // Stars are effectively at infinity: keep the shell centred on the camera.
      points.current.position.copy(camera.position)
    }
  })

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
}

/** Near-field dust. It is what makes the camera drift read as real parallax. */
export function Dust() {
  const count = quality.tier === 'high' ? 650 : 260
  const dpr = useThree((s) => s.viewport.dpr)

  const geometry = useMemo(() => {
    const rand = mulberry32(19)
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      // A loose slab between the camera and well past the planet,
      // kept out of a cylinder around the planet's line of sight.
      let x = 0
      let y = 0
      do {
        x = (rand() * 2 - 1) * 16
        y = (rand() * 2 - 1) * 10
      } while (Math.hypot(x, y) < 1.6)
      const z = -12 + rand() * 30
      positions.set([x, y, z], i * 3)
      sizes[i] = 0.8 + rand() * 2.4
      phases[i] = rand()
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aSize', new BufferAttribute(sizes, 1))
    g.setAttribute('aPhase', new BufferAttribute(phases, 1))
    return g
  }, [count])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: dustVertex,
        fragmentShader: dustFragment,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uFade: { value: 0 },
          uIon: { value: palette.ion },
          uViolet: { value: palette.violet },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  useFrame(() => {
    material.uniforms.uTime.value = director.time
    material.uniforms.uPixelRatio.value = dpr
    material.uniforms.uFade.value = director.sky
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

// ---------------------------------------------------------------------------
// Deep field: faint distant galaxies, each an elliptical smudge with a core.
// ---------------------------------------------------------------------------

const galaxyVertex = /* glsl */ `
attribute float aSize;
attribute float aAngle;
attribute float aRatio;
attribute vec3 aColor;
uniform float uPixelRatio;
uniform float uFade;
varying float vAngle;
varying float vRatio;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixelRatio;
  vAngle = aAngle;
  vRatio = aRatio;
  vColor = aColor * uFade;
}
`

const galaxyFragment = /* glsl */ `
varying float vAngle;
varying float vRatio;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float s = sin(vAngle), co = cos(vAngle);
  c = vec2(co * c.x - s * c.y, s * c.x + co * c.y);
  c.y /= vRatio;
  float r2 = dot(c, c);
  float disc = exp(-r2 * 22.0);
  float core = exp(-r2 * 260.0);
  float a = disc * 0.32 + core * 0.9;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`

export function DistantGalaxies() {
  const count = quality.tier === 'high' ? 70 : 34
  const dpr = useThree((s) => s.viewport.dpr)

  const geometry = useMemo(() => {
    const rand = mulberry32(101)
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const angles = new Float32Array(count)
    const ratios = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    const warm = new Color('#FFE2C4')
    const cool = new Color('#B7C8FF')
    const tmp = new Color()
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1
      const theta = rand() * Math.PI * 2
      const r = 420
      positions.set(
        [Math.sqrt(1 - u * u) * Math.cos(theta) * r, u * r, Math.sqrt(1 - u * u) * Math.sin(theta) * r],
        i * 3,
      )
      sizes[i] = 6 + Math.pow(rand(), 3) * 16
      angles[i] = rand() * Math.PI
      ratios[i] = 0.18 + rand() * 0.75
      tmp.copy(cool).lerp(warm, rand()).multiplyScalar(0.35 + rand() * 0.25)
      colors.set([tmp.r, tmp.g, tmp.b], i * 3)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aSize', new BufferAttribute(sizes, 1))
    g.setAttribute('aAngle', new BufferAttribute(angles, 1))
    g.setAttribute('aRatio', new BufferAttribute(ratios, 1))
    g.setAttribute('aColor', new BufferAttribute(colors, 3))
    return g
  }, [count])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: galaxyVertex,
        fragmentShader: galaxyFragment,
        uniforms: { uPixelRatio: { value: 1 }, uFade: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  const points = useRef<Points>(null)
  useFrame(({ camera }) => {
    material.uniforms.uPixelRatio.value = dpr
    material.uniforms.uFade.value = director.sky
    if (points.current) {
      points.current.rotation.y = director.time * 0.0016
      points.current.position.copy(camera.position)
    }
  })

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
}

// ---------------------------------------------------------------------------
// A rare shooting star. Never on a rhythm you can feel: 14–38 s apart.
// ---------------------------------------------------------------------------

const streakVertex = /* glsl */ `
attribute float aT;
uniform float uLife;
varying float vAlpha;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // aT runs 0 (tail) → 1 (head). Brightest at the head, fading to the tail.
  vAlpha = pow(aT, 2.2) * uLife;
}
`

const streakFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uColor * vAlpha, vAlpha);
}
`

const STREAK_SEGMENTS = 24

export function ShootingStars() {
  const motionPaused = useExperience((s) => s.motionPaused)
  const reducedMotion = useExperience((s) => s.reducedMotion)
  const state = useRef({ next: 9, t: -1, duration: 1, start: new Vector3(), dir: new Vector3(), length: 1 })
  const rand = useMemo(() => mulberry32(31), [])

  const { geometry, material, line } = useMemo(() => {
    const positions = new Float32Array(STREAK_SEGMENTS * 3)
    const ts = new Float32Array(STREAK_SEGMENTS)
    for (let i = 0; i < STREAK_SEGMENTS; i++) ts[i] = i / (STREAK_SEGMENTS - 1)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('aT', new BufferAttribute(ts, 1))
    const material = new ShaderMaterial({
      vertexShader: streakVertex,
      fragmentShader: streakFragment,
      uniforms: {
        uLife: { value: 0 },
        uColor: { value: new Color('#DCE8FF') },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const line = new Line(geometry, material)
    line.frustumCulled = false
    return { geometry, material, line }
  }, [])

  useFrame(({ camera }, delta) => {
    const s = state.current
    line.position.copy(camera.position)
    if (motionPaused || reducedMotion || director.sky < 0.95 || director.dive > 0 || director.warp > 0) {
      material.uniforms.uLife.value = 0
      return
    }
    const dt = Math.min(delta, 1 / 20)

    if (s.t < 0) {
      s.next -= dt
      if (s.next > 0) return
      // Spawn somewhere in the upper sky, behind the planet, crossing diagonally.
      const az = (rand() - 0.5) * 1.6
      const el = 0.15 + rand() * 0.45
      s.start.set(Math.sin(az) * 90, Math.sin(el) * 90, -Math.cos(az) * 90)
      s.dir.set(rand() - 0.5, -0.35 - rand() * 0.4, (rand() - 0.5) * 0.3).normalize()
      s.length = 7 + rand() * 7
      s.duration = 0.7 + rand() * 0.6
      s.t = 0
    }

    s.t += dt / s.duration
    const t = s.t
    const pos = geometry.attributes.position as BufferAttribute
    const travel = 26 * t
    const tail = Math.min(s.length, travel)
    for (let i = 0; i < STREAK_SEGMENTS; i++) {
      const k = i / (STREAK_SEGMENTS - 1)
      const d = travel - tail * (1 - k)
      pos.setXYZ(i, s.start.x + s.dir.x * d, s.start.y + s.dir.y * d, s.start.z + s.dir.z * d)
    }
    pos.needsUpdate = true
    // Quick ignition, slower burn-out.
    material.uniforms.uLife.value = Math.min(t * 6, 1) * (1 - Math.pow(Math.max(t, 0), 3)) * 0.85

    if (s.t >= 1) {
      s.t = -1
      s.next = 14 + rand() * 24
      material.uniforms.uLife.value = 0
    }
  })

  return <primitive object={line} />
}
