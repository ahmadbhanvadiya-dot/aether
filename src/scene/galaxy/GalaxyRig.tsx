import { useFrame, useThree } from '@react-three/fiber'
import { sceneToAU } from '../../data/astronomy'
import { MAP_VIEW, SYSTEM_BY_ID, SYSTEMS, type SystemId } from '../../data/systems'
import { sim } from '../../state/simulation'
import gsap from 'gsap'
import { useEffect, useMemo } from 'react'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { WORLD_BY_ID, type PlanetId, type WorldId } from '../../data/planets'
import { director, telemetry } from '../../state/director'
import { galaxy } from '../../state/galaxy'
import { useExperience } from '../../state/useExperience'
import { approach, atmosphereFx, bezier, cruise, DURATION, smooth01, travelFx } from '../motion'
import { baseFov } from '../Warp'

const baseFovFor = (aspect: number) => baseFov('galaxy', aspect)

type Mode = 'intro' | 'outro' | 'free' | 'travel' | 'focus' | 'descent' | 'ascent' | 'observatory' | 'map'

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
  focus: null as WorldId | null,
  /** Camera offset from the focused world when a descent begins. */
  dive: new Vector3(),
  diveInit: false,
  /** Phase 4: the pose the Observatory rose from, and the dial's current up vector. */
  obsFrom: new Vector3(),
  obsFromTarget: new Vector3(),
  obsUp: new Vector3(0, 0, -1),
  obsInit: false,
  /** Phase 11: the pose the universe map rose from. */
  mapFrom: new Vector3(),
  mapFromTarget: new Vector3(),
  mapInit: false,
  /** Called once when a travel lands (used to chain Observatory → descent). */
  onArrive: null as null | (() => void),
  /** Travel path: the departure control point (relative to `from`) and whether we left moving. */
  departCtl: new Vector3(),
  momentum: false,
  travelLength: 1,
  /** Camera velocity (units/s), measured every frame for momentum and parallax. */
  vel: new Vector3(),
  prev: new Vector3(),
  hasPrev: false,
  /** 0 → 1 after arriving: orbit auto-rotation eases in rather than starting at full speed. */
  settle: 1,
  /** Entry path around the world: start direction, sweep axis and angle, start distance. */
  n0: new Vector3(0, 0, 1),
  axis: new Vector3(0, 1, 0),
  sweep: 0,
  d0: 10,
  /**
   * Cinematic pass: the orbit "breathes" while the camera rests (overview and
   * focus). `breath` eases 0 → 1 after every arrival; `breathOffset` is the
   * offset added to the camera after OrbitControls, removed again before the
   * next update so the controls (and the visitor's drag) always work on the
   * clean pose.
   */
  breath: 0,
  breathOffset: new Vector3(),
}

/** Live handles so module functions (the Observatory director) can start a travel. */
const rig = {
  camera: null as PerspectiveCamera | null,
  controls: null as OrbitControls | null,
  width: 1,
  height: 1,
}
// Dev-only: the rig's controls, for inspecting views from the console.
if (import.meta.env.DEV) Object.assign(window, { __rig: rig })

/** Phase 4: rise to the zenith above Elys. The dial view is driven by director.observatory. */
export function beginObservatory() {
  gsap.killTweensOf(galaxyCam)
  galaxyCam.mode = 'observatory'
  galaxyCam.obsInit = false
  if (rig.controls) rig.controls.enabled = false
}

/** Phase 11: rise above the galaxy for the universe map (driven by director.map). */
export function beginMap() {
  gsap.killTweensOf(galaxyCam)
  galaxyCam.mode = 'map'
  galaxyCam.mapInit = false
  if (rig.controls) rig.controls.enabled = false
}

/**
 * Phase 11: each system keeps its own overview. When the transit switches
 * systems under the map, the pose the map will return to is swapped: the
 * destination's last overview, or, on a first visit to Tessaly, a closer one
 * that frames its small system (Liris orbits at 24, Elys's outer world at ~90).
 */
const overviews: Partial<Record<SystemId, { pos: Vector3; target: Vector3 }>> = {}
const FIRST_OVERVIEW: Partial<Record<SystemId, number>> = { tessaly: 58 }
export function switchMapReturn(from: SystemId, to: SystemId) {
  overviews[from] = { pos: galaxyCam.mapFrom.clone(), target: galaxyCam.mapFromTarget.clone() }
  const saved = overviews[to]
  if (saved) {
    galaxyCam.mapFrom.copy(saved.pos)
    galaxyCam.mapFromTarget.copy(saved.target)
  } else if (FIRST_OVERVIEW[to]) {
    galaxyCam.mapFromTarget.set(0, 0, 0)
    galaxyCam.mapFrom.setLength(FIRST_OVERVIEW[to])
  }
}

/** Back from the map: the overview, exactly where it was left. */
export function endMap() {
  galaxyCam.mode = 'free'
  galaxyCam.hasPrev = false
  if (rig.controls) {
    rig.controls.target.copy(galaxyCam.mapFromTarget)
    rig.controls.enabled = true
    rig.controls.update()
  }
}

/**
 * Starts a camera travel from wherever the camera is: to a world's focus view,
 * or (null) back to the overview. Used by focus changes and by the Observatory.
 *
 * The path is a cubic Bézier that leaves along the camera's current motion
 * (or, from rest, toward the destination after a slow turn) and arrives along
 * the final orbit direction, so the camera settles into orbit instead of
 * stopping on a point. Interrupting a travel starts the next one at the
 * current velocity.
 */
export function startGalaxyTravel(focus: WorldId | null) {
  const { camera, controls } = rig
  if (!camera || !controls) return
  // Entry, climb and the universe map own the camera until they finish.
  if (galaxyCam.mode === 'descent' || galaxyCam.mode === 'ascent' || galaxyCam.mode === 'map') return
  const aspect = rig.width / rig.height
  if (galaxyCam.mode === 'free') {
    galaxyCam.home.copy(camera.position)
    galaxyCam.hasHome = true
  }
  galaxyCam.focus = focus
  galaxyCam.from.copy(camera.position)
  galaxyCam.fromTarget.copy(controls.target)
  if (focus) focusOffset(focus, aspect, rig.width, galaxyCam.offset)

  const reduced = useExperience.getState().reducedMotion
  travelDest(focus, aspect, destPos, destTarget)
  const length = Math.max(0.001, galaxyCam.from.distanceTo(destPos))
  let duration = reduced ? 0.7 : DURATION.approach(length)
  galaxyCam.travelLength = length

  // Leave along the current motion when a travel is interrupted; otherwise
  // turn toward the destination first, lifting slightly off the orbital plane.
  const speed = galaxyCam.vel.length()
  galaxyCam.momentum = !reduced && galaxyCam.mode === 'travel' && speed > (length / duration) * 0.15
  if (galaxyCam.momentum) {
    // Fast and close: a shorter leg keeps the current speed instead of braking hard.
    duration = MathUtils.clamp((1.8 * length) / speed, 1.6, duration)
    galaxyCam.departCtl.copy(galaxyCam.vel).multiplyScalar(duration / 3)
    if (galaxyCam.departCtl.length() > length * 0.6) galaxyCam.departCtl.setLength(length * 0.6)
  } else {
    camera.getWorldDirection(side)
    galaxyCam.departCtl
      .subVectors(destPos, galaxyCam.from)
      .normalize()
      .lerp(side, 0.45)
      .addScaledVector(UP, 0.18)
      .normalize()
      .multiplyScalar(length * 0.3)
  }

  galaxyCam.mode = 'travel'
  galaxyCam.t = 0
  galaxyCam.settle = 0
  controls.enabled = false
  gsap.killTweensOf(galaxyCam)
  gsap.to(galaxyCam, {
    t: 1,
    duration,
    ease: 'none',
    onComplete: () => {
      // Land exactly on the final pose: if frames were skipped (a background
      // tab), the last drawn pose may be mid-flight, and focus would keep it.
      travelDest(focus, rig.width / rig.height, destPos, destTarget)
      camera.position.copy(destPos)
      controls.target.copy(destTarget)
      galaxyCam.mode = focus ? 'focus' : 'free'
      if (focus) galaxyCam.last.copy(galaxy.positions[focus])
      camera.up.set(0, 1, 0)
      camera.lookAt(destTarget)
      controls.enabled = true
      const done = galaxyCam.onArrive
      galaxyCam.onArrive = null
      done?.()
    },
  })
  // The frame slides clear of the panel during the deceleration, not the departure.
  gsap.killTweensOf(director, 'panelShift')
  gsap.to(director, {
    panelShift: focus ? 1 : 0,
    duration: reduced ? 0.5 : duration * 0.55,
    delay: reduced ? 0 : duration * 0.4,
    ease: 'power2.inOut',
  })
}

/** Where a travel ends: a world's live focus pose, or the overview. */
function travelDest(focus: WorldId | null, aspect: number, outPos: Vector3, outTarget: Vector3) {
  if (focus) {
    outTarget.copy(galaxy.positions[focus])
    outPos.copy(outTarget).add(galaxyCam.offset)
  } else {
    outTarget.set(0, 0, 0)
    if (galaxyCam.hasHome) outPos.copy(galaxyCam.home)
    else outPos.copy(HOME_DIR).multiplyScalar(homeDistance(aspect))
  }
}

/** Height above Elys at which Orion's orbit (and rings) fill the dial. */
function zenithHeight(fovDeg: number, width: number, height: number) {
  const narrow = width / height < 0.9 || width <= 900
  // Dial radius in px: on wide screens it sits left of the reading panel.
  // Narrow: matches --obs-dial in index.css, which reserves its room below the header.
  const dialPx = narrow ? Math.min(width * 0.38, height * 0.24) : Math.min(height * 0.4, width * 0.27)
  const tanHalf = Math.tan(MathUtils.degToRad(fovDeg) / 2)
  return (47 * (height / 2)) / (dialPx * tanHalf)
}


/** Phase 3: the camera dives from the focus view toward the world's atmosphere. */
export function beginGalaxyDescent() {
  gsap.killTweensOf(galaxyCam)
  galaxyCam.mode = 'descent'
  galaxyCam.diveInit = false
  galaxyCam.settle = 0
}

/**
 * The entry path around a world, from a camera offset `rel` (camera minus
 * world centre): it sweeps toward the day side (never past local noon) while
 * dropping to the top of the atmosphere, so the camera arrives gliding over a
 * sunlit horizon. Descent runs it 0 → 1, the climb back runs it 1 → 0.
 */
function initDive(rel: Vector3, planet: WorldId) {
  const P = galaxy.positions[planet]
  galaxyCam.d0 = rel.length()
  galaxyCam.n0.copy(rel).normalize()
  const toStar = side.copy(P).multiplyScalar(-1).normalize()
  const angle = Math.acos(MathUtils.clamp(galaxyCam.n0.dot(toStar), -1, 1))
  galaxyCam.axis.crossVectors(galaxyCam.n0, toStar)
  if (galaxyCam.axis.lengthSq() < 1e-6) galaxyCam.axis.crossVectors(galaxyCam.n0, UP)
  galaxyCam.axis.normalize()
  galaxyCam.sweep = Math.min(0.55, angle * 0.8)
  galaxyCam.dive.copy(rel)
  galaxyCam.diveInit = true
}

/** Phase 3: climbing back out to the focus view, driven by director.descent 1 → 0. */
export function beginGalaxyAscent() {
  // The world kept orbiting while we were on its surface: climb out to a fresh,
  // sunlit view rather than the (now night-side) offset we descended from.
  const f = galaxyCam.focus
  if (f) {
    focusOffset(f, window.innerWidth / window.innerHeight, window.innerWidth, galaxyCam.offset)
    initDive(galaxyCam.offset, f)
  }
  galaxyCam.mode = 'ascent'
  galaxyCam.settle = 0
  galaxyCam.hasPrev = false
}

/** Where the focus camera sits relative to a world (sunlit, gibbous view). */
function focusOffset(planet: WorldId, aspect: number, width: number, out: Vector3) {
  const data = WORLD_BY_ID[planet]
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
export function primeGalaxyFocus(planet: WorldId) {
  const aspect = window.innerWidth / window.innerHeight
  galaxyCam.focus = planet
  focusOffset(planet, aspect, window.innerWidth, galaxyCam.offset)
  initDive(galaxyCam.offset, planet)
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
const p1 = new Vector3()
const p2 = new Vector3()
const n = new Vector3()
const tangent = new Vector3()
const lookDir = new Vector3()
const centreDir = new Vector3()
/**
 * How far below the visible horizon the camera looks during entry (rad). The
 * horizon itself dips below the local horizontal with altitude, so the view
 * follows the real limb down and the horizon holds a steady place in frame.
 */
const ENTRY_BELOW_HORIZON = 0.14
const km = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const breathAxis = new Vector3()
const breathRel = new Vector3()
const gaze = new Vector3()
const camRight = new Vector3()
const camUp = new Vector3()

/** Speed variation for the orbit's auto-rotation: slow swells, never a turntable. */
function rotationSwell(T: number) {
  return 1 + 0.28 * Math.sin(T * 0.071 + 0.5) + 0.12 * Math.sin(T * 0.19 + 2.1)
}

/**
 * Cinematic pass: a resting orbit that breathes. After OrbitControls has set
 * the pose, the camera rises and sinks a degree or two on long, incommensurate
 * swells (15–40 s), drifts in and out by about 2 %, and its gaze wanders a
 * fraction of a degree around the target, so the frame feels held by a hand,
 * not bolted to a turntable. Driven by the scene clock (Pause motion stops it),
 * eased in after every arrival, off for reduced motion.
 */
function applyBreath(camera: PerspectiveCamera, target: Vector3, amount: number, T: number, scale: number) {
  if (amount < 1e-4) return
  breathRel.subVectors(camera.position, target)
  const len = breathRel.length()
  breathAxis.crossVectors(breathRel, UP)
  if (breathAxis.lengthSq() < 1e-8) return
  breathAxis.normalize()
  const elev = (Math.sin(T * 0.16 + 0.3) * 0.03 + Math.sin(T * 0.41 + 1.9) * 0.009) * amount * scale
  const dolly = 1 + (Math.sin(T * 0.12 + 2.4) * 0.018 + Math.sin(T * 0.29 + 0.8) * 0.006) * amount * scale
  galaxyCam.breathOffset.copy(breathRel).applyAxisAngle(breathAxis, elev).multiplyScalar(dolly).sub(breathRel)
  camera.position.add(galaxyCam.breathOffset)
  // The gaze wanders a little around the target (a fraction of a degree).
  camRight.crossVectors(breathRel, UP).normalize()
  camUp.crossVectors(camRight, breathRel).normalize()
  const wx = (Math.sin(T * 0.21 + 1.1) * 0.0045 + Math.sin(T * 0.53) * 0.0012) * amount * len
  const wy = (Math.sin(T * 0.17 + 2.6) * 0.003 + Math.sin(T * 0.47 + 0.4) * 0.001) * amount * len
  gaze.copy(target).addScaledVector(camRight, wx).addScaledVector(camUp, wy)
  camera.lookAt(gaze)
}

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

  useEffect(() => {
    rig.camera = camera
    rig.controls = controls
    rig.width = size.width
    rig.height = size.height
  }, [camera, controls, size.width, size.height])

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
    // The Observatory owns the camera while it is open; it records the focus only.
    if (galaxyCam.mode === 'observatory') {
      galaxyCam.focus = focus
      return
    }
    if (galaxyCam.mode === 'descent' || galaxyCam.mode === 'ascent') return
    if (galaxyCam.focus === focus && galaxyCam.mode !== 'travel') return
    startGalaxyTravel(focus)
  }, [focus, camera, controls, size.width, size.height])

  useFrame((_, delta) => {
    if (director.space !== 'galaxy') {
      controls.enabled = false
      galaxyCam.hasPrev = false
      return
    }
    const dt = Math.min(Math.max(delta, 1 / 240), 1 / 20)
    const aspect = size.width / size.height
    const { motionPaused, reducedMotion, hovered, phase: currentPhase } = useExperience.getState()
    const live = !motionPaused && !reducedMotion
    const T = director.time

    // The breathing offset from the last frame comes off before anything reads
    // the pose; other modes start from the clean pose and the breath restarts at 0.
    const resting = galaxyCam.mode === 'focus' || galaxyCam.mode === 'free'
    if (resting) camera.position.sub(galaxyCam.breathOffset)
    else galaxyCam.breath = 0
    galaxyCam.breathOffset.set(0, 0, 0)

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
        travelDest(f, aspect, destPos, destTarget)
        const t = galaxyCam.t
        const L = galaxyCam.travelLength
        // One clock, two curves: the view turns onto the destination early,
        // while the position gathers speed slowly and decelerates for longer.
        const e = galaxyCam.momentum ? cruise(t) : approach(t)
        const aim = galaxyCam.momentum ? smooth01(Math.min(1, t / 0.3)) : MathUtils.smootherstep(t, 0, 0.34)
        p1.copy(galaxyCam.from).add(galaxyCam.departCtl)
        if (f) {
          // Arrive moving inward along the final orbit direction.
          p2.copy(galaxyCam.offset).normalize().multiplyScalar(L * 0.28).add(destPos).addScaledVector(UP, L * 0.05)
        } else {
          p2.subVectors(destPos, galaxyCam.from).normalize().multiplyScalar(-L * 0.28).add(destPos).addScaledVector(UP, L * 0.08)
        }
        bezier(tmpPos, galaxyCam.from, p1, p2, destPos, e)
        tmpTarget.lerpVectors(galaxyCam.fromTarget, destTarget, aim)
        camera.position.copy(tmpPos)
        controls.target.copy(tmpTarget)
        // Leaving the Observatory's zenith view: settle the horizon back upright.
        camera.up.lerp(UP, Math.min(1, 0.06 + t * 0.6)).normalize()
        camera.lookAt(tmpTarget)
        break
      }
      case 'observatory': {
        controls.enabled = false
        if (!galaxyCam.obsInit) {
          galaxyCam.obsFrom.copy(camera.position)
          galaxyCam.obsFromTarget.copy(controls.target)
          galaxyCam.obsInit = true
        }
        // The dial turns so the selected world sits on the reading line (screen right).
        const sel = useExperience.getState().observed
        const P = galaxy.positions[sel]
        const theta = Math.atan2(P.z, P.x)
        destPos.set(Math.sin(theta), 0, -Math.cos(theta))
        const turn = motionPaused || reducedMotion ? 1 : 1 - Math.exp(-3 * dt)
        // Phase 9: when the selected world runs faster than the dial can turn gracefully
        // (high speeds, a jump to an event), the dial holds still and the world moves on it.
        const omega = (Math.PI * 2 * sim.rate) / WORLD_BY_ID[sel].yearDays
        if (!sim.jumping && omega < 0.35) galaxyCam.obsUp.lerp(destPos, turn).normalize()
        const k = director.observatory
        const H = zenithHeight(baseFovFor(aspect), size.width, size.height)
        destTarget.set(0, 0, 0)
        // A crane, not a zoom: the camera rises first and swings over the
        // system later, so the path curves up and over instead of sliding on a line.
        const rise = MathUtils.smootherstep(k, 0, 0.82)
        const over = MathUtils.smootherstep(k, 0.14, 1)
        tmpPos.set(
          MathUtils.lerp(galaxyCam.obsFrom.x, 0, over),
          MathUtils.lerp(galaxyCam.obsFrom.y, H, rise),
          MathUtils.lerp(galaxyCam.obsFrom.z, 0, over),
        )
        tmpTarget.lerpVectors(galaxyCam.obsFromTarget, side.set(0, 0, 0), MathUtils.smootherstep(k, 0, 0.7))
        camera.up.lerpVectors(UP, galaxyCam.obsUp, MathUtils.smoothstep(k, 0.25, 1)).normalize()
        camera.position.copy(tmpPos)
        controls.target.copy(tmpTarget)
        camera.lookAt(tmpTarget)
        break
      }
      case 'map': {
        controls.enabled = false
        if (!galaxyCam.mapInit) {
          galaxyCam.mapFrom.copy(camera.position)
          galaxyCam.mapFromTarget.copy(controls.target)
          galaxyCam.mapInit = true
        }
        // Rise out of the system and above the galaxy's disc, the view turning
        // from Elys toward the arm it lies in. Position eases later than the aim.
        const k = director.map
        const pos = MathUtils.smootherstep(k, 0.05, 1)
        const aim = MathUtils.smootherstep(k, 0, 0.7)
        // The map's view is in Elys's frame; shift it when another system is at the origin.
        const off = SYSTEM_BY_ID[useExperience.getState().activeSystem].position
        // Cinematic pass: height leads, distance follows — a rising arc, not a line.
        side.copy(MAP_VIEW.position).sub(off)
        const up = MathUtils.smootherstep(k, 0.0, 0.85)
        tmpPos.lerpVectors(galaxyCam.mapFrom, side, pos)
        tmpPos.y = MathUtils.lerp(galaxyCam.mapFrom.y, side.y, up)
        tmpTarget.lerpVectors(galaxyCam.mapFromTarget, destTarget.copy(MAP_VIEW.target).sub(off), aim)
        camera.position.copy(tmpPos)
        controls.target.copy(tmpTarget)
        camera.up.copy(UP)
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
        const data = WORLD_BY_ID[f]
        controls.minDistance = data.radius * (data.rings ? 2.9 : 1.7)
        controls.maxDistance = data.radius * 16
        galaxyCam.settle = MathUtils.damp(galaxyCam.settle, 1, 0.9, dt)
        controls.autoRotate = live
        controls.autoRotateSpeed = 0.35 * galaxyCam.settle * rotationSwell(T)
        controls.update()
        galaxyCam.breath = MathUtils.damp(galaxyCam.breath, live ? 1 : 0, 0.4, dt)
        applyBreath(camera, controls.target, galaxyCam.breath, T, 1)
        break
      }
      case 'descent':
      case 'ascent': {
        const f = galaxyCam.focus
        if (!f) break
        controls.enabled = false
        const P = galaxy.positions[f]
        const data = WORLD_BY_ID[f]
        if (!galaxyCam.diveInit) initDive(tmpPos.subVectors(camera.position, P), f)
        const k = director.descent
        // Position: sweep toward the day side while dropping to the air.
        n.copy(galaxyCam.n0).applyAxisAngle(galaxyCam.axis, galaxyCam.sweep * smooth01(k))
        // Cinematic pass: altitude falls on 1 − (1 − k)^1.5, so the last of the drop
        // is gentle. With a linear drop the horizon's dip (which the view follows)
        // swung the view up at ~85°/s just before the hand-over; now ≲ 10°/s.
        const dist = MathUtils.lerp(galaxyCam.d0, data.radius * 1.012, 1 - Math.pow(1 - k, 1.5))
        camera.position.copy(P).addScaledVector(n, dist)
        // View: from the world's centre to the horizon ahead (the direction of
        // the sweep), and the camera's up turns to the local vertical, so the
        // horizon levels out as the air thickens.
        tangent.crossVectors(galaxyCam.axis, n).normalize()
        const dip = Math.acos(Math.min(1, data.radius / dist))
        const down = dip + ENTRY_BELOW_HORIZON
        lookDir.copy(tangent).multiplyScalar(Math.cos(down)).addScaledVector(n, -Math.sin(down))
        centreDir.subVectors(P, camera.position).normalize()
        centreDir.lerp(lookDir, MathUtils.smootherstep(k, 0.32, 0.94)).normalize()
        camera.up.copy(UP).lerp(n, MathUtils.smoothstep(k, 0.22, 0.86)).normalize()
        // Cinematic pass: a gentle bank through the sweep (≤ 2.6°), zero at both
        // ends, so the camera flies the entry like a craft rather than on a rail.
        const bank = 0.045 * Math.pow(Math.sin(Math.PI * k), 1.6)
        camera.up.applyAxisAngle(centreDir, bank)
        camera.lookAt(tmpTarget.copy(camera.position).add(centreDir))
        controls.target.copy(P)
        atmosphereFx.up.copy(n)
        atmosphereFx.dip = dip
        if (galaxyCam.mode === 'ascent' && currentPhase === 'galaxy' && k <= 0.001) {
          galaxyCam.mode = 'focus'
          galaxyCam.last.copy(P)
          camera.up.copy(UP)
          camera.lookAt(P)
          controls.enabled = true
        }
        break
      }
      case 'free': {
        controls.minDistance = 16
        controls.maxDistance = 220
        galaxyCam.settle = MathUtils.damp(galaxyCam.settle, 1, 0.9, dt)
        controls.autoRotate = live
        controls.autoRotateSpeed = 0.18 * galaxyCam.settle * rotationSwell(T + 40)
        controls.update()
        galaxyCam.breath = MathUtils.damp(galaxyCam.breath, live ? 1 : 0, 0.4, dt)
        applyBreath(camera, controls.target, galaxyCam.breath, T + 40, 0.8)
        break
      }
    }

    // ---- Velocity: momentum for interrupted travels, speed for parallax ------
    if (galaxyCam.hasPrev) {
      tmpPos.subVectors(camera.position, galaxyCam.prev).divideScalar(dt)
      galaxyCam.vel.lerp(tmpPos, 1 - Math.exp(-12 * dt))
    } else galaxyCam.vel.set(0, 0, 0)
    galaxyCam.prev.copy(camera.position)
    galaxyCam.hasPrev = true
    const moving = galaxyCam.mode === 'travel' || galaxyCam.mode === 'descent' || galaxyCam.mode === 'ascent'
    const cruiseSpeed = galaxyCam.mode === 'travel' ? (galaxyCam.travelLength / DURATION.approach(galaxyCam.travelLength)) * 1.5 : 6
    const speedTarget = moving && !reducedMotion ? Math.min(1, galaxyCam.vel.length() / Math.max(cruiseSpeed, 0.01)) : 0
    travelFx.speed = MathUtils.damp(travelFx.speed, speedTarget, 3, dt)
    director.fovKick = MathUtils.damp(director.fovKick, galaxyCam.mode === 'travel' ? travelFx.speed * 4.5 : 0, 3, dt)

    // ---- Observatory chart: projected origin and worlds ---------------------
    if (galaxyCam.mode === 'observatory') {
      camera.updateMatrixWorld()
      const o = telemetry.chart
      projected.set(0, 0, 0).project(camera)
      o.ox = (projected.x * 0.5 + 0.5) * size.width
      o.oy = (-projected.y * 0.5 + 0.5) * size.height
      // The chart is Elys's six (galaxy.positions also holds Liris since Phase 11).
      for (const id of Object.keys(o.worlds) as PlanetId[]) {
        projected.copy(galaxy.positions[id]).project(camera)
        const w = o.worlds[id]
        w.x = (projected.x * 0.5 + 0.5) * size.width
        w.y = (-projected.y * 0.5 + 0.5) * size.height
        const dist = camera.position.distanceTo(galaxy.positions[id])
        w.radiusPx = (WORLD_BY_ID[id].radius / (dist * Math.tan(MathUtils.degToRad(camera.fov) / 2))) * (size.height / 2)
      }
      o.active = director.observatory
    }

    // ---- Universe map: projected systems ----------------------------------
    if (galaxyCam.mode === 'map') {
      camera.updateMatrixWorld()
      const off = SYSTEM_BY_ID[useExperience.getState().activeSystem].position
      for (const s of SYSTEMS) {
        projected.copy(s.position).sub(off).project(camera)
        const m = telemetry.map[s.id]
        m.x = (projected.x * 0.5 + 0.5) * size.width
        m.y = (-projected.y * 0.5 + 0.5) * size.height
        m.on = projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05
      }
    }

    // ---- Readout ----------------------------------------------------------
    const f = galaxyCam.focus
    const near = galaxyCam.mode === 'focus' || galaxyCam.mode === 'travel' || galaxyCam.mode === 'descent' || galaxyCam.mode === 'ascent'
    if (f && near) {
      const data = WORLD_BY_ID[f]
      const d = camera.position.distanceTo(galaxy.positions[f])
      const alt = Math.max(0, (d / data.radius - 1) * data.radiusKm)
      telemetry.readout = `Altitude ${km.format(Math.round(alt / 100) * 100)} km`
    } else if (galaxyCam.mode === 'map') {
      telemetry.readout = 'Above the outer arm'
    } else if (useExperience.getState().activeSystem === 'tessaly') {
      // Tessaly's scale: Liris's orbit (24 units) is 1.33 AU around the pair's centre.
      telemetry.readout = `${(camera.position.length() * 0.055).toFixed(1)} AU from the twin suns`
    } else {
      telemetry.readout = `${sceneToAU(camera.position.length()).toFixed(1)} AU from Elys`
    }

    // ---- Hover label position ---------------------------------------------
    const h = telemetry.hover
    if (hovered && hovered !== f) {
      const data = WORLD_BY_ID[hovered]
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
