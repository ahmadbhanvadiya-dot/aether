import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode, type BloomEffect } from 'postprocessing'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { director, pointer } from '../state/director'
import { quality, useExperience } from '../state/useExperience'
import { CameraRig } from './CameraRig'
import { Nebula } from './Nebula'
import { Planet } from './Planet'
import { GalaxyRig } from './galaxy/GalaxyRig'
import { GalaxySystem } from './galaxy/GalaxySystem'
import { ThumbnailBaker } from './galaxy/Thumbnails'
import { Ithra } from './Ithra'
import { SurfaceRig } from './surface/SurfaceRig'
import { SurfaceSpace } from './surface/SurfaceScene'
import { Precompile, Projection, Space, WarpStreaks } from './Warp'
import { DistantGalaxies, Dust, ShootingStars, Starfield } from './Starfield'

/** Advances the scene clock and reports readiness after the first frames. */
function Clock() {
  const motionPaused = useExperience((s) => s.motionPaused)
  const setSceneReady = useExperience((s) => s.setSceneReady)
  const frames = useRef(0)

  useFrame((_, delta) => {
    if (!motionPaused) director.time += Math.min(delta, 1 / 20)
    // Wait a couple of frames so shader compilation never stalls the intro.
    if (frames.current < 3 && ++frames.current === 3) setSceneReady()
  })
  return null
}

const MAX_DPR = quality.tier === 'high' ? 1.75 : 1.5


/** Daylit skies are bright: only the sun and true emitters should bloom there. */
function BloomControl({ bloom }: { bloom: RefObject<BloomEffect | null> }) {
  useFrame(() => {
    const effect = bloom.current
    if (effect) effect.luminanceMaterial.threshold = director.space === 'surface' ? 0.82 : 0.42
  })
  return null
}

export function Experience() {
  const [dpr, setDpr] = useState(MAX_DPR)
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
      dpr={[1, dpr]}
      camera={{ fov: 34, near: 0.05, far: 1200, position: [0, 0, 24] }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      aria-hidden
      onCreated={(state) => {
        // Dev-only handle for profiling frames from the console.
        if (import.meta.env.DEV) (window as unknown as { __aether: unknown }).__aether = state
      }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(1, d - 0.35))}
        onIncline={() => setDpr((d) => Math.min(MAX_DPR, d + 0.25))}
        flipflops={3}
      />
      <Clock />
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
      </Space>
      <Space space="surface">
        <SurfaceSpace />
      </Space>
      <WarpStreaks />
      <CameraRig />
      <GalaxyRig />
      <SurfaceRig />
      <Projection />
      <Precompile />
      <ThumbnailBaker />
      <BloomControl bloom={bloom} />
      <EffectComposer multisampling={quality.tier === 'high' ? 4 : 0} enableNormalPass={false}>
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
