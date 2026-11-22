import {
  CATEGORY_ORDER,
  DISCOVERIES,
  discoveriesAt,
  discoveriesFor,
  HIDDEN,
  TOTAL_DISCOVERIES,
  type Category,
  type DiscoveryData,
} from '../data/discoveries'
import { LOCATION_BY_ID, locationsFor, type LocationData, type Place } from '../data/locations'
import { PLANET_BY_ID, PLANETS, type PlanetData, type PlanetId } from '../data/planets'

/**
 * Pure derivations of progress from the exploration store. Every number the
 * Observatory, HUD and panels show comes through here, so there is one way to
 * compute each. Hidden discoveries are counted separately and never reduce a
 * completion percentage.
 */

export interface LocationProgress<L extends Place = LocationData> {
  location: L
  found: number
  total: number
  /** Hidden discoveries found here (0 or more; their total is not revealed). */
  hiddenFound: number
  /** Most recent find here, 0 if none. */
  lastAt: number
}

export interface WorldProgress {
  planet: PlanetData
  found: number
  total: number
  /** 0–100, rounded, over the visible discoveries. */
  percent: number
  hiddenFound: number
  hiddenTotal: number
  visitedAt: number | null
  /** Most recent discovery on this world, for tie-breaking. */
  lastFoundAt: number
  locations: LocationProgress[]
}

export interface DiscoveryEntry {
  discovery: DiscoveryData
  location: LocationData
  planet: PlanetData
  at: number
}

export interface SystemProgress {
  worlds: WorldProgress[]
  worldsVisited: number
  found: number
  total: number
  percent: number
  hiddenFound: number
  hiddenTotal: number
  /** Worlds with the most discoveries (several when tied); empty when nothing is found yet. */
  mostExplored: PlanetData[]
  /** The latest discovery anywhere, or null. */
  last: DiscoveryEntry | null
  byCategory: Record<Category, { found: number; total: number }>
}

type Found = Record<string, number>

const isFound = (discovered: Found, d: DiscoveryData) => !!discovered[d.id]

export function locationProgress<L extends Place>(location: L, discovered: Found): LocationProgress<L> {
  const here = discoveriesAt(location.id)
  const visible = here.filter((d) => d.kind !== 'secret')
  const times = here.map((d) => discovered[d.id]).filter((t): t is number => !!t)
  return {
    location,
    found: visible.filter((d) => isFound(discovered, d)).length,
    total: visible.length,
    hiddenFound: here.filter((d) => d.kind === 'secret' && isFound(discovered, d)).length,
    lastAt: times.length ? Math.max(...times) : 0,
  }
}

export function worldProgress(
  planet: PlanetData,
  discovered: Found,
  visited: Partial<Record<PlanetId, number>>,
): WorldProgress {
  const all = discoveriesFor(planet.id)
  const visible = all.filter((d) => d.kind !== 'secret')
  const hidden = all.filter((d) => d.kind === 'secret')
  const found = visible.filter((d) => isFound(discovered, d)).length
  const times = all.map((d) => discovered[d.id]).filter((t): t is number => !!t)
  return {
    planet,
    found,
    total: visible.length,
    percent: Math.round((found / Math.max(1, visible.length)) * 100),
    hiddenFound: hidden.filter((d) => isFound(discovered, d)).length,
    hiddenTotal: hidden.length,
    visitedAt: visited[planet.id] ?? null,
    lastFoundAt: times.length ? Math.max(...times) : 0,
    locations: locationsFor(planet.id).map((l) => locationProgress(l, discovered)),
  }
}

export function systemProgress(discovered: Found, visited: Partial<Record<PlanetId, number>>): SystemProgress {
  const worlds = PLANETS.map((p) => worldProgress(p, discovered, visited))
  const found = worlds.reduce((n, w) => n + w.found, 0)
  const best = Math.max(...worlds.map((w) => w.found))
  const timeline = discoveryTimeline(discovered)
  const byCategory = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, { found: 0, total: 0 }])) as SystemProgress['byCategory']
  for (const d of DISCOVERIES) {
    if (d.kind === 'secret') continue
    byCategory[d.category].total++
    if (isFound(discovered, d)) byCategory[d.category].found++
  }
  return {
    worlds,
    worldsVisited: worlds.filter((w) => w.visitedAt !== null).length,
    found,
    total: TOTAL_DISCOVERIES,
    percent: Math.round((found / TOTAL_DISCOVERIES) * 100),
    hiddenFound: HIDDEN.filter((d) => isFound(discovered, d)).length,
    hiddenTotal: HIDDEN.length,
    mostExplored: best > 0 ? worlds.filter((w) => w.found === best).map((w) => w.planet) : [],
    last: timeline.length ? timeline[timeline.length - 1] : null,
    byCategory,
  }
}

/** All discoveries made, oldest first (hidden ones included). Unknown stored ids are ignored. */
export function discoveryTimeline(discovered: Found): DiscoveryEntry[] {
  return DISCOVERIES.filter((d) => discovered[d.id])
    .map((d) => ({
      discovery: d,
      location: LOCATION_BY_ID[d.location],
      planet: PLANET_BY_ID[d.planet],
      at: discovered[d.id],
    }))
    .sort((a, b) => a.at - b.at)
}

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

export function formatWhen(at: number) {
  const d = new Date(at)
  return { date: dateFmt.format(d), time: timeFmt.format(d), iso: d.toISOString() }
}
