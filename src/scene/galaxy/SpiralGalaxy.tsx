import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial } from 'three'
import { GALAXY } from '../../data/systems'
import { director } from '../../state/director'
import { quality } from '../../state/useExperience'
import { galaxyDiscFragment, galaxyDiscVertex } from './shaders'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(rand: () => number) {
  return Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand())
}

const RADIUS = GALAXY.radius
const ARMS = 4
const TWIST = 3.4

/**
 * The galaxy the Aether system belongs to. The system sits out in one of the
 * arms, so the bright core and the far arms sweep across the sky behind it.
 */
export function SpiralGalaxy() {
  const count = quality.tier === 'high' ? 70_000 : 26_000
  const dpr = useThree((s) => s.viewport.dpr)
  const points = useRef<Points>(null)

  const geometry = useMemo(() => {
    const rand = mulberry32(2024)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const core = new Color('#FFE0B5')
    const arm = new Color('#A9C2FF')
    const violet = new Color('#8C6CFF')
    const pink = new Color('#FF8FB8')
    const tmp = new Color()

    for (let i = 0; i < count; i++) {
      const inBulge = rand() < 0.16
      let x: number
      let y: number
      let z: number
      if (inBulge) {
        const r = Math.abs(gaussian(rand)) * 26
        const th = rand() * Math.PI * 2
        const ph = Math.acos(rand() * 2 - 1)
        x = r * Math.sin(ph) * Math.cos(th)
        y = r * Math.cos(ph) * 0.55
        z = r * Math.sin(ph) * Math.sin(th)
        tmp.copy(core).multiplyScalar(0.55 + rand() * 0.5)
      } else {
        const r = Math.pow(rand(), 0.75) * RADIUS + 14
        const armIndex = Math.floor(rand() * ARMS)
        const spread = gaussian(rand) * (0.22 + 0.18 * (1 - r / RADIUS))
        const angle = (armIndex / ARMS) * Math.PI * 2 + (r / RADIUS) * TWIST * Math.PI + spread
        x = Math.cos(angle) * r + gaussian(rand) * 6
        z = Math.sin(angle) * r + gaussian(rand) * 6
        y = gaussian(rand) * (5 + 9 * (1 - r / RADIUS))
        const t = r / RADIUS
        tmp.copy(core).lerp(arm, Math.min(1, t * 1.6))
        const roll = rand()
        if (roll < 0.05) tmp.copy(pink)
        else if (roll < 0.12) tmp.lerp(violet, 0.6)
        tmp.multiplyScalar((0.25 + rand() * 0.5) * (1.1 - t * 0.6))
      }
      positions.set([x, y, z], i * 3)
      colors.set([tmp.r, tmp.g, tmp.b], i * 3)
      sizes[i] = 0.6 + Math.pow(rand(), 6) * 2.6
    }

    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aColor', new BufferAttribute(colors, 3))
    g.setAttribute('aSize', new BufferAttribute(sizes, 1))
    return g
  }, [count])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: galaxyDiscVertex,
        fragmentShader: galaxyDiscFragment,
        uniforms: { uPixelRatio: { value: 1 }, uFade: { value: 0 }, uMap: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  useFrame(() => {
    material.uniforms.uPixelRatio.value = dpr
    material.uniforms.uFade.value = 0.35 + director.galaxyIntro * 0.65 + director.map * 0.35
    material.uniforms.uMap.value = director.map
  })

  // Core off to one side and below, the disc tipped so its arms cross the sky.
  // (Phase 11: it no longer turns — Elys and the other systems keep their places in
  // its arms on the universe map. The placement is shared with data/systems.ts.)
  return (
    <group position={GALAXY.position} rotation={GALAXY.rotation}>
      <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
    </group>
  )
}
