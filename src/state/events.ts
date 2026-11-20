import { Vector3 } from 'three'
import { ELYS, MOONS, moonOffsetKm, orbitAngle, planetKm, type MoonInfo } from '../data/astronomy'
import { PLANET_BY_ID, PLANETS, type PlanetId } from '../data/planets'

/**
 * Phase 9: celestial events, solved from the simulation's own geometry — the same
 * functions that place the worlds and moons in the scene. Nothing is scripted.
 *
 * - Conjunctions and oppositions (two worlds in line with Elys, on one side or
 *   opposite): orbital angles are linear in time, so their times are exact.
 * - Transits (an inner world crossing the face of Elys as seen from an outer one):
 *   tested at every conjunction against the true 3‑D positions; the orbits share a
 *   line of nodes, so they happen only near it — rare, as they should be.
 * - Alignments (three or more worlds within a narrow arc): found by sampling daily.
 * - Moon events: a moon crossing its world's face as seen from Elys (its shadow
 *   on the day side: a total solar eclipse where the umbra reaches the ground, a
 *   shadow transit otherwise), and a moon inside its world's shadow (a lunar
 *   eclipse). Sampled finely, edges refined by bisection.
 */

export type EventKind = 'alignment' | 'conjunction' | 'opposition' | 'transit' | 'solar-eclipse' | 'shadow-transit' | 'lunar-eclipse'

export const EVENT_KINDS: Record<EventKind, string> = {
  alignment: 'Alignment',
  conjunction: 'Conjunction',
  opposition: 'Opposition',
  transit: 'Transit of Elys',
  'solar-eclipse': 'Solar eclipse',
  'shadow-transit': 'Moon transit',
  'lunar-eclipse': 'Lunar eclipse',
}

export interface CelestialEvent {
  id: string
  kind: EventKind
  title: string
  detail: string
  start: number
  peak: number
  end: number
  /** Worlds involved, for the dial and per‑world listings. */
  bodies: PlanetId[]
}

const TAU = Math.PI * 2
const DEG = Math.PI / 180
const name = (id: PlanetId) => PLANET_BY_ID[id].name
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

const A = new Vector3()
const B = new Vector3()
const S = new Vector3()
const M = new Vector3()
const U = new Vector3()

/** Bisection for the boundary of a predicate between a (false) and b (true). */
function edge(test: (t: number) => boolean, a: number, b: number) {
  for (let i = 0; i < 18; i++) {
    const m = (a + b) / 2
    if (test(m)) b = m
    else a = m
  }
  return b
}

// ---------------------------------------------------------------------------
// Worlds

/** Pairs of worlds, inner first. */
const PAIRS: [PlanetId, PlanetId][] = []
PLANETS.forEach((p, i) => PLANETS.slice(i + 1).forEach((q) => PAIRS.push([p.id, q.id])))

const CONJ_WINDOW = 1 * DEG

/** Is `inner` on the face of Elys, seen from `outer`? */
function transiting(inner: PlanetId, outer: PlanetId, day: number) {
  planetKm(inner, day, A)
  planetKm(outer, day, B)
  S.copy(B).multiplyScalar(-1) // outer → Elys
  A.sub(B) // outer → inner
  if (A.lengthSq() > S.lengthSq()) return false
  const sep = A.angleTo(S)
  const rho = Math.asin(ELYS.radiusKm / S.length()) + PLANET_BY_ID[inner].radiusKm / A.length()
  return sep < rho
}

function pairEvents(from: number, to: number, transitTo: number, out: CelestialEvent[]) {
  for (const [i, j] of PAIRS) {
    const pi = PLANET_BY_ID[i]
    const pj = PLANET_BY_ID[j]
    // Δ(t) = λi − λj = Δ0 + ω t, exactly linear.
    const omega = -TAU * (1 / pi.yearDays - 1 / pj.yearDays)
    const d0 = orbitAngle(pi, 0) - orbitAngle(pj, 0)
    const synodic = TAU / Math.abs(omega)
    const half = CONJ_WINDOW / Math.abs(omega)
    for (const [kind, target] of [
      ['conjunction', 0],
      ['opposition', Math.PI],
    ] as const) {
      // First t with Δ(t) ≡ target near `from − half`.
      let t = (target - d0) / omega
      t += Math.ceil((from - half - t) / synodic) * synodic
      const limit = kind === 'conjunction' ? Math.max(to, transitTo) : to
      for (; t <= limit; t += synodic) {
        if (kind === 'conjunction' && transiting(i, j, t)) {
          const start = edge((x) => transiting(i, j, x), t - 3, t)
          const end = edge((x) => transiting(i, j, x), t + 3, t)
          out.push({
            id: `transit-${i}-${j}-${Math.round(t)}`,
            kind: 'transit',
            title: `${cap(name(i))} crosses Elys`,
            detail: `Seen from ${cap(name(j))}, ${cap(name(i))} passes across the face of Elys — a small dark disc on the star.`,
            start,
            peak: t,
            end,
            bodies: [i, j],
          })
        }
        if (t > to) continue
        out.push(
          kind === 'conjunction'
            ? {
                id: `conj-${i}-${j}-${Math.round(t)}`,
                kind,
                title: `${cap(name(i))} and ${cap(name(j))} in conjunction`,
                detail: `${cap(name(i))} passes between Elys and ${cap(name(j))}: the two worlds on one line from the star.`,
                start: t - half,
                peak: t,
                end: t + half,
                bodies: [i, j],
              }
            : {
                id: `opp-${i}-${j}-${Math.round(t)}`,
                kind,
                title: `${cap(name(i))} and ${cap(name(j))} in opposition`,
                detail: `The two worlds stand on opposite sides of Elys; from ${cap(name(j))}, ${cap(name(i))} is lost in the star's glare.`,
                start: t - half,
                peak: t,
                end: t + half,
                bodies: [i, j],
              },
        )
      }
    }
  }
}

/** Smallest arc holding `k` of the worlds at `day`, and which worlds. */
function tightest(day: number, k: number) {
  const a = PLANETS.map((p) => ({ id: p.id, l: ((orbitAngle(p, day) % TAU) + TAU) % TAU })).sort((x, y) => x.l - y.l)
  let best = Infinity
  let members: PlanetId[] = []
  for (let s = 0; s < a.length; s++) {
    const e = (s + k - 1) % a.length
    const arc = (((a[e].l - a[s].l) % TAU) + TAU) % TAU
    if (arc < best) {
      best = arc
      members = Array.from({ length: k }, (_, n) => a[(s + n) % a.length].id)
    }
  }
  return { arc: best, members }
}

/** Alignments: four or more worlds inside 40°, or three inside 6°. */
const ALIGN: [number, number][] = [
  [4, 40 * DEG],
  [3, 6 * DEG],
]

function alignmentEvents(from: number, to: number, out: CelestialEvent[]) {
  for (const [k, limit] of ALIGN) {
    let open: { start: number; peak: number; arc: number; members: PlanetId[] } | null = null
    for (let t = Math.floor(from); t <= to + 1; t += 1) {
      const { arc, members } = tightest(t, k)
      if (arc <= limit) {
        if (!open) open = { start: t, peak: t, arc, members }
        else if (arc < open.arc) Object.assign(open, { peak: t, arc, members })
      } else if (open) {
        // A three-world alignment inside a four-world one is the same sky.
        const order = PLANETS.map((p) => p.id)
        const bodies = open.members.slice().sort((x, y) => order.indexOf(x) - order.indexOf(y))
        const dup = out.some((e) => e.kind === 'alignment' && e.peak - 30 < open!.peak && e.end + 30 > open!.start && bodies.every((b) => e.bodies.includes(b)))
        if (!dup) {
          const list = bodies.map((b) => cap(name(b)))
          out.push({
            id: `align-${k}-${Math.round(open.peak)}`,
            kind: 'alignment',
            title: k >= 4 ? `${k} worlds aligned` : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]} aligned`,
            detail: `${list.join(', ')} gather within ${Math.max(1, Math.round(open.arc / DEG))}° of one another as seen from Elys.`,
            start: open.start,
            peak: open.peak,
            end: t - 1,
            bodies,
          })
        }
        open = null
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Moons

interface MoonGeometry {
  /** Toward Elys from the world. */
  along: number
  perp: number
  D: number
}

function moonGeometry(m: MoonInfo, day: number, g: MoonGeometry) {
  planetKm(m.planet, day, A)
  moonOffsetKm(m, day, M)
  g.D = A.length()
  U.copy(A).multiplyScalar(-1 / g.D)
  g.along = M.dot(U)
  g.perp = S.copy(M).addScaledVector(U, -g.along).length()
  return g
}

const geo: MoonGeometry = { along: 0, perp: 0, D: 1 }

function shadowOnWorld(m: MoonInfo, day: number) {
  moonGeometry(m, day, geo)
  if (geo.along <= 0) return false
  const Rp = PLANET_BY_ID[m.planet].radiusKm
  const penumbra = m.radiusKm + (geo.along * (ELYS.radiusKm + m.radiusKm)) / geo.D
  return geo.perp < Rp + penumbra
}

function inWorldShadow(m: MoonInfo, day: number) {
  moonGeometry(m, day, geo)
  if (geo.along >= 0) return false
  const Rp = PLANET_BY_ID[m.planet].radiusKm
  const umbra = Rp - (-geo.along * (ELYS.radiusKm - Rp)) / geo.D
  return geo.perp < umbra + m.radiusKm
}

function moonEvents(from: number, to: number, out: CelestialEvent[]) {
  for (const m of MOONS) {
    const step = m.periodDays / 72
    const world = cap(name(m.planet))
    for (const [kind, test] of [
      ['shadow', shadowOnWorld],
      ['lunar', inWorldShadow],
    ] as const) {
      let prev = test(m, from)
      for (let t = from + step; t <= to; t += step) {
        const now = test(m, t)
        if (now && !prev) {
          const start = edge((x) => test(m, x), t - step, t)
          let end = t
          while (test(m, end) && end < to + m.periodDays) end += step / 4
          end = edge((x) => test(m, x), end, end - step / 4)
          const peak = (start + end) / 2
          if (kind === 'lunar') {
            out.push({
              id: `lunar-${m.name}-${peak.toFixed(2)}`,
              kind: 'lunar-eclipse',
              title: `Eclipse of ${m.name}`,
              detail: `${m.name} passes through ${world}'s shadow and goes dark for ${hours(end - start)}.`,
              start,
              peak,
              end,
              bodies: [m.planet],
            })
          } else {
            // Does the umbra reach the ground? Its length behind the moon: R·D/(R_E − R).
            moonGeometry(m, peak, geo)
            const umbraLength = (m.radiusKm * geo.D) / (ELYS.radiusKm - m.radiusKm)
            const total = geo.along - PLANET_BY_ID[m.planet].radiusKm < umbraLength
            out.push(
              total
                ? {
                    id: `solar-${m.name}-${peak.toFixed(2)}`,
                    kind: 'solar-eclipse',
                    title: `Total eclipse on ${world}`,
                    detail: `${m.name} covers Elys completely; its shadow crosses ${world}'s day side for ${hours(end - start)}.`,
                    start,
                    peak,
                    end,
                    bodies: [m.planet],
                  }
                : {
                    id: `shadow-${m.name}-${peak.toFixed(2)}`,
                    kind: 'shadow-transit',
                    title: `${m.name} crosses ${world}`,
                    detail: `${m.name} passes across the face of ${world}, its shadow a dark point on the clouds; too small to hide Elys.`,
                    start,
                    peak,
                    end,
                    bodies: [m.planet],
                  },
            )
          }
        }
        prev = now
      }
    }
  }
}

const hours = (days: number) => {
  const h = days * 24
  return h < 1.5 ? `${Math.max(1, Math.round(h * 60))} minutes` : `${h.toFixed(1)} hours`
}

// ---------------------------------------------------------------------------

/** How far ahead each family is searched. */
export const HORIZON = { worlds: 365.25 * 12, transits: 365.25 * 80, moons: 90 }

/** World events change slowly: they are solved for 12 years and reused for 2. */
let worldCache: { from: number; events: CelestialEvent[] } | null = null

/** Every event overlapping [from, from + horizon], sorted by peak. */
export function computeEvents(from: number): CelestialEvent[] {
  if (!worldCache || from < worldCache.from || from > worldCache.from + 365.25 * 2) {
    const events: CelestialEvent[] = []
    pairEvents(from, from + HORIZON.worlds, from + HORIZON.transits, events)
    alignmentEvents(from - 60, from + HORIZON.worlds, events)
    worldCache = { from, events }
  }
  const out = worldCache.events.slice()
  moonEvents(from - 1, from + HORIZON.moons, out)
  return out.filter((e) => e.end >= from).sort((a, b) => a.peak - b.peak)
}

/** Order for the "next of each kind" list. */
export const KIND_ORDER: EventKind[] = ['alignment', 'transit', 'conjunction', 'opposition', 'solar-eclipse', 'lunar-eclipse', 'shadow-transit']

