import { ArrowLeft, ChevronLeft, ChevronRight, CornerDownRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, CATEGORY_ORDER, discoveriesAt, type DiscoveryData } from '../data/discoveries'
import { LOCATIONS } from '../data/locations'
import { PLANET_BY_ID, PLANETS, type PlanetId } from '../data/planets'
import { useThumbs } from '../scene/galaxy/Thumbnails'
import { telemetry } from '../state/director'
import { useExploration } from '../state/exploration'
import { discoveryTimeline, formatWhen, systemProgress, type WorldProgress } from '../state/progress'
import { quality, useExperience } from '../state/useExperience'
import { closeObservatory, exploreFromObservatory, revisitDiscovery, stepObserved } from './observatoryDirector'
import { CATEGORY_ICON, unknownName } from './ScannerUI'

const ORDER = PLANETS.map((p) => p.id)
/** The location hint each signal shows on site before it is found (safe to show here too). */
const LOCATION_HINTS: Record<string, string> = Object.fromEntries(LOCATIONS.map((l) => [l.id, l.hint]))
const TICKS = 72

// ---------------------------------------------------------------------------
// The chart: graduations, reading line, world labels and location marks,
// drawn over the real system seen from the zenith. Positions come from
// telemetry every frame and are written straight to the DOM.
// ---------------------------------------------------------------------------

function Chart({ progress }: { progress: WorldProgress[] }) {
  const svg = useRef<SVGSVGElement>(null)
  const labels = useRef<HTMLDivElement>(null)
  const observed = useExperience((s) => s.observed)
  const setObserved = useExperience((s) => s.setObserved)
  const setHovered = useExperience((s) => s.setHovered)

  // One mark per location (hollow, partly or fully explored), then one per hidden find.
  const marks = useMemo(
    () =>
      Object.fromEntries(
        progress.map((w) => [
          w.planet.id,
          [
            ...w.locations.map((l) => (l.found === 0 ? 'none' : l.found >= l.total ? 'complete' : 'partial')),
            ...Array.from({ length: w.hiddenFound }, () => 'hidden'),
          ],
        ]),
      ),
    [progress],
  ) as Record<PlanetId, ('none' | 'partial' | 'complete' | 'hidden')[]>

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const c = telemetry.chart
      const root = svg.current
      if (root) {
        const orion = c.worlds.orion
        const outer = Math.hypot(orion.x - c.ox, orion.y - c.oy) + 38
        const ring = root.querySelector<SVGCircleElement>('[data-ring]')
        if (ring) {
          ring.setAttribute('cx', c.ox.toFixed(1))
          ring.setAttribute('cy', c.oy.toFixed(1))
          ring.setAttribute('r', outer.toFixed(1))
        }
        // The graduations turn with the sky: align their zero with the system's +x axis.
        const sel = c.worlds[observed]
        const selAngle = Math.atan2(sel.y - c.oy, sel.x - c.ox)
        const graduations = root.querySelector<SVGGElement>('[data-ticks]')
        if (graduations) {
          graduations.setAttribute('transform', `translate(${c.ox.toFixed(1)} ${c.oy.toFixed(1)}) rotate(${((selAngle * 180) / Math.PI).toFixed(2)})`)
          graduations.style.setProperty('--outer', `${outer}px`)
          graduations.querySelectorAll<SVGLineElement>('line').forEach((ln, i) => {
            const a = (i / TICKS) * Math.PI * 2
            const len = i % 6 === 0 ? 12 : 5
            ln.setAttribute('x1', (Math.cos(a) * outer).toFixed(1))
            ln.setAttribute('y1', (Math.sin(a) * outer).toFixed(1))
            ln.setAttribute('x2', (Math.cos(a) * (outer + len)).toFixed(1))
            ln.setAttribute('y2', (Math.sin(a) * (outer + len)).toFixed(1))
          })
        }
        // Reading line: from Elys out through the selected world to the panel.
        const reading = root.querySelector<SVGLineElement>('[data-reading]')
        if (reading) {
          reading.setAttribute('x1', (c.ox + Math.cos(selAngle) * (outer + 18)).toFixed(1))
          reading.setAttribute('y1', (c.oy + Math.sin(selAngle) * (outer + 18)).toFixed(1))
          reading.setAttribute('x2', (c.ox + Math.cos(selAngle) * (outer + 70)).toFixed(1))
          reading.setAttribute('y2', (c.oy + Math.sin(selAngle) * (outer + 70)).toFixed(1))
        }
        // Three location marks trailing each world along its orbit.
        for (const id of ORDER) {
          const w = c.worlds[id]
          const dx = w.x - c.ox
          const dy = w.y - c.oy
          const r = Math.hypot(dx, dy)
          const a = Math.atan2(dy, dx)
          const step = 11 / Math.max(r, 1)
          root.querySelectorAll<SVGCircleElement>(`[data-mark="${id}"]`).forEach((m, i) => {
            const t = a - (i + 1) * step - (w.radiusPx + 6) / Math.max(r, 1)
            m.setAttribute('cx', (c.ox + Math.cos(t) * r).toFixed(1))
            m.setAttribute('cy', (c.oy + Math.sin(t) * r).toFixed(1))
          })
        }
      }
      const box = labels.current
      if (box) {
        // Labels sit right of their world, flipping left rather than run into
        // the reading column (wide) or off the screen (narrow). Reads first, then writes.
        const column = document.querySelector('.obs-reading-wrap')?.getBoundingClientRect()
        const limit = column && column.left > window.innerWidth * 0.4 ? column.left - 16 : window.innerWidth - 12
        const els = [...box.querySelectorAll<HTMLElement>('[data-world]')]
        const widths = els.map((el) => el.offsetWidth)
        els.forEach((el, i) => {
          const id = el.dataset.world as PlanetId
          const w = telemetry.chart.worlds[id]
          // Clear the disc, or Orion's rings.
          const extent = PLANET_BY_ID[id].rings ? PLANET_BY_ID[id].rings!.outer : 1
          const off = Math.max(w.radiusPx * extent, 3) + 10
          const x = w.x + off + widths[i] > limit ? w.x - off - widths[i] : w.x + off
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${(w.y - off * 0.6).toFixed(1)}px, 0)`
        })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [observed])

  return (
    <div className="obs-chart" aria-hidden={false}>
      <svg ref={svg} className="obs-chart-svg" aria-hidden>
        <circle data-ring className="obs-ring" fill="none" pathLength={1} />
        <g data-ticks className="obs-ticks">
          {Array.from({ length: TICKS }, (_, i) => (
            <line key={i} data-major={i % 6 === 0 || undefined} />
          ))}
        </g>
        <line data-reading className="obs-reading" />
        {ORDER.map((id) =>
          marks[id].map((state, i) => (
            <circle
              key={`${id}-${i}`}
              data-mark={id}
              r={state === 'hidden' ? 2 : 2.6}
              className="obs-mark"
              data-found={state === 'complete' || undefined}
              data-partial={state === 'partial' || undefined}
              data-hidden={state === 'hidden' || undefined}
              style={{ ['--accent' as string]: PLANET_BY_ID[id].accent }}
            />
          )),
        )}
      </svg>
      <div ref={labels} className="obs-labels">
        {progress.map((w) => (
          <button
            key={w.planet.id}
            type="button"
            data-world={w.planet.id}
            className="obs-world-label"
            data-selected={w.planet.id === observed || undefined}
            onClick={() => setObserved(w.planet.id)}
            onPointerEnter={() => setHovered(w.planet.id)}
            onPointerLeave={() => setHovered(null)}
            aria-pressed={w.planet.id === observed}
          >
            <span className="obs-world-label-name">{w.planet.name}</span>
            <span className="obs-world-label-pct tabular-nums">{w.percent}%</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Portrait({ id, size }: { id: PlanetId; size: number }) {
  const url = useThumbs((s) => s.urls[id])
  return (
    <span className="obs-portrait" style={{ width: size, height: size }} aria-hidden>
      {url ? <img src={url} alt="" width={size} height={size} /> : <span className="obs-portrait-wait" />}
    </span>
  )
}

function visitedLine(w: WorldProgress) {
  return w.visitedAt ? formatWhen(w.visitedAt).date : 'Not yet'
}

/** The selected world's record, beside the dial. */
function Reading({ world, active }: { world: WorldProgress; active: boolean }) {
  const p = world.planet
  return (
    <section className="obs-reading-panel" aria-live="polite" aria-label={`${p.name} record`}>
      <div className="obs-reading-head" key={p.id}>
        <Portrait id={p.id} size={96} />
        <div>
          <h2 className="obs-reading-name">{p.name}</h2>
          <p className="flex items-center gap-2.5 text-[0.95rem] font-light text-starlight/85">
            <span className="obs-accent-dot" style={{ background: p.accent, boxShadow: `0 0 10px ${p.accent}` }} aria-hidden />
            {p.classification}
          </p>
        </div>
      </div>
      <p className="obs-reading-copy">{p.teaser}</p>
      <dl className="obs-facts">
        <div>
          <dt>First landed</dt>
          <dd>{visitedLine(world)}</dd>
        </div>
        <div>
          <dt>Explored</dt>
          <dd className="tabular-nums">{world.percent}%</dd>
        </div>
        <div>
          <dt>Discoveries</dt>
          <dd className="tabular-nums">
            {world.found} of {world.total}
            {world.hiddenFound > 0 && <span className="obs-hidden-count"> · {world.hiddenFound} hidden</span>}
          </dd>
        </div>
      </dl>
      <ol className="obs-reading-locations">
        {world.locations.map((l) => (
          <li key={l.location.id}>
            <span
              className="signal-dot"
              data-found={l.found >= l.total || undefined}
              data-partial={(l.found > 0 && l.found < l.total) || undefined}
              style={{ ['--accent' as string]: p.accent }}
              aria-hidden
            />
            <span className="text-starlight/90">{l.location.name}</span>
            <span className="ml-auto text-haze tabular-nums">
              {l.found} of {l.total}
              {l.hiddenFound > 0 && <span className="obs-hidden-count"> +{l.hiddenFound} hidden</span>}
              {l.lastAt ? ` · ${formatWhen(l.lastAt).date}` : ''}
            </span>
          </li>
        ))}
      </ol>
      <div className="obs-reading-actions">
        <button type="button" className="explore-button" onClick={() => exploreFromObservatory(p.id)} tabIndex={active ? 0 : -1}>
          <span className="enter-glyph" style={{ background: p.accent }} aria-hidden />
          Explore {p.name}
        </button>
        <span className="ml-auto flex">
          <button type="button" className="quiet-button px-3" onClick={() => stepObserved(-1, ORDER)} aria-label="Previous world" title="Previous world (←)" tabIndex={active ? 0 : -1}>
            <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
          </button>
          <button type="button" className="quiet-button px-3" onClick={() => stepObserved(1, ORDER)} aria-label="Next world" title="Next world (→)" tabIndex={active ? 0 : -1}>
            <ChevronRight size={16} strokeWidth={1.5} aria-hidden />
          </button>
        </span>
      </div>
    </section>
  )
}

/** One discovery in a planet archive: its record once found; only what is safe to know before. */
function ArchiveEntry({ d, at, accent, active }: { d: DiscoveryData; at: number | undefined; accent: string; active: boolean }) {
  const Icon = CATEGORY_ICON[d.category]
  const when = at ? formatWhen(at) : null
  const hidden = d.kind === 'secret'
  return (
    <li className="obs-entry" data-found={at ? true : undefined} data-hidden={hidden || undefined}>
      {at ? (
        <>
          <p className="obs-entry-kind">
            <Icon size={13} strokeWidth={1.5} aria-hidden />
            {CATEGORIES[d.category].label}
            {hidden && <span className="obs-entry-tag">Hidden</span>}
          </p>
          <p className="obs-entry-finding">{d.name}</p>
          <p className="obs-entry-copy">{d.description}</p>
          <p className="obs-entry-meta">
            <span className="signal-dot" data-found style={{ ['--accent' as string]: accent }} aria-hidden />
            Discovered <time dateTime={when!.iso}>{when!.date}, {when!.time}</time>
          </p>
          <button type="button" className="obs-entry-revisit quiet-button" onClick={() => revisitDiscovery(d.id)} tabIndex={active ? 0 : -1}>
            <CornerDownRight size={13} strokeWidth={1.5} aria-hidden />
            Revisit
            <span className="sr-only"> {d.name}</span>
          </button>
        </>
      ) : hidden ? (
        <>
          <p className="obs-entry-kind">Hidden discovery</p>
          <p className="obs-entry-redacted" aria-label="Not yet known">
            <span />
          </p>
          <p className="obs-entry-copy obs-entry-lead">{d.lead}</p>
          <p className="obs-entry-meta">
            <span className="signal-dot" style={{ ['--accent' as string]: 'var(--color-violet)' }} aria-hidden />
            Not yet found
          </p>
        </>
      ) : (
        <>
          <p className="obs-entry-kind">{unknownName(d)}</p>
          <p className="obs-entry-redacted" aria-label="Not yet known">
            <span />
          </p>
          <p className="obs-entry-copy">
            {d.kind === 'signal' ? (LOCATION_HINTS[d.location] ?? 'A signal waits here.') : 'Seen from the location, not yet scanned.'}
          </p>
          <p className="obs-entry-meta">
            <span className="signal-dot" style={{ ['--accent' as string]: accent }} aria-hidden />
            Not yet discovered
          </p>
        </>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------

export function ObservatoryUI() {
  const phase = useExperience((s) => s.phase)
  const observed = useExperience((s) => s.observed)
  const setObserved = useExperience((s) => s.setObserved)
  const discovered = useExploration((s) => s.discovered)
  const visited = useExploration((s) => s.visited)
  const markSeen = useExploration((s) => s.markObservatorySeen)
  const open = phase === 'observatory'
  const scroller = useRef<HTMLDivElement>(null)
  const chartFade = useRef<HTMLDivElement>(null)

  // One record per visit: the previous visit's mark (nothing is "new" on a
  // first visit) and whether the timeline has scrolled into view yet, so new
  // entries animate when seen rather than offscreen at open. Reset on open/close.
  const [visit, setVisit] = useState({ open: false, seenBefore: Infinity, timelineSeen: false })
  if (visit.open !== open) {
    const seenBefore = open ? useExploration.getState().observatorySeenAt || Infinity : Infinity
    setVisit({ open, seenBefore, timelineSeen: false })
  }
  useEffect(() => {
    if (!open) return
    markSeen()
    if (scroller.current) scroller.current.scrollTop = 0
  }, [open, markSeen])

  const timelineEl = useRef<HTMLOListElement>(null)
  const hasTimeline = Object.keys(discovered).length > 0
  useEffect(() => {
    const el = timelineEl.current
    if (!open || !el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisit((v) => ({ ...v, timelineSeen: true }))
          io.disconnect()
        }
      },
      { root: scroller.current, threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [open, hasTimeline])

  // Keys: Esc returns to the galaxy, arrows turn the dial.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') closeObservatory()
      else if (e.key === 'ArrowRight') stepObserved(1, ORDER)
      else if (e.key === 'ArrowLeft') stepObserved(-1, ORDER)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // The chart belongs to the first view: it fades as the archive scrolls over it.
  const onScroll = () => {
    const el = scroller.current
    const fade = chartFade.current
    if (!el || !fade) return
    fade.style.opacity = String(Math.max(0, 1 - el.scrollTop / (el.clientHeight * 0.55)))
  }

  const progress = useMemo(() => systemProgress(discovered, visited), [discovered, visited])
  const timeline = useMemo(() => discoveryTimeline(discovered), [discovered])
  const world = progress.worlds.find((w) => w.planet.id === observed)!
  const most = progress.mostExplored
  // New entries stagger among themselves.
  const fresh = open ? timeline.filter((t) => t.at > visit.seenBefore).map((t) => t.discovery.id) : []
  const scrollTo = (id: string) => scroller.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="observatory" data-visible={open || undefined} aria-hidden={!open}>
      <div ref={chartFade} className="obs-chart-fade">
        {open && <Chart progress={progress.worlds} />}
      </div>

      <div ref={scroller} className="obs-scroll" onScroll={onScroll}>
        {/* First view: title, the dial (the scene behind), the selected world's record. */}
        <section className="obs-first">
          <header className="obs-header">
            <h1 className="obs-title obs-reveal" style={{ ['--d' as string]: '0.5s' }}>
              THE OBSERVATORY
            </h1>
            <p className="obs-subtitle obs-reveal" style={{ ['--d' as string]: '0.8s' }}>
              A record of everything discovered beyond the known.
            </p>
            <nav className="obs-nav obs-reveal" style={{ ['--d' as string]: '1s' }} aria-label="Observatory sections">
              <button type="button" className="obs-nav-link" onClick={() => scrollTo('obs-worlds')} tabIndex={open ? 0 : -1}>
                Worlds
              </button>
              <button type="button" className="obs-nav-link" onClick={() => scrollTo('obs-discoveries')} tabIndex={open ? 0 : -1}>
                Discoveries
              </button>
              <button type="button" className="obs-nav-link" onClick={() => scrollTo('obs-timeline')} tabIndex={open ? 0 : -1}>
                Timeline
              </button>
            </nav>
          </header>

          <div className="obs-reveal obs-reading-wrap" style={{ ['--d' as string]: '1.2s' }}>
            <Reading world={world} active={open} />
          </div>

          <dl className="obs-ledger obs-reveal" style={{ ['--d' as string]: '1.4s' }} aria-label="Exploration record">
            <div>
              <dt>Worlds visited</dt>
              <dd className="tabular-nums">
                {progress.worldsVisited} of {PLANETS.length}
              </dd>
            </div>
            <div>
              <dt>Discoveries</dt>
              <dd className="tabular-nums">
                {progress.found} of {progress.total}
              </dd>
            </div>
            <div>
              <dt>Hidden</dt>
              <dd className="tabular-nums">
                {progress.hiddenFound} of {progress.hiddenTotal}
              </dd>
            </div>
            <div>
              <dt>Exploration</dt>
              <dd className="tabular-nums">{progress.percent}%</dd>
            </div>
            <div>
              <dt>Most explored</dt>
              <dd>{most.length === 0 ? 'None yet' : most.map((p) => p.name).join(', ') + (most.length > 1 ? ' (tied)' : '')}</dd>
            </div>
            <div>
              <dt>Last discovery</dt>
              <dd>{progress.last ? progress.last.discovery.name : 'None yet'}</dd>
            </div>
          </dl>

          <button type="button" className="obs-back quiet-button px-3" onClick={closeObservatory} tabIndex={open ? 0 : -1} title="Return to the galaxy (Esc)">
            <ArrowLeft size={15} strokeWidth={1.5} aria-hidden />
            Galaxy
          </button>
        </section>

        {/* The archive: all six worlds. */}
        <section id="obs-worlds" className="obs-section" aria-labelledby="obs-worlds-title">
          <h2 id="obs-worlds-title" className="obs-section-title">
            The six worlds
          </h2>
          <ol className="obs-worlds">
            {progress.worlds.map((w) => (
              <li key={w.planet.id} data-selected={w.planet.id === observed || undefined}>
                <button
                  type="button"
                  className="obs-world-row"
                  onClick={() => {
                    setObserved(w.planet.id)
                    scroller.current?.scrollTo({ top: 0, behavior: quality.coarse ? 'auto' : 'smooth' })
                  }}
                  tabIndex={open ? 0 : -1}
                  aria-label={`Show ${w.planet.name} on the dial`}
                >
                  <Portrait id={w.planet.id} size={64} />
                  <span className="obs-world-main">
                    <span className="obs-world-name">{w.planet.name}</span>
                    <span className="obs-world-class">{w.planet.classification}</span>
                    <span className="obs-world-teaser">{w.planet.teaser}</span>
                  </span>
                  <span className="obs-world-stat">
                    <span className="obs-stat-label">Visited</span>
                    <span>{w.visitedAt ? formatWhen(w.visitedAt).date : 'Not yet'}</span>
                  </span>
                  <span className="obs-world-stat">
                    <span className="obs-stat-label">Explored</span>
                    <span className="tabular-nums">{w.percent}%</span>
                  </span>
                  <span className="obs-world-stat">
                    <span className="obs-stat-label">Found</span>
                    <span className="tabular-nums">
                      {w.found} of {w.total}
                      {w.hiddenFound > 0 && <span className="obs-hidden-count"> +{w.hiddenFound}</span>}
                    </span>
                  </span>
                </button>
                <button type="button" className="quiet-button obs-world-explore px-4" onClick={() => exploreFromObservatory(w.planet.id)} tabIndex={open ? 0 : -1}>
                  Explore
                  <span className="sr-only"> {w.planet.name}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        {/* The planet archives: everything found on the selected world, and what remains. */}
        <section id="obs-discoveries" className="obs-section" aria-labelledby="obs-disc-title">
          <h2 id="obs-disc-title" className="obs-section-title">
            Archives
          </h2>
          <p className="obs-section-note tabular-nums">
            {progress.found} of {progress.total} discoveries, {progress.hiddenFound} of {progress.hiddenTotal} hidden. Unscanned
            objects keep their secrets until you reach them.
          </p>
          <dl className="obs-categories" aria-label="Discoveries by category">
            {CATEGORY_ORDER.map((c) => {
              const Icon = CATEGORY_ICON[c]
              return (
                <div key={c}>
                  <dt>
                    <Icon size={14} strokeWidth={1.5} aria-hidden />
                    {CATEGORIES[c].plural}
                  </dt>
                  <dd className="tabular-nums">
                    {progress.byCategory[c].found} of {progress.byCategory[c].total}
                  </dd>
                </div>
              )
            })}
          </dl>
          <div className="obs-archive-tabs" role="tablist" aria-label="Planet archive">
            {progress.worlds.map((w) => (
              <button
                key={w.planet.id}
                type="button"
                role="tab"
                className="obs-archive-tab"
                aria-selected={w.planet.id === observed}
                data-selected={w.planet.id === observed || undefined}
                onClick={() => setObserved(w.planet.id)}
                tabIndex={open ? 0 : -1}
                style={{ ['--accent' as string]: w.planet.accent }}
              >
                {w.planet.name}
                <span className="tabular-nums">
                  {w.found}/{w.total}
                </span>
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label={`${world.planet.name} archive`}>
            {world.locations.map((lp) => (
              <div key={lp.location.id} className="obs-collection-world">
                <h3 className="obs-collection-name">
                  {lp.location.name}
                  <span className="tabular-nums">
                    {lp.found} of {lp.total}
                  </span>
                </h3>
                <ul className="obs-collection">
                  {discoveriesAt(lp.location.id).map((d) => (
                    <ArchiveEntry key={d.id} d={d} at={discovered[d.id]} accent={world.planet.accent} active={open} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* The timeline: discoveries in the order they were made. */}
        <section id="obs-timeline" className="obs-section obs-section-last" aria-labelledby="obs-time-title">
          <h2 id="obs-time-title" className="obs-section-title">
            Timeline
          </h2>
          {timeline.length === 0 ? (
            <div className="obs-empty">
              <p>Nothing is recorded yet. Land on a world and scan what you find; each discovery is written here with the moment it was made.</p>
              <button type="button" className="explore-button" onClick={() => exploreFromObservatory(observed)} tabIndex={open ? 0 : -1}>
                <span className="enter-glyph" style={{ background: PLANET_BY_ID[observed].accent }} aria-hidden />
                Explore {PLANET_BY_ID[observed].name}
              </button>
            </div>
          ) : (
            <ol ref={timelineEl} className="obs-timeline" data-inview={visit.timelineSeen || undefined}>
              {timeline.map((t) => {
                const when = formatWhen(t.at)
                const order = fresh.indexOf(t.discovery.id)
                const isNew = order >= 0
                return (
                  <li
                    key={t.discovery.id}
                    className="obs-event"
                    data-new={isNew || undefined}
                    style={{ ['--i' as string]: Math.max(order, 0), ['--accent' as string]: t.planet.accent }}
                  >
                    <time className="obs-event-when tabular-nums" dateTime={when.iso}>
                      <span>{when.date}</span>
                      <span>{when.time}</span>
                    </time>
                    <span className="obs-event-dot" aria-hidden />
                    <div className="obs-event-body">
                      <p className="obs-event-name">
                        {t.discovery.name}
                        {isNew && <span className="obs-event-new">New since your last visit</span>}
                      </p>
                      <p className="obs-event-detail">{CATEGORIES[t.discovery.category].label}{t.discovery.kind === 'secret' && ' · Hidden'}</p>
                      <p className="obs-event-region">
                        {t.location.name}, {t.planet.name}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
