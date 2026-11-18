# AETHER — Design System

**The source of truth for AETHER.** Every value below was read from the source code on
2026‑11‑18. Phases 1–2 are live at <https://ahmadbhanvadiya-dot.github.io/aether/> (commit
`8b03512`); Phase 3 (planet exploration) is implemented in the working tree and not yet
deployed. When code and this document disagree, fix one of them in the same change.

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
7. [Technical architecture](#7-technical-architecture) (Implemented)
8. [Rules for future work](#8-rules-for-future-work) (Planned)
9. [Known limitations](#9-known-limitations)
10. [Decision log](#10-decision-log)
11. [Roadmap](#11-roadmap)

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
| Top‑right | **Pause motion**, **Sound** (Phase 3) and **Hide interface** buttons (labels hidden below `sm`; Sound's below `lg`). |
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
| `power3.inOut` | GSAP | Camera travel between poses; sun swing |
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
- Phase 3 reduced motion: descent, ascent and travel between locations become short veil
  crossfades (about 1.2s); lightning flashes are off; signal pings hold still; motes drop to 40%.
- Every interactive 3D object has a DOM equivalent: the world index (buttons, keyboard
  focusable, focus highlights the world) and panel buttons with `aria-label`s.
- Keyboard: `H` hide interface and `M` sound, anywhere; in a focused world `Esc`, `←`, `→`;
  on a surface `Esc` returns to orbit and `←` / `→` fly between locations. Shortcuts appear in
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

**Status: Implemented.** All six share one pipeline (§7) and differ through a *kind* recipe
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
- Path: straight interpolation plus an arc over the orbital plane
  (`sin(π·t) × 0.14 × distance`); the look‑at target interpolates alongside.
- Duration: `clamp(1.5 + distance / 45, 1.8, 3.4)` s, `power3.inOut`.
- On arrival, the camera follows the world (it adds the world's movement every frame), and
  OrbitControls orbit around it.
- The frame shifts so the world clears the panel: a view offset of 17% of the width
  (landscape) or 26% of the height (narrow), tweened over 1.6s.

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

On click, the surface mounts and compiles (two animation frames), then, from `t = 0`:

| t (s) | Beat |
|-------|------|
| 0 – 0.9 | Letterbox closes; the panel shift returns to centre (1.2s). |
| 0.2 – 3.6 | Galaxy camera dives from its focus pose to 1.012 × radius (`director.descent`, `power2.in`); near the end the view tips from the planet's centre to its horizon. |
| 0.3 | Wind sound (6s, sweeping up). |
| 2.6 – 3.6 | The world's atmosphere color fills the frame (`.atmo-veil`, a radial gradient of its day color). |
| **3.65** | **Space switches to `surface`.** The surface camera starts 380 units up and 140 back, pitched down 0.75 rad. |
| 3.8 – 5.6 | Veil clears. |
| 3.65 – 8.85 | Landing (`director.landing`, `power3.out`): the camera falls through the cloud layer to eye height and turns toward the signal. |
| 6.4 | Title card: location name + region (1.1s in, 3.6s hold, 0.8s out). |
| 7.4 – 8.7 | Letterbox opens. Phase becomes `surface` when the timeline ends. |

The ascent (`startAscent`) mirrors it: letterbox closes, the camera climbs (`landing 1 → 0`,
2.8s, `power2.in`), wind sweeps down, the veil fills at 2.0s, **switch at 2.95s** with the
galaxy camera at the atmosphere, then it pulls back out to the focus pose (3.4s, `power3.out`);
the panel shift returns at 4.8s, the letterbox opens at 5.2s, the phase becomes `galaxy` and
the surface unmounts.

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
- **Flight** (`travelTo`): from the current view to the destination over
  `clamp(3.2 + distance / 420, 4, 7)` s, `power3.inOut`, arcing up `50 + 0.12 × distance` units
  and never closer than 6 units to the ground. The whole environment (sun, sky, fog, weather,
  clouds) blends along the way; a low swell plays; the title card shows on arrival (2.4s hold).
- **Look around**: drag (mouse or one finger) turns the view; the mouse position adds a slight
  parallax; a gentle breathing bob runs unless motion is paused or reduced.

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

- A Zustand `persist` store in localStorage, key `aether-exploration` (version 1): `discovered`
  (location id → timestamp) and `soundOn`. Storage errors (private browsing, blocked storage)
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

## 7. Technical architecture

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
    exploration.ts         persisted discoveries + sound setting (Phase 3)
  scene/
    Experience.tsx         <Canvas>, pointer listeners, Clock, spaces, rigs, post stack
    CameraRig.tsx          Vael camera: framing, arrival, drift, dive, Ithra projection
    Warp.tsx               baseFov, Projection, WarpStreaks, Space, Precompile
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
      GalaxyRig.tsx        OrbitControls, intro/outro/travel/focus, readouts, hover projection
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
    ExploreUI.tsx          veil, title card, location panel/strip, signal label, notice, keys
    exploreDirector.ts     descent, ascent, travel, discovery timelines; ?shot=<location>
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
  - `SurfaceRig` runs only on surfaces (modes `landing`, `free`, `travel`, in `surfaceCam`).
- `GalaxyRig` modes (`galaxyCam.mode`): `intro` (driven by `director.galaxyIntro`), `free`
  (OrbitControls around Elys), `travel` (tween `galaxyCam.t`), `focus` (follow + orbit a
  world), `outro` (recede during Return to Vael), `descent` / `ascent` (Phase 3: dive to and
  climb from a world's atmosphere, driven by `director.descent`).
- `Projection` owns FOV, clip planes and view offset: base FOV per space (Vael 34°/44°,
  galaxy 46°/60°, surface 55°/68°, portrait below 0.8 aspect) + `warp × 32°`; near/far
  0.05/1200 in space and 0.3/6000 on surfaces; view offset from `director.panelShift`.
- Framing math always uses the base FOV, so the warp's FOV kick never moves the camera.

### State management

| Store | Kind | Contents |
|-------|------|----------|
| `useExperience` | Zustand (React renders) | `phase` (`boot · arriving · orbit · warping · galaxy · returning · descending · surface · ascending`), `sceneReady`, `motionPaused`, `reducedMotion`, `cinema`, `focus`, `hovered`, `exploring`, `location`, `signalHovered`, `notice`, actions `setPhase`, `setSceneReady`, `toggleMotion`, `toggleCinema`, `setFocus`, `stepFocus`, `setHovered`, `setExploring`, `setLocation`, `setSignalHovered`, `setNotice` |
| `useExploration` | Zustand + `persist` (localStorage `aether-exploration`) | `discovered` (id → timestamp), `soundOn`, `discover(id)` (true only the first time), `toggleSound` |
| `director` | Mutable object (GSAP writes, `useFrame` reads) | `arrival`, `sun`, `sky`, `dive`, `letterbox`*, `hud`, `space` (`vael · galaxy · surface`), `warp`, `galaxyIntro`, `panelShift`, `descent`, `landing`, `time` |
| `telemetry` | Mutable, read in `requestAnimationFrame` by DOM | `altitudeKm`, `readout`, `ithra {x,y,visible}`, `hover {x,y,visible,radiusPx}`, `signal {x,y,visible}` |
| `surface`, `surfaceCam`, `signalFx` | Mutable (surface modules) | current world's height function, poses, envs, blended env; surface camera; signal bloom |
| `labels`, `galaxy.positions` | Mutable vectors | Ithra's and the six worlds' live world positions |
| `galaxyCam` | Mutable (GalaxyRig module) | camera mode, travel progress and poses |

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
  can all call it. It reaches the letterbox and veils through `data-*` selectors.
- **`useFrame`** reads `director` and writes uniforms and transforms; never `setState`.
- **CSS transitions** for interruptible UI (index, panel, hover label, buttons, cinema fade);
  CSS keyframes only for `panel-in`, `reveal-in` (lore on discovery) and the button's orbiting
  edge light.
- **rAF loops in DOM components** (`Readout`, `OrbitLabel`, `HoverLabel`, `SignalLabel`) write
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
  `?shot=solara-rustgate`) straight onto a surface, primed so Return to orbit works.
- Dev builds only: `window.__aether` (R3F state), `__store`, `__director`, `__galaxyCam`,
  `__galaxy`, `__gsap`, `__telemetry`.
- `npm run build` = `tsc -b && vite build`, `base: './'`. GitHub Actions
  (`.github/workflows/deploy.yml`) builds and deploys to GitHub Pages on every push to `main`.

---

## 8. Rules for future work

These are rules, not features. The global rules apply to all future work. The Phase 3
subsections now record how the shipped implementation follows them; Observatory is still
**Planned**.

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

### Planet exploration (Phase 3 — implemented, see §6)

- Followed: entered from the focused world's panel; camera‑directed descent with the letterbox
  closed; exit returns to the same world's focus view with the panel open; four HUD corners;
  the readout is a true altitude.
- Differences from the original rule: the atmosphere crossing is a color veil (the world's
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

### Observatory screens (Phase 4)

- Full‑frame editorial screens on `void`, opened from the HUD; the scene stays behind, dimmed
  by a scrim (and may pause its clock).
- Titles in Italiana; data as `<dl>` lists with hairline rules — the same grammar as the
  world panel facts.
- World accents only as dots and chart marks.
- `Esc` closes; focus returns to the control that opened the screen.

### Adding a world

1. Add a `PLANETS` entry. Orbit radius must keep ≥ 4.5 units clearance to its neighbours,
   and `max(radius × 1.6, 1.5)` must not overlap a neighbour's hit sphere.
2. Reuse a kind, or add one: a `#elif KIND == …` branch in **both** `bakeFragment` and
   `worldFragment`, plus `KIND_IDS`, `BUMP` and `HAZE` entries.
3. Extend `ORDINALS` if there are more than six worlds.
4. Check overview framing (`homeDistance`) still holds the whole system.

---

## 9. Known limitations

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

---

## 10. Decision log

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

---

## 11. Roadmap

| Phase | Name | Status | Scope |
|-------|------|--------|-------|
| 1 | Arrival | **Complete** | Prelude, letterboxed arrival at Vael, Ithra, deep‑field sky, Pause motion, Hide interface, touch drag |
| 2 | Galaxy | **Complete** | Warp, Elys, six worlds, spiral galaxy, hover/select/travel, info panel, world index, keyboard navigation, Return to Vael, GitHub Pages deploy |
| 3 | Planet Exploration | **Complete** (not yet deployed) | Descent and ascent, six surface environments, 18 locations, flights between them, signals and discovery, notifications, persisted progress, synthesized sound with controls |
| 4 | Observatory | Planned | Editorial data screens for the system and each world |
| 5 | Final Polish | Planned | Real‑device testing, code splitting, ring shadows on Orion, surface shadows, performance tuning |
