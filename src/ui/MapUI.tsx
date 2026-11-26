import { ArrowLeft, Navigation, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LIRIS } from '../data/tessaly'
import { SYSTEM_BY_ID, SYSTEMS, type SystemId } from '../data/systems'
import { telemetry } from '../state/director'
import { useExploration } from '../state/exploration'
import { mapAccess } from '../state/expeditions'
import { systemProgress, worldProgress } from '../state/progress'
import { useExperience } from '../state/useExperience'
import { loadSystem } from '../system/chunks'
import { closeMap, transitFx, travelTo } from './mapDirector'

/**
 * Phase 11: the universe map. The galaxy AETHER has always drawn, seen from
 * above its disc, with the star systems marked in its arms. Elys is home.
 * Tessaly is hinted at once Expedition II is complete (unnamed), and reachable
 * once Expedition III is: select it and travel.
 */

export function MapUI() {
  const phase = useExperience((s) => s.phase)
  const active = useExperience((s) => s.activeSystem)
  const open = phase === 'map'
  const discovered = useExploration((s) => s.discovered)
  const visited = useExploration((s) => s.visited)
  const access = useMemo(() => mapAccess(discovered), [discovered])
  const [selected, setSelected] = useState<SystemId>(active)
  const [travelling, setTravelling] = useState(false)
  const marks = useRef<HTMLDivElement>(null)
  const route = useRef<HTMLDivElement>(null)
  const traveller = useRef<HTMLDivElement>(null)
  // The rAF loop reads the selection without restarting.
  const selectedRef = useRef(selected)
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])
  const percent = useMemo<Partial<Record<SystemId, number>>>(
    () => ({
      elys: systemProgress(discovered, visited).percent,
      tessaly: worldProgress(LIRIS, discovered, visited).percent,
    }),
    [discovered, visited],
  )
  // A place is sealed until its expedition opens it (development shots can stand anywhere regardless).
  const isSealed = (id: SystemId) => !access.open[id] && id !== active
  const shown = SYSTEMS.filter((s) => s.id === active || access.known[s.id])

  // Each time the map opens: start on the system you are in (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSelected(active)
      setTravelling(false)
    }
  }

  // Markers, the route and the traveller follow the projected systems (written by GalaxyRig in map mode).
  useEffect(() => {
    if (!open) return
    let raf = 0
    const tick = () => {
      marks.current?.querySelectorAll<HTMLElement>('[data-system]').forEach((el) => {
        const m = telemetry.map[el.dataset.system!]
        el.style.transform = `translate3d(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px, 0)`
        el.style.visibility = m.on ? 'visible' : 'hidden'
      })
      const r = route.current
      const t = traveller.current
      if (r && t) {
        const a = telemetry.map[transitFx.active ? transitFx.from : useExperience.getState().activeSystem]
        const b = telemetry.map[transitFx.active ? transitFx.to : selectedRef.current]
        const show = a.on && b.on && a !== b
        const dx = b.x - a.x
        const dy = b.y - a.y
        r.style.width = `${Math.hypot(dx, dy).toFixed(1)}px`
        r.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0) rotate(${Math.atan2(dy, dx)}rad)`
        r.style.opacity = show ? (transitFx.active ? '1' : '0.55') : '0'
        const k = transitFx.t
        t.style.transform = `translate3d(${(a.x + dx * k).toFixed(1)}px, ${(a.y + dy * k).toFixed(1)}px, 0)`
        t.style.opacity = transitFx.active && show ? '1' : '0'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const st = useExperience.getState()
      if (st.story || st.journal || transitFx.active) return
      if (e.key === 'Escape') closeMap()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const sys = SYSTEM_BY_ID[selected]
  const sealed = isSealed(selected)
  const here = selected === active
  const canTravel = !sealed && !here && !travelling
  const tab = open && !travelling ? 0 : -1
  const activeName = SYSTEM_BY_ID[active].name

  const travel = () => {
    setTravelling(true)
    travelTo(selected)
  }

  return (
    <div className="map-ui" data-open={open || undefined} data-travelling={travelling || undefined} inert={!open} aria-hidden={!open}>
      <div ref={marks} className="map-marks">
        <div ref={route} className="map-route" aria-hidden />
        <div ref={traveller} className="map-traveller" aria-hidden />
        {shown.map((s) => {
          const sealedMark = isSealed(s.id)
          return (
            <button
              key={s.id}
              type="button"
              data-system={s.id}
              className="map-mark"
              data-selected={s.id === selected || undefined}
              data-sealed={sealedMark || undefined}
              data-here={s.id === active || undefined}
              style={{ ['--star' as string]: s.color }}
              onClick={() => {
                setSelected(s.id)
                // Fetch the destination's code early, so arriving never waits.
                if (!sealedMark) travelPreload(s.id)
              }}
              aria-pressed={s.id === selected}
              tabIndex={tab}
            >
              <span className="map-mark-dot" aria-hidden />
              <span className="map-mark-name">
                {sealedMark ? s.unknownName : s.name}
                {s.id === active && <span className="map-mark-here"> · You are here</span>}
              </span>
            </button>
          )
        })}
      </div>

      <aside className="map-panel" aria-live="polite">
        <p className="map-kicker">{travelling ? 'In transit' : 'The galaxy'}</p>
        <h2 className="map-title">{sealed ? sys.unknownName : sys.name}</h2>
        <p className="map-copy">{sealed ? sys.description : (sys.openDescription ?? sys.description)}</p>
        <dl className="obs-facts map-facts">
          {sys.kind === 'site' ? (
            <div>
              <dt>Site</dt>
              <dd>{sealed ? 'Unresolved' : sys.siteKind}</dd>
            </div>
          ) : (
            <div>
              <dt>Star</dt>
              <dd>{sealed ? 'Unresolved' : sys.star}</dd>
            </div>
          )}
          {sealed ? (
            <div>
              <dt>Status</dt>
              <dd>Not yet reachable</dd>
            </div>
          ) : sys.kind === 'site' ? (
            <div>
              <dt>Light</dt>
              <dd>No star; its own lamps</dd>
            </div>
          ) : (
            <>
              <div>
                <dt>Worlds</dt>
                <dd className="tabular-nums">{sys.worlds}</dd>
              </div>
              <div>
                <dt>Explored</dt>
                <dd className="tabular-nums">{percent[selected] ?? 0}%</dd>
              </div>
            </>
          )}
        </dl>
        {!access.tessalyKnown && <p className="map-note">Beyond Elys, the galaxy is uncharted. Complete the expeditions to learn where they lead.</p>}
        {sealed && sys.sealedNote && <p className="map-note">{sys.sealedNote}</p>}
        <div className="map-actions">
          {canTravel && (
            <button type="button" className="explore-button" onClick={travel}>
              <Navigation size={14} strokeWidth={1.5} aria-hidden />
              Travel to {inSentence(sys.name)}
            </button>
          )}
          <button type="button" className={canTravel ? 'quiet-button px-3' : 'explore-button'} onClick={closeMap} tabIndex={tab} disabled={travelling}>
            <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
            Back to {inSentence(activeName)}
          </button>
        </div>
      </aside>

      <button type="button" className="map-close quiet-button px-3" onClick={closeMap} title="Close the map (Esc)" tabIndex={tab} disabled={travelling}>
        <X size={15} strokeWidth={1.5} aria-hidden />
        Close
      </button>
    </div>
  )
}

function travelPreload(id: SystemId) {
  void loadSystem(id).catch(() => {})
}

/** "The Waystation" reads "the Waystation" mid-sentence. */
const inSentence = (name: string) => (name.startsWith('The ') ? `the ${name.slice(4)}` : name)
