import { Landmark, Leaf, Mountain, Sparkle, Wind, X, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, DISCOVERY_BY_ID, discoveriesAt, type Category, type DiscoveryData } from '../data/discoveries'
import { LOCATION_BY_ID } from '../data/locations'
import { PLANET_BY_ID } from '../data/planets'
import { scanFx } from '../scene/motion'
import { telemetry } from '../state/director'
import { useExploration } from '../state/exploration'
import { formatWhen, worldProgress } from '../state/progress'
import { quality, useExperience } from '../state/useExperience'
import { closeCard, startScan } from './scanner'

/**
 * Phase 6 scanner interface: a real button at every scannable object at the
 * current location (positioned each frame from `telemetry.targets`), the
 * circular scanning interface around the object being scanned, and the card
 * that opens once a discovery is recorded.
 */

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  geology: Mountain,
  structure: Landmark,
  atmosphere: Wind,
  life: Leaf,
  anomaly: Sparkle,
}

/** What the visitor may know about a discovery before it is found. */
export function unknownName(d: DiscoveryData) {
  return d.kind === 'signal' ? 'Unidentified signal' : d.kind === 'secret' ? 'Hidden object' : 'Unidentified object'
}

/** The discoveries at a location that can be seen right now (hidden ones once noticed or found). */
export function useScannable(location: string | null) {
  const discovered = useExploration((s) => s.discovered)
  const detected = useExperience((s) => s.detected)
  return useMemo(
    () =>
      location
        ? discoveriesAt(location).filter((d) => d.kind !== 'secret' || discovered[d.id] || detected[d.id])
        : [],
    [location, discovered, detected],
  )
}

function Marker({ d, found, active }: { d: DiscoveryData; found: boolean; active: boolean }) {
  const el = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const node = el.current
      const t = telemetry.targets[d.id]
      if (node && t) {
        node.style.transform = `translate3d(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px, 0)`
        const show = t.on && !active
        node.style.opacity = show ? '1' : '0'
        node.style.pointerEvents = show ? 'auto' : 'none'
        node.tabIndex = show ? 0 : -1
        node.dataset.side = t.x > window.innerWidth - 260 ? 'left' : 'right'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [d.id, active])

  const name = found ? d.name : unknownName(d)
  return (
    <button
      ref={el}
      type="button"
      className="scan-marker"
      data-found={found || undefined}
      data-kind={d.kind}
      data-discovery={d.id}
      style={{ opacity: 0 }}
      onClick={() => startScan(d.id)}
      aria-label={found ? `${d.name}, ${CATEGORIES[d.category].label}. Show record` : `${name}. Scan`}
    >
      <span className="scan-marker-reticle" aria-hidden />
      <span className="scan-marker-label" aria-hidden>
        <span className="scan-marker-leader" />
        <span className="scan-marker-text">
          <span className="scan-marker-name">{name}</span>
          <span className="scan-marker-hint">
            {found ? CATEGORIES[d.category].label : quality.coarse ? 'Tap to scan' : 'Select to scan'}
          </span>
        </span>
      </span>
    </button>
  )
}

const TICKS = 60

/** The circular scanning interface, drawn around the object being scanned. */
function ScanRing() {
  const scanning = useExperience((s) => s.scanning)
  const card = useExperience((s) => s.card)
  const root = useRef<HTMLDivElement>(null)
  const arc = useRef<SVGCircleElement>(null)
  const pct = useRef<HTMLSpanElement>(null)
  const id = scanning ?? card
  // Completed: the scan has ended and its record is open (the ring is only drawn while its effects play).
  const done = !scanning && !!card

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const node = root.current
      const target = scanFx.target ? telemetry.targets[scanFx.target] : null
      if (node) {
        const live = !!target && !!scanFx.target && (scanning !== null || scanFx.pulse > 0)
        node.style.opacity = live && target!.on ? '1' : '0'
        if (target) node.style.transform = `translate3d(${target.x.toFixed(1)}px, ${target.y.toFixed(1)}px, 0)`
        if (arc.current) arc.current.style.strokeDashoffset = String(1 - scanFx.progress)
        if (pct.current) pct.current.textContent = `${Math.round(scanFx.progress * 100)}%`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [scanning])

  const d = id ? DISCOVERY_BY_ID[id] : null
  return (
    <div ref={root} className="scan-ring" data-done={done || undefined} aria-hidden style={{ opacity: 0 }}>
      <svg viewBox="-70 -70 140 140" className="scan-ring-svg">
        <g className="scan-ring-ticks">
          {Array.from({ length: TICKS }, (_, i) => {
            const a = (i / TICKS) * Math.PI * 2
            const r0 = i % 5 === 0 ? 58 : 61
            return (
              <line key={i} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * 64} y2={Math.sin(a) * 64} />
            )
          })}
        </g>
        <circle className="scan-ring-track" r={50} />
        <circle ref={arc} className="scan-ring-arc" r={50} pathLength={1} transform="rotate(-90)" />
        <circle className="scan-ring-inner" r={36} />
      </svg>
      <span className="scan-ring-readout">
        {done ? (d ? CATEGORIES[d.category].label : 'Recorded') : <>Scanning <span ref={pct} className="tabular-nums">0%</span></>}
      </span>
    </div>
  )
}

/** The record that opens once a discovery is in the archive. */
function DiscoveryCard() {
  const card = useExperience((s) => s.card)
  const openedAt = useExperience((s) => s.cardAt)
  const discovered = useExploration((s) => s.discovered)
  const visited = useExploration((s) => s.visited)
  // Keep the last card's content while it fades out.
  const [last, setLast] = useState<string | null>(null)
  if (card && card !== last) setLast(card)
  const id = card ?? last
  const d = id ? DISCOVERY_BY_ID[id] : null
  if (!d) return <aside className="discovery-card" aria-hidden />

  const at = discovered[d.id]
  const world = PLANET_BY_ID[d.planet]
  const progress = worldProgress(world, discovered, visited)
  const Icon = CATEGORY_ICON[d.category]
  const isNew = !!at && openedAt - at < 15000
  const when = at ? formatWhen(at) : null

  return (
    <aside
      className="discovery-card ui-hideable"
      data-open={card ? true : undefined}
      aria-hidden={!card}
      aria-live="polite"
      aria-label={`Discovery: ${d.name}`}
      style={{ ['--accent' as string]: world.accent }}
      key={d.id}
    >
      <p className="discovery-card-kind">
        <Icon size={14} strokeWidth={1.5} aria-hidden />
        {CATEGORIES[d.category].label}
        {d.kind === 'secret' && <span className="discovery-card-hidden">Hidden discovery</span>}
      </p>
      <h2 className="discovery-card-name">{d.name}</h2>
      <p className="discovery-card-copy">{d.description}</p>
      <dl className="discovery-card-facts">
        <div>
          <dt>Where</dt>
          <dd>
            {LOCATION_BY_ID[d.location].name}, {world.name}
          </dd>
        </div>
        <div>
          <dt>{isNew ? 'Recorded' : 'In the archive since'}</dt>
          <dd className="tabular-nums">{when ? `${when.date}, ${when.time}` : '—'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{isNew ? 'New discovery' : 'Catalogued'}</dd>
        </div>
      </dl>
      <p className="discovery-card-archive tabular-nums">
        Saved to the {world.name} archive · {progress.found} of {progress.total} found on {world.name}
        {progress.hiddenFound > 0 && `, ${progress.hiddenFound} hidden`}
      </p>
      <button type="button" className="discovery-card-close quiet-button" onClick={closeCard} tabIndex={card ? 0 : -1}>
        <X size={14} strokeWidth={1.5} aria-hidden />
        Close
      </button>
    </aside>
  )
}

export function ScannerUI() {
  const location = useExperience((s) => s.location)
  const scanning = useExperience((s) => s.scanning)
  const discovered = useExploration((s) => s.discovered)
  const targets = useScannable(location)
  return (
    <>
      <div className="scan-markers">
        {targets.map((d) => (
          <Marker key={d.id} d={d} found={!!discovered[d.id]} active={scanning === d.id} />
        ))}
      </div>
      <ScanRing />
      <DiscoveryCard />
    </>
  )
}
