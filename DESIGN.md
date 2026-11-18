# AETHER — Design System

AETHER is a cinematic exploration of a fictional star system. The first screen is an
*arrival*: you drift out of darkness toward **Vael**, a backlit ocean world, and its
atmosphere closes around the title like an eclipse ring.

## Subject, audience, job

- **Subject** — an invented, plausible universe. Not sci‑fi chrome, not a product.
- **Audience** — people who opened the link to be transported: designers, space fans,
  curious visitors on desktop and phone.
- **Job of the first screen** — make one unforgettable image, then invite the visitor in.

## The one bold idea

**The planet frames the words.** Vael is lit from behind and to the right, so most of its
disc is in shadow and a thin crescent burns along one edge. The atmosphere glows all the way
around the limb. The title, tagline and button sit inside that dark disc, framed by the ring.
Everything else on the page stays quiet so this composition carries the experience.

## Color

| Token        | Hex       | Role |
|--------------|-----------|------|
| `void`       | `#02030A` | The page and deep space. Blue‑black, never neutral grey. |
| `midnight`   | `#070C22` | Nebula floor, planet night side, overlay fades. |
| `abyss`      | `#132056` | Deep ocean, lowest nebula light. |
| `ion`        | `#5AB0FF` | Electric blue. Atmosphere scattering, focus ring, live data. |
| `violet`     | `#8C6CFF` | Night‑side airglow, nebula, the button's edge light. |
| `starlight`  | `#E9EDF9` | Primary text and star cores. |
| `haze`       | `#8A93B8` | Secondary text. ~6.8:1 on `void`. |

Rules:
- Blue and violet are **light**, not paint. They appear where something emits or scatters
  (atmosphere, airglow, focus, hover) — never as flat fills or gradient washes on panels.
- No pure white surfaces. The brightest pixels belong to the sunlit crescent and a few stars.

## Type

- **Display — Italiana.** A thin, high‑contrast roman. Set only in the wordmark, very large,
  with wide tracking (`0.28em`), so it reads like a film title card. Light enough that the
  atmosphere ring behind it is never overpowered.
- **Text — Manrope Variable.** Calm geometric sans for the tagline, button and readouts.
  Weights 300 (tagline), 500 (button), 400 (readouts).

Scale (fluid, `clamp`):

| Role      | Size                               | Tracking | Weight |
|-----------|------------------------------------|----------|--------|
| Wordmark  | `clamp(3.25rem, 12.5vw, 9.5rem)`   | 0.28em   | Italiana |
| Tagline   | `clamp(1rem, 1.4vw, 1.3rem)`       | 0.04em   | 300 |
| Button    | `0.8125rem`                        | 0.22em   | 500 |
| Readout   | `0.8125rem`                        | 0.01em   | 400 |

The button label is the only all‑caps text (`ENTER UNIVERSE`, per brief). No eyebrow labels,
no accented single words, no monospace data.

## Layout

```
 desktop                                   mobile
┌─────────────────────────────────────┐   ┌───────────────┐
│                              [ ⏸ ]  │   │          [⏸]  │
│            .-~~~~~~~~-.             │   │   .-~~~~~-.   │
│         .'             ')  ← lit    │   │ .'         ') │
│        :    A E T H E R  ))  crescent   │ : AETHER   )) │
│        :  Beyond the known. ))      │   │ :Beyond the.) │
│         '. [ENTER UNIVERSE] )       │   │  '[ENTER]  )  │
│            '-.________.-'           │   │   '-.___.-'   │
│ Now orbiting Vael       Move to look│   │ Now orbiting  │
│ 4.6M km and closing        around   │   │ Vael          │
└─────────────────────────────────────┘   └───────────────┘
```

- Everything is centre‑aligned on the planet's axis; the HUD readouts are corner‑anchored
  and left/right aligned to the safe area.
- The camera distance is computed from the viewport so the planet's disc fills ~66% of the
  height on landscape screens and ~88% of the width on portrait screens. The type is sized
  in `vw`/`vh` to stay inside the dark part of the disc at any size.
- Side gutter: 24px mobile, 40px desktop, plus `env(safe-area-inset-*)`.

## 3D environment

| Layer       | Technique | Notes |
|-------------|-----------|-------|
| Vael surface | Terrain noise (8‑octave domain‑warped fBm + ridges) baked once into a 4096×2048 half‑float texture under the prelude; the surface shader reads it for albedo and smooth finite‑difference normals; ocean glint, terminator tint, bioluminescent night coasts | Nothing to download; ~5 ms/frame at 2000×1125 on an RTX 3050 laptop |
| Clouds      | Second sphere, animated fBm, wrap lighting, drifts faster than the surface | Transparent, no depth write |
| Atmosphere  | Back‑face shell, additive. Glow is a function of each view ray's closest approach to the planet, so the limb stays physically thin from far orbit down to the horizon shot | Produces the eclipse ring |
| Ithra       | Small procedural moon on a dotted orbit (points with a fading wake) that rings the title | Label is DOM, projected each frame |
| Deep field  | ~70 distant galaxies (elliptical point sprites) and a rare shooting star | Ambient only; off when motion is paused or reduced |
| Stars       | ~6,000 points (2,500 on small screens) on shells 70–400u; power‑law size, colour temperature, per‑star twinkle | Additive points, one draw call |
| Dust        | ~600 near particles 4–30u from camera | Gives real parallax when the camera drifts |
| Nebula      | Inside of a sky sphere, directional fBm in violet/abyss, very low intensity | Depth, never a wallpaper |
| Post        | Mipmap bloom (threshold‑gated), subtle vignette | Only bright pixels bloom |

Lighting is a single sun direction shared by every shader through one uniform, so the
crescent, cloud lighting and atmosphere glow always agree.

## Motion

One orchestrated arrival, then stillness with life in it.

| t (s)    | What happens | Curve |
|----------|--------------|-------|
| 0 – 2.2  | Stars and nebula fade up out of black | `power2.out` |
| 0 – 5.5  | Camera dollies from far away into orbit framing | `expo.out` (strong ease‑out) |
| 0.6 – 4.6| The sun swings from fully behind the planet to its final angle — the ring appears first, then the crescent grows | `power3.inOut` |
| 2.4 – 3.4| Wordmark letters resolve from blur, 70ms stagger | `cubic-bezier(0.23,1,0.32,1)` |
| 3.3      | Tagline | same |
| 3.6      | Button | same |
| 4.0      | HUD corners | same |

After arrival: the planet rotates (~1 rev / 6 min), clouds drift, stars twinkle, and the camera
follows the pointer with a damped spring‑like ease (max ±0.35u, small roll). Touch devices get
no hover effects and no pointer drift.

**Enter universe**: UI exits the way it entered (reverse stagger, 0.6s), the camera dives toward
the sunlit limb into a close orbit shot, exposure lifts briefly as you pass through the haze.
A **Return** control reverses it.

Reduced motion: no dolly, no dive, no drift, no twinkle; elements fade in place with shorter
timing. A visible **Pause motion** toggle offers the same to everyone.

## References — what we took, and how we changed it

AETHER borrows *ideas*, never layouts, assets or copy.

| Reference | Strongest idea | AETHER's version |
|-----------|----------------|------------------|
| **Equinox** (Little Workshop) | Narrative first, cinematic framing, one‑finger touch mode | Letterbox bars frame every moment the camera is *directing* (arrival, dive) and retract when control is handed to you. On touch, drag with one finger to look around. |
| **Outreach** (Rocani) | Typography on pure black before the world appears; story as fragments | A prelude: one quiet line on black (“Receiving Vael”) with a real load count, then the void opens into stars. |
| **Space Portfolio** (Allan Pinot) | Dotted orbital rings, labels on leader lines, an orrery you travel through | Vael's moon **Ithra** rides a dotted orbit that encircles the title like an orrery ring, labelled with a leader line. The same label system will carry the next milestone's system map. |
| **Galaxy Explorer** | Deep‑field richness, rare ambient events, cinema mode, FPS watchdog | Faint distant galaxies in the sky, an occasional shooting star (rare, never on a schedule you can feel), a *Hide interface* control, adaptive resolution. |

What we deliberately did **not** take: HUD frames and scanlines (Space Portfolio), the
illustrated cel look (Equinox), labelled‑everything density (Galaxy Explorer). AETHER stays
photographic and quiet; the UI appears only where it carries information.

## Arrival choreography (v2)

| t (s)     | Beat |
|-----------|------|
| prelude   | Black. “Receiving Vael” + load count (fonts, sky bake, shaders, first frame). |
| 0         | Prelude line dissolves; letterbox bars are already closed to 2.39:1. |
| 0 – 2.4   | Stars and nebula fade up. |
| 0 – 6.2   | Camera approach. Dust streams past the lens. |
| 0.5 – 4.7 | Sun swings out from behind Vael: ring first, then crescent. |
| 2.5 – 3.9 | Wordmark resolves, 70ms stagger. |
| 3.4 / 3.7 | Tagline, then ENTER UNIVERSE. |
| 4.1       | Letterbox retracts, HUD and Ithra's orbit label appear — you have control. |

## Components

- `scene/Experience` — Canvas, adaptive DPR, post stack.
- `scene/Planet` — terrain bake, surface, clouds, atmosphere; sun from `scene/sun`.
- `scene/Ithra` — moon + dotted orbit. `ui/OrbitLabel` — its leader‑line label.
- `scene/Starfield`, `scene/Dust`, `scene/Nebula` — background layers.
- `scene/CameraRig` — framing math, arrival dolly, pointer drift, dive.
- `ui/TitleScreen` — prelude, letterbox, wordmark, CTA, low‑orbit panel and every GSAP timeline.
- `ui/Wordmark`, `ui/Hud` — title letters; corners, motion and cinema toggles (H).
- `?shot=orbit` / `?shot=low` jump to a settled shot for review.
- `state/director` — a plain mutable object GSAP tweens and `useFrame` reads (no React renders
  per frame). `state/useExperience` — Zustand store for phase and preferences.

## Principles

1. **Light is the accent.** Colour comes from emission and scattering, not decoration.
2. **One image, held.** A single composition, built in one sequence, then left alone.
3. **Quiet interface.** Hairline borders, no glass panels, no cards.
4. **Earned detail.** Readouts say something true about the scene (distance closes as you
   arrive), or they don't exist.
