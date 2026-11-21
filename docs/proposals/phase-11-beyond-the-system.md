# Phase 11 — Beyond the System (proposal)

Status: **agreed, in progress.** Decisions: **Tessaly first** (binary star, one circumbinary world),
**story-gated** unlocking, the **universe map as its own view**. Built so far: 11a (registry) and 11b
(read-only map) — see DESIGN.md §17. Next: 11c, Tessaly.

## The idea in one paragraph

Elys stays the heart of AETHER. The rest of the universe is not a catalogue to tick off.
It is where the existing mystery points. Expedition I ends with the moonlet singing a fourth
note, and Expedition II follows four voices that are "there only some of the time". Phase 11
lets those voices lead somewhere: a handful of other star systems and deep-space sites,
reached one at a time, each earned through the story the visitor is already following. The
visitor never pilots a ship. They choose a destination and the camera takes them there, the
same way it already takes them from Vael to the galaxy.

## 1. Universe structure

```
Universe
├── Elys system (home; always first, always reachable)       ← today's experience, unchanged
├── Star systems (2–4 at first, more later)
│   ├── star: spectral type, colour, size, mass
│   ├── worlds: 2–5 per system (same PlanetData shape as today)
│   │   └── locations → discoveries (same catalogue shape)
│   └── lore, expedition hooks
└── Deep-space sites (between systems)
    ├── nebula        — a place to be inside, not just a backdrop
    ├── asteroid field
    ├── derelict station
    └── anomalies     — the source of the signal, eventually
```

Proposed first destinations. Names and details are placeholders to agree on:

| Destination | Kind | Why it exists in the story |
|-------------|------|----------------------------|
| **Caer** | Red dwarf with three worlds. One is tidally locked, with a permanent day/night line; one is an ice moon of a small giant | The direction Expedition II's closing record points. The fourth note is loudest here |
| **The Veil** | Emission nebula, a deep-space site | Lies between Elys and Caer. The transit passes through it; one scannable "anomaly" inside |
| **Halcyon Station** | Derelict array in a slow orbit around nothing | Whoever built the Listening Array also built this. Their records, in the existing story-fragment form |
| **Tessaly** | Binary star with one circumbinary world | A later system. Its sky has two suns, a showcase for the existing living-sky shaders |

Scale stays small and deliberate. Each system is a complete, crafted place, like Elys, not
procedural filler.

## 2. How other systems connect to Elys

- **Narratively:** through expeditions. Expedition III (after II) unlocks the Veil and Caer.
  Later expeditions span systems and use the same objective model (`requires: discoveryId[]`,
  derived progress). A system is *sealed* until an expedition opens it. The journal's
  "sealed" pattern already reads this way.
- **Spatially:** every system has a position in the spiral galaxy AETHER already draws
  (`SpiralGalaxy`, 70 k points). Elys sits at its current place, and the others sit along
  an arm, so the backdrop the visitor has watched all along becomes the map.
- **In motion:** system to system is a *transit*, a cinematic sequence built from what
  exists:
  1. climb out of the system (the galaxy outro);
  2. warp (`WarpStreaks`, from Vael → galaxy);
  3. optionally pass through a deep-space site on the way (the Veil);
  4. arrive in the new system's intro framing (`enterGalaxyIntro`, parameterised).
- **Returning home** is always one action: "Return to Elys", like today's "Return to Vael".

## 3. Technical architecture

### A system registry (the one structural change)

Today `PLANETS` is a single list and `PlanetId` a closed union of six names. Proposed:

```ts
// data/systems.ts — always loaded, tiny (~2 kB): what the map needs
interface SystemMeta {
  id: 'elys' | 'caer' | …
  name, star: { type, color, radiusKm, mass }
  position: [x, y, z]            // in the spiral galaxy
  unlock: { always: true } | { expedition: id }
  load: () => Promise<SystemPack> // the rest, on demand
}

// systems/<id>/index.ts — one chunk per system, loaded on approach
interface SystemPack {
  worlds: PlanetData[]           // the existing shape
  locations, discoveries, surfaces, fragments
  kinds?: shader recipe additions (new defines, not new pipelines)
}
```

- **Elys becomes system 1 with zero behaviour change.** Its data stays in the main bundle
  and its ids stay exactly as they are, so every saved `discovered[id]` remains valid. New
  systems use globally unique location ids, prefixed by system.
- **One active system.** Only the system the visitor is in is mounted: its worlds, bakes,
  moons and orbit paths. Leaving a system disposes its world bake targets (1536 × 768
  each). `galaxy.positions` becomes keyed by the active system.
- **One progress store, one clock.** `discovered` stays a flat map. `sim.day` stays the
  universal clock, and each system's orbits use its own epoch phases. `computeEvents`
  takes a system; events are per system.
- **Spaces:** `director.space` gains `'transit'` (the warp between systems) and `'site'`
  (deep-space sites). A site reuses the surface pattern: a lazily loaded scene, a free-look
  rig and the same scanner. Sites are just "locations without a planet".
- **Deep-space content stays procedural**, per PRODUCT.md (no texture downloads):
  - nebula: layered volumetric slices or a raymarched density, baked into the sky the way
    `Nebula.tsx` already bakes;
  - asteroid field: `InstancedMesh` with noise-displaced rocks;
  - station: procedural modules (cylinders, trusses, panels), with lights that still work;
  - anomalies: shader-only.
- **The map** (§4) reads only `SystemMeta`, so it can open without loading any system.

### Persistence

`aether-exploration` stays at v2 until a migration is truly needed. New fields:
- `systemsVisited: Record<id, timestamp>` (as `visited` is for worlds);
- the current system (where a reload returns you).

## 4. Universe map

A **zoom-out**, not a new screen:

- From the Elys galaxy view (or the Observatory), pulling back past the system's edge
  continues the same camera into the spiral galaxy. The six worlds collapse into Elys's
  point of light, and other systems appear as labelled stars on the arm.
- **Shown:**
  - Elys and its worlds (a small inset ring at the home point);
  - systems: visited (full light), known (dim), sealed (only a faint "unresolved signal"
    marker);
  - deep-space sites;
  - **expedition routes:** the active expedition's next destination as a thin ion arc from
    where you are; completed routes as faint violet arcs. The same colour language as the
    Observatory's lines of sight;
  - **unexplored regions:** sectors of the arm the visitor has never seen, slightly veiled
    (a density fade in the existing galaxy points, not fog sprites).
- **Interaction:** select a star to see what is known (the Observatory's record style), then
  *Travel* (transit) or *Show in journal*. Keyboard: arrows between known destinations.
- **Rendering:** the existing `SpiralGalaxy` points plus at most a few dozen marker
  sprites and route lines. Effectively no new GPU cost.

## 5. Visual direction

- **Each star sets the palette of its system**, the way Elys's warmth sets today's.
  Caer is red-orange and dim, so long shadows and ember skies. Tessaly is two suns, one
  white and one gold, with double shadows from the existing N·L lighting run twice.
- **Typography, interface and motion stay exactly AETHER's:** Italiana titles, Manrope,
  ion/violet accents, lower-third records, hairline rules. New systems inherit the
  interface; they do not restyle it.
- **Deep space is quieter than systems:** fewer interface elements, more darkness, sound
  carrying more of the mood (a new ambience bed per site, synthesised like today's).
- **The transit is a single held shot:** stars stretching, the nebula passing as colour on
  the streaks, the new star resolving ahead.

## 6. Phased implementation

| Step | Scope | Visible change | Risk |
|------|-------|----------------|------|
| **11a — Registry** | `SystemMeta`/`SystemPack`; Elys moved behind the registry; `PlanetId` widened; `galaxy.positions` per active system | None (a refactor, verified by playing the whole current journey) | Medium: touches many files; covered by the existing end-to-end checks |
| **11b — Map (read-only)** | Zoom-out to the spiral; Elys, one sealed signal, no travel | The galaxy now has a "beyond" | Low |
| **11c — Transit + Caer (vertical slice)** | Expedition III, the transit, Caer with 3 worlds × 2 locations, its events | The first new system, end to end | High: the real test of the architecture |
| **11d — One deep-space site** | Halcyon Station (the `site` space, scanner reuse) | A destination that is not a planet | Medium |
| **11e — The Veil + routes** | Nebula transit pass-through, expedition routes on the map | The universe feels connected | Medium |
| Later | Tessaly; more sites | — | — |

Each step ships on its own and leaves the experience complete.

## 7. Performance challenges

| Challenge | Approach |
|-----------|----------|
| Bundle growth | Each system and site is its own lazy chunk (`memoImport`, Phase 10); first visit unchanged. Budget: ≤ 30 kB gzipped per system |
| Shader compile hitches on arrival | Precompile the next system's materials *during the warp* (`gl.compileAsync`), when nothing needs to be smooth |
| GPU memory | One mounted system; dispose bakes and geometries on leaving (Phase 10 pattern); measure with `gl.info.memory` per transit |
| Galaxy-map draw cost | Reuse the existing 70 k / 26 k galaxy points; markers and routes are tens of objects |
| Nebula fill cost | Bake to the sky cube once per visit (as `Nebula.tsx`); never raymarch per frame on the low tier |
| Event solving | Per system, active system only (the solve already caches; ~50 ms worst case) |
| Save data | Flat maps stay small (hundreds of ids); no migration in 11a |
| Testing load | Every step keeps the GPU timer measurements from Phase 10 as a regression check |

## Decisions needed from you

1. The first new system's character. Is Caer (red dwarf, tidally locked world) right?
2. Is unlocking through expeditions (story-gated) right, or should the map allow free
   travel to any revealed system?
3. Should the universe map be part of the Observatory (see the Phase 12 proposal), or its
   own view?
