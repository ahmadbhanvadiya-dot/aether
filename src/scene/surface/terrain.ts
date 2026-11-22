import type { Place, ShapeKind, SurfaceSettings } from '../../data/locations'

/**
 * Terrain height, implemented twice — GLSL for the GPU, TypeScript for the CPU —
 * with the same integer hash (PCG) so both agree to float precision. The CPU
 * copy places the camera, landmarks and signals exactly on the rendered ground.
 *
 * Keep the two implementations in lock-step: any change to one must be made to
 * the other.
 */

export const SHAPE_IDS: Record<ShapeKind, number> = {
  none: 0,
  coast: 1,
  crater: 2,
  canyon: 3,
  volcano: 4,
  atoll: 5,
  abyss: 6,
}

export const KIND_IDS: Record<SurfaceSettings['kind'], number> = {
  terrestrial: 0,
  dark: 1,
  desert: 2,
  deck: 3,
  ocean: 4,
  giant: 5,
}

// ---------------------------------------------------------------------------
// GLSL
// ---------------------------------------------------------------------------

/** Requires #define SEED <uint>u and #define SKIND <int>. */
export const terrainGLSL = /* glsl */ `
uniform vec4 uLocA[3]; // center.x, center.z, radius, lift
uniform vec4 uLocB[3]; // rough, shape, a, b

uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

float hash2(ivec2 c) {
  uint h = pcg(pcg(uint(c.x + 4096)) + uint(c.y + 4096) + SEED);
  return float(h) / 4294967295.0;
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec2 c = ivec2(i);
  float a = hash2(c);
  float b = hash2(c + ivec2(1, 0));
  float d = hash2(c + ivec2(0, 1));
  float e = hash2(c + ivec2(1, 1));
  return mix(mix(a, b, u.x), mix(d, e, u.x), u.y) * 2.0 - 1.0;
}

float fbm2(vec2 p, int oct) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    sum += amp * vnoise(p);
    p = vec2(0.8 * p.x - 0.6 * p.y, 0.6 * p.x + 0.8 * p.y) * 2.02;
    amp *= 0.5;
  }
  return sum;
}

float ridged2(vec2 p, int oct) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(vnoise(p));
    sum += amp * n * n;
    p = vec2(0.8 * p.x - 0.6 * p.y, 0.6 * p.x + 0.8 * p.y) * 2.02;
    amp *= 0.5;
  }
  return sum;
}

float baseHeight(vec2 p) {
#if SKIND == 0
  float cont = fbm2(p * 0.0016, 5);
  float m = ridged2(p * 0.0055, 5);
  return cont * 60.0 + 4.0 + m * m * 140.0 * smoothstep(0.05, 0.4, cont) + fbm2(p * 0.03, 3) * 2.5;
#elif SKIND == 1
  return fbm2(p * 0.0025, 5) * 40.0 + ridged2(p * 0.011, 4) * 22.0 + fbm2(p * 0.04, 2) * 1.5 - 10.0;
#elif SKIND == 2
  float base = fbm2(p * 0.0016, 4) * 35.0;
  float phase = (p.x * 0.86 + p.y * 0.5) * 0.035 + fbm2(p * 0.002, 3) * 7.0;
  float dune = pow(0.5 + 0.5 * sin(phase), 1.6) * 24.0;
  float mask = smoothstep(-0.3, 0.2, fbm2(p * 0.0009, 2));
  return base + dune * mask + fbm2(p * 0.05, 2) * 0.6;
#elif SKIND == 3
  return fbm2(p * 0.008, 4) * 7.0 + fbm2(p * 0.0015, 3) * 10.0;
#elif SKIND == 4
  return fbm2(p * 0.002, 5) * 40.0 - 26.0 + ridged2(p * 0.008, 3) * 10.0;
#else
  return fbm2(vec2(p.x * 0.004, p.y * 0.012), 4) * 5.0 + fbm2(p * 0.0012, 3) * 8.0;
#endif
}

float terrainHeight(vec2 p) {
  float h = baseHeight(p);
  for (int i = 0; i < 3; i++) {
    vec2 d = p - uLocA[i].xy;
    float dist = length(d);
    float R = uLocA[i].z;
    float w = exp(-(dist * dist) / (R * R));
    h = mix(h, h * uLocB[i].x + uLocA[i].w, w);
    int shape = int(uLocB[i].y + 0.5);
    float a = uLocB[i].z;
    float b = uLocB[i].w;
    if (shape == 1) {
      h += a * (d.x * cos(b) + d.y * sin(b)) * w;
    } else if (shape == 2) {
      h += -b * (1.0 - smoothstep(0.0, a, dist));
      float k = (dist - a) / (a * 0.16);
      h += b * 0.6 * exp(-k * k);
    } else if (shape == 3) {
      float x = d.x + 18.0 * sin(d.y * 0.018);
      float along = 1.0 - smoothstep(R * 0.6, R, abs(d.y));
      h += -b * (1.0 - smoothstep(a * 0.35, a, abs(x))) * along;
    } else if (shape == 4) {
      h += b * pow(max(0.0, 1.0 - dist / a), 1.6);
      h += -b * 0.18 * (1.0 - smoothstep(0.0, a * 0.08, dist));
    } else if (shape == 5) {
      float k = (dist - a) / 14.0;
      h += b * exp(-k * k);
    } else if (shape == 6) {
      h += -b * (1.0 - smoothstep(a * 0.2, a, dist));
    }
  }
  return h;
}
`

// ---------------------------------------------------------------------------
// TypeScript mirror
// ---------------------------------------------------------------------------

const U32 = 4294967295

function pcg(v: number) {
  const state = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0
  const word = Math.imul(((state >>> ((state >>> 28) + 4)) ^ state) >>> 0, 277803737) >>> 0
  return ((word >>> 22) ^ word) >>> 0
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

export interface LocField {
  cx: number
  cz: number
  radius: number
  lift: number
  rough: number
  shape: number
  a: number
  b: number
}

export function locFields(locations: Place[]): LocField[] {
  return locations.map((l) => ({
    cx: l.center[0],
    cz: l.center[1],
    radius: l.terrain.radius,
    lift: l.terrain.lift,
    rough: l.terrain.rough,
    shape: SHAPE_IDS[l.terrain.shape],
    a: l.terrain.a,
    b: l.terrain.b,
  }))
}

/** CPU height sampler for one world. */
export function makeHeightFn(kindId: number, seed: number, locs: LocField[]) {
  const hash2 = (x: number, y: number) => pcg((pcg((x + 4096) >>> 0) + (y + 4096) + seed) >>> 0) / U32

  const vnoise = (px: number, py: number) => {
    const ix = Math.floor(px)
    const iy = Math.floor(py)
    const fx = px - ix
    const fy = py - iy
    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
    const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
    const a = hash2(ix, iy)
    const b = hash2(ix + 1, iy)
    const d = hash2(ix, iy + 1)
    const e = hash2(ix + 1, iy + 1)
    const top = a + (b - a) * ux
    const bot = d + (e - d) * ux
    return (top + (bot - top) * uy) * 2 - 1
  }

  const fbm2 = (px: number, py: number, oct: number) => {
    let sum = 0
    let amp = 0.5
    for (let i = 0; i < oct; i++) {
      sum += amp * vnoise(px, py)
      const nx = (0.8 * px - 0.6 * py) * 2.02
      const ny = (0.6 * px + 0.8 * py) * 2.02
      px = nx
      py = ny
      amp *= 0.5
    }
    return sum
  }

  const ridged2 = (px: number, py: number, oct: number) => {
    let sum = 0
    let amp = 0.5
    for (let i = 0; i < oct; i++) {
      const n = 1 - Math.abs(vnoise(px, py))
      sum += amp * n * n
      const nx = (0.8 * px - 0.6 * py) * 2.02
      const ny = (0.6 * px + 0.8 * py) * 2.02
      px = nx
      py = ny
      amp *= 0.5
    }
    return sum
  }

  const baseHeight = (x: number, z: number) => {
    switch (kindId) {
      case 0: {
        const cont = fbm2(x * 0.0016, z * 0.0016, 5)
        const m = ridged2(x * 0.0055, z * 0.0055, 5)
        return cont * 60 + 4 + m * m * 140 * smoothstep(0.05, 0.4, cont) + fbm2(x * 0.03, z * 0.03, 3) * 2.5
      }
      case 1:
        return fbm2(x * 0.0025, z * 0.0025, 5) * 40 + ridged2(x * 0.011, z * 0.011, 4) * 22 + fbm2(x * 0.04, z * 0.04, 2) * 1.5 - 10
      case 2: {
        const base = fbm2(x * 0.0016, z * 0.0016, 4) * 35
        const phase = (x * 0.86 + z * 0.5) * 0.035 + fbm2(x * 0.002, z * 0.002, 3) * 7
        const dune = Math.pow(0.5 + 0.5 * Math.sin(phase), 1.6) * 24
        const mask = smoothstep(-0.3, 0.2, fbm2(x * 0.0009, z * 0.0009, 2))
        return base + dune * mask + fbm2(x * 0.05, z * 0.05, 2) * 0.6
      }
      case 3:
        return fbm2(x * 0.008, z * 0.008, 4) * 7 + fbm2(x * 0.0015, z * 0.0015, 3) * 10
      case 4:
        return fbm2(x * 0.002, z * 0.002, 5) * 40 - 26 + ridged2(x * 0.008, z * 0.008, 3) * 10
      default:
        return fbm2(x * 0.004, z * 0.012, 4) * 5 + fbm2(x * 0.0012, z * 0.0012, 3) * 8
    }
  }

  return (x: number, z: number) => {
    let h = baseHeight(x, z)
    for (const l of locs) {
      const dx = x - l.cx
      const dz = z - l.cz
      const dist = Math.hypot(dx, dz)
      const w = Math.exp(-(dist * dist) / (l.radius * l.radius))
      h = h + (h * l.rough + l.lift - h) * w
      const { a, b } = l
      switch (l.shape) {
        case 1:
          h += a * (dx * Math.cos(b) + dz * Math.sin(b)) * w
          break
        case 2: {
          h += -b * (1 - smoothstep(0, a, dist))
          const k = (dist - a) / (a * 0.16)
          h += b * 0.6 * Math.exp(-k * k)
          break
        }
        case 3: {
          const xx = dx + 18 * Math.sin(dz * 0.018)
          const along = 1 - smoothstep(l.radius * 0.6, l.radius, Math.abs(dz))
          h += -b * (1 - smoothstep(a * 0.35, a, Math.abs(xx))) * along
          break
        }
        case 4:
          h += b * Math.pow(Math.max(0, 1 - dist / a), 1.6)
          h += -b * 0.18 * (1 - smoothstep(0, a * 0.08, dist))
          break
        case 5: {
          const k = (dist - a) / 14
          h += b * Math.exp(-k * k)
          break
        }
        case 6:
          h += -b * (1 - smoothstep(a * 0.2, a, dist))
          break
      }
    }
    return h
  }
}

/**
 * A polar grid: dense under the camera, sparse at the horizon. Ring spacing
 * grows geometrically so vertex density roughly matches screen density.
 */
export function polarGrid(rings: number, segments: number, first: number, ratio: number) {
  const radii: number[] = [0]
  let r = 0
  let step = first
  for (let i = 0; i < rings; i++) {
    r += step
    radii.push(r)
    step *= ratio
  }
  const positions = new Float32Array((1 + rings * segments) * 3)
  let o = 3
  for (let i = 1; i <= rings; i++) {
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2
      positions[o++] = Math.cos(a) * radii[i]
      positions[o++] = 0
      positions[o++] = Math.sin(a) * radii[i]
    }
  }
  const index: number[] = []
  for (let s = 0; s < segments; s++) index.push(0, 1 + ((s + 1) % segments), 1 + s)
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segments
    const b0 = 1 + i * segments
    for (let s = 0; s < segments; s++) {
      const s1 = (s + 1) % segments
      index.push(a0 + s, a0 + s1, b0 + s)
      index.push(a0 + s1, b0 + s1, b0 + s)
    }
  }
  return { positions, index, outer: r }
}
