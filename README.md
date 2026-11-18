# AETHER

A cinematic, real-time 3D space expedition. Arrive at the ocean world Vael, then jump into the Aether system and explore six worlds around the star Elys.

Built with React, Vite, TypeScript, Three.js, React Three Fiber, GSAP, Zustand and Tailwind CSS. Every planet, star and nebula is generated on the GPU; there are no texture downloads.

## Run locally

```bash
npm install
npm run dev
```

## Controls

- **Title screen:** move the cursor (or drag on touch) to drift; press **Enter Universe** to jump.
- **Galaxy:** drag to rotate, scroll or pinch to zoom, hover a world for its name, click to fly there.
- **Keyboard:** `Esc` returns to the galaxy, `←` / `→` step between worlds, `H` hides the interface.
- **Review shortcuts:** `?shot=orbit`, `?shot=galaxy`, or `?shot=<world>` (for example `?shot=orion`).

See [DESIGN.md](DESIGN.md) for the visual system.
