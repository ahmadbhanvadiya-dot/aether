import { Orbit, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CATEGORIES } from '../data/discoveries'
import { expeditionsFor } from '../data/expeditions'
import { isSiteId, READING_BY_ID, readingsFor, readingsFoundAt, SITE_RECORDS, type SiteId } from '../data/waystation'
import { telemetry } from '../state/director'
import { useExploration } from '../state/exploration'
import { formatWhen } from '../state/progress'
import { quality, useExperience } from '../state/useExperience'
import { CATEGORY_ICON } from './ScannerUI'
import { closeReadingCard, readingFx, startReading, useSite } from './siteDirector'

/**
 * Phase 11d: a deep-space site's interface — its record (opened by selecting the
 * site in the scene: `siteOpen`), the markers of its readings over the scene, and
 * the card of a reading once it is taken. The same panel and card as a world's.
 * One interface for every site (the Waystation, the keepers' ring).
 */

/** "The Waystation" reads "the Waystation" mid-sentence. */
const inSentence = (name: string) => (name.startsWith('The ') ? `the ${name.slice(4)}` : name)

/** The site you are at, in its overview (null elsewhere). */
function useHere(): SiteId | null {
  const phase = useExperience((s) => s.phase)
  const active = useExperience((s) => s.activeSystem)
  return phase === 'galaxy' && isSiteId(active) ? active : null
}

/** Markers over the site: a ring to read, a filled dot once read, a sweep while reading. */
function Markers({ here }: { here: SiteId | null }) {
  const discovered = useExploration((s) => s.discovered)
  const scanning = useSite((s) => s.scanning)
  const layer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!here) return
    let raf = 0
    const tick = () => {
      layer.current?.querySelectorAll<HTMLElement>('[data-reading]').forEach((el) => {
        const m = telemetry.site[el.dataset.reading!]
        if (!m) return
        el.style.transform = `translate3d(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px, 0)`
        el.dataset.away = m.on ? '' : 'true'
        if (el.dataset.reading === readingFx.id) el.style.setProperty('--p', readingFx.progress.toFixed(3))
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [here])

  const readings = here ? readingsFor(here) : []
  return (
    <div
      ref={layer}
      className="site-marks"
      data-visible={here || undefined}
      aria-label={here ? `Readings at ${inSentence(SITE_RECORDS[here].name)}` : undefined}
      style={here ? { ['--site' as string]: SITE_RECORDS[here].color } : undefined}
    >
      {readings.map((r) => {
        const found = !!discovered[r.id]
        return (
          <button
            key={r.id}
            type="button"
            data-reading={r.id}
            className="site-mark"
            data-found={found || undefined}
            data-scanning={scanning === r.id || undefined}
            onClick={() => startReading(r.id)}
            tabIndex={here ? 0 : -1}
            aria-label={found ? `${r.name}, read` : `Unread reading: ${r.hint}`}
            title={found ? r.name : r.hint}
          >
            <span className="site-mark-ring" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

/** The card of a reading, once taken. */
function ReadingCard({ here }: { here: SiteId | null }) {
  const card = useSite((s) => s.card)
  const discovered = useExploration((s) => s.discovered)
  const r = card ? READING_BY_ID[card] : null
  const open = !!r && here === r.site

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const st = useExperience.getState()
      if (e.key === 'Escape' && !st.story && !st.journal) closeReadingCard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!r) return <aside className="discovery-card site-card" aria-hidden />
  const rec = SITE_RECORDS[r.site]
  const Icon = CATEGORY_ICON[r.category]
  const at = discovered[r.id]
  const when = at ? formatWhen(at) : null
  return (
    <aside
      className="discovery-card site-card ui-hideable"
      data-open={open || undefined}
      aria-hidden={!open}
      aria-live="polite"
      aria-label={`Reading: ${r.name}`}
      style={{ ['--accent' as string]: rec.color }}
      key={r.id}
    >
      <p className="discovery-card-kind">
        <Icon size={14} strokeWidth={1.5} aria-hidden />
        {CATEGORIES[r.category].label}
      </p>
      <h2 className="discovery-card-name">{r.name}</h2>
      <p className="discovery-card-copy">{r.description}</p>
      <dl className="discovery-card-facts">
        <div>
          <dt>Where</dt>
          <dd>
            {rec.name}, {rec.place}
          </dd>
        </div>
        <div>
          <dt>Recorded</dt>
          <dd className="tabular-nums">{when ? `${when.date}, ${when.time}` : '—'}</dd>
        </div>
      </dl>
      {expeditionsFor(r.id).map((e) => (
        <p key={e.id} className="discovery-card-expedition">
          Part of {e.code} · {e.title}
        </p>
      ))}
      <p className="discovery-card-archive tabular-nums">
        Read from orbit · {readingsFoundAt(discovered, r.site)} of {readingsFor(r.site).length} readings at {inSentence(rec.name)}
      </p>
      <button type="button" className="discovery-card-close quiet-button" onClick={closeReadingCard} tabIndex={open ? 0 : -1}>
        <X size={14} strokeWidth={1.5} aria-hidden />
        Close
      </button>
    </aside>
  )
}

export function SiteUI() {
  const here = useHere()
  const siteOpen = useExperience((s) => s.siteOpen)
  const setSiteOpen = useExperience((s) => s.setSiteOpen)
  const discovered = useExploration((s) => s.discovered)
  const aside = useRef<HTMLElement>(null)
  const open = siteOpen && !!here
  // Keep the last site's record while the panel fades out.
  const [last, setLast] = useState<SiteId>('waystation')
  if (here && here !== last) setLast(here)
  const site = here ?? last
  const rec = SITE_RECORDS[site]
  const readings = readingsFor(site)
  const found = readingsFoundAt(discovered, site)

  useEffect(() => {
    if (!open) return
    if (aside.current) aside.current.scrollTop = 0
    const onKey = (e: KeyboardEvent) => {
      const st = useExperience.getState()
      if (e.key === 'Escape' && !st.story && !st.journal) st.setSiteOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="site-ui">
      <Markers here={here} />
      <ReadingCard here={here} />
      <aside ref={aside} className="world-panel ui-hideable" data-open={open || undefined} aria-hidden={!open} inert={!open} aria-live="polite">
        <div className="world-panel-body">
          <p className="text-[0.8125rem] text-haze">{rec.kicker}</p>
          <h2 className="world-panel-name">{rec.name.toUpperCase()}</h2>
          <p className="flex items-center gap-2.5 text-[1.02rem] font-light text-starlight/85">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: rec.color, boxShadow: `0 0 10px ${rec.color}` }} aria-hidden />
            {rec.kind}
          </p>
          <p className="world-panel-copy">{rec.copy}</p>
          <dl className="world-facts">
            {rec.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          <div className="site-readings" style={{ ['--site' as string]: rec.color }}>
            <p className="site-readings-head tabular-nums">
              Readings{' '}
              <span>
                {found} of {readings.length}
              </span>
            </p>
            <ul>
              {readings.map((r) => {
                const at = discovered[r.id]
                return (
                  <li key={r.id}>
                    <button type="button" className="site-reading" data-found={at ? true : undefined} onClick={() => startReading(r.id)} tabIndex={open ? 0 : -1}>
                      <span className="site-reading-dot" aria-hidden />
                      <span>{at ? r.name : r.hint}</span>
                      <span className="site-reading-state">{at ? formatWhen(at).date : quality.coarse ? 'Tap to read' : 'Select to read'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="world-panel-actions">
            <button type="button" className="quiet-button ml-auto px-4" onClick={() => setSiteOpen(false)} tabIndex={open ? 0 : -1} title="Close (Esc)">
              <Orbit size={15} strokeWidth={1.5} aria-hidden />
              Return to {inSentence(rec.name)}
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
