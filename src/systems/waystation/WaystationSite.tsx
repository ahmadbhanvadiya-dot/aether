import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import { GALAXY, SYSTEM_BY_ID } from '../../data/systems'
import { director } from '../../state/director'
import { telemetry } from '../../state/director'
import { useExperience } from '../../state/useExperience'
import { READINGS } from '../../data/waystation'
import { readingFx } from '../../state/site'

/**
 * Phase 11d: the Waystation — a survey station left in the dark between the
 * galaxy's arms. No star: the galaxy's core lights one side warm, the void the
 * other cold, and three of its nine lamps still turn. Loaded on demand, mounted
 * only while it is the active place, always at the scene's origin.
 */

const RING = 5.6
const LAMPS = 9
const LIT = new Set([0, 4, 7])
const LAMP_COLOR = new Color('#9FE3FF')

// Scratch for projecting the readings (no allocation per frame).
const pos = new Vector3()
const nrm = new Vector3()
const toCam = new Vector3()
const anchors = READINGS.map((r) => ({
  id: r.id,
  frame: r.frame,
  local: new Vector3(...r.anchor),
  normal: new Vector3(...r.normal),
  world: new Vector3(),
}))
for (const r of READINGS) telemetry.site[r.id] = telemetry.site[r.id] ?? { x: 0, y: 0, on: false }

export default function WaystationSite() {
  const spin = useRef<Group>(null)
  const scanHalo = useRef<Mesh>(null)
  const camera = useThree((st) => st.camera)
  const size = useThree((st) => st.size)
  const lamps = useRef<(MeshBasicMaterial | null)[]>([])
  const halos = useRef<(MeshBasicMaterial | null)[]>([])

  // The galaxy's core, seen from the station (the scene is offset so the station is at the origin).
  const coreDir = useMemo(() => GALAXY.position.clone().sub(SYSTEM_BY_ID.waystation.position).normalize(), [])

  const metal = useMemo(() => new MeshStandardMaterial({ color: '#8A93A6', metalness: 0.55, roughness: 0.5 }), [])
  const dark = useMemo(() => new MeshStandardMaterial({ color: '#4E5666', metalness: 0.5, roughness: 0.65 }), [])
  const mark = useMemo(() => new MeshBasicMaterial({ color: LAMP_COLOR.clone().multiplyScalar(1.6), toneMapped: false }), [])

  // Dust drifting about the station.
  const dust = useMemo(() => {
    const n = 420
    const pos = new Float32Array(n * 3)
    const v = new Vector3()
    // Seeded, so the dust lies the same way on every visit.
    let seed = 0x9e3779b9
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1
      const th = rand() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      v.set(r * Math.cos(th), u, r * Math.sin(th)).multiplyScalar(9 + rand() * 26)
      v.y *= 0.55
      pos.set([v.x, v.y, v.z], i * 3)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    return g
  }, [])

  useEffect(
    () => () => {
      metal.dispose()
      dark.dispose()
      mark.dispose()
      dust.dispose()
    },
    [metal, dark, mark, dust],
  )

  useFrame(() => {
    const t = director.time
    if (spin.current) spin.current.rotation.y = t * 0.018

    // Readings: where each anchor is on screen, and whether its face is towards us.
    const group = spin.current
    if (group) {
      group.updateWorldMatrix(true, false)
      for (const a of anchors) {
        if (a.frame === 'station') {
          a.world.copy(a.local).applyMatrix4(group.matrixWorld)
          nrm.copy(a.normal).transformDirection(group.matrixWorld)
        } else {
          a.world.copy(a.local)
          nrm.set(0, 0, 0)
        }
        toCam.subVectors(camera.position, a.world)
        const facing = nrm.lengthSq() === 0 || nrm.dot(toCam) > 0
        pos.copy(a.world).project(camera)
        const m = telemetry.site[a.id]
        m.x = (pos.x * 0.5 + 0.5) * size.width
        m.y = (-pos.y * 0.5 + 0.5) * size.height
        m.on = facing && pos.z < 1 && Math.abs(pos.x) < 1.02 && Math.abs(pos.y) < 1.02
      }
    }
    // While a reading is taken, light gathers at its point.
    const halo = scanHalo.current
    if (halo) {
      const a = readingFx.id ? anchors.find((x) => x.id === readingFx.id) : null
      halo.visible = !!a
      if (a) {
        halo.position.copy(a.world)
        const p = readingFx.progress
        halo.scale.setScalar(0.35 + 1.1 * (1 - p) + 0.08 * Math.sin(t * 9))
        ;(halo.material as MeshBasicMaterial).opacity = 0.15 + 0.55 * p
      }
    }
    // The surviving lamps turn slowly, each a little out of step with the others.
    for (let i = 0; i < LAMPS; i++) {
      const lamp = lamps.current[i]
      const halo = halos.current[i]
      if (!lamp || !halo) continue
      if (!LIT.has(i)) continue
      const k = 0.55 + 0.45 * Math.max(0, Math.sin(t * 0.7 + i * 1.9))
      lamp.color.copy(LAMP_COLOR).multiplyScalar(0.5 + 1.1 * k)
      halo.opacity = 0.05 + 0.14 * k
    }
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // Ignore the click that ends a drag-to-rotate, and anything outside the overview.
    if (e.delta > 6 || useExperience.getState().phase !== 'galaxy') return
    e.stopPropagation()
    useExperience.getState().setSiteOpen(true)
  }
  const over = () => (document.body.style.cursor = 'pointer')
  const out = () => (document.body.style.cursor = '')

  return (
    <group>
      {/* Light: the galaxy's core on one side, the void's cold on the other. */}
      <ambientLight color="#6A78A6" intensity={0.7} />
      <directionalLight color="#FFD6A8" intensity={3.2} position={coreDir.clone().multiplyScalar(50)} />
      <directionalLight color="#6E8FD8" intensity={0.9} position={coreDir.clone().multiplyScalar(-50)} />
      <pointLight color={LAMP_COLOR} intensity={14} distance={16} decay={1.6} position={[RING, 0, 0]} />

      <group rotation={[0.32, 0, 0.12]}>
        <group ref={spin} onClick={onClick} onPointerOver={over} onPointerOut={out}>
          {/* The hub, with the survey's mark on its face. */}
          <mesh material={metal}>
            <cylinderGeometry args={[1.1, 1.25, 3.6, 24]} />
          </mesh>
          <mesh material={dark} position={[0, 2.1, 0]}>
            <cylinderGeometry args={[0.55, 1.1, 0.7, 24]} />
          </mesh>
          <mesh material={dark} position={[0, -2.1, 0]}>
            <cylinderGeometry args={[1.1, 0.55, 0.7, 24]} />
          </mesh>
          <group position={[0, -0.2, 1.2]}>
            <mesh material={mark} position={[0, -0.55, 0]}>
              <torusGeometry args={[0.34, 0.035, 8, 40]} />
            </mesh>
            {[-0.24, 0, 0.24].map((x, i) => (
              <mesh key={x} material={mark} position={[x, 0.1 + i * 0.12, 0]}>
                <boxGeometry args={[0.05, 0.5 + i * 0.24, 0.05]} />
              </mesh>
            ))}
          </group>

          {/* The main ring, on three spars, and its nine lamps. */}
          <mesh material={metal} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[RING, 0.24, 12, 96]} />
          </mesh>
          {[0, 1, 2].map((k) => {
            const a = (k / 3) * Math.PI * 2 + 0.3
            return (
              <mesh key={k} material={dark} position={[Math.cos(a) * RING * 0.55, 0, Math.sin(a) * RING * 0.55]} rotation={[0, -a, 0]}>
                <boxGeometry args={[RING * 0.9, 0.16, 0.3]} />
              </mesh>
            )
          })}
          {Array.from({ length: LAMPS }, (_, i) => {
            const a = (i / LAMPS) * Math.PI * 2
            const lit = LIT.has(i)
            return (
              <group key={i} position={[Math.cos(a) * RING, 0.32, Math.sin(a) * RING]}>
                <mesh>
                  <sphereGeometry args={[0.2, 12, 12]} />
                  <meshBasicMaterial
                    ref={(m) => {
                      lamps.current[i] = m
                    }}
                    color={lit ? LAMP_COLOR : '#141A24'}
                    toneMapped={!lit}
                  />
                </mesh>
                {lit && (
                  <mesh>
                    <sphereGeometry args={[0.42, 12, 12]} />
                    <meshBasicMaterial
                      ref={(m) => {
                        halos.current[i] = m
                      }}
                      color={LAMP_COLOR}
                      transparent
                      opacity={0.12}
                      depthWrite={false}
                      blending={AdditiveBlending}
                    />
                  </mesh>
                )}
              </group>
            )
          })}

          {/* An outer ring, broken: most of it is gone. */}
          <mesh material={dark} rotation={[Math.PI / 2 + 0.35, 0.2, 0.9]}>
            <torusGeometry args={[7.6, 0.13, 8, 80, 3.9]} />
          </mesh>
        </group>
      </group>

      <mesh ref={scanHalo} visible={false}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color={LAMP_COLOR} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>

      <points geometry={dust}>
        <pointsMaterial color="#8FA6C8" size={0.09} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
      </points>
    </group>
  )
}
