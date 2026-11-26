import { EXPEDITIONS, EXPEDITION_BY_ID, type Expedition, type Fragment, type Objective } from '../data/expeditions'
import { SYSTEMS, type SystemId } from '../data/systems'

/**
 * Phase 8: expedition progress, derived from the exploration store's
 * `discovered` map alone (no stored progress, so nothing can complete twice
 * or drift out of step with the archives).
 *
 * - An expedition opens at its unlock moment: the first discovery anywhere,
 *   or the completion of the expedition before it.
 * - Objective n opens when objective n − 1 completes. It completes when all
 *   its discoveries are found and it is open: at the later of the two moments.
 * - The expedition completes with its last objective.
 */

type Found = Record<string, number>

export type ObjectiveStatus = 'sealed' | 'open' | 'complete'

export interface ObjectiveState {
  objective: Objective
  status: ObjectiveStatus
  openedAt: number | null
  completedAt: number | null
  /** How many of its discoveries are already found (for "1 of 2"). */
  found: number
}

export interface ExpeditionState {
  expedition: Expedition
  openedAt: number | null
  completedAt: number | null
  objectives: ObjectiveState[]
  done: number
  total: number
}

export interface UnlockedFragment {
  fragment: Fragment
  expedition: Expedition
  at: number
}

function firstFound(found: Found) {
  let min = Infinity
  for (const at of Object.values(found)) if (at < min) min = at
  return Number.isFinite(min) ? min : null
}

export function expeditionStates(found: Found): ExpeditionState[] {
  const byId: Record<string, ExpeditionState> = {}
  for (const e of EXPEDITIONS) {
    const openedAt = 'firstDiscovery' in e.unlock ? firstFound(found) : (byId[e.unlock.after]?.completedAt ?? null)
    let prevDone: number | null = openedAt
    const objectives: ObjectiveState[] = e.objectives.map((o) => {
      const times = o.requires.map((id) => found[id]).filter((t): t is number => !!t)
      const opened = prevDone
      const all = times.length === o.requires.length
      const completedAt = opened !== null && all ? Math.max(opened, ...times) : null
      prevDone = completedAt
      return {
        objective: o,
        status: opened === null ? 'sealed' : completedAt !== null ? 'complete' : 'open',
        openedAt: opened,
        completedAt,
        found: times.length,
      }
    })
    const done = objectives.filter((o) => o.status === 'complete').length
    byId[e.id] = {
      expedition: e,
      openedAt,
      completedAt: done === objectives.length ? objectives[objectives.length - 1].completedAt : null,
      objectives,
      done,
      total: objectives.length,
    }
  }
  return EXPEDITIONS.map((e) => byId[e.id])
}

/**
 * Phase 11: what the expeditions have opened on the map. Each story-gated place
 * names the expedition after which it shows (unnamed, sealed) and the one that
 * opens it: Tessaly after II and III, the Waystation after III and IV.
 */
export function mapAccess(found: Found) {
  const states = expeditionStates(found)
  const done = (id?: string) => !id || states.find((s) => s.expedition.id === id)?.completedAt != null
  const known = {} as Record<SystemId, boolean>
  const open = {} as Record<SystemId, boolean>
  for (const s of SYSTEMS) {
    known[s.id] = s.unlock === 'home' || done(s.knownAfter)
    open[s.id] = s.unlock === 'home' || done(s.opensWith)
  }
  return { known, open, tessalyKnown: known.tessaly, tessalyOpen: open.tessaly }
}

/** Every story fragment the visitor has unlocked, oldest first. */
export function unlockedFragments(states: ExpeditionState[]): UnlockedFragment[] {
  const out: UnlockedFragment[] = []
  for (const s of states) {
    if (s.openedAt === null) continue
    out.push({ fragment: s.expedition.intro, expedition: s.expedition, at: s.openedAt })
    for (const o of s.objectives) if (o.completedAt !== null) out.push({ fragment: o.objective.fragment, expedition: s.expedition, at: o.completedAt })
    if (s.completedAt !== null) out.push({ fragment: s.expedition.closing, expedition: s.expedition, at: s.completedAt })
  }
  return out.sort((a, b) => a.at - b.at)
}

/** What the unlock condition of a sealed expedition says, without spoilers. */
export function unlockLine(e: Expedition) {
  if ('firstDiscovery' in e.unlock) return 'Opens with your first discovery.'
  return `Opens when ${EXPEDITION_BY_ID[e.unlock.after].code} is complete.`
}
