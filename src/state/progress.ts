import { LOCATIONS, locationsFor, TOTAL_LOCATIONS, type LocationData } from '../data/locations'
import { PLANETS, type PlanetData, type PlanetId } from '../data/planets'

/**
 * Pure derivations of progress from the exploration store. Every number the
 * Observatory shows comes through here, so there is one way to compute each.
 */

export interface WorldProgress {
  planet: PlanetData
  found: number
  total: number
  /** 0–100, rounded. */
  percent: number
  visitedAt: number | null
  /** Most recent discovery on this world, for tie-breaking. */
  lastFoundAt: number
}

export interface SystemProgress {
  worlds: WorldProgress[]
  worldsVisited: number
  found: number
  total: number
  percent: number
  /** Worlds with the most discoveries (several when tied); empty when nothing is found yet. */
  mostExplored: PlanetData[]
}

export interface DiscoveryEntry {
  location: LocationData
  planet: PlanetData
  at: number
}

export function worldProgress(
  planet: PlanetData,
  discovered: Record<string, number>,
  visited: Partial<Record<PlanetId, number>>,
): WorldProgress {
  const locs = locationsFor(planet.id)
  const times = locs.map((l) => discovered[l.id]).filter((t): t is number => !!t)
  return {
    planet,
    found: times.length,
    total: locs.length,
    percent: Math.round((times.length / locs.length) * 100),
    visitedAt: visited[planet.id] ?? null,
    lastFoundAt: times.length ? Math.max(...times) : 0,
  }
}

export function systemProgress(
  discovered: Record<string, number>,
  visited: Partial<Record<PlanetId, number>>,
): SystemProgress {
  const worlds = PLANETS.map((p) => worldProgress(p, discovered, visited))
  const found = worlds.reduce((n, w) => n + w.found, 0)
  const best = Math.max(...worlds.map((w) => w.found))
  return {
    worlds,
    worldsVisited: worlds.filter((w) => w.visitedAt !== null).length,
    found,
    total: TOTAL_LOCATIONS,
    percent: Math.round((found / TOTAL_LOCATIONS) * 100),
    mostExplored: best > 0 ? worlds.filter((w) => w.found === best).map((w) => w.planet) : [],
  }
}

/** All discoveries, oldest first. */
export function discoveryTimeline(discovered: Record<string, number>): DiscoveryEntry[] {
  return LOCATIONS.filter((l) => discovered[l.id])
    .map((l) => ({
      location: l,
      planet: PLANETS.find((p) => p.id === l.planet)!,
      at: discovered[l.id],
    }))
    .sort((a, b) => a.at - b.at)
}

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

export function formatWhen(at: number) {
  const d = new Date(at)
  return { date: dateFmt.format(d), time: timeFmt.format(d), iso: d.toISOString() }
}
