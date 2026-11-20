import { CornerDownRight, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { DISCOVERY_BY_ID } from '../data/discoveries'
import { FRAGMENT_KINDS } from '../data/expeditions'
import { LOCATION_BY_ID } from '../data/locations'
import { PLANET_BY_ID } from '../data/planets'
import { useExploration } from '../state/exploration'
import { expeditionStates, unlockedFragments, unlockLine, type ExpeditionState } from '../state/expeditions'
import { formatWhen } from '../state/progress'
import { useExperience } from '../state/useExperience'
import { unknownName } from './ScannerUI'
import { replayStory } from './storyDirector'

/**
 * Phase 8: the Expedition Journal. Everything here is derived from the
 * exploration store: expeditions under way, complete or sealed; each one's
 * objectives and the places they involve; and every story fragment unlocked,
 * each of which can be replayed.
 */

const ORDER = { open: 0, complete: 1, sealed: 2 } as const

function statusOf(s: ExpeditionState) {
  return s.completedAt !== null ? 'complete' : s.openedAt !== null ? 'open' : 'sealed'
}

function ExpeditionEntry({ s, active }: { s: ExpeditionState; active: boolean }) {
  const discovered = useExploration((st) => st.discovered)
  const status = statusOf(s)
  const e = s.expedition
  return (
    <article className="journal-expedition" data-status={status}>
      <p className="journal-code">
        <span>{e.code}</span>
        <span className="journal-status">
          {status === 'complete' ? `Complete · ${formatWhen(s.completedAt!).date}` : status === 'open' ? 'Under way' : 'Sealed'}
        </span>
      </p>
      <h3 className="journal-title">{status === 'sealed' ? 'Sealed expedition' : e.title}</h3>
      {status === 'sealed' ? (
        <p className="journal-copy">{unlockLine(e)}</p>
      ) : (
        <>
          <p className="journal-copy">{e.intro.body[e.intro.body.length - 1]}</p>
          <div className="journal-progress" aria-label={`${s.done} of ${s.total} objectives complete`}>
            {s.objectives.map((o) => (
              <span key={o.objective.id} data-done={o.status === 'complete' || undefined} data-open={o.status === 'open' || undefined} />
            ))}
            <span className="journal-progress-count tabular-nums">
              {s.done} of {s.total}
            </span>
          </div>
          <ol className="journal-objectives">
            {s.objectives.map((o, i) => (
              <li key={o.objective.id} data-status={o.status}>
                <span className="journal-objective-n tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  {o.status === 'sealed' ? (
                    <p className="journal-objective-title">Sealed until objective {i} is complete</p>
                  ) : (
                    <>
                      <p className="journal-objective-title">{o.objective.title}</p>
                      {o.status === 'open' && <p className="journal-objective-brief">{o.objective.brief}</p>}
                      <ul className="journal-places">
                        {o.objective.requires.map((id) => {
                          const d = DISCOVERY_BY_ID[id]
                          const at = discovered[id]
                          return (
                            <li key={id} data-found={at ? true : undefined}>
                              <span className="signal-dot" data-found={at ? true : undefined} style={{ ['--accent' as string]: PLANET_BY_ID[d.planet].accent }} aria-hidden />
                              <span>
                                {at ? d.name : unknownName(d)} · {LOCATION_BY_ID[d.location].name}, {PLANET_BY_ID[d.planet].name}
                              </span>
                              <span className="journal-place-state">{at ? formatWhen(at).date : 'Not yet found'}</span>
                            </li>
                          )
                        })}
                      </ul>
                      {o.status === 'complete' && (
                        <button type="button" className="journal-replay quiet-button" onClick={() => replayStory(o.objective.fragment.id)} tabIndex={active ? 0 : -1}>
                          <CornerDownRight size={13} strokeWidth={1.5} aria-hidden />
                          {FRAGMENT_KINDS[o.objective.fragment.kind]}: {o.objective.fragment.title}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </article>
  )
}

export function JournalUI() {
  const open = useExperience((s) => s.journal)
  const setJournal = useExperience((s) => s.setJournal)
  const discovered = useExploration((s) => s.discovered)
  const seen = useExploration((s) => s.story)
  const heading = useRef<HTMLHeadingElement>(null)

  const states = useMemo(() => expeditionStates(discovered), [discovered])
  const fragments = useMemo(() => unlockedFragments(states).slice().reverse(), [states])
  const sorted = useMemo(() => states.slice().sort((a, b) => ORDER[statusOf(a)] - ORDER[statusOf(b)]), [states])
  const complete = states.filter((s) => s.completedAt !== null).length

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => heading.current?.focus({ preventScroll: true }), 200)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        setJournal(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, setJournal])

  return (
    <aside className="journal" data-open={open || undefined} aria-hidden={!open} inert={!open} aria-labelledby="journal-title">
      <div className="journal-scroll">
        <header className="journal-head">
          <h2 id="journal-title" ref={heading} tabIndex={-1} className="journal-heading">
            Expedition Journal
          </h2>
          <p className="journal-sub tabular-nums">
            {complete} of {states.length} expeditions complete · {fragments.length} {fragments.length === 1 ? 'record' : 'records'}
          </p>
          <button type="button" className="journal-close quiet-button px-3" onClick={() => setJournal(false)} title="Close (Esc)">
            <X size={15} strokeWidth={1.5} aria-hidden />
            Close
          </button>
        </header>

        <section aria-label="Expeditions">
          {sorted.map((s) => (
            <ExpeditionEntry key={s.expedition.id} s={s} active={open} />
          ))}
        </section>

        <section className="journal-records" aria-labelledby="journal-records-title">
          <h3 id="journal-records-title" className="journal-section-title">
            Records
          </h3>
          {fragments.length === 0 ? (
            <p className="journal-copy">Nothing has been received yet. Scan something on any world.</p>
          ) : (
            <ol>
              {fragments.map((f) => {
                const when = formatWhen(f.at)
                return (
                  <li key={f.fragment.id}>
                    <button type="button" className="journal-record" onClick={() => replayStory(f.fragment.id)} tabIndex={open ? 0 : -1}>
                      <span className="journal-record-kind">
                        {FRAGMENT_KINDS[f.fragment.kind]}
                        {!seen[f.fragment.id] && <span className="journal-new">New</span>}
                      </span>
                      <span className="journal-record-title">{f.fragment.title}</span>
                      <span className="journal-record-meta tabular-nums">
                        {f.expedition.code} · {when.date}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </aside>
  )
}
