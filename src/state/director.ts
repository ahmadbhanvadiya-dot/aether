import { Color, Vector3 } from 'three'

/**
 * Palette as linear-space THREE colours. Hex values mirror DESIGN.md and the
 * CSS tokens in index.css.
 */
export const palette = {
  void: new Color('#02030A'),
  midnight: new Color('#070C22'),
  abyss: new Color('#132056'),
  ion: new Color('#5AB0FF'),
  violet: new Color('#8C6CFF'),
  sun: new Color('#FFF3E6'),
}

/**
 * A plain mutable object that GSAP tweens and `useFrame` reads.
 * Keeping per-frame values out of React means zero re-renders while the
 * cinematic plays.
 */
export const director = {
  /** 0 → far away, 1 → settled in orbit framing */
  arrival: 0,
  /** 0 → sun hidden directly behind Vael, 1 → final crescent angle */
  sun: 0,
  /** Starfield + nebula brightness, 0 → 1 */
  sky: 0,
  /** 0 → orbit framing, 1 → low-orbit horizon shot */
  dive: 0,
  /** Letterbox bars: 1 → closed to 2.39:1 (camera is directing), 0 → open */
  letterbox: 1,
  /** HUD, orbit ring and labels, 0 → 1 */
  hud: 0,
  /** Which world the camera is in. Only the active space renders. */
  space: 'vael' as 'vael' | 'galaxy',
  /** Warp jump intensity: streaks, FOV kick. 0 → 1 */
  warp: 0,
  /** Galaxy approach after the jump: 0 → far, 1 → settled overview */
  galaxyIntro: 0,
  /** Shifts the frame so a focused world clears the info panel. 0 → 1 */
  panelShift: 0,
  /** Scene clock that stops when motion is paused */
  time: 0,
}

/** World positions of labelled bodies, written by the scene every frame. */
export const labels = {
  ithra: new Vector3(),
}

/** Normalised pointer position, −1…1, written by a window listener. */
export const pointer = { x: 0, y: 0 }

/** Values the 3D scene reports back for the HUD (read in rAF, not React). */
export const telemetry = {
  altitudeKm: 0,
  /** Second HUD line, written by whichever camera rig is active. */
  readout: '',
  /** Hovered world's projected screen position in CSS pixels. */
  hover: { x: 0, y: 0, visible: false, radiusPx: 0 },
  /** Ithra's projected screen position in CSS pixels. */
  ithra: { x: 0, y: 0, visible: false },
}

/** Vael's radius in km — 1 scene unit. */
export const PLANET_RADIUS_KM = 6_820

/** Where the sun starts (eclipsed) and ends (crescent over the top limb). */
export const SUN_START = new Vector3(0.02, 0.12, -1).normalize()
export const SUN_END = new Vector3(0.24, 0.72, -0.62).normalize()
