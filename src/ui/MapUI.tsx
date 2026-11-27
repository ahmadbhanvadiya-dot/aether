import { ArrowLeft, Navigation, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LIRIS } from '../data/tessaly'
import { SYSTEM_BY_ID, SYSTEMS, type SystemId } from '../data/systems'
import { telemetry } from '../state/director'
import { useExploration } from '../state/exploration'
import { mapAccess } from '../state/expeditions'
import { routeKey } from '../state/exploration'
import { systemProgress, worldProgress } from '../state/progress'
import { useExperience } from '../state/useExperience'
import { loadSystem } from '../system/chunks'
import { closeMap, transitFx, travelTo } from './mapDirector'
import { sound } from '../audio/sound'

/**
 * Phase 11: the universe map. The galaxy AETHER has always drawn, seen from
 * above its disc, with the star systems marked in its arms. Elys is home.
 * Tessaly is hinted at once Expedition II is complete (unnamed), and reachable
 * once Expedition III is: select it and travel.
 */

/** When the map was last opened (routes flown since then trace themselves in). */
const lastMapOpen = { at: Date.now() }

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
  // Phase 11e: routes. Flown ones glow; ones that could be flown (both ends open) are a faint dash.
  const routes = useExploration((s) => s.routes)
  const pairs = useMemo(() => {
    const open = SYSTEMS.filter((s) => s.id === active || access.open[s.id])
    const out: { a: SystemId; b: SystemId; flown: number }[] = []
    for (let i = 0; i < open.length; i++)
      for (let j = i + 1; j < open.length; j++) {
        const a = open[i].id
        const b = open[j].id
        out.push({ a, b, flown: routes[routeKey(a, b)] ?? 0 })
      }
    return out
  }, [access, active, routes])
  // Routes flown since the map was last open trace themselves in.
  const [seenAt, setSeenAt] = useState(() => lastMapOpen.at)
  const fog = useRef<HTMLCanvasElement>(null)
  const routeSvg = useRef<SVGSVGElement>(null)

  // Each time the map opens: start on the system you are in (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSelected(active)
      setTravelling(false)
      // Routes flown after the last opening are the new ones (the effect then records this opening).
      setSeenAt(lastMapOpen.at)
    }
  }

  // Markers, the route and the traveller follow the projected systems (written by GalaxyRig in map mode).
  useEffect(() => {
    if (!open) return
    lastMapOpen.at = Date.now()
    let raf = 0
    // The fog: uncharted space stays veiled; known places clear it around them,
    // reachable ones widely, the place you are in most. It breathes slowly.
    const c = fog.current
    const ctx = c?.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const reduce = useExperience.getState().reducedMotion
    const clearings = SYSTEMS.map((s) => ({
      id: s.id,
      r: s.id === useExperience.getState().activeSystem ? 230 : access.open[s.id] ? 180 : access.known[s.id] ? 95 : 0,
    })).filter((x) => x.r > 0)
    const drawFog = () => {
      if (!c || !ctx) return
      const W = Math.round(window.innerWidth * dpr)
      const H = Math.round(window.innerHeight * dpr)
      if (c.width !== W || c.height !== H) {
        c.width = W
        c.height = H
      }
      const t = reduce ? 0 : performance.now() / 1000
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(2, 3, 10, 0.74)'
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'destination-out'
      for (const k of clearings) {
        const m = telemetry.map[k.id]
        if (!m) continue
        const R = k.r * dpr * (1 + 0.05 * Math.sin(t * 0.5 + k.r))
        const g = ctx.createRadialGradient(m.x * dpr, m.y * dpr, 0, m.x * dpr, m.y * dpr, R)
        g.addColorStop(0, 'rgba(0,0,0,1)')
        g.addColorStop(0.55, 'rgba(0,0,0,0.85)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(m.x * dpr, m.y * dpr, R, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
    }
    const tick = () => {
      marks.current?.querySelectorAll<HTMLElement>('[data-system]').forEach((el) => {
        const m = telemetry.map[el.dataset.system!]
        el.style.transform = `translate3d(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px, 0)`
        el.style.visibility = m.on ? 'visible' : 'hidden'
      })
      // Route lines between the projected places.
      routeSvg.current?.querySelectorAll<SVGLineElement>('[data-route]').forEach((ln) => {
        const a = telemetry.map[ln.dataset.a!]
        const b = telemetry.map[ln.dataset.b!]
        ln.setAttribute('x1', a.x.toFixed(1))
        ln.setAttribute('y1', a.y.toFixed(1))
        ln.setAttribute('x2', b.x.toFixed(1))
        ln.setAttribute('y2', b.y.toFixed(1))
        ln.style.visibility = a.on && b.on ? 'visible' : 'hidden'
      })
      drawFog()
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
  }, [open, access])

  // A route flown since the last opening traces itself in, with a soft glide (CSS: 0.9 s in).
  const fresh = open && pairs.some((p) => p.flown > seenAt)
  useEffect(() => {
    if (!fresh) return
    const id = window.setTimeout(() => sound.trace(1.6), 900)
    return () => clearTimeout(id)
  }, [fresh])

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
      <canvas ref={fog} className="map-fog" aria-hidden />
      <svg ref={routeSvg} className="map-routes" aria-hidden>
        {pairs.map(({ a, b, flown }) => (
          <line
            key={`${a}>${b}`}
            data-route
            data-a={a}
            data-b={b}
            data-flown={flown ? true : undefined}
            data-new={flown > seenAt || undefined}
            // Only a route tracing itself in is measured in path units (its dash is the whole line).
            pathLength={flown > seenAt ? 1 : undefined}
          />
        ))}
      </svg>
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
