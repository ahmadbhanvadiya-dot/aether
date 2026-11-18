# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Designers and developers who follow real-time 3D and interface craft on the web. They arrive
by link, often on a quick visit, and notice technique, detail, motion and performance. The
experience must also hold up for any curious visitor, on desktop and phone.

## Product Purpose

AETHER is a personal art piece: a cinematic, real-time 3D journey through an invented star
system, made for its own sake and shared publicly. It succeeds when a visitor stays to explore
and comes away remembering a specific image or moment, not when they convert to anything.

## Positioning

An explorable universe built entirely in the browser: every planet, star, sky and surface is
generated on the GPU, with no texture downloads, and the whole journey (arrival, galaxy,
surfaces) runs as one continuous scene rather than a set of pages.

## Operating Context

- Visited at <https://ahmadbhanvadiya-dot.github.io/aether/>, deployed from
  `ahmadbhanvadiya-dot/aether` on every push to `main`.
- Experienced in a browser on desktop and phone; sessions range from a single look to a full
  exploration of all six worlds.
- Progress (discoveries) and preferences (sound) persist in the visitor's own browser.

## Capabilities and Constraints

- Phases 1–3 are live: arrival at Vael, the Aether system with six worlds, planet surfaces
  with 18 discoverable locations. Phase 4 (Observatory) and Phase 5 (Final Polish) are planned.
- Static site with no backend: everything runs client-side and deploys to GitHub Pages.
- No accounts, sign-in, analytics or tracking; no data leaves the browser.
- Every experience must work on a mobile browser, not only on desktop.
- Stack: React, Vite, TypeScript, three.js / React Three Fiber, GSAP, Zustand, Tailwind CSS.

## Brand Commitments

- Name: AETHER. Tagline: "Beyond the known."
- The universe is fictional: worlds, facts and lore are invented and are never presented as
  real science.
- The visual system, voice and motion rules are recorded in DESIGN.md.

## Evidence on Hand

- All content is original and lives in code: `src/data/planets.ts` (six worlds) and
  `src/data/locations.ts` (18 locations with lore).
- There are no testimonials, metrics, press or real visitor data; statistics shown in the
  product must be derived from the visitor's own state, never invented.

## Product Principles

1. The world comes first; interface is secondary and quiet.
2. Every number and fact on screen is true within the fiction and computed from real state.
3. One continuous journey: moving between experiences is a camera move, not a page load.
4. Craft is the point: detail, motion and performance hold up to a designer's scrutiny.
5. Respect the visitor's device and preferences: phones, reduced motion, sound off.

## Accessibility & Inclusion

Respect `prefers-reduced-motion` everywhere (gentler, not absent motion); keep every 3D
interaction reachable from DOM controls and the keyboard; visible focus; no flashing content
in reduced-motion mode.
