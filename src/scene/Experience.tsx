import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode, type BloomEffect } from 'postprocessing'
import { lazy, Suspense, useEffect, useRef, useState, type RefObject } from 'react'
import { director, pointer } from '../state/director'
import { ATTACHED_MAX, GROUND_RATE, SPEEDS, stepSimulation, useSimulation } from '../state/simulation'
import { quality, useExperience } from '../state/useExperience'
import { watchContext } from '../system/health'
import { Atmosphere } from './Atmosphere'
import { CameraRig } from './CameraRig'
import { Nebula } from './Nebula'
import { Planet } from './Planet'
import { GalaxyRig, galaxyCam } from './galaxy/GalaxyRig'
import { HeatHaze } from './HeatHaze'
import { GalaxySystem } from './galaxy/GalaxySystem'
import { SpaceDust } from './galaxy/SpaceDust'
import { ThumbnailBaker } from './galaxy/Thumbnails'
import { Ithra } from './Ithra'
import { SurfaceRig } from './surface/SurfaceRig'
import { AmbienceDriver } from './surface/AmbienceDriver'
import { loadSurfaceScene } from './surface/lazy'
import { Precompile, Projection, Space, WarpStreaks } from './Warp'
import { DistantGalaxies, Dust, ShootingStars, Starfield } from './Starfield'

const SurfaceScene = lazy(loadSurfaceScene)

/** The world being explored, mounted from descent start to ascent end; its code loads on demand. */
function SurfaceSpace() {
  const exploring = useExperience((s) => s.exploring)
  if (!exploring) return null
  return (
    <Suspense fallback={null}>
      <SurfaceScene key={exploring} planet={exploring} />
    </Suspense>
  )
}

/** Fetches the surface code in the background once the first scene is up, so descents never wait. */
function PrefetchSurface() {
  const ready = useExperience((s) => s.sceneReady)
  useEffect(() => {
    if (!ready) return
    const idle = (window as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    // A failed prefetch is not an error yet: the descent retries and reports it.
    const start = () => void loadSurfaceScene().catch(() => {})
    if (idle) idle(start)
    else setTimeout(start, 1500)
  }, [ready])
  return null
}

/** Advances the scene clock and reports readiness after the first frames. */
function Clock() {
  const motionPaused = useExperience((s) => s.motionPaused)
  const setSceneReady = useExperience((s) => s.setSceneReady)
  const frames = useRef(0)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    if (!motionPaused) director.time += dt
    // Phase 9: the simulation clock. Full speed only while the camera is free
    // (the galaxy overview, the Observatory); attached to a world, it eases down.
    const { playing, speed } = useSimulation.getState()
    const { reducedMotion, phase } = useExperience.getState()
    const free = (phase === 'galaxy' && galaxyCam.mode === 'free') || phase === 'observatory'
    const ground = phase === 'surface' || phase === 'descending' || phase === 'ascending'
    stepSimulation(dt, playing && !motionPaused ? SPEEDS[speed].perSec : 0, free ? Infinity : ground ? GROUND_RATE : ATTACHED_MAX, reducedMotion)
    // Wait a couple of frames so shader compilation never stalls the intro.
    if (frames.current < 3 && ++frames.current === 3) setSceneReady()
  })
  return null
}

const MAX_DPR = quality.tier === 'high' ? 1.75 : 1.5
const START_DPR = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, MAX_DPR)
const MIN_DPR = 0.75


/**
 * Daylit skies are bright: only the sun and true emitters should bloom there.
 * The threshold follows the atmosphere's density, so entering the air raises it
 * gradually (the haze never blooms into a flash) and the space switch is seamless.
 */
function BloomControl({ bloom }: { bloom: RefObject<BloomEffect | null> }) {
  const current = useRef(0.42)
  useFrame((_, delta) => {
    const effect = bloom.current
    if (!effect) return
    const base = director.space === 'surface' ? 0.82 : 0.42
    const target = base + (0.82 - base) * Math.min(1, director.atmo * 1.4)
    current.current += (target - current.current) * (1 - Math.exp(-6 * Math.min(delta, 0.05)))
    effect.luminanceMaterial.threshold = current.current
  })
  return null
}

export function Experience() {
  // Phase 10: adaptive resolution. Start at the display's pixel ratio (capped); under
  // sustained load step down to 0.75 (below 1 on ordinary 1080p laptops with
  // integrated graphics, where 1 is often too much); recover when there is headroom.
  const [dpr, setDpr] = useState(START_DPR)
  const bloom = useRef<BloomEffect>(null)

  useEffect(() => {
    // Mouse: the cursor position steers the drift.
    // Touch: one finger drags the view; it eases back to centre on release.
    let dragging = false
    let last = { x: 0, y: 0 }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      dragging = true
      last = { x: e.clientX, y: e.clientY }
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1
        return
      }
      if (!dragging) return
      const scale = 2.6 / Math.min(window.innerWidth, window.innerHeight)
      pointer.x = Math.max(-1, Math.min(1, pointer.x - (e.clientX - last.x) * scale))
      pointer.y = Math.max(-1, Math.min(1, pointer.y - (e.clientY - last.y) * scale))
      last = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      dragging = false
      pointer.x = 0
      pointer.y = 0
    }
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', onUp, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  return (
    <Canvas
      className="!fixed inset-0"
      dpr={dpr}
      camera={{ fov: 34, near: 0.05, far: 1200, position: [0, 0, 24] }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      aria-hidden
      onCreated={(state) => {
        watchContext(state.gl.domElement)
        // Dev-only handle for profiling frames from the console.
        if (import.meta.env.DEV) (window as unknown as { __aether: unknown }).__aether = state
      }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(MIN_DPR, +(d - 0.25).toFixed(2)))}
        onIncline={() => setDpr((d) => Math.min(START_DPR, +(d + 0.25).toFixed(2)))}
        flipflops={3}
      />
      <Clock />
      <PrefetchSurface />
      <AmbienceDriver />
      <Nebula />
      <Space space={['vael', 'galaxy']}>
        <Starfield />
        <DistantGalaxies />
        <ShootingStars />
      </Space>
      <Space space="vael">
        <Dust />
        <Planet />
        <Ithra />
      </Space>
      <Space space="galaxy">
        <GalaxySystem />
        <SpaceDust />
      </Space>
      <Space space="surface">
        <SurfaceSpace />
      </Space>
      <WarpStreaks />
      <Atmosphere />
      <CameraRig />
      <GalaxyRig />
      <SurfaceRig />
      <Projection />
      <Precompile />
      <ThumbnailBaker />
      <BloomControl bloom={bloom} />
      <EffectComposer multisampling={quality.tier === 'high' ? 4 : 0} enableNormalPass={false}>
        <HeatHaze />
        <Bloom
          ref={bloom}
          mipmapBlur
          intensity={0.85}
          luminanceThreshold={0.42}
          luminanceSmoothing={0.35}
          radius={0.78}
        />
        <Vignette offset={0.28} darkness={0.72} />
        <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.22} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  )
}
