import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo } from 'react'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PLANET_BY_ID, type PlanetId } from '../../data/planets'
import { director, telemetry } from '../../state/director'
import { galaxy } from '../../state/galaxy'
import { useExperience } from '../../state/useExperience'

type Mode = 'intro' | 'outro' | 'free' | 'travel' | 'focus' | 'descent' | 'ascent'

const UP = new Vector3(0, 1, 0)
const HOME_DIR = new Vector3(0.18, 0.44, 1).normalize()

/** Overview distance that keeps the whole system in frame on any aspect. */
function homeDistance(aspect: number) {
  if (aspect < 0.7) return 168
  if (aspect < 1.1) return 124
  return 92
}

/** Mutable camera state for the galaxy. Read by the UI through `galaxyCam.mode`. */
export const galaxyCam = {
  mode: 'intro' as Mode,
  t: 0,
  from: new Vector3(),
  fromTarget: new Vector3(),
  offset: new Vector3(),
  last: new Vector3(),
  home: new Vector3(),
  hasHome: false,
  outroFrom: new Vector3(),
  outroTarget: new Vector3(),
  focus: null as PlanetId | null,
  /** Camera offset from the focused world when a descent begins. */
  dive: new Vector3(),
  diveInit: false,
}

/** Phase 3: the camera dives from the focus view toward the world's atmosphere. */
export function beginGalaxyDescent() {
  gsap.killTweensOf(galaxyCam)
  galaxyCam.mode = 'descent'
  galaxyCam.diveInit = false
}

/** Phase 3: climbing back out to the focus view, driven by director.descent 1 → 0. */
export function beginGalaxyAscent() {
  // The world kept orbiting while we were on its surface: climb out to a fresh,
  // sunlit view rather than the (now night-side) offset we descended from.
  const f = galaxyCam.focus
  if (f) {
    focusOffset(f, window.innerWidth / window.innerHeight, window.innerWidth, galaxyCam.offset)
    galaxyCam.dive.copy(galaxyCam.offset)
    galaxyCam.diveInit = true
  }
  galaxyCam.mode = 'ascent'
}

/** Where the focus camera sits relative to a world (sunlit, gibbous view). */
function focusOffset(planet: PlanetId, aspect: number, width: number, out: Vector3) {
  const data = PLANET_BY_ID[planet]
  const P = galaxy.positions[planet]
  const toStar = new Vector3().copy(P).multiplyScalar(-1).normalize()
  const sideV = new Vector3().crossVectors(UP, toStar).normalize()
  // Narrow screens show the panel as a bottom sheet: pull back so the world fits above it.
  const narrow = aspect < 0.9 || width <= 900
  const dist = data.radius * (data.rings ? 5.6 : 4.6) * (narrow ? 1.5 : 1)
  return out
    .copy(toStar)
    .multiplyScalar(0.62)
    .addScaledVector(sideV, 0.72)
    .addScaledVector(UP, 0.3)
    .normalize()
    .multiplyScalar(dist)
}

/**
 * Debug shots that start on a surface: pretend we descended from the focus
 * view, so the ascent has somewhere to return to.
 */
export function primeGalaxyFocus(planet: PlanetId) {
  const aspect = window.innerWidth / window.innerHeight
  galaxyCam.focus = planet
  focusOffset(planet, aspect, window.innerWidth, galaxyCam.offset)
  galaxyCam.dive.copy(galaxyCam.offset)
  galaxyCam.diveInit = true
  galaxyCam.hasHome = false
}

/** Called by the warp sequence before the galaxy approach starts. */
export function enterGalaxyIntro() {
  galaxyCam.mode = 'intro'
  galaxyCam.focus = null
  galaxyCam.hasHome = false
  // Every arrival starts from the overview, never from a stale selection.
  if (useExperience.getState().focus) useExperience.getState().setFocus(null)
}

const tmpPos = new Vector3()
const tmpTarget = new Vector3()
const destPos = new Vector3()
const destTarget = new Vector3()
const side = new Vector3()
const projected = new Vector3()
const km = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function GalaxyRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const focus = useExperience((s) => s.focus)
  const phase = useExperience((s) => s.phase)

  const controls = useMemo(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enableDamping = true
    c.dampingFactor = 0.065
    c.enablePan = false
    c.rotateSpeed = 0.45
    c.zoomSpeed = 0.75
    c.minPolarAngle = 0.15
    c.maxPolarAngle = Math.PI - 0.15
    c.autoRotateSpeed = 0.22
    c.enabled = false
    return c
  }, [camera, gl])

  useEffect(() => () => controls.dispose(), [controls])

  // Leaving the galaxy: capture the pose so the outro recedes from where you are.
  useEffect(() => {
    if (phase === 'returning' && director.space === 'galaxy') {
      galaxyCam.mode = 'outro'
      galaxyCam.outroFrom.copy(camera.position)
      galaxyCam.outroTarget.copy(controls.target)
      controls.enabled = false
    }
  }, [phase, camera, controls])

  // Every focus change starts a travel from the current pose.
  useEffect(() => {
    if (director.space !== 'galaxy') return
    if (galaxyCam.mode === 'intro' || galaxyCam.mode === 'outro') {
      // Arriving straight into a focus (debug shots): start from the overview.
      if (focus === null) return
      const aspect = size.width / size.height
      camera.position.copy(HOME_DIR).multiplyScalar(homeDistance(aspect))
      controls.target.set(0, 0, 0)
    }
    if (galaxyCam.mode === 'free') {
      galaxyCam.home.copy(camera.position)
      galaxyCam.hasHome = true
    }
    if (galaxyCam.focus === focus && galaxyCam.mode !== 'travel') return

    galaxyCam.focus = focus
    galaxyCam.from.copy(camera.position)
    galaxyCam.fromTarget.copy(controls.target)

    if (focus) focusOffset(focus, size.width / size.height, size.width, galaxyCam.offset)

    const reduced = useExperience.getState().reducedMotion
    const travelDistance = galaxyCam.from.distanceTo(
      focus ? destPos.copy(galaxy.positions[focus]).add(galaxyCam.offset) : galaxyCam.home,
    )
    galaxyCam.mode = 'travel'
    galaxyCam.t = 0
    controls.enabled = false
    gsap.killTweensOf(galaxyCam)
    gsap.to(galaxyCam, {
      t: 1,
      duration: reduced ? 0.7 : MathUtils.clamp(1.5 + travelDistance / 45, 1.8, 3.4),
      ease: reduced ? 'power1.inOut' : 'power3.inOut',
      onComplete: () => {
        galaxyCam.mode = focus ? 'focus' : 'free'
        if (focus) galaxyCam.last.copy(galaxy.positions[focus])
        controls.enabled = true
      },
    })
    gsap.to(director, { panelShift: focus ? 1 : 0, duration: reduced ? 0.5 : 1.6, ease: 'power3.inOut' })
  }, [focus, camera, controls, size.width, size.height])

  useFrame(() => {
    if (director.space !== 'galaxy') {
      controls.enabled = false
      return
    }
    const aspect = size.width / size.height
    const { motionPaused, reducedMotion, hovered, phase: currentPhase } = useExperience.getState()

    switch (galaxyCam.mode) {
      case 'intro': {
        const gi = director.galaxyIntro
        const far = 1 - gi
        tmpPos.copy(HOME_DIR).multiplyScalar(homeDistance(aspect) * (1 + 2.8 * far))
        tmpPos.applyAxisAngle(UP, far * 0.9)
        tmpPos.y += far * 30
        camera.position.copy(tmpPos)
        controls.target.set(0, 0, 0)
        camera.lookAt(controls.target)
        if (currentPhase === 'galaxy' && gi >= 0.999) {
          galaxyCam.mode = 'free'
          controls.enabled = true
        }
        break
      }
      case 'outro': {
        const far = 1 - director.galaxyIntro
        tmpTarget.copy(galaxyCam.outroTarget).lerp(destTarget.set(0, 0, 0), Math.min(1, far * 2))
        tmpPos.copy(galaxyCam.outroFrom).multiplyScalar(1 + 2.4 * far)
        tmpPos.y += far * 26
        camera.position.copy(tmpPos)
        controls.target.copy(tmpTarget)
        camera.lookAt(tmpTarget)
        break
      }
      case 'travel': {
        const f = galaxyCam.focus
        if (f) {
          destTarget.copy(galaxy.positions[f])
          destPos.copy(destTarget).add(galaxyCam.offset)
        } else {
          destTarget.set(0, 0, 0)
          if (galaxyCam.hasHome) destPos.copy(galaxyCam.home)
          else destPos.copy(HOME_DIR).multiplyScalar(homeDistance(aspect))
        }
        const e = galaxyCam.t
        tmpPos.lerpVectors(galaxyCam.from, destPos, e)
        // Arc over the orbital plane instead of cutting straight through it.
        tmpPos.y += Math.sin(Math.PI * e) * galaxyCam.from.distanceTo(destPos) * 0.14
        tmpTarget.lerpVectors(galaxyCam.fromTarget, destTarget, e)
        camera.position.copy(tmpPos)
        controls.target.copy(tmpTarget)
        camera.lookAt(tmpTarget)
        break
      }
      case 'focus': {
        const f = galaxyCam.focus!
        const P = galaxy.positions[f]
        tmpPos.subVectors(P, galaxyCam.last)
        camera.position.add(tmpPos)
        controls.target.add(tmpPos)
        galaxyCam.last.copy(P)
        const data = PLANET_BY_ID[f]
        controls.minDistance = data.radius * (data.rings ? 2.9 : 1.7)
        controls.maxDistance = data.radius * 16
        controls.autoRotate = !motionPaused && !reducedMotion
        controls.autoRotateSpeed = 0.35
        controls.update()
        break
      }
      case 'descent':
      case 'ascent': {
        const f = galaxyCam.focus
        if (!f) break
        controls.enabled = false
        const P = galaxy.positions[f]
        const data = PLANET_BY_ID[f]
        if (!galaxyCam.diveInit) {
          galaxyCam.dive.subVectors(camera.position, P)
          galaxyCam.diveInit = true
        }
        const k = director.descent
        const dirV = tmpPos.copy(galaxyCam.dive).normalize()
        const dist = MathUtils.lerp(galaxyCam.dive.length(), data.radius * 1.012, k)
        camera.position.copy(P).addScaledVector(dirV, dist)
        // Near the atmosphere the view tips from the planet's centre to its horizon.
        side.crossVectors(dirV, UP).normalize()
        destTarget.copy(P).addScaledVector(dirV, data.radius).addScaledVector(side, data.radius * 2.5)
        tmpTarget.copy(P).lerp(destTarget, MathUtils.smoothstep(k, 0.55, 1))
        camera.lookAt(tmpTarget)
        controls.target.copy(P)
        if (galaxyCam.mode === 'ascent' && currentPhase === 'galaxy' && k <= 0.001) {
          galaxyCam.mode = 'focus'
          galaxyCam.last.copy(P)
          controls.enabled = true
        }
        break
      }
      case 'free': {
        controls.minDistance = 16
        controls.maxDistance = 220
        controls.autoRotate = !motionPaused && !reducedMotion
        controls.autoRotateSpeed = 0.18
        controls.update()
        break
      }
    }

    // ---- Readout ----------------------------------------------------------
    const f = galaxyCam.focus
    const near = galaxyCam.mode === 'focus' || galaxyCam.mode === 'travel' || galaxyCam.mode === 'descent' || galaxyCam.mode === 'ascent'
    if (f && near) {
      const data = PLANET_BY_ID[f]
      const d = camera.position.distanceTo(galaxy.positions[f])
      const alt = Math.max(0, (d / data.radius - 1) * data.radiusKm)
      telemetry.readout = `Altitude ${km.format(Math.round(alt / 100) * 100)} km`
    } else {
      telemetry.readout = `${(camera.position.length() * 0.05).toFixed(1)} AU from Elys`
    }

    // ---- Hover label position ---------------------------------------------
    const h = telemetry.hover
    if (hovered && hovered !== f) {
      const data = PLANET_BY_ID[hovered]
      camera.updateMatrixWorld()
      projected.copy(galaxy.positions[hovered]).project(camera)
      h.x = (projected.x * 0.5 + 0.5) * size.width
      h.y = (-projected.y * 0.5 + 0.5) * size.height
      // Approximate on-screen radius so the label clears the disc.
      const dist = camera.position.distanceTo(galaxy.positions[hovered])
      const fovRad = MathUtils.degToRad(camera.fov)
      h.radiusPx = (data.radius / (dist * Math.tan(fovRad / 2))) * (size.height / 2)
      h.visible = projected.z < 1
    } else {
      h.visible = false
    }
  })

  return null
}
