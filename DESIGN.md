# AETHER — Design System

**The source of truth for AETHER.** Every value below was read from the source code on
2026‑11‑19. Phases 1–4 are live at <https://ahmadbhanvadiya-dot.github.io/aether/> (merge
commit `f34cd14`); the journey choreography (§8) is in the working tree and not yet
deployed. Product context lives in `PRODUCT.md`. When code and this document disagree, fix one of them in the same change.

Status labels used throughout:

- **Implemented** — in the code.
- **Planned** — a rule or intention for a future phase. Nothing in the code yet.

---

## Contents

1. [Foundations](#1-foundations) — subject, color, type, layout, motion, accessibility, principles
2. [Phase 1 — Arrival](#2-phase-1--arrival) (Implemented)
3. [Phase 2 — Galaxy](#3-phase-2--galaxy) (Implemented)
4. [The six worlds](#4-the-six-worlds) (Implemented)
5. [Interaction](#5-interaction) (Implemented)
6. [Phase 3 — Planet exploration](#6-phase-3--planet-exploration) (Implemented)
7. [Phase 4 — The Observatory](#7-phase-4--the-observatory) (Implemented)
8. [The journey — camera choreography](#8-the-journey--camera-choreography) (Implemented)
9. [Technical architecture](#9-technical-architecture) (Implemented)
10. [Rules for future work](#10-rules-for-future-work) (Planned)
11. [Known limitations](#11-known-limitations)
12. [Decision log](#12-decision-log)
13. [Roadmap](#13-roadmap)

---

## 1. Foundations

### Subject, audience, job

- **Subject** — an invented, plausible universe. Not sci‑fi chrome, not a product.
- **Audience** — people who opened the link to be transported: designers, space fans,
  curious visitors on desktop and phone.
- **Job of the experience** — make one unforgettable image (Phase 1), then let the visitor
  travel through a living system of worlds (Phase 2) without the interface ever competing
  with the scene.

### Color

| Token        | Hex       | Role |
|--------------|-----------|------|
| `void`       | `#02030A` | The page and deep space. Blue‑black, never neutral grey. |
| `midnight`   | `#070C22` | Nebula floor, planet night side, overlay fades. |
| `abyss`      | `#132056` | Deep ocean, lowest nebula light. |
| `ion`        | `#5AB0FF` | Electric blue. Atmosphere scattering, focus ring, live data. |
| `violet`     | `#8C6CFF` | Night‑side airglow, nebula, the button's edge light. |
| `starlight`  | `#E9EDF9` | Primary text and star cores. |
| `haze`       | `#8A93B8` | Secondary text. ~6.8:1 on `void`. |

Defined in `src/index.css` (`@theme`, used as Tailwind colors) and mirrored as linear
THREE colors in `src/state/director.ts` (`palette`, plus `sun: #FFF3E6`).

Rules:
- Blue and violet are **light**, not paint. They appear where something emits or scatters
  (atmosphere, airglow, focus, hover) — never as flat fills or gradient washes on panels.
- No pure white surfaces. The brightest pixels belong to sunlit limbs, Elys, and a few stars.
- **World accents (Phase 2).** Each world has one accent color (see §4). It may appear only
  as: the 5–6px dot beside its name (index and panel), its dotted orbit, and its
  atmosphere/hover rim light. Never as text color, button fill or background.

### Type

- **Display — Italiana** (`@fontsource/italiana`). A thin, high‑contrast roman. Used for
  names only: the AETHER wordmark, world names (panel and hover label), and Ithra's label.
- **Text — Manrope Variable** (`@fontsource-variable/manrope`). Everything else.

| Role | Size | Tracking | Weight / face | Where |
|------|------|----------|---------------|-------|
| Wordmark | `min(13.5svh, 15.5vw)` | `0.26em` (`0.15em` below 4:5 aspect) | Italiana | `.wordmark` |
| World name, panel | `clamp(2.6rem, 4.4vw, 4.2rem)` (sheet: `clamp(2.2rem, 9vw, 3rem)`) | `0.16em` | Italiana | `.world-panel-name` |
| World name, hover label | `1.35rem` | `0.14em` | Italiana | `GalaxyUI` |
| Ithra label | `1.15rem` | `0.06em` | Italiana | `OrbitLabel` |
| Tagline | `clamp(1rem, 1.4vw, 1.3rem)` | `0.04em` | 300 | title |
| Panel body | `0.95rem` / 1.65 (sheet `0.875rem`) | — | 300 | `.world-panel-copy` |
| Facts | label `0.75rem` haze, value `0.9rem` | — | 400 | `.world-facts` |
| World index | `0.75rem` | `0.18em` | 500 | `.world-index-item` |
| Enter button | `0.8125rem` | `0.22em` | 500 | `.enter-button` |
| HUD / readouts | `0.8125rem` | `0.01em` | 400 | `.hud-corner` |
| Prelude line | `clamp(0.95rem, 1.2vw, 1.1rem)` | `0.03em` | 300 | `.prelude-line` |
| Location title card | `clamp(2.6rem, 6.4vw, 5.6rem)`; region `clamp(0.95rem, 1.2vw, 1.1rem)` | `0.1em` | Italiana / 300 | `.title-card` |
| Location name, panel | `clamp(2rem, 3vw, 2.8rem)` (narrow `1.7rem`) | `0.06em` | Italiana | `.location-name` |
| Location lore / hint | `0.92rem` / 1.65 (narrow `0.85rem`) | — | 300 | `.location-copy` |

All‑caps appears only where the content itself is a proper name in caps (`ENTER UNIVERSE`
per the Phase 1 brief, and the six world names, which are defined in caps in
`data/planets.ts`). No eyebrow labels, no accented single words, no monospace data.

### Layout and the HUD

- Side gutter `--gutter`: 24px, 40px from 768px wide, always plus `env(safe-area-inset-*)`.
- The HUD lives in four corners and never moves into the centre of the frame:

| Corner | Content |
|--------|---------|
| Top‑left | Eclipse mark (SVG). In galaxy overview, **Return to Vael** beside it. |
| Top‑right | **Observatory** (Phase 4; galaxy and surfaces), **Pause motion**, **Sound** (Phase 3) and **Hide interface** buttons (labels hidden below `sm`; Sound's below `lg`). In the Observatory, top‑left shows **← Galaxy**. |
| Bottom‑left | Status line (`aria-live`) + live readout; in the galaxy and on surfaces a third line, "N of 18 discoveries". |
| Bottom‑right | One contextual hint. |

Status and hint text by state (`ui/Hud.tsx`):

| State | Status | Readout | Hint (mouse / touch) |
|-------|--------|---------|----------------------|
| Arriving | Approaching Vael | Altitude N km | Move the cursor to drift / Drag to look around |
| Title | Now orbiting Vael | Altitude N km | same |
| Warping out | Leaving Vael's orbit | Vael altitude, then N AU from Elys after the jump | Vael hint (galaxy hints appear only in the `galaxy` phase) |
| Galaxy overview | The Aether system | N AU from Elys | Drag to rotate, select a world / Drag to rotate, tap a world |
| World focused | In orbit around NAME | Altitude N km | Drag to orbit, scroll to zoom / Drag to orbit, pinch to zoom |
| Returning | Returning to Vael | N AU from Elys, then Vael altitude after the jump | Vael hint |
| Descending (Phase 3) | Descending to NAME | Altitude above the world | — |
| Surface (Phase 3) | Exploring NAME | Altitude N m (gas worlds: Above the cloud tops N m) | Drag to look around, select / tap the signal (once found: Drag to look around) |
| Ascending (Phase 3) | Returning to orbit | Surface altitude, then orbital altitude | — |
| Observatory (Phase 4) | The Observatory (corner hidden) | — | hidden: the ledger replaces both bottom corners |
| Paused (any) | — | — | Motion paused |

While a world's panel is open as a bottom sheet (narrow screens, galaxy only), both bottom HUD
corners hide. Below 480px wide the bottom‑right hint is hidden entirely.

### Motion

Philosophy (unchanged since Phase 1): **one orchestrated sequence per transition, then
stillness with life in it.** The camera "directs" during transitions (letterbox closed);
the visitor has control the rest of the time (letterbox open).

| Token | Value | Use |
|-------|-------|-----|
| `uiOut` / `--ease-out-ui` | `cubic-bezier(0.23, 1, 0.32, 1)` | Every UI entrance and exit |
| `power4.out` | GSAP | Long camera approaches (arrival, galaxy intro) |
| `power3.inOut` | GSAP | Sun swing; Phase 1 – 2 sequences |
| `approach` · `cruise` · `entry` · `glide` · `climb` | `scene/motion.ts` | Every camera move of the journey (§8) |
| `power2.in` / `power3.in` | GSAP | Only for the camera *accelerating into* a warp — never on UI |
| `ease` 180–300ms | CSS | Hover / color changes |

Rules:
- UI never uses ease‑in. Exits use the same `uiOut` curve and leave the way they came.
- Letter stagger 60–70ms; group stagger 80–120ms.
- Hover motion is gated behind `@media (hover: hover) and (pointer: fine)`.
- Rapidly repeatable UI (panel, index, hover label) uses CSS transitions, not keyframes, so
  it can be interrupted. The panel *content* uses a one‑shot `panel-in` keyframe because it
  re‑mounts per world.

### Accessibility and reduced motion

Implemented:

- `prefers-reduced-motion: reduce` is read once at load (`useExperience.reducedMotion`):
  - Arrival: no dolly; sky and sun fade (1.4s); text fades in place; letterbox starts open.
  - Warp (both directions): no dive, streaks or FOV kick — a 0.5s / 0.7s veil crossfade.
  - Camera travel: 0.7s `power1.inOut` instead of up to 3.4s; panel shift 0.5s.
  - Off: pointer drift, star twinkle, shooting stars, OrbitControls auto‑rotate.
  - CSS: panel and index lose their transforms (fade only); `panel-in` becomes fade‑only;
    the button's orbiting edge light stops.
- **Pause motion** button (visible to everyone, `aria-pressed`): freezes the scene clock
  (`director.time`), so orbits, spins, clouds, Ithra, twinkle phases, Nyx's pulse, Vesper's
  lightning and shooting stars stop; auto‑rotate and pointer drift stop. User‑initiated
  transitions (warp, travel) still complete.
- Phase 3 reduced motion: descent, ascent and travel between locations become short
  crossfades through the in‑scene haze (about 1.2s); lightning flashes are off; signal pings
  hold still; motes drop to 40%. No FOV breathing, near dust, bank or surface drift (§8).
- Phase 4 reduced motion: no letterbox; the rise to the dial takes 0.6s and the dial snaps to
  the selected world; reveals and new timeline entries fade only.
- Every interactive 3D object has a DOM equivalent: the world index (buttons, keyboard
  focusable, focus highlights the world) and panel buttons with `aria-label`s.
- Keyboard: `H` hide interface and `M` sound, anywhere; in a focused world `Esc`, `←`, `→`;
  on a surface `Esc` returns to orbit and `←` / `→` fly between locations; `O` opens the
  Observatory from the galaxy or a surface, and in it `Esc` / `O` close and `←` / `→` turn
  the dial. Shortcuts appear in
  the buttons' `title` tooltips.
- Visible focus: 1px `ion` outline (offset 5px on the Enter button, 3px on quiet buttons).
- Live regions: HUD status (`aria-live="polite"`) and the world panel.
- The wordmark is an `<h1 aria-label="Aether">`; its letter spans are `aria-hidden`.
- Hidden UI is removed from the tab order (`tabIndex=-1`) and from pointer events.

### Principles

1. **Light is the accent.** Color comes from emission and scattering, not decoration.
2. **One image, held.** Each screen is a single composition, built in one sequence, then
   left alone.
3. **Quiet interface.** Hairline borders, no glass panels, no cards. Panels are type on a
   scrim that fades into space.
4. **Earned detail.** Readouts say something true about the scene (altitude is computed from
   the real camera distance; AU is computed from distance to Elys), or they don't exist.
5. **The camera directs, then hands over.** Letterbox closed = watch. Letterbox open = explore.
6. **Everything procedural.** No texture downloads. Every surface, star and nebula is
   generated on the GPU, baked once where possible.

---

## 2. Phase 1 — Arrival

**Status: Implemented.**

### The one bold idea

**The planet frames the words.** Vael is lit from behind and above (`SUN_END`
≈ `(0.24, 0.72, −0.62)`), so most of its disc is in shadow and a crescent burns along the
upper limb. The atmosphere glows all the way around. The wordmark, tagline and Enter button
sit inside the dark disc, framed by the ring. Ithra's dotted orbit encircles the title like
an orrery.

```
 desktop                                        mobile
┌──────────────────────────────────────────┐   ┌───────────────┐
│ ◐                   Pause  Hide interface│   │ ◐       ⏸  ◎  │
│     .  .  .   .-~~~~~~~~-.   .  .  .     │   │ .  .-~~~~~-. .│
│   .        .'  ‿‿ lit ‿‿  '.        .    │   │  .'  ‿lit‿  '.│
│  .        :  A E T H E R   :         .   │   │ : AETHER     :│
│  .        :  Beyond the known.       .   │   │ :Beyond the k.│
│   .        '. [• ENTER UNIVERSE]    .    │   │ '[•ENTER UNI]'│
│  ○ Ithra    '-.____________.-'  .        │   │   '-.____.-'  │
│ Now orbiting Vael     Move the cursor to │   │Now orbiting   │
│ Altitude 29,820 km                 drift │   │Altitude 39,49…│
└──────────────────────────────────────────┘   └───────────────┘
```

- The camera distance is computed from the viewport (`CameraRig.framingDistance`) so the
  planet's disc fills **62% of the height** on landscape screens and **80% of the width** on
  tall screens, using the base FOV (34°, or 44° below 0.8 aspect).
- The type is sized in `svh`/`vw` to stay inside the dark part of the disc.

### Vael and its environment

| Layer | Implementation (file) | Notes |
|-------|----------------------|-------|
| Surface | 8‑octave domain‑warped fBm + ridges baked once into a 4096×2048 half‑float equirect texture (2048×1024 low tier) under the prelude; albedo + finite‑difference normals from the texture; ocean glint (pow 160); terminator tint; bioluminescent night coastlines (`scene/Planet.tsx`, `shaders/planet.ts`) | Axial tilt 0.36 rad; rotates 0.0175 rad/s (~6 min per turn) |
| Clouds | Sphere ×1.008, live fBm (5 octaves, 3 low), wrap lighting, silver lining when backlit | Transparent, no depth write |
| Atmosphere | Back‑face shell ×1.09, additive. Glow is a function of each view ray's closest approach to the centre, so the limb stays thin from any distance | Intensity `0.3 + 0.9 × sky` |
| Sun | One direction, slerped from `SUN_START` (eclipsed) to `SUN_END` by `director.sun` (`scene/sun.ts`) | Shared by surface, clouds, atmosphere, Ithra |
| Ithra | Moon r 0.07 on an orbit of 1.78 planet radii, tilted (1.18, 0, −0.22) rad, 240s period; 180‑dot orbit with a fading wake (`scene/Ithra.tsx`) | DOM leader‑line label (`ui/OrbitLabel.tsx`), hidden near HUD corners |
| Dust | 650 near particles (260 low tier) | Vael space only |
| Stars* | 6,500 points (2,800 low) on shells 70–400u, power‑law size, 5 color temperatures, twinkle | Shell follows the camera (stars at infinity) |
| Deep field* | 70 distant elliptical galaxies (34 low) | Follows the camera |
| Shooting stars* | One streak every 14–38s (the first ~9s after the sky is fully up) | Off when paused/reduced, during dive or warp |
| Nebula* | Directional fBm baked once into a 1024² cube map (512² low) used as `scene.background` | Fades with `director.sky` |
| Post* | Bloom (mipmap, intensity 0.85, threshold 0.42, radius 0.78), vignette (0.28/0.72), noise (screen, 0.22), ACES tone mapping; MSAA ×4 high tier | `scene/Experience.tsx` |

\* Shared by both spaces (Vael and galaxy).

### Arrival choreography

Prelude: black, "Receiving signal from Vael" and a load count. The count is real: 35%
when fonts are ready, 100% when the scene has rendered three frames (all bakes and shader
compiles happen before that). Then the line dissolves (0.7s blur, after a 0.75s hold) and the
black lifts (0.6s). `t = 0` below is 0.3s into the black lifting, so the sky starts
brightening underneath it.

| t (s) | Beat | Curve |
|-------|------|-------|
| 0 – 2.4 | Stars, nebula and galaxies fade up (`director.sky`) | `power2.out` |
| 0 – 6.2 | Camera approach on a curved path; dust streams past the lens (`director.arrival`) | `power4.out` |
| 0.5 – 4.7 | Sun swings out from behind Vael: ring first, then crescent (`director.sun`) | `power3.inOut` |
| 2.5 – 3.9 | Wordmark letters resolve from blur 14px / +0.2em, 70ms stagger | `uiOut` |
| 3.4 – 4.5 | Tagline | `uiOut` |
| 3.7 – 4.8 | ENTER UNIVERSE (also scales 0.97 → 1) | `uiOut` |
| 4.1 – 5.4 | Letterbox opens — you have control | `uiOut` |
| 4.3 – 5.5 | HUD corners, 80ms stagger | `power1.out` |
| 4.5 – 6.1 | Ithra's orbit and label (`director.hud`) | `power1.out` |

After arrival: Vael rotates, clouds drift, stars twinkle, Ithra orbits. The camera follows
the pointer with a damped ease (`MathUtils.damp`, λ 2.2; 4 on touch), at most ±0.34 × 0.22
units at framing distance, with a slight roll. On touch, one finger drags the view and it
eases back on release.

### References — what we took, and how we changed it

AETHER borrows *ideas*, never layouts, assets or copy.

| Reference | Strongest idea | AETHER's version |
|-----------|----------------|------------------|
| **Equinox** (Little Workshop) | Narrative first, cinematic framing, one‑finger touch mode | Letterbox bars frame every moment the camera is *directing* (arrival, warp) and retract when control is handed to you. On touch, drag with one finger. |
| **Outreach** (Rocani) | Typography on pure black before the world appears | The prelude: one quiet line on black with a real load count, then the void opens into stars. |
| **Space Portfolio** (Allan Pinot) | Dotted orbital rings, labels on leader lines, an orrery you travel through | Ithra's dotted orbit around the title; in Phase 2, every world's dotted orbit and its leader‑line hover label. |
| **Galaxy Explorer** | Deep‑field richness, rare ambient events, cinema mode, FPS watchdog, a bottom strip of destinations | Distant galaxies, rare shooting stars, *Hide interface*, adaptive resolution; in Phase 2, the world index along the bottom. |

What we deliberately did **not** take: HUD frames and scanlines, the illustrated cel look,
labelled‑everything density. AETHER stays photographic and quiet.

---

## 3. Phase 2 — Galaxy

**Status: Implemented.**

ENTER UNIVERSE no longer leads to a holding shot. It skims Vael's lit limb, jumps to warp,
and drops the visitor into **the Aether system**: the star **Elys** and six worlds on
dotted orbits, inside a spiral galaxy. **Return to Vael** reverses the jump.

### Composition

```
 galaxy overview (desktop)
┌────────────────────────────────────────────────────┐
│ ◐  ↶ Return to Vael              Pause  Hide interf│
│   ✺ galactic core                                  │
│   (far, lower‑left)        ○ ORION (rings)         │
│          . · ˙ ˙ · .  ˙ · . dotted orbits  · .     │
│      ·  ·    ◦       ✹ Elys      ◦          ·      │
│       ˙ ·  ◦       ◦       ◦             · ˙       │
│           ˙ · . . · ˙ ˙ · . . · ˙                  │
│   • AURELIS • NYX • SOLARA • VESPER • THALASSA • ORION │
│ The Aether system            Drag to rotate, select│
│ 6.2 AU from Elys                           a world │
└────────────────────────────────────────────────────┘
```

- **Elys** sits at the world origin. It is the only light source for all six worlds: every
  world shader computes `L = normalize(uSunPos − worldPos)` with `uSunPos = (0,0,0)`. No
  three.js light objects are used.
- **Orbits** lie close to one plane (inclinations ≤ 0.035 rad) so the system reads as a
  disc from the default view, and each world's dotted orbit traces it.
- **The spiral galaxy** surrounds the system: its core is far away to the lower‑left
  (group at `(−250, −70, −330)`, rotated `(0.42, 0.6, 0.18)`), so its arms sweep across the
  sky behind the system and parallax as you rotate. This is what makes the system feel
  embedded in something enormous.

### Scale and positions (from `data/planets.ts`)

Scene units; Elys radius 2.4. Display scale is arranged for readability, not physics.

| World | Orbit radius | Body radius | Orbit period (scene s) | Inclination | Axial tilt | Spin (rad/s) | Start phase |
|-------|-------------|-------------|------------------------|-------------|-----------|--------------|-------------|
| AURELIS | 10 | 0.78 | 80 | 0.02 | 0.41 | 0.09 | 0.6 |
| NYX | 14.5 | 0.62 | 130 | −0.035 | 0.12 | 0.05 | 2.4 |
| SOLARA | 19.5 | 0.88 | 190 | 0.03 | 0.29 | 0.11 | 4.3 |
| VESPER | 25 | 0.96 | 260 | −0.02 | 0.05 | 0.03 | 1.4 |
| THALASSA | 31 | 1.05 | 340 | 0.025 | 0.33 | 0.08 | 3.3 |
| ORION | 41 | 2.3 (rings to 5.4) | 480 | −0.015 | 0.47 | 0.14 | 5.4 |

Position each frame (`scene/galaxy/World.tsx`): `angle = phase − (time / period) × 2π`,
`(cos, 0, sin) × orbitRadius`, inside a group rotated by the inclination about X. Inner
worlds visibly move; Orion takes 8 minutes per orbit. All motion uses `director.time`, so
**Pause motion** freezes the whole system.

### Elys (`scene/galaxy/Star.tsx`)

- Photosphere: sphere r 2.4, two‑scale animated fBm granulation (4 octaves), limb darkening,
  warm‑to‑hot color, HDR output (≈ 2.6–5×) so bloom produces its glow.
- Corona: camera‑facing plane 21.6 units wide (9 × radius), radial falloff with slowly
  turning 7‑fold streamers, color `#FFD9A0` × 1.6, additive, depth‑tested so worlds occlude it.

### Environment

- Shared with Vael: starfield, deep‑field galaxies, shooting stars, nebula background, post
  stack (see §2).
- Galaxy only — **spiral galaxy** (`scene/galaxy/SpiralGalaxy.tsx`): 70,000 points
  (26,000 low tier), radius 360, 4 arms with a twist of 3.4π across the radius, 16% in a
  spherical bulge. Colors: core `#FFE0B5` → arms `#A9C2FF`; 7% violet‑tinted, 5% pink
  star‑forming specks. Size‑attenuated soft points; rotates 0.002 rad/s; brightness
  `0.35 + 0.65 × galaxyIntro`.
- Vael's dust is hidden in the galaxy.

### Galaxy navigation

| Input | Overview | Focused world |
|-------|----------|---------------|
| Drag | Rotate around Elys | Orbit around the world |
| Scroll / pinch | Zoom, 16–220 units | Zoom, radius × 1.7 (Orion × 2.9) to radius × 16 |
| Pan | Disabled | Disabled |
| Idle | Auto‑rotate 0.18 | Auto‑rotate 0.35 |
| Hover a world | Name + teaser label; orbit brightens; surface rim light | Same, for other worlds |
| Click / tap a world | Fly there | Fly to the new world |
| Index button | Fly there | (index hidden) |

OrbitControls settings: damping 0.065, rotate speed 0.45, zoom speed 0.75, polar angle
limited to 0.15 … π − 0.15. Auto‑rotate is off when motion is paused or reduced.

---

## 4. The six worlds

**Status: Implemented.** All six share one pipeline (§9) and differ through a *kind* recipe
in the bake and surface shaders (`scene/galaxy/shaders.ts`), plus per‑world data.

| World | Kind | Accent | Atmosphere day / night | Shell | Clouds | Rings |
|-------|------|--------|------------------------|-------|--------|-------|
| AURELIS | terrestrial | `#6FB6FF` | `#6FB6FF` / `#4A3FA8` | ×1.10 | `#F4F7FF`, 0.85 | — |
| NYX | dark | `#8C6CFF` | `#7C5CFF` / `#3A2A8A` (intensity 0.35) | ×1.05 | — | — |
| SOLARA | desert | `#F2B66B` | `#F2B66B` / `#7A3E5A` | ×1.07 | dust `#E9C38E`, 0.35 | — |
| VESPER | cloud | `#B48CFF` | `#C9A2FF` / `#5B3BB0` (intensity 1.35) | ×1.16 | (is the cloud) | — |
| THALASSA | ocean | `#46D2E6` | `#46D2E6` / `#2A4FA8` | ×1.10 | `#F2FBFF`, 0.9 | — |
| ORION | giant | `#E8C79A` | `#F0D2A6` / `#6B4A7A` | ×1.05 | — | ×1.35 – ×2.35 |

### AURELIS — Blue terrestrial world

- **Identity:** the gentlest world. Shallow blue seas, green‑gold continents, open clouds.
- **Material:** domain‑warped height field; sea level 0.03; ocean from `(0.004,0.03,0.09)`
  to `(0.03,0.17,0.32)`; lowlands green‑gold, highlands grey‑brown, polar ice above ~0.84
  latitude. Bump 0.07. Ocean specular.
- **Night side:** sparse warm settlement lights along coasts and lowlands.
- **Clouds:** baked into the texture's alpha, drifting at 0.006 per scene second, feathered edges.
- **Panel facts:** Radius 6,210 km · Day 26 hours · Year 341 days · Surface 14 °C ·
  Air Nitrogen, oxygen · Moons 1.

### NYX — Dark world

- **Identity:** reflects almost nothing; something underneath glows along its faults.
- **Material:** near‑black glassy basalt (albedo ~0.016–0.05), slight glassy sheen. Bump 0.05.
- **Emission:** thin fissure crests only (`smoothstep(0.62, 0.92)` of a sharpened vein field,
  plus finer secondary veins at 60%), colored between `violet` and `ion`, pulsing slowly;
  faint by day, brighter on the night side.
- **Atmosphere:** the quietest of the six (intensity 0.35).
- **Panel facts:** Radius 4,980 km · Day 61 hours · Year 612 days · Surface −140 °C ·
  Air Trace argon · Moons None.

### SOLARA — Golden desert world

- **Identity:** one desert from pole to pole under a copper sky.
- **Material:** dune crests (a warped sinusoid field), sand gold → ochre, rust canyons where
  ridged noise is high, pale salt flats in basins, small frost caps above ~0.9 latitude.
  Bump 0.06; soft terminator (wrap 0.05).
- **Dust storms:** a thin dust deck (opacity 0.35) drifting at 0.004.
- **Atmosphere:** warm gold by day, dusky rose at night.
- **Panel facts:** Radius 7,340 km · Day 19 hours · Year 902 days · Surface 48 °C ·
  Air Thin CO₂, dust · Moons 2.

### VESPER — Violet atmospheric world

- **Identity:** no visible surface; the planet *is* its cloud deck.
- **Material:** swirling cloud tops (strongly warped fBm, stretched along latitude) in deep
  violet, lavender and rose bands. No bump. Soft terminator (wrap 0.25).
- **Motion:** the cloud texture shears with latitude (`uv.x += t × 0.0025 × (1 + 0.35 cos 2φ)`)
  — superrotation.
- **Night side:** lightning — random cells on a 48×24 grid flash for a third of a second
  (`hash > 0.9965`), only where clouds are thick.
- **Atmosphere:** the thickest and brightest shell (×1.16, intensity 1.35).
- **Panel facts:** Radius 8,050 km · Day 5 days · Year 1,420 days · Surface 460 °C ·
  Air CO₂, sulfur haze · Moons None.

### THALASSA — Deep ocean world

- **Identity:** one ocean, scattered volcanic islands, wandering cyclones.
- **Material:** abyssal blue to teal currents (a warped current field); islands where the
  height field exceeds 0.3 (rare); strong, tight ocean specular (pow 110). Bump 0.06 on islands.
- **Night side:** faint teal bioluminescent currents, slowly pulsing.
- **Clouds:** the fastest deck (0.008), opacity 0.9.
- **Panel facts:** Radius 9,120 km · Day 31 hours · Year 2,180 days · Surface 22 °C ·
  Air Nitrogen, water vapour · Moons 3.

### ORION — Ringed gas giant

- **Identity:** the largest and outermost world, crowned with rings.
- **Material:** latitude bands (two interfering band frequencies plus turbulence) in brown,
  tan and cream, slate toward the poles; limb darkening; bands shear like Vesper's.
- **Great storm:** an amber spiral storm in the southern belt at texture position
  `(0.62, 0.33)`.
- **Rings:** a 192‑segment ring in the equatorial plane from 1.35 to 2.35 planet radii;
  procedural density bands with a Cassini‑like gap at 60–67% of the width; colors `#E9DCC4`
  / `#A89880`; **the planet's shadow falls across the rings**; brighter when backlit
  (forward scattering).
- **Panel facts:** Radius 61,400 km · Day 10 hours · Year 4,310 days · Cloud tops −150 °C ·
  Air Hydrogen, helium · Moons 27.

### Information panel (all worlds)

Content, top to bottom (`ui/GalaxyUI.tsx → InfoPanel`):
1. Ordinal line — "First … Sixth world from Elys" (haze, 0.8125rem). This is a real sequence
   (orbital order), so ordinal wording is allowed here.
2. Name — Italiana.
3. Accent dot (with a soft glow in the accent) + classification.
4. Description — 2–3 sentences, max 40ch.
5. Facts — a `<dl>` of six label/value pairs with hairline top borders, 2 columns (3 in the sheet).
6. Actions — Previous world, Next world, **Return to galaxy**.

Layout:
- Desktop / wide: a right‑hand column `clamp(380px, 40vw, 480px)` on a scrim gradient
  (`void` at 88% → transparent), vertically centred. **No card, no border, no blur.**
- Narrow (≤ 900px wide or ≤ 9:10 aspect): a bottom sheet, max 58svh, scrollable, scrim from
  the bottom; the camera frames the world above it.
- Opens 250ms after selection (so the camera leads), 420ms fade / 520ms slide in `uiOut`.
  Content re‑mounts per world with `panel-in` (600ms).

---

## 5. Interaction

**Status: Implemented.**

### The warp (Vael ⇄ galaxy)

Out — ENTER UNIVERSE (`ui/TitleScreen.tsx → enter`), from click:

| t (s) | Beat |
|-------|------|
| 0 – 0.6 | Letters exit in reverse (40ms stagger from the end, blur 10px, −0.12em); tagline and button exit 0.45s; Ithra fades (`hud → 0`). If the arrival was still playing, it finishes over 1.2s. |
| 0 – 0.9 | Letterbox closes — the camera takes over. |
| 0.1 – 1.8 | Camera skims toward the lit limb (`dive 0 → 0.42`, `power2.in`). |
| 0.9 – 2.1 | Warp builds (`warp 0 → 1`, `power3.in`): streaks, FOV +32°. |
| 1.9 – 2.15 | Light flash (veil to 0.9). |
| **2.15** | **Space switches to galaxy** (camera placed far out). |
| 2.2 – 3.3 | Flash fades. |
| 2.2 – 4.2 | Warp decays (`power3.out`). |
| 2.15 – 6.35 | Galaxy approach (`galaxyIntro 0 → 1`, `power4.out`): from 3.8× overview distance, swinging 0.9 rad and descending 30u. |
| 4.0 – 5.3 | Letterbox opens. |
| 6.35 | Phase `galaxy`: galaxy UI fades in (600ms). |

Back — **Return to Vael** (`returnToVael`): any focus is cleared; letterbox closes;
the camera recedes from wherever you are (`galaxyIntro 1 → 0.55`, `power2.in`); warp builds
at 0.6s; flash at 1.5s; **switch at 1.75s** with Vael's camera at `arrival 0.35`; warp
decays; Vael's approach completes by 5.55s; letterbox opens at 3.9s; title returns at 3.2s,
tagline and button at 3.7s, Ithra at 3.9s.

Warp streaks (`scene/Warp.tsx → WarpStreaks`): 1,400 line segments (600 low tier) in a
camera‑space tunnel, 120 units deep, rushing at 140 u/s, tails stretched by `warp`,
color `#BFD8FF`. Drawn only while `warp > 0.005`.

### Planet selection

- **Hover** (mouse): R3F pointer events on an invisible hit sphere per world, radius
  `max(radius × 1.6, 1.5)`, so small far worlds are easy to hit. Sets `hovered`, pointer
  cursor, brightens that orbit to 0.95, adds a rim light to the surface, and shows the hover
  label: a leader line from the disc's upper‑right edge, name + teaser, flipping to the left
  when the world is in the right 36% of the screen.
- **Click / tap**: sets `focus`. Ignored if the pointer moved more than 6px (a drag) or
  outside the `galaxy` phase.
- **World index**: hovering or keyboard‑focusing a name highlights that world exactly like
  pointer hover; activating it selects the world.

### Camera transitions (`scene/galaxy/GalaxyRig.tsx`)

- Every focus change starts a **travel** from the current camera pose (so changing your mind
  mid‑flight retargets smoothly).
- Destination for a world: offset from the world toward Elys and to the side —
  `normalize(0.62·toStar + 0.72·side + 0.3·up) × radius × 4.6` (5.6 with rings; × 1.5 on
  narrow screens) — a sunlit gibbous view. The destination is recomputed every frame, so the
  camera lands on a world that keeps orbiting.
- Path, aim, timing and momentum: see §8 (a Bézier that aims first, then accelerates and
  decelerates into orbit; `clamp(2.3 + d/38, 2.7, 4.6)` s).
- On arrival, the camera follows the world (it adds the world's movement every frame), and
  OrbitControls orbit around it.
- The frame shifts so the world clears the panel: a view offset of 17% of the width
  (landscape) or 26% of the height (narrow), tweened during the travel's deceleration.

### Planet navigation and return

- **Previous / Next** (panel buttons, `←` / `→`): step through orbital order, wrapping
  ORION ↔ AURELIS. Each step is a normal travel.
- **Return to galaxy** (panel button, `Esc`): travels back to the overview pose you left
  from (saved when you first focused a world), restores the index and closes the panel.
- **Return to Vael** (top‑left, overview only): the reverse warp above.

### Pause motion and Hide interface

- **Pause motion** — see §1 Accessibility. Label and icon swap (Pause/Resume motion);
  hint reads "Motion paused".
- **Hide interface** (button or `H`, anywhere) — cinema mode. Everything marked
  `.ui-hideable` (title, HUD corners, index, panel, Return to Vael) and all leader‑line labels
  fade out in 200ms, Pause motion included. Only the **Show interface** button stays, dimmed,
  so the visitor can bring the interface back.

---

## 6. Phase 3 — Planet exploration

**Status: Implemented** (not yet deployed).

From a focused world, **Explore NAME** takes the camera down through that world's atmosphere
to its surface. Each world is one continuous landscape with three locations on it; each
location has a landmark, a discovery signal and its own light and weather. Discoveries are
saved in the browser.

### The flow

```
galaxy focus ──Explore──▶ descent ──▶ surface (location A) ──fly──▶ location B ──fly──▶ C
      ▲                                     │
      └──────────── ascent ◀── Return to orbit / Esc
```

- The descent starts only from a focused world's info panel. It lands at the first location
  whose signal is not yet found (or the first location if all are found).
- The ascent always returns to the same world's focus view with its panel open, recomputing a
  sunlit view because the world kept orbiting while you were below.

### Descent (`ui/exploreDirector.ts → startDescent`)

On click, the surface mounts and compiles (two animation frames); then the entry, the space
switch inside the atmosphere haze and the landing glide run as one move (timings in §8).
Return to orbit (`startAscent`) climbs from wherever the camera is, switches inside the
haze and pulls back to the world's focus view; the phase becomes `galaxy` and the surface
unmounts.

### Surface environments

Every world shares one renderer (`scene/surface/SurfaceScene.tsx`) and differs by recipe
(`SURFACES` in `data/locations.ts`):

| World | Ground | Water | Sky | Weather / particles |
|-------|--------|-------|-----|---------------------|
| AURELIS | Continents, ridged mountains, beaches, rock on slopes, snow above ~95u | Yes | 1 moon; aurora and stars at night | Snow motes; cloud layer |
| NYX | Dark basalt, glassy sheen, violet / ion fissure lines (noise zero‑contours) | — | Stars | Rising ash embers |
| SOLARA | Dune field (warped sinusoid), canyon strata, salt flats that mirror the sky | — | 2 moons | Drifting dust |
| VESPER | Cloud deck (billows), vortex coloring inside the abyss | — | Storm towers on the horizon, lit by lightning | Haze motes; upper cloud layer; lightning |
| THALASSA | Mostly sea floor; volcanic islands | Yes: waves up to storm swell, bioluminescent ribbons | 3 moons; stars at night | Spray motes; rain; lightning; cloud layer |
| ORION | Banded cloud deck, amber storm vortex | — | Ring system with the planet's shadow; 4 moons; aurora | Haze motes; cloud layer |

Technique:
- **Terrain**: a polar grid that follows the camera (200 rings × 320 segments, first ring 0.25u,
  ratio 1.029, about 2.6 km radius; low tier 140 × 200). Heights come from value‑noise fBm with
  a PCG integer hash, implemented identically in GLSL and TypeScript (`scene/surface/terrain.ts`),
  so the CPU knows the exact ground height for the camera, landmarks and signals. Normals use
  finite differences in the vertex shader. 1 unit = 10 m.
- **Location shaping**: each location blends the base terrain toward its own lift and roughness
  inside a Gaussian of its radius, then adds one set piece: `coast`, `crater`, `canyon`,
  `volcano`, `atoll` or `abyss`. This is what guarantees, for example, that the Glass Shelf's
  stacks stand in water and the Quiet Caldera has a floor below its rim.
- **Sky** (`skyFragment`): gradient, Elys's disc and glow, stars, lit moon discs, aurora curtains,
  Orion's rings (analytic, oriented to arch across each location's view), Vesper's storm towers.
  The same `skyBase()` colors all fog, so every horizon is seamless.
- **Ambient**: sky hemisphere light plus a night floor from starlight and aurora, so night scenes
  stay readable.
- **Water**: three directional waves (amplitude from `waves`), two‑scale ripples fading with
  distance, sky reflection with Fresnel, sun glint, depth color from the terrain height, shore foam.
- **Clouds**: a flat noise layer at `cloudHeight`, lit from above or below depending on the
  camera, faded when the camera passes through it.
- **Landmarks** (procedural kit, custom shader, no three.js lights): `spires` (sea stacks on
  Aurelis, leaning crystals on Nyx, salt crystals on Solara), `monolith` (Nyx slab, Aurelis ice
  cairn, Solara obelisk), `arch` (Rustgate), `geyser` (vent + rising plume).
- **Weather**: motes (1,400 / 560 low tier) wrapping around the camera; rain (2,600 / 1,000
  line streaks); lightning (random direction, double flicker, thunder 0.8–3s later).
- **Post**: bloom threshold rises to 0.82 on surfaces so only Elys and true emitters bloom
  against bright skies. The global starfield and deep‑field layers are hidden on surfaces.

### The 18 locations (`data/locations.ts`)

| World | Location | Region | Landmark | Light / weather |
|-------|----------|--------|----------|-----------------|
| AURELIS | The Glass Shelf | Northern coast | Sea stacks offshore, seen from a bluff | Low morning sun, clouds |
| | Halvard Ridge | Central highlands | Ice cairn | Night above the clouds, aurora |
| | The Sounding Lagoon | Equatorial reefs | Thermal vent inside an atoll | Noon, calm |
| NYX | The Vein Fields | Equatorial plains | Violet vent | Low sun, fissures bright |
| | Cathedral of Shards | Southern highlands | Crystal columns | Low sun |
| | The Quiet Caldera | Polar rim | Monolith on the crater floor | Night, full stars |
| SOLARA | The Amber Sea | Western dune sea | Half‑buried obelisk | Sunset, dust |
| | Rustgate Canyon | Southern badlands | Stone arch over the canyon floor | Midday |
| | The Salt Mirror | Eastern basin | Salt crystal spiral | Afternoon, mirror flats |
| VESPER | The Violet Abyss | Upper cloud deck | Signal above a gulf | Day, occasional lightning |
| | Thunderhead Choir | Night side | Signal in the open | Night, constant lightning |
| | The Rose Terraces | Dawn terminator | Signal over the terraces | Dawn |
| THALASSA | Ember Atoll | Western archipelago | Steam vent on a volcano | Dusk |
| | The Long Storm | Southern cyclone belt | Signal over the swell | Storm, rain, lightning |
| | Lantern Current | Eastern deep | Signal over glowing currents | Night, 3 moons |
| ORION | Ringrise | Equatorial cloud tops | Signal along the cloud tops | Day, ring arch overhead |
| | The Amber Eye | Great southern storm | Signal in the storm eye | Day, rings low on the horizon |
| | Polar Lanterns | Northern high latitudes | Signal under the ring arch | Night, aurora, rings |

Each location defines: name, region, `hint` (shown before discovery), `lore` (revealed on
discovery), `finding` (what the signal turns out to be), terrain shaping, camera position and
eye height, landmark, signal height, and a full environment (sun, sky colors, fog, stars,
aurora, lightning, rain, waves, glow, fissures, mirror, cloud height / cover / color, motes,
ring latitude).

### Location navigation

- **Location strip** (bottom centre, above the HUD lines): the three locations, each with a hollow
  ring (unfound) or a filled glowing dot (found) in the world's accent. Selecting one flies there.
- **Keyboard**: `←` / `→` fly to the previous / next location.
- **Flight** (`travelTo`): a Bézier from the current view to the destination over
  `clamp(3.8 + distance / 360, 4.4, 7.6)` s, facing the direction of travel and clearing the
  ground between (§8). The whole environment (sun, sky, fog, weather, clouds) blends along the
  way; a low swell plays; the title card shows on arrival (2.4s hold).
- **Look around**: drag (mouse or one finger) turns the view; the mouse position adds a slight
  parallax; a slow ambient drift runs unless motion is paused or reduced (§8).

### Discovery

- **The signal**: a pulsing core, two expanding rings (pings), and a tall light beam so it can be
  found from a distance. An invisible 8‑unit sphere makes it easy to hit.
- **Hover** shows a leader‑line label: "Unidentified signal" with "Select to investigate"
  (touch: "Tap to investigate", shown without hover); once found, the finding's name and
  "Discovered". Below 560px wide the label sits centred under the signal.
- **Select** (ignored after a drag of more than 6px or during a flight). On first discovery:
  chime; the signal blooms (rings × 4, core flare, 1.6s); the beam goes out; the location's lore
  replaces its hint (300ms `reveal-in`); its dots fill; a notification appears. Selecting an
  already‑found signal gives a small pulse only.
- **Notification** (`DiscoveryNotice`): bottom‑left above the status lines (higher on narrow
  screens); accent dot + "Discovered" + the finding + "N of 3 on WORLD, N of 18 in all"; 300ms
  `uiOut` rise of 8px; hidden after 5.6s; `role="status"`; hidden by Hide interface.

### Progress and persistence (`state/exploration.ts`)

- A Zustand `persist` store in localStorage, key `aether-exploration`: `discovered`
  (location id → timestamp) and `soundOn`; Phase 4 (version 2) adds `visited` and
  `observatorySeenAt` (see §7). Storage errors (private browsing, blocked storage)
  are caught; progress then lasts for the session.
- Per world: the world panel shows "Three signals unexplored" or "N of 3 signals found"; the
  location panel shows "N of 3 signals found on WORLD".
- Total: the HUD's third line, "N of 18 discoveries", in the galaxy and on surfaces.

### Sound (`audio/sound.ts`)

Synthesized with Web Audio; no files. The context is created on the first click (browser
autoplay rules).

| Sound | When | Build |
|-------|------|-------|
| Chime | First discovery of a signal | Three sine partials (E5, B5, E6), 2.6s decay, short feedback delay |
| Wind | Descent (sweeps up), ascent (sweeps down) | Band‑passed noise, 260 ↔ 1,400 Hz |
| Swell | Flights between locations | Two detuning triangle waves (110, 165 Hz) |
| Thunder | After each lightning flash | Low‑passed noise at 140 Hz, 3.2s roll‑off |

All are quiet (peak gain ≤ 0.09). The **Sound** button in the HUD and `M` toggle it; the
setting persists.

### Exploration interface

- **Return to orbit** (top‑left, beside the mark) and `Esc`.
- **Location panel**: a left column `min(400px, 36vw)` on a left scrim (narrow screens: a compact
  block under the top HUD row): region, name (Italiana), signal state, hint or lore, per‑world
  count.
- **Title card**: lower third, centred; hidden by Hide interface.
- The environment fills the frame; every element above is `.ui-hideable`.

### Measured performance

Forced frames on an RTX 3050 laptop at a 2000×1125 buffer: Solara (Amber Sea) 5.1 ms,
Aurelis (Glass Shelf) 5.9 ms, Thalassa (Long Storm, the heaviest: water, rain, full clouds)
9.7 ms. Not yet measured on a phone.

---

## 7. Phase 4 — The Observatory

**Status: Implemented** (deployed, merge commit `f34cd14`). The record of everything the
visitor has found. Product context (purpose, audience, constraints) is in `PRODUCT.md`.

### The one idea: the planisphere

The Observatory is not a separate screen laid over the galaxy. It is the galaxy, read from
above. Opening it raises the galaxy camera to the zenith over Elys, so the live system
becomes a **planisphere dial**: the real worlds on their real orbits, still turning, with a
graduated ring, a reading line and each world's three locations marked on its orbit. The
record sits beside the dial on wide screens and below it on narrow ones; the archive scrolls
on under both.

Rejected alternatives: a dashboard of stat tiles (banned in `PRODUCT.md` — statistics are
plain label + value lines), a card grid of worlds (unnecessary cards), and a 2D chart drawn
in SVG alone (it would duplicate the scene and drift from it).

### Entry and exit

| From | How | What happens |
|------|-----|--------------|
| Galaxy (overview or a focused world) | **Observatory** button (top‑right, first), or `O` | Letterbox closes; camera rises to the zenith (`director.observatory` 0 → 1, 2.8s `power3.inOut`); view shifts (`panelShift`, 2.2s); letterbox opens at 2.4s; the record reveals in a stagger |
| A surface | Same button, or `O` | `startAscent(then)` climbs to orbit first, then the Observatory opens on the world just left |
| Observatory → galaxy | **← Galaxy** (top‑left), `Esc` or `O` | Letterbox closes and reopens; the camera travels back to the overview pose saved at entry (`startGalaxyTravel(null)`) and comes upright |
| Observatory → a world | **Explore NAME** (record, world rows, empty timeline) | Travel to the world's focus view, then `galaxyCam.onArrive` starts the Phase 3 descent: one continuous move from the dial to the surface |

The world shown first is the focused world, else the most explored, else the last one
shown. Reduced motion: no letterbox; opening is a 0.6s `power1.inOut` move, closing uses the
0.7s reduced travel.

### Camera (`scene/galaxy/GalaxyRig.tsx`, mode `observatory`)

- Height above Elys: `H = 47 · (h/2) / (dialPx · tan(fov/2))`, so Orion's orbit fills the
  dial. `dialPx` = `min(0.4h, 0.27w)` on wide screens; `min(0.38w, 0.24h)` on narrow ones
  (≤ 900px or aspect < 0.9), the same value as `--obs-dial` in CSS.
- Position lerps from the entry pose to `(0, H, 0)` by `director.observatory`; the target
  lerps to the origin.
- **The dial turns.** `camera.up` eases (rate 0.05/frame; 1 when paused or reduced) toward
  the selected world's direction, blended in by `smoothstep(0.25, 1, k)`. The selected world
  therefore always sits on the screen‑right reading line. Travel out of the Observatory
  lerps `camera.up` back to +Y.
- View offset: wide screens shift the dial left of the record (`panelShift = 1`, 17% of the
  width). Narrow screens solve `panelShift` at open from the layout
  (`observatoryDirector.narrowShift`), centring Elys in the room the record leaves below the
  header.
- Each frame the rig writes `telemetry.chart`: Elys's screen position, each world's screen
  position and radius in px, and whether the chart is active.

### The dial (`ui/ObservatoryUI.tsx → Chart`)

An SVG and DOM layer positioned every frame from `telemetry.chart` (rAF, no React renders):

- **Ring**: Orion's orbit + 38px, hairline, drawn in on open (`pathLength = 1`).
- **Graduations**: 72 ticks, every 6th major (12px, else 5px), rotating with the dial.
- **Reading line**: dashed, from the ring + 18px to + 70px along the selected world's angle,
  pointing into the record.
- **Location marks**: three per world, 2.6px, 11px apart, trailing the world along its
  orbit; hollow until found, then filled in the world's accent.
- **Labels**: buttons with name + explored %. Hover highlights the world in the scene;
  click selects it. A label sits right of its world, clear of the disc (Orion: clear of its
  rings), and flips left instead of running into the record column or off the screen. On
  narrow screens labels sit on a `void` backing (0.62) so they read over crowded marks.
- Worlds in the scene are clickable too (they select rather than focus here). `←` / `→`
  step through the worlds.

### The record (first view)

Right column `clamp(360px, 33vw, 470px)` on a scrim; on narrow screens a single column under
the dial.

- **THE OBSERVATORY** (Italiana, `clamp(1.9rem, 2.5vw, 2.9rem)`, tracking 0.14em), subtitle
  "A record of everything discovered beyond the known.", and three text links (Worlds,
  Discoveries, Timeline) that scroll to the sections.
- **Reading**: the selected world's portrait (96px), name, accent dot + classification,
  teaser; facts as a 3‑column `<dl>` with hairlines — First landed (date or "Not yet"),
  Explored %, Locations "N of 3 found"; the three locations, each with its discovery date or
  "Not found"; **Explore NAME**; previous / next chevrons.
- **Ledger** (`<dl>`, same grammar): Worlds visited "N of 6", Locations discovered,
  Discoveries available (18), Exploration %, Most explored ("None yet", one name, or several
  names + "(tied)").

### The archive (scrolls under the dial)

The dial fades out as the archive scrolls over it (opacity follows scroll over 55% of the
viewport height).

- **The six worlds**: one row each — portrait (64px; 52px narrow), name, classification,
  teaser, Visited date, Explored %, Found "N of 3" — plus a separate **Explore** button. A
  row click selects the world and scrolls back to the dial. The selected row is tinted
  across its full width.
- **Discoveries**: all 18, grouped by world in a 3‑column grid (1 column narrow). Found:
  name, region, finding (Italiana), lore, accent dot + "Discovered" + date and time.
  **Not found: name, region, a hatched redaction bar where the finding would be, and the
  same hint the surface shows before discovery** — nothing a visitor could not already see
  in the world — plus "Not yet discovered".
- **Timeline**: every discovery, oldest first: date and time, accent dot on a hairline
  spine, location name, finding, region. Empty state: one sentence and an Explore button.

### New since your last visit

`observatorySeenAt` is stored on every opening. Entries newer than the previous opening are
marked "New since your last visit" and animate in: a 700ms `uiOut` rise from 10px and an
accent ping on the dot, staggered 90ms among the new entries only. They wait (hidden) until
the timeline is scrolled into view (IntersectionObserver, threshold 0.15), so the motion is
seen. A first visit marks nothing as new. Reduced motion: fade only, no ping.

### Thumbnails (`scene/galaxy/Thumbnails.tsx`)

Portraits are baked from each world's **live** materials (surface, clouds, atmosphere,
rings — registered in `galaxy.materials`), not from separate assets: once, on the first
opening, into a 192px render target with 4× MSAA, seen three‑quarter, half lit. Pixels are
read back, tone‑mapped through a small LUT, given an alpha matte derived from brightness
(so atmospheres and rings keep soft edges), and stored as data URLs in `useThumbs`. Until
they exist, portraits show a hairline circle.

### Data and persistence

- **One source of truth**: `useExploration` (`state/exploration.ts`), persisted as
  `aether-exploration`, **version 2**: `discovered` (location id → timestamp), `visited`
  (world id → first landing), `observatorySeenAt`, `soundOn`. `markVisited` runs whenever a
  surface is entered (descent or `?shot=` jump).
- **Migration 1 → 2**: a world's `visited` time is its earliest discovery; nothing else is
  invented.
- **No duplicate state**: every figure the Observatory shows is derived on render by the pure
  functions in `state/progress.ts` — `worldProgress`, `systemProgress` (worlds, worlds
  visited, found, total, percent, most explored with ties), `discoveryTimeline`, and
  `formatWhen` (`Intl.DateTimeFormat`, the visitor's locale). The HUD count and the
  Observatory read the same store.
- Only the selected world (`observed`, in `useExperience`) and the per‑visit timeline record
  are UI state.

### HUD while open

The status (bottom‑left) and hint (bottom‑right) corners hide — the ledger already says
everything they would, and they would sit over the archive. The top corners stay above the
Observatory's scrims (`z-index: 11`) and usable. Phase label: "The Observatory".

### Accessibility

- `Esc` closes, `O` toggles, `←` / `→` turn the dial. Every control is a real button;
  hidden controls leave the tab order.
- Labels are `aria-pressed`; world rows have `aria-label`s; dates are `<time datetime>`.
- The redaction bar is decorative; unfound entries say "Not yet discovered" in text.
- Reduced motion: see the entry table and the timeline above; the ring and reveals fade only.

### Verified

Tested in the dev build (desktop 1280×800 and phone 375×812 emulation): opening from the
galaxy and from a surface (ascent then dial), closing back to an upright overview, Explore
from the record and from a world row (travel → descent → surface, `visited` recorded),
selection by label, row and arrow keys, the "new" timeline flow across close / discover /
reopen, persistence across reloads, the v1 → v2 migration, no horizontal overflow on a
phone, and the reduced‑motion timings.

---

## 8. The journey — camera choreography

**Status: Implemented** (working tree; not yet deployed). Supersedes the Phase 2 and 3
camera timings: galaxy travel, descent, landing, location flights and the climb back out
were rebuilt as one continuous move. The rigs, director values and spaces are the same
(no new camera controller); the curves, paths and the hand‑over between spaces are new.

```
Galaxy ──approach──▶ orbit ──entry──▶ [haze: space switch] ──landing glide──▶ location
                       ▲                                                       │ flights
                       └──pull‑back◀── [haze: space switch] ◀──climb◀──────────┘
```

### What was wrong before

- The approach was a zoom: position and look‑at shared one `power3.inOut`, so the world slid
  across the frame instead of being found, then approached. Far stars move with the camera,
  so nothing near the lens gave a sense of speed, and re‑targeting started from rest.
- Entry hid behind a curtain: a flat CSS gradient went fully opaque while the scene swapped.
  The orbital camera looked straight down (no horizon), the surface camera started with a
  top‑down drop, and bloom snapped between spaces — two shots joined by a fade.
- Surfaces were almost static (a 0.012‑unit breathe).
- Flights could crab sideways (heading interpolated independently of the path) and kinked
  where a hard ground clamp kicked in.
- Leaving mid‑flight snapped the camera to the destination; several rates were per frame.

### Principles

1. **One clock, several curves.** Tweens drive a linear clock (`galaxyCam.t`,
   `surfaceCam.t`); the rigs shape it each frame, so orientation and position can follow
   different curves from the same time (aim first, then accelerate).
2. **Paths, not lerps.** Every move is a cubic Bézier or an orbit sweep whose end tangents
   match the motion before and after it.
3. **Continuity across the switch.** At the space switch both sides share horizon height,
   direction of travel, speed and haze colour; the switch happens inside a haze that is
   still sky, never a flat curtain.
4. **Momentum.** Every rig measures its velocity; a redirected move leaves at that velocity.
5. **Arrivals ease in.** Auto‑rotation, surface drift and pointer parallax ramp from zero
   after every arrival, so nothing starts at full strength.

### Eases and durations (`scene/motion.ts`)

| Name | Curve | Use |
|------|-------|-----|
| `approach` | `M0,0 C0.46,0 0.14,1 1,1` | Starts at rest: gentle acceleration, cruise, long deceleration (galaxy travel, flights) |
| `cruise` | `M0,0 C0.3,0.3 0.16,1 1,1` | Starts at unit speed (matches incoming velocity), then settles (redirected moves) |
| `entry` | `M0,0 C0.42,0 0.36,0.86 1,1` | Orbit → top of the atmosphere |
| `glide` | `M0,0 C0.24,0.52 0.3,1 1,1` | Arrives moving, decelerates to rest (landing, pull‑back) |
| `climb` | `M0,0 C0.5,0 0.72,0.42 1,1` | Lifts off slowly, leaves fast (hands speed to the pull‑back) |

| Move | Duration |
|------|----------|
| Galaxy approach | `clamp(2.3 + d/38, 2.7, 4.6)` s (redirected: down to `1.8·d/speed`, min 1.6 s) |
| Entry (orbit → air) | 4.4 s |
| Landing glide | 6.2 s |
| Surface flight | `clamp(3.8 + d/360, 4.4, 7.6)` s (redirected: down to `1.5·d/speed`, min 2.4 s) |
| Climb | 3.2 s |
| Pull‑back to orbit | 4.4 s |
| Reduced motion | haze in 0.5 s, out 0.7 s (flights 0.4 / 0.6 s) |

### 1 · Planet approach (`GalaxyRig`, mode `travel`)

- **Aim first.** The look‑at target moves from the old target to the world over the first
  34% of the clock (`smootherstep`), while the position, on `approach`, has barely begun.
- **Path.** Bézier from the current pose: the departure control leaves toward the
  destination blended with the current view, lifted off the orbital plane; the arrival
  control sits outward along the final orbit direction, so the camera arrives moving inward
  and decelerates into orbit. Controls are recomputed per frame against the live world.
- **Scale and speed.** Field of view widens by up to 4.5° with speed (`director.fovKick`,
  damped) and narrows again on arrival. **Near dust** (`SpaceDust`: 720 / 360 motes in a
  64‑unit box wrapped around the camera, additive, invisible at rest) streams past during
  travel, so far stars (fixed), the system (mid) and dust (near) move at three rates.
- **Arrival.** The frame slides clear of the panel during the deceleration (from 40% of the
  travel); OrbitControls auto‑rotation then eases in over ~3 s (`galaxyCam.settle`).
- **Redirect** (another world, or back, mid‑flight): the new leg leaves at the measured
  velocity on `cruise` — verified continuous (23 → 27 units/s across a redirect).

### 2 · Atmospheric entry (galaxy `descent` → surface `landing`)

| t (s) | Beat |
|-------|------|
| 0 – 0.9 | Letterbox closes; panel shift returns to centre (1.4 s). |
| 0.15 – 4.55 | **Entry** (`director.descent`, `entry`): the camera sweeps around the world toward the day side (up to 0.55 rad, never past local noon) while dropping from its orbit distance to 1.012 × radius. The view turns from the world's centre to the horizon ahead (`smootherstep` 0.32 – 0.94), looking 0.14 rad below the *visible* limb at every altitude (the limb's dip, `acos(R/r)`, is followed), and the camera's up turns to the local vertical — the horizon levels as the air thickens. |
| 0.4 | Wind (7 s). |
| 2.65 – 4.55 | Haze thickens to 1.15 (`power2.in`); cloud wisps start streaming. |
| **4.55** | **Space switch, inside the haze.** The surface camera begins 640 back and ~546 above the location, pitched 0.14 rad down — the same horizon height as the orbital view. |
| 4.55 – 10.75 | **Landing glide** (`director.landing`, `glide`): forward and down through the location's cloud layer, yaw settling 0.22 rad, pitch easing to the location's view, never closer than 14 units to the ground. |
| 4.6 – 7.6 | Haze thins (`power2.out`): the place appears through mist, then clears. |
| 8.35 / 9.15 | Title card; letterbox opens. Phase becomes `surface` at the end. |

### 3 · Exploration

- **Drift** (`free`): slow, incommensurate swells — lateral ±2 units (periods ~57 s and
  ~23 s), vertical ±0.6, fore‑aft ±1; yaw ±0.02 rad, pitch ±0.009 — from the scene clock, so
  Pause motion stops it. It eases in after every arrival (`surfaceCam.drift`) together with
  pointer parallax. Off for reduced motion.
- **Flights** (`travel`): Bézier leaving along the current heading and arriving along the
  destination heading (controls 32% / 42% of the distance), lifted so the midpoint clears
  the highest ground under the line by 34 units (24 samples), with a floor clamp as a
  backstop. The camera faces the path's heading — within ±5° while cruising, turning to the
  destination's framing only in the last part (`smoothstep` 0.86 – 1, at most ~16° off the
  path, at low speed). Up to 3° of bank into turns; field of view widens up to 3° at speed;
  light and weather blend across 10 – 90% of the path.
- **Redirect** mid‑flight: leaves at the current velocity on `cruise`.

### 4 · Return to orbit (surface `climb` → galaxy `ascent`)

| t (s) | Beat |
|-------|------|
| 0 – 3.2 | **Climb** (`surfaceCam.climb`, `climb`): from wherever the camera is — even mid‑flight, carrying that flight's velocity and bleeding it off (τ 0.8 s; verified 422 → 346 units/s, no jump) — rising and moving forward, the view settling onto the horizon (0.14 rad down). |
| 1.5 – 3.2 | Haze thickens to 1.15. |
| **3.2** | **Space switch.** The galaxy camera starts at 1.012 × radius on the entry path, looking at the horizon. |
| 3.2 – 7.6 | **Pull‑back** (`director.descent 1 → 0`, `glide`): the entry path in reverse to a fresh sunlit focus view — the limb, then the whole world, is revealed as the view turns back to the centre; haze clears in 1.5 s. |
| 6.0 / 6.4 | Panel shift returns; letterbox opens. Phase `galaxy`, focus and panel restored, camera upright. |

### The atmosphere layer (`scene/Atmosphere.tsx`)

A full‑screen quad drawn **inside** the scene (render order 1000, no depth), so bloom and ACES
tone mapping grade it like everything else. Density `director.atmo` (0 – 1.15).

- Colours: the world's limb in orbit (`atmosphere.day`, `atmosphere.night × 0.5`) blending
  into the location's sky (`horizon`, `zenith`) as it thickens; on the surface, the sky.
- Graded about the **true horizon line**: the camera's view direction flattened onto the
  local vertical (the world's radial direction in orbit, +Y on surfaces), tilted by the
  limb's dip, projected to the screen.
- Above the horizon: horizon → zenith. Below: a cloud deck deepening with depth. A bright
  scattering band at the horizon. Two cloud layers on perspective planes stream toward the
  camera at different rates (parallax inside the haze), lit and shaded.
- Thicker toward the horizon than overhead; at 1.15 it is opaque everywhere, but still sky.
- Bloom's threshold follows the haze (0.42 → 0.82), damped, so the bright haze never blooms
  into a flash and the switch is seamless.

### Interruption and cleanup

- Galaxy travel: `gsap.killTweensOf(galaxyCam)` and `panelShift` before each leg; redirect
  carries momentum. Travel requests are ignored while `descent` / `ascent` own the camera.
- Entry / climb: one timeline per director; any new one kills the old and stops the haze
  tweens (`settleHaze`). The climb starts from the current pose.
- Flights: the old tween is killed; the new leg starts from the current pose and velocity.
- All per‑frame rates use `delta` (clamped 1/240 – 1/20 s): `damp` for speed, drift,
  settle and bank; the Observatory dial turn is now `1 − e^(−3·dt)`.

### Reduced motion

No camera travel at all for entry, climb or flights: the haze (no wisp motion) crossfades in
0.5 s, the switch happens, and it clears in 0.7 s; flights dip through the destination's sky
in 0.4 / 0.6 s. Galaxy travel stays 0.7 s `power1.inOut`. No FOV breathing, dust, bank or
drift. Verified for descent and ascent.

### Verified

Dev build, 1280×800, forced frames on a fixed virtual clock: approach speed profile (rest →
cruise → long deceleration), redirect continuity, entry frames on Aurelis and Orion (limb,
haze, switch, glide to the location), flights (heading error), climb from mid‑flight
(real‑time velocity continuity), pull‑back restoring focus / panel / upright camera,
reduced‑motion descent and ascent, and the Observatory → Explore chain into a descent.

---

## 9. Technical architecture

**Status: Implemented.** React 19 · Vite 8 · TypeScript · three 0.187 · @react-three/fiber 9 ·
@react-three/drei 10 (PerformanceMonitor only) · @react-three/postprocessing 3 · GSAP 3
(+ @gsap/react, CustomEase) · Zustand 5 · Tailwind CSS 4 · lucide-react.

### File structure

```
src/
  main.tsx                 fonts + global CSS, React root
  App.tsx                  <Experience/> + <TitleScreen/>; dev-only window handles
  index.css                tokens (@theme), every component style, reduced-motion rules
  audio/
    sound.ts               Web Audio synth: chime, wind, swell, thunder (Phase 3)
  data/
    planets.ts             PLANETS (six worlds), PLANET_BY_ID, ORDINALS, types
    locations.ts           LOCATIONS (18), SURFACES (per-world surface recipe), types (Phase 3)
  state/
    useExperience.ts       Zustand store; quality tier; debugShot (?shot=)
    director.ts            palette; director (tweened values); telemetry; labels; Vael sun
    galaxy.ts              live world positions
    exploration.ts         persisted progress: discoveries, first landings, Observatory mark, sound (v2)
    progress.ts            pure derivations: world/system progress, timeline, dates (Phase 4)
  scene/
    Experience.tsx         <Canvas>, pointer listeners, Clock, spaces, rigs, post stack
    CameraRig.tsx          Vael camera: framing, arrival, drift, dive, Ithra projection
    Warp.tsx               baseFov, Projection, WarpStreaks, Space, Precompile
    motion.ts              journey eases, durations, Bézier helpers, atmosphereFx, travelFx (§8)
    Atmosphere.tsx         in-scene haze for entry and climb (§8)
    Planet.tsx             Vael: terrain bake, surface, clouds, atmosphere
    Ithra.tsx              moon + dotted orbit
    Starfield.tsx          Starfield, Dust, DistantGalaxies, ShootingStars
    Nebula.tsx             cube-map sky bake → scene.background
    sun.ts                 Vael sun direction
    shaders/               noise.ts (simplex + fBm), planet.ts (Vael), space.ts (sky)
    galaxy/
      GalaxySystem.tsx     SpiralGalaxy + Star + six <World/>
      World.tsx            one world: bake, surface, clouds, atmosphere, rings, hit sphere, orbit
      Star.tsx             Elys
      SpiralGalaxy.tsx     the surrounding galaxy
      GalaxyRig.tsx        OrbitControls, intro/outro/travel/focus/observatory, readouts, projections
      Thumbnails.tsx       portraits baked from the live world materials (Phase 4)
      SpaceDust.tsx        near dust that streams past during travel (§8)
      shaders.ts           kind bake, world surface, clouds, atmosphere, rings, star, disc, warp
    surface/               (Phase 3)
      terrain.ts           height function in GLSL + TypeScript, polar grid
      env.ts               EnvState, blending, shared surface uniforms
      world.ts             prepareSurface: poses, landmark bases, signals, envs per location
      shaders.ts           sky, terrain, water, clouds, motes, rain, landmark, plume, signal
      SurfaceScene.tsx     SurfaceSpace → sky, terrain, water, clouds, weather, landmarks, signal
      SurfaceRig.tsx       surface camera: landing, free look, flights; readout; signal projection
  ui/
    TitleScreen.tsx        prelude, arrival, warp out/back, letterbox, veil; mounts Hud + GalaxyUI
    Wordmark.tsx           AETHER letters
    Hud.tsx                corners, status/readout/hint, Pause motion, Hide interface
    OrbitLabel.tsx         Ithra's label
    GalaxyUI.tsx           hover label, world index, info panel (+ Explore), Return to Vael, keys
    ExploreUI.tsx          title card, location panel/strip, signal label, notice, keys
    exploreDirector.ts     descent, ascent, travel, discovery timelines; ?shot=<location>
    ObservatoryUI.tsx      dial overlay, record, ledger, worlds, discoveries, timeline, keys (Phase 4)
    observatoryDirector.ts open / close / explore choreography (Phase 4)
```

### Scene management

- One `<Canvas>`, three **spaces** sharing the origin: `vael` (Dust, Planet, Ithra), `galaxy`
  (GalaxySystem) and `surface` (SurfaceSpace). `<Space>` sets `visible` from `director.space`
  every frame (it accepts one space or a list), so only the active space renders. The
  starfield, deep field and shooting stars render in `vael` and `galaxy` only; the nebula
  background, warp streaks and post stack are shared by all three.
- The surface is **mounted only while a world is being explored** (`exploring` from descent
  start to ascent end), keyed by world, and compiles its programs with `gl.compile` on mount,
  two frames before the descent starts moving.
- **Bakes** (Vael terrain, six world textures, nebula cube map) run once in effects on mount,
  under the prelude.
- **Precompile** calls `gl.compile(scene, camera)` on mount with both spaces visible, so the
  first jump never stalls on shader compilation.
- `Clock` advances `director.time` (unless paused) and reports `sceneReady` after 3 frames.

### Camera management

- One perspective camera, driven by exactly one rig at a time:
  - `CameraRig` runs only when `director.space === 'vael'`.
  - `GalaxyRig` runs only in the galaxy; it owns a manually created three.js
    `OrbitControls`, enabled only in its `free` and `focus` modes.
  - `SurfaceRig` runs only on surfaces (modes `landing`, `free`, `travel`, `climb`, in
    `surfaceCam`).
- `GalaxyRig` modes (`galaxyCam.mode`): `intro` (driven by `director.galaxyIntro`), `free`
  (OrbitControls around Elys), `travel` (tween `galaxyCam.t`), `focus` (follow + orbit a
  world), `outro` (recede during Return to Vael), `descent` / `ascent` (Phase 3: dive to and
  climb from a world's atmosphere, driven by `director.descent`), `observatory` (Phase 4: rise
  to the zenith, turn the dial; §7). `startGalaxyTravel` and `beginObservatory` are exported
  so the Observatory director can drive the rig; `galaxyCam.onArrive` chains a descent onto a
  travel.
- `Projection` owns FOV, clip planes and view offset: base FOV per space (Vael 34°/44°,
  galaxy 46°/60°, surface 55°/68°, portrait below 0.8 aspect) + `warp × 32°`; near/far
  0.05/1200 in space and 0.3/6000 on surfaces; view offset from `director.panelShift`;
  `director.fovKick` (speed breathing, §8) is added on top.
- Framing math always uses the base FOV, so the warp's FOV kick never moves the camera.

### State management

| Store | Kind | Contents |
|-------|------|----------|
| `useExperience` | Zustand (React renders) | `phase` (`boot · arriving · orbit · warping · galaxy · returning · descending · surface · ascending · observatory`), `observed` (the Observatory's selected world), `sceneReady`, `motionPaused`, `reducedMotion`, `cinema`, `focus`, `hovered`, `exploring`, `location`, `signalHovered`, `notice`, actions `setPhase`, `setSceneReady`, `toggleMotion`, `toggleCinema`, `setFocus`, `stepFocus`, `setHovered`, `setExploring`, `setLocation`, `setSignalHovered`, `setNotice` |
| `useExploration` | Zustand + `persist` (localStorage `aether-exploration`, v2) | `discovered` (id → timestamp), `visited` (world → first landing), `observatorySeenAt`, `soundOn`, `discover(id)` (true only the first time), `markVisited`, `markObservatorySeen`, `toggleSound` |
| `state/progress.ts` | Pure functions | Every derived figure (§7); never stored |
| `useThumbs` | Zustand | Baked portrait data URLs |
| `director` | Mutable object (GSAP writes, `useFrame` reads) | `arrival`, `sun`, `sky`, `dive`, `letterbox`*, `hud`, `space` (`vael · galaxy · surface`), `warp`, `galaxyIntro`, `panelShift`, `descent`, `landing`, `observatory`, `atmo` (haze density, §8), `fovKick`, `time` |
| `telemetry` | Mutable, read in `requestAnimationFrame` by DOM | `altitudeKm`, `readout`, `ithra {x,y,visible}`, `hover {x,y,visible,radiusPx}`, `signal {x,y,visible}`, `chart {ox,oy,active,worlds}` (Phase 4) |
| `surface`, `surfaceCam`, `signalFx` | Mutable (surface modules) | current world's height function, poses, envs, blended env; surface camera; signal bloom |
| `labels`, `galaxy.positions` | Mutable vectors | Ithra's and the six worlds' live world positions |
| `galaxyCam` | Mutable (GalaxyRig module) | camera mode, travel clock, path controls, measured velocity, settle ramp, entry path (start direction, sweep axis/angle) |
| `atmosphereFx`, `travelFx` | Mutable (`scene/motion.ts`) | haze colours, local up, limb dip, wisp flow; travel speed for dust |

\* `director.letterbox` is declared but unused; the letterbox is tweened directly on the DOM.

Rule: **values that change every frame never go through React.** React state changes only
on discrete events (phase, focus, hover, toggles).

### Planet configuration

A world is one entry in `PLANETS` (`data/planets.ts`):

```ts
{ id, name, kind, classification, teaser, description, facts[6],
  radius, orbitRadius, orbitPeriod, phase, inclination, axialTilt, spin, radiusKm,
  atmosphere: { day, night, shell, density, intensity },
  accent, clouds?: { color, opacity, speed }, rings?: { inner, outer, colorA, colorB } }
```

Per kind, `World.tsx` maps `KIND_IDS`, `BUMP` (terrestrial 0.07, dark 0.05, desert 0.06,
ocean 0.06, cloud/giant 0) and `HAZE` (inner‑haze strength). The texture seed is
`index × 1.37 + 0.5`.

Phase 3 adds, per world, a `SURFACES` entry (`data/locations.ts`): noise `seed`, surface `kind`
(`terrestrial · dark · desert · deck · ocean · giant`), `water`, water colors, a five‑color
`palette`, `motes` kind and color, number of `moons`, `rings`, landmark `rock` and `glow`
colors. Locations are `LOCATIONS` entries (fields in §6).

### Animation implementation

- **GSAP timelines** in `TitleScreen` own every orchestrated sequence (prelude, arrival, warp
  out, warp back) and tween `director` values and DOM nodes together. `useGSAP` scopes and
  cleans them up; `contextSafe` wraps the click handlers.
- **GSAP tweens** in `GalaxyRig` drive travel progress and `panelShift`.
- **`exploreDirector`** (a plain module, not a component) owns the Phase 3 timelines (descent,
  ascent, travel, discovery bloom, title card) so the 3D signal, the panels and the keyboard
  can all call it. It reaches the letterbox through `data-*` selectors; the atmosphere is
  in‑scene (`director.atmo`), not DOM.
- **`observatoryDirector`** (plain module) owns the Phase 4 timelines and reuses the Phase 3
  ascent and descent, so every route between galaxy, surface and Observatory is one chain.
- **`useFrame`** reads `director` and writes uniforms and transforms; never `setState`.
- **CSS transitions** for interruptible UI (index, panel, hover label, buttons, cinema fade);
  CSS keyframes only for `panel-in`, `reveal-in` (lore on discovery) and the button's orbiting
  edge light.
- **rAF loops in DOM components** (`Readout`, `OrbitLabel`, `HoverLabel`, `SignalLabel`, the
  Observatory `Chart`) write
  text and transforms directly from `telemetry`.

### Performance

| Setting | High tier | Low tier (touch or < 700px short side) |
|---------|-----------|----------------------------------------|
| Max DPR | 1.75 | 1.5 |
| MSAA | ×4 | off |
| Vael terrain | 4096×2048 | 2048×1024 |
| World textures | 1536×768 ×6 | 1024×512 ×6 |
| Stars / dust / galaxies / spiral points | 6,500 / 650 / 70 / 70,000 | 2,800 / 260 / 34 / 26,000 |
| Warp streaks | 1,400 | 600 |
| Sphere segments (Vael / worlds) | 160 / 96 | 96 / 64 |
| Surface terrain grid (rings × segments) | 200 × 320 | 140 × 200 |
| Surface cloud grid segments / cloud octaves | 160 / 5 | 112 / 4 |
| Surface motes / rain streaks / plume particles | 1,400 / 2,600 / 220 | 560 / 1,000 / 110 |

`PerformanceMonitor` lowers DPR by 0.35 on decline and raises it by 0.25 on incline.
Measured on an RTX 3050 laptop (forced frames): Vael ≈ 5.3 ms at a 2000×1125 buffer; galaxy
≈ 1 ms at 920×845; surfaces 5–10 ms at 2000×1125 (§6). On surfaces the bloom threshold is
0.82 (0.42 elsewhere).

### Development and deployment

- `?shot=orbit` jumps to the settled title; `?shot=galaxy` to the overview;
  `?shot=<id>` (e.g. `?shot=orion`) to a focused world; `?shot=<location id>` (e.g.
  `?shot=solara-rustgate`) straight onto a surface, primed so Return to orbit works;
  `?shot=observatory` opens the Observatory from the overview.
- Dev builds only: `window.__aether` (R3F state), `__store`, `__director`, `__galaxyCam`,
  `__galaxy`, `__gsap`, `__telemetry`.
- `npm run build` = `tsc -b && vite build`, `base: './'`. GitHub Actions
  (`.github/workflows/deploy.yml`) builds and deploys to GitHub Pages on every push to `main`.

---

## 10. Rules for future work

These are rules, not features. The global rules apply to all future work. The Phase 3
and Phase 4 subsections record how the shipped implementation follows them.

### Global rules

1. **One camera director at a time.** A new mode gets its own rig (or a new `galaxyCam`
   mode) and a single owner. Rigs check `director.space` (or a new space) before touching the
   camera.
2. **Letterbox means "watch".** Close it for any sequence the visitor cannot steer; open it
   the moment they can.
3. **New spaces use `<Space>`,** bake under a prelude or warp, and are covered by `Precompile`.
4. **Per‑frame values live in `director` / `telemetry`,** never in React state.
5. **Every 3D interactive object needs** an invisible hit proxy ≥ 1.5 units, a hover label
   in the leader‑line style, a DOM/keyboard equivalent, and the 6px drag threshold.
6. **Every animation ships with** its reduced‑motion variant and respects Pause motion.
7. **Copy is plain and true.** Facts are written as label + value; readouts are computed
   from the scene.
8. **New colors are world accents** following the accent rule in §1, or don't ship.
9. **Camera moves use `scene/motion.ts`:** a linear clock shaped per frame by its eases,
   a path whose end tangents match the motion around it, momentum when interrupted, and a
   reduced‑motion haze crossfade. Never hide a cut behind a flat colour.

### Planet exploration (Phase 3 — implemented, see §6)

- Followed: entered from the focused world's panel; camera‑directed descent with the letterbox
  closed; exit returns to the same world's focus view with the panel open; four HUD corners;
  the readout is a true altitude.
- Differences from the original rule (the colour veil described next was replaced by the
  in‑scene haze in §8): the atmosphere crossing was a color veil (the world's
  atmosphere color), not the closest‑approach shell; surfaces are live procedural terrain with
  their own recipes (palettes chosen to match each world's orbital look) rather than a lazy
  higher‑resolution bake of the orbital texture; the readout does not show local time.
- For future surface work: new locations are data (§6 fields) plus, if needed, a new set‑piece
  shape added to **both** the GLSL and TypeScript height functions in `terrain.ts`.
  Verify every new location with the CPU height probe (camera ground, landmark ground, signal
  height) before tuning visually.

### Discovery notifications (implemented, see §6)

- Non‑modal, one at a time. Discoveries only happen with the letterbox open. As built, a new
  notification replaces the current one rather than queueing (discoveries are seconds apart at
  most once per location, so a queue has never been needed).
- Placement: bottom‑left, directly above the status line, so they read as part of the HUD.
- Form: accent dot + one line (title) + optional second line in haze. No icon tiles, no
  glass, no card.
- Motion: enter with `uiOut` (≤ 300ms, 8px rise); exit the same way; auto‑dismiss after at
  least 5s; pausing motion does not hide them.
- Accessibility: `aria-live="polite"`; hidden by Hide interface like all `.ui-hideable` UI.

### Observatory (Phase 4 — implemented, see §7)

- Followed: opened from the HUD; titles in Italiana; data as `<dl>` lists with hairline
  rules; world accents only as dots and chart marks; `Esc` closes.
- Differences from the original rule: the scene is not dimmed behind a screen — it *is* the
  Observatory's centrepiece (the planisphere), and its clock keeps running so the dial is
  alive; focus is not returned to the opening control, because closing is a camera move to
  a different view (or a descent), not the dismissal of an overlay.
- For future work: every figure goes through `state/progress.ts`; never store a derived
  number. Statistics stay label + value lines — no tiles, rings or charts that restate a
  number. Unfound content may show only what the surface shows before discovery.

### Adding a world

1. Add a `PLANETS` entry. Orbit radius must keep ≥ 4.5 units clearance to its neighbours,
   and `max(radius × 1.6, 1.5)` must not overlap a neighbour's hit sphere.
2. Reuse a kind, or add one: a `#elif KIND == …` branch in **both** `bakeFragment` and
   `worldFragment`, plus `KIND_IDS`, `BUMP` and `HAZE` entries.
3. Extend `ORDINALS` if there are more than six worlds.
4. Check overview framing (`homeDistance`) still holds the whole system.

---

## 11. Known limitations

| Item | Status |
|------|--------|
| Not tested on a real phone (touch drag, pinch, tap on worlds); narrow layouts were checked in a desktop browser only | Open |
| When the page is throttled (window not visible), GSAP's lag smoothing stretches transitions; they complete when the page is visible again | By design (GSAP default) |
| Orion's rings receive the planet's shadow but cast none onto the planet | Open |
| Moons listed in facts are not rendered in orbit (they appear only as discs in surface skies) | Open |
| Worlds do not shadow or eclipse each other | Open |
| Hide interface fades over 200ms for both button and `H` | Accepted |
| Single 1.5 MB JS chunk (~440 KB gzipped) | Open — candidate for Phase 5 |
| Surfaces: no shadows; landmarks and terrain are lit by sun and sky only | Open |
| Surfaces: far terrain "swims" slightly as the polar grid follows the camera (hidden by fog) | Accepted |
| Surfaces: notifications replace rather than queue | Accepted |
| Surface performance not measured on a phone; low tier is a best guess | Open |
| Ascent recomputes a sunlit view; the camera does not retrace the exact descent path | By design |
| Observatory: progress lives in one browser's localStorage; clearing site data or another device starts over (no accounts, by design in `PRODUCT.md`) | By design |
| Observatory: first‑landing dates for progress saved before Phase 4 are inferred from the earliest discovery; worlds landed on without a discovery then show "Not yet" | Accepted |
| Observatory: portraits bake on the first opening (a brief hairline placeholder) | Accepted |
| Observatory: on small phones the inner orbits are tight; labels can overlap each other at some orbital phases (they stay legible on their backing) | Open |
| Observatory: the narrow dial position is solved once at opening; rotating the phone while it is open keeps the old offset until reopened | Open |
| Observatory: not tested on a real phone or with a screen reader | Open |
| Journey: orbital and surface terrain are not the same data; continuity is in horizon, motion, speed and colour, and the switch happens inside the haze | By design |
| Journey: the entry sweeps toward the day side; a world whose focus view is near local noon barely sweeps | Accepted |
| Journey: near dust is subtle by design and reads only in motion | Accepted |
| Journey: timings verified on forced frames in a desktop browser; not yet felt on a real phone or a 120 Hz display | Open |

---

## 12. Decision log

Superseded Phase 1 decisions, kept so nobody reintroduces them by accident.

| Was | Now | Why |
|-----|-----|-----|
| Wordmark `clamp(3.25rem, 12.5vw, 9.5rem)`, tracking 0.28em | `min(13.5svh, 15.5vw)`, 0.26em (0.15em tall screens) | Size must track the planet disc, which follows the shorter axis |
| Disc fills ~66% height / ~88% width | 62% / 80% | Room for the HUD and Ithra's ring |
| Camera dolly 5.5s `expo.out` | 6.2s `power4.out` | Less front‑loaded; the approach reads as travel |
| Enter universe → low‑orbit "Dawn over Vael" holding shot + Return | Skim the limb → warp → galaxy; Return to Vael | Phase 2 gave the button a real destination |
| Live fBm surface with screen‑derivative bump | Baked terrain + texture finite‑difference normals | Removed 2×2 blocky artifacts; cheaper per frame |
| Fresnel atmosphere | Closest‑approach atmosphere | Stays thin at any distance |
| Star shell fixed at the origin | Star shell follows the camera | The galaxy camera travels 200+ units |
| Touch had no drift | One‑finger drag to look (Vael); OrbitControls (galaxy) | Equinox reference; touch parity |
| Fixed ring orientation in surface skies | Ring axis tipped away from each location's view, latitudes 0.42 / 0.95 / 0.8 | At low latitude the arch sat 30–55° up, outside the frame |
| Night surfaces lit only by sky colors | Ambient floor from starlight and aurora | Nyx and night scenes rendered black |
| Fissures / glow from thresholded fBm | Thin lines along noise zero‑contours | Thresholded fBm made blobs or nothing |
| Location strip at the world‑index height | 72px above the bottom gutter | Collided with the three‑line HUD status |
| Observatory as a full‑frame screen over a dimmed scene (Phase 4 rule) | The galaxy seen from the zenith as a turning planisphere | One continuous world; the record is anchored to the real system |
| Narrow dial at a fixed 7% view offset | Offset solved from the layout at opening; dial radius shared with CSS (`--obs-dial`) | The fixed offset put Orion's label on the header links |
| Timeline marked every entry new on a first visit, animating at open | Nothing is new on a first visit; new entries wait until the timeline is in view | "Since your last visit" must be true, and the motion must be seen |
| Galaxy travel: lerp + sine arc, one `power3.inOut` for position and aim | Bézier on a linear clock; aim first, `approach` for position; momentum on redirect | Read as travel, not a zoom; redirects never brake |
| Radial dive, straight down at the planet | Sweep to the day side, view following the limb's dip, up turning to local vertical | A horizon to carry across the switch |
| CSS `.atmo-veil` radial gradient, fully opaque at the switch | In‑scene haze graded about the true horizon, with streaming cloud layers; bloom threshold follows it | No curtain; the switch happens inside the sky |
| Landing: top‑down drop from 380 up | Glide from 640 back / 546 up, through the clouds, horizon at the hand‑over height | Same horizon and motion on both sides of the switch |
| Ascent = landing in reverse from the location pose | Climb from the current pose, carrying flight velocity | Leaving mid‑flight jumped to the destination |
| Flights: lerp + sine arc, heading interpolated independently | Bézier along start/end headings, facing the path; clearance sampled under the line | No crabbing, no clamp kinks |
| Surface breathe 0.012 units | Layered slow drift that eases in after arrivals | Alive without motion sickness |

---

## 13. Roadmap

| Phase | Name | Status | Scope |
|-------|------|--------|-------|
| 1 | Arrival | **Complete** | Prelude, letterboxed arrival at Vael, Ithra, deep‑field sky, Pause motion, Hide interface, touch drag |
| 2 | Galaxy | **Complete** | Warp, Elys, six worlds, spiral galaxy, hover/select/travel, info panel, world index, keyboard navigation, Return to Vael, GitHub Pages deploy |
| 3 | Planet Exploration | **Complete** | Descent and ascent, six surface environments, 18 locations, flights between them, signals and discovery, notifications, persisted progress, synthesized sound with controls |
| 4 | Observatory | **Complete** | Planisphere dial from the zenith, world record and ledger, six‑world archive, discovery collection with redacted unfound entries, timeline with new‑since‑last‑visit, baked portraits, persisted progress v2, navigation between galaxy, surfaces and Observatory |
| — | Journey choreography | **Complete** (not yet deployed) | Approach, entry, exploration drift and flights, return to orbit as one continuous move (§8) |
| 5 | Final Polish | Planned | Real‑device testing, code splitting, ring shadows on Orion, surface shadows, performance tuning |
