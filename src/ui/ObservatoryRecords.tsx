import { ArrowLeft, BookOpen, CornerDownRight, Play, Search } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode, type RefObject } from 'react'
import { ASTRONOMY, MOONS, formatDuration } from '../data/astronomy'
import { CATEGORIES, DISCOVERY_BY_ID, discoveriesAt } from '../data/discoveries'
import { EXPEDITION_BY_ID, FRAGMENT_BY_ID, FRAGMENT_KINDS } from '../data/expeditions'
import { LOCATION_BY_ID } from '../data/locations'
import { PLANET_BY_ID, type PlanetId } from '../data/planets'
import { buildCatalog, CATALOG_KINDS, CATALOG_ORDER, searchCatalog, type CatalogEntry } from '../state/catalog'
import { EVENT_KINDS } from '../state/events'
import { useExploration } from '../state/exploration'
import { expeditionStates } from '../state/expeditions'
import { formatWhen } from '../state/progress'
import { formatUntil, sim } from '../state/simulation'
import { useSky } from '../state/sky'
import { useExperience, type ObsFocus } from '../state/useExperience'
import { exploreLocation, revisitDiscovery } from './observatoryDirector'
import { CATEGORY_ICON, unknownName } from './ScannerUI'
import { showEvent } from './skyActions'
import { replayStory } from './storyDirector'

/**
 * Phase 12: the Observatory's record for anything that is not a world (a moon,
 * place, discovery, sky event, expedition or story record), and the search that
 * finds them. Every action goes through an existing route: Revisit, Explore,
 * Show on the dial, Open in journal, Play record.
 */

// ---- The contextual record ---------------------------------------------------

function Head({ kind, title, planet, sub }: { kind: string; title: string; planet: PlanetId | null; sub: string }) {
  const p = planet ? PLANET_BY_ID[planet] : null
  return (
    <>
      <p className="obs-focus-kind">{kind}</p>
      <h2 className="obs-reading-name obs-focus-title">{title}</h2>
      <p className="flex items-center gap-2.5 text-[0.95rem] font-light text-starlight/85">
        {p && <span className="obs-accent-dot" style={{ background: p.accent, boxShadow: `0 0 10px ${p.accent}` }} aria-hidden />}
        {sub}
      </p>
    </>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Body({ focus, active }: { focus: ObsFocus; active: boolean }) {
  const discovered = useExploration((s) => s.discovered)
  const all = useSky((s) => s.all)
  const tab = active ? 0 : -1

  switch (focus.kind) {
    case 'discovery': {
      const d = DISCOVERY_BY_ID[focus.id]
      if (!d) return null
      const at = discovered[d.id]
      const l = LOCATION_BY_ID[d.location]
      const Icon = CATEGORY_ICON[d.category]
      return (
        <>
          <Head kind={at ? CATEGORIES[d.category].label : 'Not yet scanned'} title={at ? d.name : unknownName(d)} planet={d.planet} sub={`${l.name}, ${PLANET_BY_ID[d.planet].name}`} />
          <p className="obs-reading-copy">{at ? d.description : d.kind === 'signal' ? l.hint : 'Seen from the location, not yet scanned.'}</p>
          <dl className="obs-facts">
            <Fact label="Status">{at ? 'Discovered' : 'Not yet found'}</Fact>
            <Fact label={at ? 'Recorded' : 'Where'}>{at ? formatWhen(at).date : l.region}</Fact>
            <Fact label="Kind">
              <span className="inline-flex items-center gap-1.5">
                <Icon size={13} strokeWidth={1.5} aria-hidden />
                {at ? CATEGORIES[d.category].label : d.kind === 'signal' ? 'Signal' : 'Object'}
              </span>
            </Fact>
          </dl>
          <div className="obs-reading-actions">
            {at ? (
              <button type="button" className="explore-button" onClick={() => revisitDiscovery(d.id)} tabIndex={tab}>
                <CornerDownRight size={14} strokeWidth={1.5} aria-hidden />
                Revisit
              </button>
            ) : (
              <button type="button" className="explore-button" onClick={() => exploreLocation(d.location)} tabIndex={tab}>
                <span className="enter-glyph" style={{ background: PLANET_BY_ID[d.planet].accent }} aria-hidden />
                Explore {l.name}
              </button>
            )}
          </div>
        </>
      )
    }

    case 'location': {
      const l = LOCATION_BY_ID[focus.id]
      if (!l) return null
      const here = discoveriesAt(l.id)
      const listed = here.filter((d) => d.kind !== 'secret')
      const found = listed.filter((d) => discovered[d.id]).length
      const hidden = here.filter((d) => d.kind === 'secret' && discovered[d.id]).length
      return (
        <>
          <Head kind="Place" title={l.name} planet={l.planet} sub={`${l.region}`} />
          <p className="obs-reading-copy">{found > 0 ? l.lore : l.hint}</p>
          <dl className="obs-facts">
            <Fact label="World">{PLANET_BY_ID[l.planet].name}</Fact>
            <Fact label="Discoveries">
              <span className="tabular-nums">
                {found} of {listed.length}
                {hidden > 0 && <span className="obs-hidden-count"> +{hidden} hidden</span>}
              </span>
            </Fact>
          </dl>
          <div className="obs-reading-actions">
            <button type="button" className="explore-button" onClick={() => exploreLocation(l.id)} tabIndex={tab}>
              <span className="enter-glyph" style={{ background: PLANET_BY_ID[l.planet].accent }} aria-hidden />
              Explore {l.name}
            </button>
          </div>
        </>
      )
    }

    case 'moon': {
      const m = MOONS.find((x) => x.name === focus.id)
      if (!m) return null
      const p = PLANET_BY_ID[m.planet]
      const coming = all.filter((e) => e.id.includes(`-${m.name}-`) && e.end >= sim.day).slice(0, 2)
      return (
        <>
          <Head kind="Moon" title={m.name} planet={m.planet} sub={`Moon of ${p.name}`} />
          <dl className="obs-facts">
            <Fact label="Orbit">{formatDuration(m.periodDays)}{m.retrograde ? ', retrograde' : ''}</Fact>
            <Fact label="Distance">{Math.round(m.km / 1000).toLocaleString('en-US')} thousand km</Fact>
            <Fact label="Radius">{m.radiusKm.toLocaleString('en-US')} km</Fact>
          </dl>
          <p className="obs-focus-note">Fictional values, consistent with {p.name}'s mass ({ASTRONOMY[m.planet].moons.length} modelled {ASTRONOMY[m.planet].moons.length === 1 ? 'moon' : 'moons'}).</p>
          {coming.length > 0 && (
            <ul className="obs-focus-list">
              {coming.map((e) => (
                <li key={e.id}>
                  <button type="button" className="sky-inline" onClick={() => showEvent(e)} tabIndex={tab}>
                    {e.title}
                  </button>
                  <span className="text-haze"> · {formatUntil(e.peak - sim.day)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )
    }

    case 'event': {
      const e = all.find((x) => x.id === focus.id)
      if (!e) return <Head kind="Sky event" title="This event has passed" planet={null} sub="The clock has moved on since it was chosen." />
      return (
        <>
          <Head kind={EVENT_KINDS[e.kind]} title={e.title} planet={e.bodies[0] ?? null} sub={e.bodies.map((b) => PLANET_BY_ID[b].name).join(', ')} />
          <p className="obs-reading-copy">{e.detail}</p>
          <div className="obs-reading-actions">
            <button type="button" className="explore-button" onClick={() => showEvent(e)} tabIndex={tab}>
              Show on the dial
            </button>
          </div>
        </>
      )
    }

    case 'expedition': {
      const exp = EXPEDITION_BY_ID[focus.id]
      const s = expeditionStates(discovered).find((x) => x.expedition.id === focus.id)
      if (!exp || !s) return null
      const current = s.objectives.find((o) => o.status === 'open')
      return (
        <>
          <Head kind={exp.code} title={exp.title} planet={null} sub={s.completedAt !== null ? `Complete · ${formatWhen(s.completedAt).date}` : `Under way · ${s.done} of ${s.total}`} />
          <p className="obs-reading-copy">{current ? current.objective.brief : exp.closing.body[exp.closing.body.length - 1]}</p>
          <div className="obs-reading-actions">
            <button type="button" className="explore-button" onClick={() => useExperience.getState().setJournal(true)} tabIndex={tab}>
              <BookOpen size={14} strokeWidth={1.5} aria-hidden />
              Open in journal
            </button>
          </div>
        </>
      )
    }

    case 'record': {
      const f = FRAGMENT_BY_ID[focus.id]
      if (!f) return null
      return (
        <>
          <Head kind={FRAGMENT_KINDS[f.fragment.kind]} title={f.fragment.title} planet={null} sub={`${f.fragment.source} · ${f.expedition.code}`} />
          <p className="obs-reading-copy">{f.fragment.body[0]}</p>
          <div className="obs-reading-actions">
            <button type="button" className="explore-button" onClick={() => replayStory(f.fragment.id)} tabIndex={tab}>
              <Play size={14} strokeWidth={1.5} aria-hidden />
              Play record
            </button>
          </div>
        </>
      )
    }
  }
}

/** Replaces the world record while something else is selected. */
export function FocusRecord({ focus, active }: { focus: ObsFocus; active: boolean }) {
  const observed = useExperience((s) => s.observed)
  return (
    <section className="obs-reading-panel" aria-live="polite" aria-label="Selected record">
      <div className="obs-focus" key={`${focus.kind}-${focus.id}`}>
        <Body focus={focus} active={active} />
      </div>
      <button type="button" className="obs-focus-back quiet-button px-3" onClick={() => useExperience.getState().setObsFocus(null)} tabIndex={active ? 0 : -1}>
        <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
        {PLANET_BY_ID[observed].name}
      </button>
    </section>
  )
}

// ---- Search ----------------------------------------------------------------

const PER_GROUP = 6

export function SearchSection({ active, input, onPick }: { active: boolean; input: RefObject<HTMLInputElement | null>; onPick: () => void }) {
  const discovered = useExploration((s) => s.discovered)
  const now = useSky((s) => s.now)
  const next = useSky((s) => s.next)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const inputId = useId()

  const catalog = useMemo(() => buildCatalog(discovered, expeditionStates(discovered), [...now, ...next]), [discovered, now, next])
  const results = useMemo(() => searchCatalog(catalog, query), [catalog, query])
  const counts = useMemo(() => CATALOG_ORDER.map((k) => [k, catalog.filter((e) => e.kind === k).length] as const), [catalog])

  const pick = (e: CatalogEntry) => {
    const st = useExperience.getState()
    if (e.kind === 'world') st.setObserved(e.planet!)
    else st.setObsFocus({ kind: e.kind, id: e.id }, e.planet)
    onPick()
  }
  const tab = active ? 0 : -1

  return (
    <section id="obs-search" className="obs-section" aria-labelledby="obs-search-title">
      <h2 id="obs-search-title" className="obs-section-title">
        Search
      </h2>
      <p className="obs-section-note">Worlds, moons, places, discoveries, expeditions, records and the sky's coming events. Only what you have found is named.</p>
      <label htmlFor={inputId} className="obs-search-field">
        <Search size={16} strokeWidth={1.5} aria-hidden />
        <span className="sr-only">Search the record</span>
        <input
          ref={input}
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setExpanded(null)
          }}
          placeholder="Search the record ( / )"
          autoComplete="off"
          spellCheck={false}
          tabIndex={tab}
        />
      </label>

      {!query.trim() ? (
        <p className="obs-search-counts tabular-nums">
          {counts
            .filter(([, n]) => n > 0)
            .map(([k, n]) => `${n} ${CATALOG_KINDS[k].toLowerCase()}`)
            .join(' · ')}
        </p>
      ) : results.length === 0 ? (
        <p className="obs-search-empty" role="status">
          Nothing in the record matches “{query.trim()}”.
        </p>
      ) : (
        <div className="obs-search-results" role="status" aria-live="polite">
          <p className="sr-only">{results.length} results</p>
          {CATALOG_ORDER.map((k) => {
            const group = results.filter((e) => e.kind === k)
            if (!group.length) return null
            const shown = expanded === k ? group : group.slice(0, PER_GROUP)
            return (
              <div key={k} className="obs-search-group">
                <h3 className="obs-search-kind">
                  {CATALOG_KINDS[k]} <span className="tabular-nums">{group.length}</span>
                </h3>
                <ul>
                  {shown.map((e) => (
                    <li key={`${e.kind}-${e.id}`}>
                      <button type="button" className="obs-search-hit" onClick={() => pick(e)} tabIndex={tab}>
                        {e.planet && <span className="obs-accent-dot" style={{ background: PLANET_BY_ID[e.planet].accent }} aria-hidden />}
                        <span className="obs-search-title">{e.title}</span>
                        <span className="obs-search-sub">{e.sub}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {group.length > PER_GROUP && expanded !== k && (
                  <button type="button" className="quiet-button obs-search-more px-3" onClick={() => setExpanded(k)} tabIndex={tab}>
                    Show all {group.length}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
