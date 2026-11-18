import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { locationsFor } from '../data/locations'
import { PLANET_BY_ID, PLANETS, type PlanetId } from '../data/planets'
import { useThumbs } from '../scene/galaxy/Thumbnails'
import { telemetry } from '../state/director'
import { useExploration } from '../state/exploration'
import { discoveryTimeline, formatWhen, systemProgress, type WorldProgress } from '../state/progress'
import { quality, useExperience } from '../state/useExperience'
import { closeObservatory, exploreFromObservatory, stepObserved } from './observatoryDirector'

const ORDER = PLANETS.map((p) => p.id)
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
  const discovered = useExploration((s) => s.discovered)

  // Which of each world's three locations are found, in location order.
  const marks = useMemo(
    () => Object.fromEntries(PLANETS.map((p) => [p.id, locationsFor(p.id).map((l) => !!discovered[l.id])])),
    [discovered],
  ) as Record<PlanetId, boolean[]>

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
          marks[id].map((found, i) => (
            <circle
              key={`${id}-${i}`}
              data-mark={id}
              r={2.6}
              className="obs-mark"
              data-found={found || undefined}
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
  const discovered = useExploration((s) => s.discovered)
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
          <dt>Locations</dt>
          <dd className="tabular-nums">
            {world.found} of {world.total} found
          </dd>
        </div>
      </dl>
      <ol className="obs-reading-locations">
        {locationsFor(p.id).map((l) => {
          const at = discovered[l.id]
          return (
            <li key={l.id}>
              <span className="signal-dot" data-found={at ? true : undefined} style={{ ['--accent' as string]: p.accent }} aria-hidden />
              <span className="text-starlight/90">{l.name}</span>
              <span className="ml-auto text-haze tabular-nums">{at ? formatWhen(at).date : 'Not found'}</span>
            </li>
          )
        })}
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
  const fresh = open ? timeline.filter((t) => t.at > visit.seenBefore).map((t) => t.location.id) : []
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
              <dt>Locations discovered</dt>
              <dd className="tabular-nums">{progress.found}</dd>
            </div>
            <div>
              <dt>Discoveries available</dt>
              <dd className="tabular-nums">{progress.total}</dd>
            </div>
            <div>
              <dt>Exploration</dt>
              <dd className="tabular-nums">{progress.percent}%</dd>
            </div>
            <div>
              <dt>Most explored</dt>
              <dd>{most.length === 0 ? 'None yet' : most.map((p) => p.name).join(', ') + (most.length > 1 ? ' (tied)' : '')}</dd>
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

        {/* The collection: every location, found or not. */}
        <section id="obs-discoveries" className="obs-section" aria-labelledby="obs-disc-title">
          <h2 id="obs-disc-title" className="obs-section-title">
            Discoveries
          </h2>
          <p className="obs-section-note tabular-nums">
            {progress.found} of {progress.total} found. Unfound signals keep their secrets until you reach them.
          </p>
          {progress.worlds.map((w) => (
            <div key={w.planet.id} className="obs-collection-world">
              <h3 className="obs-collection-name">
                {w.planet.name}
                <span className="tabular-nums">
                  {w.found} of {w.total}
                </span>
              </h3>
              <ul className="obs-collection">
                {locationsFor(w.planet.id).map((l) => {
                  const at = discovered[l.id]
                  return (
                    <li key={l.id} className="obs-entry" data-found={at ? true : undefined}>
                      <p className="obs-entry-name">{l.name}</p>
                      <p className="obs-entry-region">{l.region}</p>
                      {at ? (
                        <>
                          <p className="obs-entry-finding">{l.finding}</p>
                          <p className="obs-entry-copy">{l.lore}</p>
                          <p className="obs-entry-meta">
                            <span className="signal-dot" data-found style={{ ['--accent' as string]: w.planet.accent }} aria-hidden />
                            Discovered <time dateTime={formatWhen(at).iso}>{formatWhen(at).date}, {formatWhen(at).time}</time>
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="obs-entry-redacted" aria-label="Finding not yet known">
                            <span />
                          </p>
                          <p className="obs-entry-copy">{l.hint}</p>
                          <p className="obs-entry-meta">
                            <span className="signal-dot" style={{ ['--accent' as string]: w.planet.accent }} aria-hidden />
                            Not yet discovered
                          </p>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>

        {/* The timeline: discoveries in the order they were made. */}
        <section id="obs-timeline" className="obs-section obs-section-last" aria-labelledby="obs-time-title">
          <h2 id="obs-time-title" className="obs-section-title">
            Timeline
          </h2>
          {timeline.length === 0 ? (
            <div className="obs-empty">
              <p>Nothing is recorded yet. Land on a world and find its signal; each discovery is written here with the moment it was made.</p>
              <button type="button" className="explore-button" onClick={() => exploreFromObservatory(observed)} tabIndex={open ? 0 : -1}>
                <span className="enter-glyph" style={{ background: PLANET_BY_ID[observed].accent }} aria-hidden />
                Explore {PLANET_BY_ID[observed].name}
              </button>
            </div>
          ) : (
            <ol ref={timelineEl} className="obs-timeline" data-inview={visit.timelineSeen || undefined}>
              {timeline.map((t) => {
                const when = formatWhen(t.at)
                const order = fresh.indexOf(t.location.id)
                const isNew = order >= 0
                return (
                  <li
                    key={t.location.id}
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
                        {t.location.name}
                        {isNew && <span className="obs-event-new">New since your last visit</span>}
                      </p>
                      <p className="obs-event-detail">{t.location.finding}</p>
                      <p className="obs-event-region">{t.location.region}</p>
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
