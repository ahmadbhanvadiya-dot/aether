import { MOONS, formatDuration } from '../data/astronomy'
import { DISCOVERIES, CATEGORIES } from '../data/discoveries'
import { FRAGMENT_KINDS } from '../data/expeditions'
import { LOCATIONS, LOCATION_BY_ID } from '../data/locations'
import { PLANETS, PLANET_BY_ID, type PlanetId } from '../data/planets'
import type { CelestialEvent } from './events'
import { unlockedFragments, type ExpeditionState } from './expeditions'

/**
 * Phase 12a–c: one index over everything the Observatory knows, derived from the
 * existing catalogues and progress — nothing here is stored. It feeds the search,
 * the contextual record and the timeline's milestones.
 *
 * Search never spoils: an unfound discovery is listed only under the name the
 * surface gives it ("Unidentified signal / object") and is findable by its place,
 * never by its real name; unfound hidden discoveries and sealed expeditions are
 * not listed at all.
 */

export type CatalogKind = 'world' | 'moon' | 'location' | 'discovery' | 'event' | 'expedition' | 'record'

export const CATALOG_KINDS: Record<CatalogKind, string> = {
  world: 'Worlds',
  moon: 'Moons',
  location: 'Places',
  discovery: 'Discoveries',
  event: 'Sky events',
  expedition: 'Expeditions',
  record: 'Records',
}

export const CATALOG_ORDER: CatalogKind[] = ['world', 'moon', 'location', 'discovery', 'expedition', 'record', 'event']

export interface CatalogEntry {
  kind: CatalogKind
  id: string
  title: string
  /** One line of context (world, place, kind). */
  sub: string
  planet: PlanetId | null
  /** Lower-case text the search matches against. */
  text: string
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const unknown = (kind: string) => (kind === 'signal' ? 'Unidentified signal' : 'Unidentified object')

export function buildCatalog(found: Record<string, number>, states: ExpeditionState[], events: CelestialEvent[]): CatalogEntry[] {
  const out: CatalogEntry[] = []
  const add = (e: Omit<CatalogEntry, 'text'>, extra = '') => out.push({ ...e, text: norm(`${e.title} ${e.sub} ${extra}`) })

  for (const p of PLANETS) add({ kind: 'world', id: p.id, title: p.name, sub: p.classification, planet: p.id }, `${p.teaser} ${p.description}`)

  for (const m of MOONS) {
    const p = PLANET_BY_ID[m.planet]
    add({ kind: 'moon', id: m.name, title: m.name, sub: `Moon of ${p.name} · ${formatDuration(m.periodDays)}`, planet: m.planet }, 'moon satellite')
  }

  for (const l of LOCATIONS) {
    const p = PLANET_BY_ID[l.planet]
    add({ kind: 'location', id: l.id, title: l.name, sub: `${l.region}`, planet: l.planet }, `${p.name} ${l.hint}`)
  }

  for (const d of DISCOVERIES) {
    const at = found[d.id]
    const l = LOCATION_BY_ID[d.location]
    const p = PLANET_BY_ID[d.planet]
    if (at) {
      add({ kind: 'discovery', id: d.id, title: d.name, sub: `${CATEGORIES[d.category].label} · ${l.name}, ${p.name}`, planet: d.planet }, d.description)
    } else if (d.kind !== 'secret') {
      add({ kind: 'discovery', id: d.id, title: unknown(d.kind), sub: `Not yet scanned · ${l.name}, ${p.name}`, planet: d.planet })
    }
  }

  for (const s of states) {
    if (s.openedAt === null) continue
    const e = s.expedition
    add({ kind: 'expedition', id: e.id, title: e.title, sub: `${e.code} · ${s.completedAt !== null ? 'Complete' : `${s.done} of ${s.total}`}`, planet: null }, e.intro.body.join(' '))
  }

  for (const f of unlockedFragments(states)) {
    add({ kind: 'record', id: f.fragment.id, title: f.fragment.title, sub: `${FRAGMENT_KINDS[f.fragment.kind]} · ${f.fragment.source}`, planet: null }, f.fragment.body.join(' '))
  }

  for (const ev of events) add({ kind: 'event', id: ev.id, title: ev.title, sub: 'Sky event', planet: ev.bodies[0] ?? null }, ev.detail)

  return out
}

/** Every word of the query must appear; titles that start with it come first. */
export function searchCatalog(entries: CatalogEntry[], query: string) {
  const q = norm(query.trim())
  if (!q) return []
  const words = q.split(/\s+/)
  return entries
    .filter((e) => words.every((w) => e.text.includes(w)))
    // Title matches first; within a score, what has been found before what has not.
    .map((e) => ({ e, score: (norm(e.title).startsWith(q) ? 0 : norm(e.title).includes(q) ? 1 : 2) + (e.title.startsWith('Unidentified') ? 0.5 : 0) }))
    .sort((a, b) => a.score - b.score)
    .map((x) => x.e)
}

// ---------------------------------------------------------------------------
// Milestones: facts computed from timestamps that already exist.

export interface Milestone {
  id: string
  at: number
  title: string
  detail: string
  planet: PlanetId | null
}

export function milestones(found: Record<string, number>, visited: Partial<Record<PlanetId, number>>, states: ExpeditionState[]): Milestone[] {
  const out: Milestone[] = []
  for (const p of PLANETS) {
    const at = visited[p.id]
    if (at) out.push({ id: `land-${p.id}`, at, title: `First landing on ${p.name}`, detail: p.classification, planet: p.id })
    // Every catalogued (not hidden) discovery on a world found.
    const own = DISCOVERIES.filter((d) => d.planet === p.id && d.kind !== 'secret')
    if (own.length && own.every((d) => found[d.id])) {
      out.push({ id: `explored-${p.id}`, at: Math.max(...own.map((d) => found[d.id])), title: `${p.name} fully explored`, detail: `All ${own.length} discoveries`, planet: p.id })
    }
  }
  const landings = PLANETS.map((p) => visited[p.id])
  if (landings.every((v) => v)) out.push({ id: 'all-worlds', at: Math.max(...(landings as number[])), title: 'All six worlds visited', detail: 'The Aether system', planet: null })
  for (const s of states) {
    if (s.openedAt !== null) out.push({ id: `open-${s.expedition.id}`, at: s.openedAt, title: `${s.expedition.code} begins`, detail: s.expedition.title, planet: null })
    if (s.completedAt !== null) out.push({ id: `done-${s.expedition.id}`, at: s.completedAt, title: `${s.expedition.code} complete`, detail: s.expedition.title, planet: null })
  }
  return out
}

