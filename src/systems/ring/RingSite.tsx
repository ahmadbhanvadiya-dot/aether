import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three'
import { GALAXY, SYSTEM_BY_ID } from '../../data/systems'
import { RING_ARC } from '../../data/waystation'
import { director } from '../../state/director'
import { useExperience } from '../../state/useExperience'
import { useSiteReadings } from '../siteReadings'

/**
 * Phase 11d: the keepers' ring — the Waystation's outer ring, cut free and fitted
 * with engines, drifting toward the core. An arc of the old ring with its ribs, a
 * row of windows lit violet by the moss grown inside, three cold engines on the
 * cut end, and lamps still sending the four notes (here, here, here — wait). It
 * tumbles slowly. Loaded on demand, at the scene's origin while it is the active place.
 */

const { radius: R, tube: TUBE, half: HALF, shift: SHIFT } = RING_ARC
const LAMP = new Color('#C8A2FF')
const GARDEN = new Color('#B98CFF')
const LAMP_AT = [-0.6, 0.1, 0.7]

/** A point on the arc (as in data/waystation), and the rotation that turns +Z along the arc there. */
const at = (a: number, out = 0, up = 0): [number, number, number] => [(R + out) * Math.cos(a) + SHIFT, up, (R + out) * Math.sin(a)]

/** The four notes: three short, one long, on a six-second cycle. */
function notes(t: number) {
  const c = ((t % 6) + 6) % 6
  const short = (s: number) => Math.exp(-((c - s) ** 2) / 0.012)
  return Math.max(short(0.2), short(0.9), short(1.6), c > 2.6 && c < 4.4 ? Math.sin(((c - 2.6) / 1.8) * Math.PI) : 0)
}

export default function RingSite() {
  const spin = useRef<Group>(null)
  const lampMats = useRef<(MeshBasicMaterial | null)[]>([])
  const scanHalo = useSiteReadings('ring', spin)

  const coreDir = useMemo(() => GALAXY.position.clone().sub(SYSTEM_BY_ID.ring.position).normalize(), [])
  const metal = useMemo(() => new MeshStandardMaterial({ color: '#8A8FA6', metalness: 0.55, roughness: 0.5 }), [])
  const dark = useMemo(() => new MeshStandardMaterial({ color: '#4A4E60', metalness: 0.5, roughness: 0.65 }), [])
  const window_ = useMemo(() => new MeshBasicMaterial({ color: GARDEN.clone().multiplyScalar(1.3), toneMapped: false }), [])

  // Spores drifting about the ring (seeded: the same on every visit).
  const dust = useMemo(() => {
    const n = 360
    const pos = new Float32Array(n * 3)
    const v = new Vector3()
    let seed = 0x2545f491
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1
      const th = rand() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      v.set(r * Math.cos(th), u * 0.5, r * Math.sin(th)).multiplyScalar(8 + rand() * 24)
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
      window_.dispose()
      dust.dispose()
    },
    [metal, dark, window_, dust],
  )

  useFrame(() => {
    const t = director.time
    // A slow tumble: no one has steered it for a long time.
    if (spin.current) {
      spin.current.rotation.y = t * 0.012
      spin.current.rotation.z = 0.08 * Math.sin(t * 0.05)
    }
    const k = notes(t)
    for (const m of lampMats.current) m?.color.copy(LAMP).multiplyScalar(0.35 + 1.5 * k)
    window_.color.copy(GARDEN).multiplyScalar(1.15 + 0.15 * Math.sin(t * 0.4))
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || useExperience.getState().phase !== 'galaxy') return
    e.stopPropagation()
    useExperience.getState().setSiteOpen(true)
  }
  const over = () => (document.body.style.cursor = 'pointer')
  const out = () => (document.body.style.cursor = '')

  const ribs = useMemo(() => Array.from({ length: 11 }, (_, i) => -HALF + 0.1 + (i / 10) * (2 * HALF - 0.2)), [])
  const windows = useMemo(() => Array.from({ length: 13 }, (_, i) => -0.9 + (i / 12) * 1.8), [])

  return (
    <group>
      <ambientLight color="#5E5480" intensity={0.6} />
      <directionalLight color="#FFD6A8" intensity={3} position={coreDir.clone().multiplyScalar(50)} />
      <directionalLight color="#6E7FD8" intensity={0.8} position={coreDir.clone().multiplyScalar(-50)} />
      <pointLight color={GARDEN} intensity={10} distance={14} decay={1.6} position={at(0, TUBE + 2, 0)} />

      <group rotation={[0.25, 0, -0.18]}>
        <group ref={spin} onClick={onClick} onPointerOver={over} onPointerOut={out}>
          {/* The arc of the old ring. */}
          <group position={[SHIFT, 0, 0]} rotation={[0, HALF, 0]}>
            <mesh material={metal} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[R, TUBE, 18, 72, 2 * HALF]} />
            </mesh>
          </group>
          {/* Ribs around the hull. */}
          {ribs.map((a) => (
            <group key={a} position={at(a)} rotation={[0, -a, 0]}>
              <mesh material={dark}>
                <torusGeometry args={[TUBE + 0.06, 0.07, 6, 24]} />
              </mesh>
            </group>
          ))}
          {/* Windows on the outer face, lit by the garden inside. */}
          {windows.map((a) => (
            <mesh key={a} material={window_} position={at(a, TUBE + 0.01, 0.12)} rotation={[0, Math.PI / 2 - a, 0]}>
              <boxGeometry args={[0.42, 0.28, 0.04]} />
            </mesh>
          ))}
          {/* The cut end: a flange; the other end: three cold engines. */}
          <group position={at(-HALF)} rotation={[0, HALF, 0]}>
            <mesh material={dark}>
              <torusGeometry args={[TUBE * 0.7, 0.18, 8, 24]} />
            </mesh>
          </group>
          {(
            [
              [0, 0.6],
              [0.55, -0.35],
              [-0.55, -0.35],
            ] as const
          ).map(([o, u]) => (
            <group key={`${o}${u}`} position={at(HALF + 0.06, o, u)} rotation={[0, -HALF, 0]}>
              <mesh material={dark} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.28, 0.42, 1.5, 16]} />
              </mesh>
            </group>
          ))}
          {/* Lamps along the top of the hull. */}
          {LAMP_AT.map((a, i) => (
            <mesh key={a} position={at(a, 0, TUBE + 0.12)}>
              <sphereGeometry args={[0.18, 12, 12]} />
              <meshBasicMaterial
                ref={(m) => {
                  lampMats.current[i] = m
                }}
                color={LAMP}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      </group>

      <mesh ref={scanHalo} visible={false}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color={LAMP} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>

      <points geometry={dust}>
        <pointsMaterial color="#B8A2D8" size={0.08} sizeAttenuation transparent opacity={0.5} depthWrite={false} />
      </points>
    </group>
  )
}
