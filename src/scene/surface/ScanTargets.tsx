import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, DoubleSide, Mesh, MathUtils, PlaneGeometry, ShaderMaterial, Vector3 } from 'three'
import { discoveriesFor, type DiscoveryData } from '../../data/discoveries'
import { PLANET_BY_ID, type PlanetId } from '../../data/planets'
import { director, telemetry } from '../../state/director'
import { useExploration } from '../../state/exploration'
import { useExperience } from '../../state/useExperience'
import { noticeHidden } from '../../ui/scanner'
import { scanFx } from '../motion'
import { surfaceCam } from './SurfaceRig'
import { surface } from './world'

/**
 * Phase 6: the scanner in the scene. Faint glints mark points of interest —
 * brighter at the location you are at and toward the centre of your view,
 * barely there from a distance. Hidden discoveries show nothing until you
 * look toward one; holding the gaze reveals it. While scanning, a beam rises
 * at the target and rings sweep out from it; completion sends one bright ring.
 * Screen positions go to `telemetry.targets` for the DOM scan markers.
 */

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const glintFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uFound;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float d = length(c);
  float core = smoothstep(0.1, 0.02, d);
  float halo = exp(-d * d * 40.0) * 0.5;
  // Unfound: a thin ring that breathes. Found: a steady point.
  float r = 0.3 + 0.025 * sin(uTime * 2.0);
  float ring = smoothstep(0.02, 0.0, abs(d - r)) * (1.0 - uFound) * 0.9;
  float a = clamp((core + halo + ring) * uAlpha, 0.0, 1.0);
  // Bright enough at the core to catch the bloom: a small sparkle even in daylight.
  gl_FragColor = vec4(uColor * (core * 2.6 + halo + ring * 1.2), a);
}
`

const ringFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uRadius;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5);
  float ring = smoothstep(0.018, 0.0, abs(d - uRadius));
  gl_FragColor = vec4(uColor * ring, ring * uAlpha);
}
`

const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uHeight;
varying vec2 vUv;
void main() {
  float x = abs(vUv.x - 0.5) * 2.0;
  float core = exp(-x * x * 18.0);
  // Brightest at the base, fading upward; only the risen part shows.
  float rise = step(vUv.y, uHeight) * (1.0 - vUv.y / max(uHeight, 0.001)) ;
  float a = core * rise * uAlpha;
  gl_FragColor = vec4(uColor * core, a);
}
`

/** How long a hidden discovery must be looked at (seconds), and the cones (radians). */
const DWELL = 1.4
const LOCK_CONE = Math.cos(0.2)
const WARM_OUTER = Math.cos(0.45)
const WARM_INNER = Math.cos(0.12)
/** On-screen glint size in CSS px. */
const GLINT_PX = 44

const camPos = new Vector3()
const viewDir = new Vector3()
const toTarget = new Vector3()
const projected = new Vector3()

interface Glint {
  d: DiscoveryData
  mesh: Mesh | null
  mat: ShaderMaterial
  reveal: number
  dwell: number
  /** Terrain between the eye and the object: 0 → clear, 1 → hidden (damped). */
  occl: number
  blocked: boolean
}

/**
 * Is the line from the eye to a target blocked by the ground? Samples the
 * terrain along the middle of the line (the ends are skipped: the eye and the
 * object both sit just above the ground).
 */
function blocked(from: Vector3, to: Vector3) {
  for (let i = 1; i < 14; i++) {
    const t = 0.04 + (i / 14) * 0.86
    const y = from.y + (to.y - from.y) * t
    if (surface.height(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t) > y + 0.6) return true
  }
  return false
}

export function ScanTargets({ planet }: { planet: PlanetId }) {
  const size = useThree((s) => s.size)
  const accent = useMemo(() => new Color(PLANET_BY_ID[planet].accent).lerp(new Color('#ffffff'), 0.35), [planet])

  const glints = useMemo<Glint[]>(
    () =>
      discoveriesFor(planet)
        .filter((d) => d.kind !== 'signal')
        .map((d) => ({
          d,
          mesh: null,
          reveal: 0,
          dwell: 0,
          occl: 0,
          blocked: false,
          mat: new ShaderMaterial({
            vertexShader: vertex,
            fragmentShader: glintFragment,
            uniforms: {
              uColor: { value: accent.clone().multiplyScalar(1.4) },
              uAlpha: { value: 0 },
              uFound: { value: 0 },
              uTime: { value: 0 },
            },
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: AdditiveBlending,
          }),
        })),
    [planet, accent],
  )
  const all = useMemo(() => discoveriesFor(planet), [planet])
  const quad = useMemo(() => new PlaneGeometry(1, 1), [])
  // Freed with the surface (Phase 10): each descent mounts a new one.
  useEffect(() => () => quad.dispose(), [quad])

  const fx = useMemo(() => {
    const make = (fragment: string, extra: Record<string, { value: unknown }>) =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { uColor: { value: accent.clone().multiplyScalar(1.6) }, uAlpha: { value: 0 }, ...extra },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      })
    return {
      beam: make(beamFragment, { uHeight: { value: 0 } }),
      sweeps: [0, 1].map(() => make(ringFragment, { uRadius: { value: 0.2 } })),
      pulse: make(ringFragment, { uRadius: { value: 0.2 } }),
    }
  }, [accent])
  const beam = useRef<Mesh>(null)
  const frame = useRef(0)
  const sweeps = useRef<(Mesh | null)[]>([])
  const pulse = useRef<Mesh>(null)

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 1 / 20)
    frame.current++
    const st = useExperience.getState()
    const discovered = useExploration.getState().discovered
    const here = st.location
    const free = st.phase === 'surface' && surfaceCam.mode === 'free' && !st.scanning
    camera.getWorldPosition(camPos)
    camera.getWorldDirection(viewDir)
    const clear = 1 - Math.min(1, director.atmo)
    const t = director.time
    const tanHalf = Math.tan(MathUtils.degToRad((camera as { fov?: number }).fov ?? 55) / 2)

    for (const g of glints) {
      const pos = surface.targets[g.d.id]
      const mesh = g.mesh
      if (!pos || !mesh) continue
      toTarget.subVectors(pos, camPos)
      const dist = toTarget.length()
      const gaze = toTarget.divideScalar(Math.max(dist, 1e-3)).dot(viewDir)
      const found = !!discovered[g.d.id]
      const atHere = g.d.location === here
      let alpha: number
      if (g.d.kind === 'secret' && !found) {
        // Hidden: a faint shimmer only as the view nears it; holding it there reveals it.
        const detected = !!st.detected[g.d.id]
        if (!detected && atHere && free) {
          g.dwell = gaze > LOCK_CONE ? g.dwell + dt : Math.max(0, g.dwell - dt * 0.6)
          if (g.dwell >= DWELL) noticeHidden(g.d.id)
        }
        g.reveal = MathUtils.damp(g.reveal, detected ? 1 : 0, 1.6, dt)
        const warm = atHere ? MathUtils.smoothstep(gaze, WARM_OUTER, WARM_INNER) * (0.12 + 0.3 * Math.min(1, g.dwell / DWELL)) : 0
        alpha = Math.max(warm, g.reveal * (0.45 + 0.55 * MathUtils.smoothstep(gaze, 0.8, 0.995)))
      } else {
        const near = atHere ? 1 : MathUtils.smoothstep(dist, 1500, 600) * 0.45
        const focus = 0.4 + 0.6 * MathUtils.smoothstep(gaze, 0.8, 0.995)
        alpha = near * focus * (found ? 0.65 : 1)
      }
      // Behind a ridge: tested every third frame (staggered), faded rather than popped.
      if ((frame.current + glints.indexOf(g)) % 3 === 0) g.blocked = blocked(camPos, pos)
      g.occl = MathUtils.damp(g.occl, g.blocked ? 1 : 0, 6, dt)
      alpha *= clear * (gaze > 0 ? 1 : 0) * (1 - g.occl)
      mesh.visible = alpha > 0.004
      g.mat.uniforms.uAlpha.value = alpha
      g.mat.uniforms.uFound.value = found ? 1 : 0
      g.mat.uniforms.uTime.value = t
      if (mesh.visible) {
        mesh.position.copy(pos)
        mesh.quaternion.copy(camera.quaternion)
        mesh.scale.setScalar(2 * dist * tanHalf * (GLINT_PX / size.height))
      }
    }

    // Screen positions for the DOM markers: only what can be scanned from here.
    const targets = telemetry.targets
    camera.updateMatrixWorld()
    for (const d of all) {
      const pos = surface.targets[d.id]
      const entry = (targets[d.id] ??= { x: 0, y: 0, on: false, alpha: 0 })
      const found = !!discovered[d.id]
      const scannable = d.location === here && (d.kind !== 'secret' || found || !!st.detected[d.id])
      if (!pos || !scannable) {
        entry.on = false
        continue
      }
      projected.copy(pos).project(camera)
      entry.x = (projected.x * 0.5 + 0.5) * size.width
      entry.y = (-projected.y * 0.5 + 0.5) * size.height
      const glintOf = glints.find((g) => g.d.id === d.id)
      entry.on =
        projected.z < 1 &&
        Math.abs(projected.x) < 1.05 &&
        Math.abs(projected.y) < 1.05 &&
        clear > 0.5 &&
        (!glintOf || glintOf.occl < 0.5)
      const glint = glints.find((g) => g.d.id === d.id)
      entry.alpha = d.kind === 'signal' ? 1 : (glint?.mat.uniforms.uAlpha.value as number) ?? 0
    }

    // Scan effects at the target.
    const id = scanFx.target
    const pos = id ? surface.targets[id] : null
    const sky = id ? !!all.find((d) => d.id === id)?.placement?.elev : false
    const scanning = !!st.scanning
    if (beam.current) {
      beam.current.visible = !!pos && !sky && scanFx.beam > 0.002
      if (pos && beam.current.visible) {
        const dist = camPos.distanceTo(pos)
        const height = Math.max(40, dist * 0.6)
        beam.current.scale.set(Math.max(1.2, dist * 0.012), height, 1)
        beam.current.position.set(pos.x, pos.y + height / 2, pos.z)
        beam.current.rotation.set(0, Math.atan2(camPos.x - pos.x, camPos.z - pos.z), 0)
        fx.beam.uniforms.uHeight.value = scanFx.beam
        fx.beam.uniforms.uAlpha.value = 0.55 * scanFx.beam
      }
    }
    const ringSize = pos ? Math.max(14, camPos.distanceTo(pos) * 0.22) : 1
    sweeps.current.forEach((m, i) => {
      if (!m) return
      const on = !!pos && scanning
      m.visible = on
      if (!on || !pos) return
      const phase = (t * 0.9 + i * 0.5) % 1
      m.position.copy(pos)
      m.quaternion.copy(camera.quaternion)
      m.scale.setScalar(ringSize)
      ;(m.material as ShaderMaterial).uniforms.uRadius.value = 0.08 + phase * 0.38
      ;(m.material as ShaderMaterial).uniforms.uAlpha.value = (1 - phase) * 0.7 * Math.min(1, scanFx.progress * 6)
    })
    if (pulse.current) {
      pulse.current.visible = !!pos && scanFx.pulse > 0.001 && scanFx.pulse < 0.999
      if (pos && pulse.current.visible) {
        pulse.current.position.copy(pos)
        pulse.current.quaternion.copy(camera.quaternion)
        pulse.current.scale.setScalar(ringSize * 1.6)
        fx.pulse.uniforms.uRadius.value = 0.06 + scanFx.pulse * 0.42
        fx.pulse.uniforms.uAlpha.value = (1 - scanFx.pulse) * 1.6
      }
    }
  })

  return (
    <group>
      {glints.map((g) => (
        <mesh
          key={g.d.id}
          ref={(m) => {
            g.mesh = m
          }}
          geometry={quad}
          material={g.mat}
          renderOrder={30}
          frustumCulled={false}
          visible={false}
        />
      ))}
      <mesh ref={beam} geometry={quad} material={fx.beam} renderOrder={29} frustumCulled={false} visible={false} />
      {fx.sweeps.map((m, i) => (
        <mesh
          key={i}
          ref={(el) => {
            sweeps.current[i] = el
          }}
          geometry={quad}
          material={m}
          renderOrder={31}
          frustumCulled={false}
          visible={false}
        />
      ))}
      <mesh ref={pulse} geometry={quad} material={fx.pulse} renderOrder={31} frustumCulled={false} visible={false} />
    </group>
  )
}
