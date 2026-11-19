import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import {
  BufferGeometry,
  Color,
  Group,
  Mesh,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three'
import { create } from 'zustand'
import { PLANETS, type PlanetId } from '../../data/planets'
import { galaxy } from '../../state/galaxy'
import { useExperience } from '../../state/useExperience'

/** Rendered portraits of the six worlds, as data URLs. */
export const useThumbs = create<{ urls: Partial<Record<PlanetId, string>> }>(() => ({ urls: {} }))

const SIZE = 192
// Linear → sRGB, with a gentle shoulder so bright limbs don't clip.
const LUT = new Uint8ClampedArray(256)
for (let i = 0; i < 256; i++) {
  const v = i / 255
  LUT[i] = Math.round(255 * Math.pow(v / (1 + v * 0.12), 1 / 2.2) * 1.06)
}

/**
 * Renders each world once, from its own live materials (surface, clouds,
 * atmosphere, rings), lit by Elys from the same side as the focus view. The
 * alpha matte comes from the render itself, so the portrait sits on any
 * background without a cutout shape.
 */
function bakeAll(gl: WebGLRenderer) {
  const rt = new WebGLRenderTarget(SIZE, SIZE, { samples: 4 })
  const scene = new Scene()
  const camera = new PerspectiveCamera(26, 1, 0.01, 400)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return {}
  const pixels = new Uint8Array(SIZE * SIZE * 4)
  const image = ctx.createImageData(SIZE, SIZE)
  const previousTarget = gl.getRenderTarget()
  const previousClear = gl.getClearColor(new Color())
  const previousAlpha = gl.getClearAlpha()
  const P = new Vector3(18, 0, 0)
  const view = new Vector3(-0.55, 0.3, 0.78).normalize()
  const urls: Partial<Record<PlanetId, string>> = {}

  for (const planet of PLANETS) {
    const m = galaxy.materials[planet.id]
    if (!m) continue
    const r = planet.radius
    const root = new Group()
    root.position.copy(P)
    const tilt = new Group()
    tilt.rotation.z = planet.axialTilt
    root.add(tilt)
    const geometries: BufferGeometry[] = [new SphereGeometry(r, 72, 72)]
    const surface = new Mesh(geometries[0], m.surface)
    tilt.add(surface)
    if (m.clouds) {
      geometries.push(new SphereGeometry(r * 1.012, 72, 72))
      const clouds = new Mesh(geometries[geometries.length - 1], m.clouds)
      clouds.renderOrder = 1
      tilt.add(clouds)
    }
    geometries.push(new SphereGeometry(r * planet.atmosphere.shell, 48, 48))
    const atmo = new Mesh(geometries[geometries.length - 1], m.atmosphere)
    atmo.renderOrder = 2
    root.add(atmo)
    if (m.rings && planet.rings) {
      geometries.push(new RingGeometry(planet.rings.inner * r, planet.rings.outer * r, 160, 1))
      const rings = new Mesh(geometries[geometries.length - 1], m.rings)
      rings.rotation.x = Math.PI / 2
      rings.renderOrder = 3
      tilt.add(rings)
    }
    scene.add(root)
    root.updateMatrixWorld(true)

    // Point the shared uniforms at this portrait for one render; the galaxy
    // rewrites them every frame, so nothing needs restoring.
    m.surface.uniforms.uModelRot.value.setFromMatrix4(surface.matrixWorld)
    m.atmosphere.uniforms.uCenter.value.copy(P)
    m.surface.uniforms.uCenter.value.copy(P)
    if (m.rings) m.rings.uniforms.uCenter.value.copy(P)

    const extent = planet.rings ? planet.rings.outer * r * 1.08 : r * planet.atmosphere.shell * 1.06
    const distance = extent / Math.sin((camera.fov * Math.PI) / 360)
    camera.position.copy(P).addScaledVector(view, distance)
    camera.lookAt(P)
    camera.updateMatrixWorld()

    gl.setRenderTarget(rt)
    gl.setClearColor(0x000000, 0)
    gl.clear()
    gl.render(scene, camera)
    gl.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, pixels)

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const src = ((SIZE - 1 - y) * SIZE + x) * 4
        const dst = (y * SIZE + x) * 4
        const R = LUT[pixels[src]]
        const G = LUT[pixels[src + 1]]
        const B = LUT[pixels[src + 2]]
        image.data[dst] = R
        image.data[dst + 1] = G
        image.data[dst + 2] = B
        // Matte from the render: anything lit or glowing is opaque, true black is not.
        image.data[dst + 3] = Math.min(255, Math.max(R, G, B) * 3)
      }
    }
    ctx.putImageData(image, 0, 0)
    urls[planet.id] = canvas.toDataURL('image/png')

    scene.remove(root)
    geometries.forEach((g) => g.dispose())
  }

  gl.setRenderTarget(previousTarget)
  gl.setClearColor(previousClear, previousAlpha)
  rt.dispose()
  return urls
}

/** Bakes the portraits the first time the Observatory opens. */
export function ThumbnailBaker() {
  const gl = useThree((s) => s.gl)
  const phase = useExperience((s) => s.phase)
  useEffect(() => {
    if (phase !== 'observatory') return
    if (Object.keys(useThumbs.getState().urls).length === PLANETS.length) return
    // After the first observatory frame, so the bake never delays the transition's start.
    const id = window.setTimeout(() => useThumbs.setState({ urls: bakeAll(gl) }), 120)
    return () => window.clearTimeout(id)
  }, [phase, gl])
  return null
}
