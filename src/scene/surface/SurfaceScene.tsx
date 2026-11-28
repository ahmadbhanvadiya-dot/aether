import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LineSegments,
  MathUtils,
  Mesh,
  Points,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  Vector4,
  type BufferGeometry as BG,
} from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SURFACES, type Place, type SurfaceSettings } from '../../data/locations'
import { isElysWorld, type WorldId } from '../../data/planets'
import { director, telemetry } from '../../state/director'
import { useExploration } from '../../state/exploration'
import { quality, useExperience } from '../../state/useExperience'
import { signalFx } from '../../ui/exploreDirector'
import { startScan } from '../../ui/scanner'
import { liveEnv } from './living'
import { ScanTargets } from './ScanTargets'
import { sound } from '../../audio/sound'
import { surfaceCam } from './SurfaceRig'
import { scanFx } from '../motion'
import { sim } from '../../state/simulation'
import { placeMoons } from './skyMoons'
import { applyEnv, createSurfaceUniforms, type SurfaceUniforms } from './env'
import {
  beaconCoreFragment,
  beaconRingFragment,
  beamFragment,
  cloudFragment,
  cloudVertex,
  landmarkFragment,
  landmarkVertex,
  motesFragment,
  motesVertex,
  plumeFragment,
  plumeVertex,
  rainFragment,
  rainVertex,
  skyFragment,
  skyVertex,
  terrainFragment,
  terrainVertex,
  uvVertex,
  waterFragment,
  waterVertex,
} from './shaders'
import { KIND_IDS, polarGrid, SHAPE_IDS } from './terrain'
import { prepareSurface, surface } from './world'

const HIGH = quality.tier === 'high'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Phase 10: geometries made in hooks are not freed by React; release their GPU
 * buffers when the surface unmounts (each descent mounts a new one). Materials are
 * kept: they hold no buffers, and their compiled programs make revisits instant.
 */
function useDispose(...items: ({ dispose(): void } | null | undefined)[]) {
  useEffect(() => () => items.forEach((i) => i?.dispose()), items) // eslint-disable-line react-hooks/exhaustive-deps
}

function gridGeometry(rings: number, segments: number, first: number, ratio: number) {
  const g = polarGrid(rings, segments, first, ratio)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(g.positions, 3))
  geometry.setIndex(g.index)
  return geometry
}

/** Mounts the surface of the world being explored (from descent to ascent). */
/** Loaded on demand (see ./lazy.ts); mounted by SurfaceSpace in Experience. */
const flareView = new Vector3()
const flareProbe = new Vector3()

export default function SurfaceScene({ planet }: { planet: WorldId }) {
  const s = useMemo(() => prepareSurface(planet), [planet])
  const settings = SURFACES[planet]
  const group = useRef<Group>(null)
  const gl = useThree((st) => st.gl)
  const scene = useThree((st) => st.scene)
  const camera = useThree((st) => st.camera)

  const uniforms = useMemo(() => {
    const u = createSurfaceUniforms(settings)
    s.locations.forEach((l, i) => {
      u.uLocA.value[i].set(l.center[0], l.center[1], l.terrain.radius, l.terrain.lift)
      u.uLocB.value[i].set(l.terrain.rough, SHAPE_IDS[l.terrain.shape], l.terrain.a, l.terrain.b)
    })
    if (s.env) applyEnv(u, s.env)
    return u
  }, [settings, s])

  // LIVE_OCT: noise octaves for the Phase 7 cloud shadows (one fewer on the low tier).
  // SUN2: a second sun's paths (Liris), compiled only where there is one (Phase 11).
  // SHADOW_STEPS: the realism pass's march toward the sun for the land's own shadows.
  const defines = useMemo(
    () => ({
      SEED: `${settings.seed}u`,
      SKIND: KIND_IDS[settings.kind],
      LIVE_OCT: HIGH ? 3 : 2,
      SHADOW_STEPS: HIGH ? 10 : 6,
      ...(settings.twoSuns ? { SUN2: 1 } : {}),
    }),
    [settings],
  )

  // Compile every surface program now (during the descent), not on first view.
  useEffect(() => {
    if (group.current) gl.compile(group.current, camera, scene)
  }, [gl, camera, scene])

  // Bold pass: the sun on screen, for the lens flare — only when it is up, in view,
  // not behind the land and not lost in cloud.
  const flareSize = useThree((st) => st.size)
  const projectFlare = (sunDir: Vector3, cover: number) => {
    const f = telemetry.flare
    camera.getWorldDirection(flareView)
    const facing = MathUtils.smoothstep(flareView.dot(sunDir), 0.55, 0.97)
    const up = MathUtils.smoothstep(sunDir.y, 0.0, 0.1)
    let k = facing * up * (1 - 0.75 * cover)
    if (k > 0.01) {
      // Terrain between the eye and the sun hides it.
      for (const d of [25, 60, 120, 240, 480]) {
        flareProbe.copy(camera.position).addScaledVector(sunDir, d)
        if (surface.height(flareProbe.x, flareProbe.z) > flareProbe.y) {
          k = 0
          break
        }
      }
    }
    flareProbe.copy(camera.position).addScaledVector(sunDir, 1000).project(camera)
    f.x = (flareProbe.x * 0.5 + 0.5) * flareSize.width
    f.y = (-flareProbe.y * 0.5 + 0.5) * flareSize.height
    f.k += (k - f.k) * 0.15
  }

  useFrame((_, delta) => {
    const { reducedMotion, motionPaused } = useExperience.getState()
    // The living pass: day–night drift, gusting wind and breathing weather (Phase 7).
    if (s.env) {
      const ev = weatherEvent
      const env = liveEnv(s.env, uniforms, planet, director.time, Math.min(delta, 1 / 20), {
        reduced: reducedMotion,
        paused: motionPaused,
        // Cinematic pass: a gust event drives the wind (sand streams and dust walls speed up).
        gust: ev.kind === 'gust' ? ev.strength : 0,
      })
      // Cinematic pass: what an event does to the light and weather (all eased by its envelope).
      if (ev.strength > 0) {
        const k = ev.strength
        if (ev.kind === 'squall') {
          // A squall line passes: the ceiling lowers and thickens, the light falls, the air fills.
          env.cloudCover = Math.min(0.98, env.cloudCover + 0.22 * k)
          env.sunColor.multiplyScalar(1 - 0.32 * k)
          env.zenith.multiplyScalar(1 - 0.18 * k)
          env.fog *= 1 + 0.6 * k
        } else if (ev.kind === 'aurora') {
          env.aurora *= 1 + 0.9 * k
        } else if (ev.kind === 'gust') {
          // Dust in the air: the distance softens and warms.
          env.fog *= 1 + 0.4 * k
          env.horizon.lerp(env.ground, 0.12 * k)
        } else if (ev.kind === 'sunbreak') {
          // The break in the clouds brightens the whole scene a touch (beams are in the shaders).
          env.sunColor.multiplyScalar(1 + 0.12 * k)
        }
      }
      applyEnv(uniforms, env)
      // The sky's moons stand where the simulation has them (after the sun is set).
      const covered = isElysWorld(planet) ? placeMoons(uniforms, planet, sim.day, settings.moons) : 0
      // An eclipse seen from the ground: the light falls with the covered part of Elys.
      if (covered > 0) uniforms.uSunColor.value.multiplyScalar(1 - 0.88 * covered)
    }
    uniforms.uTime.value = director.time
    projectFlare(uniforms.uSunDir.value, uniforms.uCloudCover.value)
  })


  return (
    <group ref={group}>
      <Sky uniforms={uniforms} defines={defines} />
      <Terrain uniforms={uniforms} defines={defines} />
      {settings.water && <Water uniforms={uniforms} defines={defines} />}
      <Clouds uniforms={uniforms} defines={defines} />
      <Weather uniforms={uniforms} settings={settings} />
      {s.locations.map((l) => (
        <Landmark key={l.id} loc={l} uniforms={uniforms} defines={defines} settings={settings} />
      ))}
      <Signal settings={settings} />
      <ScanTargets planet={planet} />
    </group>
  )
}

interface MatProps {
  uniforms: SurfaceUniforms
  defines: Record<string, string | number>
}

// ---------------------------------------------------------------------------

function Sky({ uniforms, defines }: MatProps) {
  const mesh = useRef<Mesh>(null)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        uniforms,
        defines,
        side: BackSide,
        depthWrite: false,
      }),
    [uniforms, defines],
  )
  useFrame(({ camera }) => mesh.current?.position.copy(camera.position))
  return (
    <mesh ref={mesh} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[4000, 48, 24]} />
    </mesh>
  )
}

function useFollowXZ() {
  const mesh = useRef<Mesh>(null)
  useFrame(({ camera }) => {
    if (mesh.current) mesh.current.position.set(camera.position.x, 0, camera.position.z)
  })
  return mesh
}

const terrainGrid = HIGH ? gridGeometry(200, 320, 0.25, 1.029) : gridGeometry(140, 200, 0.4, 1.04)

function Terrain({ uniforms, defines }: MatProps) {
  const mesh = useFollowXZ()
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: terrainVertex,
        fragmentShader: terrainFragment,
        uniforms,
        defines,
        side: DoubleSide,
      }),
    [uniforms, defines],
  )
  return <mesh ref={mesh} geometry={terrainGrid} material={material} frustumCulled={false} />
}

function Water({ uniforms, defines }: MatProps) {
  const mesh = useFollowXZ()
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
        uniforms,
        defines,
        side: DoubleSide,
      }),
    [uniforms, defines],
  )
  return <mesh ref={mesh} geometry={terrainGrid} material={material} frustumCulled={false} renderOrder={1} />
}

const cloudGrid = gridGeometry(90, HIGH ? 160 : 112, 2, 1.045)

function Clouds({ uniforms, defines }: MatProps) {
  const mesh = useRef<Mesh>(null)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: cloudVertex,
        fragmentShader: cloudFragment,
        uniforms,
        defines: { ...defines, OCT: HIGH ? 5 : 4 },
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    [uniforms, defines],
  )
  useFrame(({ camera }) => {
    if (!mesh.current) return
    mesh.current.position.set(camera.position.x, uniforms.uCloudHeight.value, camera.position.z)
    mesh.current.visible = uniforms.uCloudCover.value > 0.01
  })
  return <mesh ref={mesh} geometry={cloudGrid} material={material} frustumCulled={false} renderOrder={5} />
}

// ---------------------------------------------------------------------------
// Weather: motes, rain and lightning
// ---------------------------------------------------------------------------

const MOTE_MOTION: Record<SurfaceSettings['motes'], { vel: [number, number, number]; size: number }> = {
  dust: { vel: [5, 0.4, 1.6], size: 2.2 },
  ash: { vel: [0.4, 1.1, 0.3], size: 2.0 },
  snow: { vel: [0.8, -1.4, 0.4], size: 2.6 },
  spray: { vel: [4, -0.6, 2], size: 2.4 },
  haze: { vel: [1.2, 0.1, 0.5], size: 3.4 },
}

// ---------------------------------------------------------------------------
// Overhaul: each world's occasional events. The scheduler (in Weather) picks one
// every 12–30 s (bold pass; was 25–60); the shaders draw it from uEventDir and uEvent.

type EventKind = 'meteor' | 'sunbreak' | 'eruption' | 'devil' | 'deep' | 'aurora' | 'surge' | 'squall' | 'gust' | 'tremor'

/** Shader ids for uEventKind (see the sky and terrain shaders). */
const EVENT_ID: Record<EventKind, number> = {
  meteor: 1,
  sunbreak: 2,
  eruption: 3,
  devil: 4,
  deep: 5,
  aurora: 6,
  surge: 7,
  squall: 8,
  gust: 9,
  tremor: 10,
}

/**
 * Which event a world has next. Cinematic pass: every world now has one, most
 * have two, so the occasional moment does not repeat itself.
 */
const EVENTS: Partial<Record<SurfaceSettings['kind'], (night: boolean, aurora: number) => EventKind>> = {
  // Aurelis: by night a meteor or an auroral substorm; by day a break in the clouds.
  terrestrial: (night, aurora) => (night ? (aurora > 0.05 && Math.random() < 0.5 ? 'aurora' : 'meteor') : 'sunbreak'),
  // Nyx: an eruption, or a tremor that runs a wave of light through the vein field.
  dark: () => (Math.random() < 0.55 ? 'eruption' : 'tremor'),
  // Solara: a dust devil, or a gust that lifts the sand and drives it across the dunes.
  desert: () => (Math.random() < 0.5 ? 'devil' : 'gust'),
  // Vesper: a surge of light along the energy ribbons (lightning keeps its own schedule).
  deck: () => 'surge',
  // Thalassa: a squall line sweeps through (lightning keeps its own schedule).
  ocean: () => 'squall',
  giant: () => 'deep',
}

const DURATION: Record<EventKind, number> = {
  meteor: 1.4,
  sunbreak: 14,
  eruption: 16,
  devil: 22,
  deep: 3.2,
  aurora: 26,
  surge: 18,
  squall: 26,
  gust: 15,
  tremor: 9,
}

/** Smoothstep 0 → 1 (eases the edges of the longer events). */
const ease01 = (x: number) => {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

/** Strength over the event's life (t: 0 → 1). */
const ENVELOPE: Record<EventKind, (t: number) => number> = {
  meteor: (t) => Math.sin(Math.min(t, 1) * Math.PI),
  sunbreak: (t) => Math.sin(Math.min(t, 1) * Math.PI) ** 2,
  // An eruption flares quickly, then glows and fades for a long time.
  eruption: (t) => Math.min(1, t * 8) * Math.pow(1 - Math.min(t, 1), 1.5),
  devil: (t) => Math.min(1, t * 5) * Math.min(1, (1 - Math.min(t, 1)) * 5),
  // Deep storms flicker: a few pulses inside one envelope.
  deep: (t) => Math.sin(Math.min(t, 1) * Math.PI) * (0.55 + 0.45 * Math.sin(t * 37) * Math.sin(t * 11 + 1)),
  // A substorm: brightens over a few seconds, breathes in pulses, fades slowly.
  aurora: (t) => ease01(t * 4) * ease01((1 - t) * 1.8) * (0.78 + 0.22 * Math.sin(t * 29) * Math.sin(t * 7 + 0.6)),
  surge: (t) => Math.sin(Math.min(t, 1) * Math.PI) ** 2,
  squall: (t) => ease01(t * 3.5) * ease01((1 - t) * 2.5),
  gust: (t) => ease01(t * 3) * ease01((1 - t) * 2.2),
  tremor: (t) => Math.sin(Math.min(t, 1) * Math.PI),
}

/** The event playing now, for the environment pass (one frame behind is fine). */
const weatherEvent = { kind: 'none' as EventKind | 'none', strength: 0 }
/** Dev only: `__forceEvent('squall')` plays an event now (for review and capture). */
let forcedEvent: EventKind | null = null
if (import.meta.env.DEV) Object.assign(window, { __forceEvent: (k: EventKind) => (forcedEvent = k) })
const moteLight = new Color()

/** The camera's heading as an angle in the shaders' (cos a, sin a) convention. */
function viewAngle() {
  const yaw = surfaceCam.current.yaw
  return Math.atan2(-Math.cos(yaw), Math.sin(yaw))
}

/** One particle layer (see motesVertex): `far` fills the middle distance, `near` is the bokeh foreground. */
function makeMotes(settings: SurfaceSettings, uniforms: SurfaceUniforms, layer: 'far' | 'near') {
  const far = layer === 'far'
  const count = far ? (HIGH ? 1400 : 560) : HIGH ? 90 : 40
  const rand = mulberry32(settings.seed + (far ? 0 : 101))
  const seeds = new Float32Array(count * 3)
  const r = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    seeds.set([rand(), rand(), rand()], i * 3)
    r[i] = rand()
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
  g.setAttribute('aSeed', new BufferAttribute(seeds, 3))
  g.setAttribute('aRand', new BufferAttribute(r, 1))
  const motion = MOTE_MOTION[settings.motes]
  const material = new ShaderMaterial({
    vertexShader: motesVertex,
    fragmentShader: motesFragment,
    uniforms: {
      uTime: uniforms.uTime,
      uWind: uniforms.uWind,
      uVel: { value: new Vector3(...motion.vel) },
      uSize: { value: far ? motion.size : motion.size * 9 },
      uPR: { value: 1 },
      uAmount: { value: 0 },
      uColor: { value: new Color(settings.moteColor) },
      uBox: { value: far ? new Vector3(80, 40, 80) : new Vector3(16, 9, 16) },
      uFade: { value: far ? new Vector4(0.5, 3, 25, 40) : new Vector4(0.6, 1.6, 5.5, 8) },
      uMaxPx: { value: far ? 12 : 64 },
      uBokeh: { value: far ? 0 : 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  const points = new Points(g, material)
  points.frustumCulled = false
  return { points, material, base: new Color(settings.moteColor) }
}

function Weather({ uniforms, settings }: { uniforms: SurfaceUniforms; settings: SurfaceSettings }) {
  const dpr = useThree((st) => st.viewport.dpr)
  const motionPaused = useExperience((st) => st.motionPaused)
  const reducedMotion = useExperience((st) => st.reducedMotion)
  const nextFlash = useRef(4)
  const flash = useRef(0)
  // Bold pass: the first event comes soon after landing, then every 12–30 s.
  const event = useRef({ kind: 'meteor' as EventKind, age: -1, wait: 6, dur: 1, az: 0, el: 0 })

  // Overhaul: two layers from one shader — fine motes through the middle distance,
  // and a few large, soft ones near the lens that give the frame a foreground.
  const motes = useMemo(() => makeMotes(settings, uniforms, 'far'), [settings, uniforms])
  const near = useMemo(() => makeMotes(settings, uniforms, 'near'), [settings, uniforms])

  const rain = useMemo(() => {
    const count = HIGH ? 2600 : 1000
    const rand = mulberry32(settings.seed + 7)
    const seeds = new Float32Array(count * 2 * 3)
    const ends = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      const sx = rand()
      const sy = rand()
      const sz = rand()
      for (let k = 0; k < 2; k++) {
        seeds.set([sx, sy, sz], (i * 2 + k) * 3)
        ends[i * 2 + k] = k
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 6), 3))
    g.setAttribute('aSeed', new BufferAttribute(seeds, 3))
    g.setAttribute('aEnd', new BufferAttribute(ends, 1))
    const material = new ShaderMaterial({
      vertexShader: rainVertex,
      fragmentShader: rainFragment,
      uniforms: { uTime: uniforms.uTime, uAmount: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const lines = new LineSegments(g, material)
    lines.frustumCulled = false
    return { lines, material }
  }, [settings, uniforms])

  const light = useMemo(() => new Color(), [])

  useFrame((_, delta) => {
    const env = surface.env
    if (!env) return
    const dt = Math.min(delta, 1 / 20)
    const mm = motes.material.uniforms
    mm.uPR.value = dpr
    // Cinematic pass: events thicken the air — sand in a gust, ash in a tremor, spray in a squall.
    const evNow = weatherEvent
    const lift =
      evNow.kind === 'gust' ? 1.3 * evNow.strength : evNow.kind === 'tremor' ? 0.6 * evNow.strength : evNow.kind === 'squall' ? 0.5 * evNow.strength : 0
    mm.uAmount.value = env.motes * (reducedMotion ? 0.4 : 1) * (1 + lift)
    // Motes take the light of the scene they drift through.
    light
      .copy(env.sunColor)
      .multiplyScalar(Math.max(env.sunDir.y, 0) * 0.7 + 0.25)
      .add(moteLight.copy(env.zenith).multiplyScalar(0.6))
    mm.uColor.value.copy(motes.base).multiply(light)
    const nm = near.material.uniforms
    nm.uPR.value = dpr
    // The foreground layer is faint: it should be felt more than seen.
    nm.uAmount.value = env.motes * (reducedMotion ? 0.2 : 0.32) * (1 + lift)
    nm.uColor.value.copy(mm.uColor.value)
    const rainAmt = env.rain + (evNow.kind === 'squall' ? 0.6 * evNow.strength : 0)
    rain.material.uniforms.uAmount.value = rainAmt * 0.35
    rain.lines.visible = rainAmt > 0.01

    // Lightning: never in reduced motion (flashing), never while paused. Vesper
    // always has storms somewhere (Phase 7): a faint, distant baseline — rare,
    // dim flashes low on the horizon, thunder that arrives late and soft.
    const level = Math.max(env.lightning, settings.kind === 'deck' ? 0.12 : 0)
    const distant = env.lightning < 0.05
    const active = level > 0.01 && !motionPaused && !reducedMotion && director.space === 'surface'
    if (active) {
      nextFlash.current -= dt
      if (nextFlash.current <= 0) {
        flash.current = distant ? 0.45 + Math.random() * 0.2 : 1
        // Overhaul: most flashes happen where the visitor is looking (they used to
        // fall anywhere around, mostly behind); some still light the sky behind.
        const a = viewAngle() + (Math.random() < 0.75 ? (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2)
        const up = distant ? 0.02 + Math.random() * 0.08 : 0.08 + Math.random() * 0.22
        uniforms.uFlashDir.value.set(Math.cos(a), up, Math.sin(a)).normalize()
        nextFlash.current = (2.5 + Math.random() * 6) / level
        if (distant) sound.thunder(2.8 + Math.random() * 3, 0.22)
        else sound.thunder(0.8 + Math.random() * 2.2, 0.4 + env.lightning * 0.6)
      }
    }
    // Overhaul: the world's occasional event (see EVENTS). One at a time, never in
    // reduced motion or while paused, always roughly where the visitor is looking.
    const ev = event.current
    const eu = uniforms.uEvent.value
    const spec = EVENTS[settings.kind]
    if (spec && !motionPaused && !reducedMotion && director.space === 'surface' && surfaceCam.mode === 'free') {
      if (ev.age < 0) {
        ev.wait -= dt
        if (ev.wait <= 0 || forcedEvent) {
          const night = env.stars > 0.25 || env.sunDir.y < 0
          ev.kind = forcedEvent ?? spec(night, env.aurora)
          forcedEvent = null
          ev.age = 0
          // Cinematic pass: each occurrence runs a little longer or shorter.
          ev.dur = DURATION[ev.kind] * (0.85 + Math.random() * 0.3)
          ev.az = viewAngle() + (Math.random() - 0.5) * 1.3
          ev.el = ev.kind === 'meteor' ? 0.35 + Math.random() * 0.3 : ev.kind === 'deep' ? -0.25 - Math.random() * 0.2 : 0.02
          uniforms.uEventKind.value = EVENT_ID[ev.kind]
          if (ev.kind === 'eruption') sound.thunder(3.5 + Math.random() * 2, 0.35)
          if (ev.kind === 'deep') sound.thunder(2.5, 0.2)
          if (ev.kind === 'tremor') sound.thunder(0.6, 0.28)
          if (ev.kind === 'squall' || ev.kind === 'gust') sound.wind(ev.dur * 0.8, 'down')
        }
      }
    }
    if (ev.age >= 0) {
      ev.age += dt / ev.dur
      // A dust devil wanders along the horizon; a squall line and surges move across the view.
      if (ev.kind === 'devil') ev.az += dt * 0.02
      if (ev.kind === 'squall' || ev.kind === 'surge') ev.az += dt * 0.012
      uniforms.uEventDir.value.set(Math.cos(ev.az) * Math.cos(ev.el), Math.sin(ev.el), Math.sin(ev.az) * Math.cos(ev.el))
      const t = ev.age
      eu.set(ENVELOPE[ev.kind](t), t)
      weatherEvent.kind = ev.kind
      weatherEvent.strength = eu.x
      if (t >= 1) {
        ev.age = -1
        ev.wait = 12 + Math.random() * 18
        eu.set(0, 0)
        weatherEvent.kind = 'none'
        weatherEvent.strength = 0
      }
    } else {
      // No event (paused mid-way, or none due): any strength left eases away.
      weatherEvent.strength = Math.max(0, weatherEvent.strength - dt * 0.5)
      if (weatherEvent.strength === 0) weatherEvent.kind = 'none'
    }

    // Overhaul: a discovery's light wave, timed by the scanner's completion pulse.
    const revealId = scanFx.target
    const at = revealId ? surface.targets[revealId] : null
    const rv = uniforms.uReveal.value
    // Only for things on the ground: a find in the sky has no ground to light.
    const grounded = at && at.y - surface.floor(at.x, at.z) < 40
    if (at && grounded && scanFx.pulse > 0.001 && scanFx.pulse < 0.999) rv.set(at.x, at.y, at.z, scanFx.pulse)
    else rv.w = 0

    // A double flicker that decays quickly.
    flash.current = Math.max(0, flash.current - dt * 3.2)
    const f = flash.current
    uniforms.uFlash.value = f > 0 ? f * f * (0.7 + 0.3 * Math.sin(f * 40)) : 0
  })

  useDispose(motes.points.geometry, near.points.geometry, rain.lines.geometry)

  return (
    <>
      <primitive object={motes.points} />
      <primitive object={near.points} />
      <primitive object={rain.lines} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------------

function jitter(geometry: BG, amount: number, rand: () => number) {
  const pos = geometry.attributes.position as BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (rand() - 0.5) * amount,
      pos.getY(i) + (rand() - 0.5) * amount * 0.5,
      pos.getZ(i) + (rand() - 0.5) * amount,
    )
  }
  geometry.computeVertexNormals()
  return geometry
}

// Realism pass: each landmark piece also as a capsule (a -> b, radius), in the
// landmark's own space, for the shadows the shaders work out (capsuleShadow).
interface Capsule {
  a: Vector3
  b: Vector3
  r: number
}

/**
 * A sea stack: a tapering column of worn rock, lumpy around and stepped in ledges
 * up its height, welded so the light rolls over it (not eight flat faces). Its
 * shape comes from its own seed; it still draws the random numbers the old
 * jittered prism did (97 vertices x 3), so every later stack keeps its place.
 */
const OLD_STACK_DRAWS = 291
function rockColumn(w: number, h: number, rand: () => number) {
  const seed = rand() * 100
  for (let k = 1; k < OLD_STACK_DRAWS; k++) rand()
  const g = new CylinderGeometry(w * 0.7, w, h, 20, 14)
  g.deleteAttribute('uv')
  g.deleteAttribute('normal')
  const pos = g.attributes.position as BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const ang = Math.atan2(z, x)
    const t = y / h + 0.5
    const lumps = 0.14 * Math.sin(ang * 3 + seed + t * 2.1) + 0.08 * Math.sin(ang * 7 - seed * 1.3 + t * 5.7)
    const ledges = 0.05 * Math.sin(y * 0.45 + seed)
    const k = 1 + lumps + ledges
    pos.setXYZ(i, x * k, y, z * k)
  }
  const welded = mergeVertices(g)
  welded.computeVertexNormals()
  return welded
}

function buildSpires(planet: WorldId, scale: number, rand: () => number) {
  const parts: BG[] = []
  const caps: Capsule[] = []
  const salt = planet === 'solara'
  const stacks = planet === 'aurelis'
  const count = salt ? 28 : stacks ? 7 : 12
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(rand()) * (salt ? 26 : stacks ? 60 : 30)
    const h = salt ? 2 + rand() * 6 : stacks ? 22 + rand() * 28 : 18 + rand() * 46
    const w = salt ? 0.4 + rand() * 0.6 : stacks ? 4 + rand() * 4 : 1.4 + rand() * 2.2
    const body = stacks ? rockColumn(w, h, rand) : new CylinderGeometry(w, w, h * 0.85, 6, 1)
    body.translate(0, h * 0.425, 0)
    let geo = body
    if (!stacks) {
      const tip = new ConeGeometry(w, h * 0.15, 6, 1)
      tip.translate(0, h * 0.85 + h * 0.075, 0)
      geo = mergeGeometries([body.toNonIndexed(), tip.toNonIndexed()])
    }
    // Crystals lean toward a shared point in the sky; stacks stand straight.
    const top = new Vector3(0, h, 0)
    if (!stacks) {
      const lean = 0.18 + (rand() - 0.5) * 0.12
      const turn = rand() * 0.3
      geo.rotateZ(lean)
      geo.rotateY(turn)
      top.applyAxisAngle(new Vector3(0, 0, 1), lean).applyAxisAngle(new Vector3(0, 1, 0), turn)
    }
    geo.translate(Math.cos(a) * r, 0, Math.sin(a) * r)
    parts.push(geo)
    const foot = new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)
    caps.push({ a: foot.clone().multiplyScalar(scale), b: top.add(foot).multiplyScalar(scale), r: w * (stacks ? 0.85 : 0.9) * scale })
  }
  const merged = mergeGeometries(parts)
  merged.scale(scale, scale, scale)
  merged.computeVertexNormals()
  return { geometry: merged, caps }
}

function buildMonolith(planet: WorldId, scale: number) {
  let g: BG
  let cap: Capsule
  if (planet === 'solara') {
    g = new CylinderGeometry(1.4, 2.6, 26, 4, 1)
    g.rotateY(Math.PI / 4)
    g.translate(0, 13, 0)
    g.rotateZ(0.18)
    cap = { a: new Vector3(), b: new Vector3(0, 26, 0).applyAxisAngle(new Vector3(0, 0, 1), 0.18), r: 2 }
  } else if (planet === 'aurelis') {
    g = new CylinderGeometry(2.2, 3.4, 14, 5, 3)
    g.translate(0, 7, 0)
    cap = { a: new Vector3(), b: new Vector3(0, 14, 0), r: 2.8 }
  } else {
    g = new CylinderGeometry(1, 1, 1, 4, 1)
    g.rotateY(Math.PI / 4)
    g.scale(7, 34, 1.8)
    g.translate(0, 17, 0)
    // A slab: one capsule between its width and its depth.
    cap = { a: new Vector3(), b: new Vector3(0, 34, 0), r: 2.6 }
  }
  g = g.toNonIndexed()
  g.scale(scale, scale, scale)
  g.computeVertexNormals()
  cap.b.multiplyScalar(scale)
  cap.r *= scale
  return { geometry: g, caps: [cap] }
}

function buildArch(scale: number, rand: () => number) {
  const g = new TorusGeometry(30, 6.5, 12, 56, Math.PI)
  jitter(g, 1.6, rand)
  g.scale(scale, scale, scale)
  // Six capsules along the half ring.
  const at = (i: number) =>
    new Vector3(Math.cos((i / 6) * Math.PI) * 30, Math.sin((i / 6) * Math.PI) * 30, 0).multiplyScalar(scale)
  const caps = Array.from({ length: 6 }, (_, i) => ({ a: at(i), b: at(i + 1), r: 6.5 * scale }))
  return { geometry: g, caps }
}

// The pieces of every landmark on this world, written into the shared uniforms:
// the largest first, when there are more than the shaders take (MAX_CAPS: each
// costs every ground pixel a little). Pieces thinner than 0.7 m (Solara's salt
// spires) are left out: their shadows would hardly show.
const MAX_CAPS = 16
const landmarkCaps = new Map<string, Capsule[]>()
function writeCaps(u: SurfaceUniforms) {
  const size = (c: Capsule) => c.r * (c.a.distanceTo(c.b) + c.r)
  const all = [...landmarkCaps.values()]
    .flat()
    .filter((c) => c.r >= 0.7)
    .sort((x, y) => size(y) - size(x))
  const n = Math.min(all.length, MAX_CAPS)
  for (let i = 0; i < n; i++) {
    u.uCapA.value[i].set(all[i].a.x, all[i].a.y, all[i].a.z, all[i].r)
    u.uCapB.value[i].set(all[i].b.x, all[i].b.y, all[i].b.z, 0)
  }
  u.uCapN.value = n
}

function buildVent(scale: number) {
  const g = new ConeGeometry(7, 3, 12, 1, true)
  g.translate(0, 1.5, 0)
  g.scale(scale, scale, scale)
  return g
}

const LANDMARK_LOOK: Record<WorldId, { glow: number; seam: number }> = {
  aurelis: { glow: 0.35, seam: 1 },
  nyx: { glow: 1, seam: 1 },
  solara: { glow: 0.3, seam: 0.6 },
  vesper: { glow: 0.5, seam: 0 },
  thalassa: { glow: 0.2, seam: 0 },
  orion: { glow: 0.4, seam: 0 },
  liris: { glow: 0.4, seam: 0.5 },
}

function Landmark({
  loc,
  uniforms,
  defines,
  settings,
}: MatProps & { loc: Place; settings: SurfaceSettings }) {
  const base = surface.landmarkBase[loc.id]
  const kind = loc.landmark.kind

  const { geometry, caps, material, height } = useMemo(() => {
    const rand = mulberry32(settings.seed * 97 + loc.id.length)
    let geometry: BG | null = null
    let caps: Capsule[] = []
    let height = 30
    if (kind === 'spires') {
      ;({ geometry, caps } = buildSpires(loc.planet, loc.landmark.scale, rand))
      height = 60 * loc.landmark.scale
    } else if (kind === 'monolith') {
      ;({ geometry, caps } = buildMonolith(loc.planet, loc.landmark.scale))
      height = 34 * loc.landmark.scale
    } else if (kind === 'arch') {
      ;({ geometry, caps } = buildArch(loc.landmark.scale, rand))
    } else if (kind === 'geyser') {
      geometry = buildVent(loc.landmark.scale)
      height = 3
    }
    const look = LANDMARK_LOOK[loc.planet]
    // Sea stacks and arches are plain rock: they don't glow.
    const plain = (kind === 'spires' && loc.planet === 'aurelis') || kind === 'arch' || kind === 'geyser'
    const material = new ShaderMaterial({
      vertexShader: landmarkVertex,
      fragmentShader: landmarkFragment,
      uniforms: {
        ...uniforms,
        uRock: { value: new Color(kind === 'spires' && loc.planet === 'solara' ? '#EDE6DA' : settings.rock) },
        uGlowColor: { value: new Color(settings.glow).multiplyScalar(1.4) },
        uGlowAmt: { value: plain ? 0 : look.glow },
        uSeam: { value: kind === 'monolith' ? look.seam : 0 },
        uHeight: { value: height },
      },
      defines,
    })
    return { geometry, caps, material, height }
  }, [kind, loc, settings, uniforms, defines])
  useDispose(geometry)

  // This landmark's pieces join the world's shadow casters while it is mounted.
  useEffect(() => {
    if (!base || !caps.length) return
    landmarkCaps.set(
      loc.id,
      caps.map((c) => ({ a: c.a.clone().add(base), b: c.b.clone().add(base), r: c.r })),
    )
    writeCaps(uniforms)
    return () => {
      landmarkCaps.delete(loc.id)
      writeCaps(uniforms)
    }
  }, [base, caps, loc.id, uniforms])

  if (!base) return null
  return (
    <group position={base}>
      {geometry && <mesh geometry={geometry} material={material} />}
      {kind === 'geyser' && <Plume planet={loc.planet} scale={loc.landmark.scale} height={height} />}
    </group>
  )
}

const PLUME: Record<WorldId, { color: string; opacity: number; height: number }> = {
  aurelis: { color: '#DDEBF5', opacity: 0.32, height: 40 },
  nyx: { color: '#9C7CFF', opacity: 0.6, height: 70 },
  solara: { color: '#F2C88C', opacity: 0.3, height: 40 },
  vesper: { color: '#E2D0FF', opacity: 0.3, height: 40 },
  thalassa: { color: '#C8D2DA', opacity: 0.34, height: 60 },
  orion: { color: '#FFE8CC', opacity: 0.3, height: 40 },
  liris: { color: '#F2E6FF', opacity: 0.3, height: 40 },
}

function Plume({ planet, scale, height }: { planet: WorldId; scale: number; height: number }) {
  const dpr = useThree((st) => st.viewport.dpr)
  const { points, material } = useMemo(() => {
    const count = HIGH ? 220 : 110
    const rand = mulberry32(31 + count)
    const r = new Float32Array(count)
    const ph = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      r[i] = rand()
      ph[i] = rand()
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aRand', new BufferAttribute(r, 1))
    g.setAttribute('aPhase', new BufferAttribute(ph, 1))
    const p = PLUME[planet]
    const material = new ShaderMaterial({
      vertexShader: plumeVertex,
      fragmentShader: plumeFragment,
      uniforms: {
        uTime: { value: 0 },
        uHeight: { value: p.height * scale },
        uPR: { value: 1 },
        uScale: { value: scale },
        uColor: { value: new Color(p.color) },
        uOpacity: { value: p.opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const points = new Points(g, material)
    points.frustumCulled = false
    points.position.y = height
    return { points, material }
  }, [planet, scale, height])
  useFrame(() => {
    material.uniforms.uTime.value = director.time
    material.uniforms.uPR.value = dpr
  })
  useDispose(points.geometry)
  return <primitive object={points} />
}

// ---------------------------------------------------------------------------
// The discovery signal
// ---------------------------------------------------------------------------

function Signal({ settings }: { settings: SurfaceSettings }) {
  const location = useExperience((st) => st.location)
  const discovered = useExploration((st) => (location ? !!st.discovered[location] : false))
  const setSignalHovered = useExperience((st) => st.setSignalHovered)
  const group = useRef<Group>(null)
  const core = useRef<Mesh>(null)
  const beam = useRef<Mesh>(null)
  const rings = useRef<Group>(null)
  // Cinematic pass: the pings advance by integrated phase and the found state eases,
  // so the moment of discovery slows the signal instead of making it jump.
  const ping = useRef(0)
  const foundK = useRef(discovered ? 1 : 0)

  const mats = useMemo(() => {
    const color = new Color(settings.glow).lerp(new Color('#FFFFFF'), 0.25)
    const coreM = new ShaderMaterial({
      vertexShader: uvVertex,
      fragmentShader: beaconCoreFragment,
      uniforms: { uColor: { value: color.clone().multiplyScalar(2.2) }, uPulse: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const ringM = [0, 1].map(
      () =>
        new ShaderMaterial({
          vertexShader: uvVertex,
          fragmentShader: beaconRingFragment,
          uniforms: { uColor: { value: color.clone().multiplyScalar(1.6) }, uOpacity: { value: 0 }, uRadius: { value: 0.5 } },
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          side: DoubleSide,
        }),
    )
    const beamM = new ShaderMaterial({
      vertexShader: uvVertex,
      fragmentShader: beamFragment,
      uniforms: { uColor: { value: color.clone() }, uOpacity: { value: 0.35 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    })
    return { coreM, ringM, beamM }
  }, [settings])

  const hitGeometry = useMemo(() => new SphereGeometry(8, 12, 12), [])
  useDispose(hitGeometry)

  useFrame(({ camera }, delta) => {
    if (!location || !group.current) return
    const pos = surface.signals[location]
    if (!pos) return
    group.current.position.copy(pos)
    const t = director.time
    const b = signalFx.bloom
    const { reducedMotion, motionPaused } = useExperience.getState()
    const dt = Math.min(delta, 1 / 20)
    const fk = (foundK.current = MathUtils.damp(foundK.current, discovered ? 1 : 0, 1.2, dt))

    if (core.current) {
      core.current.quaternion.copy(camera.quaternion)
      const pulse = MathUtils.lerp(0.8 + 0.25 * Math.sin(t * 2.2), 0.7, fk)
      mats.coreM.uniforms.uPulse.value = pulse + b * 2.5
      core.current.scale.setScalar(1 + b * 1.5)
    }
    // Two pings expanding outward, half a cycle apart. Slow and faint once found.
    if (!motionPaused) ping.current = (ping.current + dt * MathUtils.lerp(0.35, 0.12, fk)) % 1
    mats.ringM.forEach((m, i) => {
      const phase = reducedMotion ? 0.55 : (ping.current + i * 0.5) % 1
      m.uniforms.uRadius.value = 0.15 + phase * 0.8
      m.uniforms.uOpacity.value = (1 - phase) * MathUtils.lerp(0.9, 0.35, fk) + b * 1.5
    })
    if (rings.current) rings.current.scale.setScalar(1 + b * 3)
    if (beam.current) {
      // The beam only marks signals that have not been found yet (it fades as one is).
      const beamA = MathUtils.lerp(0.32, 0, fk) + b * 0.6
      beam.current.visible = beamA > 0.003
      beam.current.rotation.y = Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z)
      mats.beamM.uniforms.uOpacity.value = beamA
    }
  })

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setSignalHovered(true)
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    setSignalHovered(false)
    document.body.style.cursor = ''
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return
    const loc = useExperience.getState().location
    if (loc) startScan(loc)
  }

  if (!location) return null
  return (
    <group ref={group}>
      <mesh ref={core} material={mats.coreM} renderOrder={20}>
        <planeGeometry args={[7, 7]} />
      </mesh>
      <group ref={rings} rotation={[-Math.PI / 2, 0, 0]}>
        {mats.ringM.map((m, i) => (
          <mesh key={i} material={m} renderOrder={20}>
            <planeGeometry args={[18, 18]} />
          </mesh>
        ))}
      </group>
      <mesh ref={beam} material={mats.beamM} position={[0, 70, 0]} renderOrder={19}>
        <planeGeometry args={[2.4, 140]} />
      </mesh>
      <mesh geometry={hitGeometry} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}
