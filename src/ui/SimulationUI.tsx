import gsap from 'gsap'
import { ChevronsLeft, ChevronsRight, Orbit, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { ASTRONOMY, formatAU, formatDay, formatDuration } from '../data/astronomy'
import { PLANET_BY_ID, type PlanetId } from '../data/planets'
import { EVENT_KINDS, type CelestialEvent } from '../state/events'
import { formatSimDay, formatUntil, resetSimulation, sim, SPEEDS, useSimulation } from '../state/simulation'
import { nextFor, useSky, watchSky } from '../state/sky'
import { useExperience } from '../state/useExperience'

/**
 * Phase 9: the simulation's controls and what they show — the clock, the
 * events in progress and to come, and each world's astronomy. Text that changes
 * every frame (the clock, "in 12 days") is written straight to the DOM from one
 * animation frame loop; React renders only on discrete changes.
 */

// ---- One rAF loop for every live text ----------------------------------------

type Live = (day: number) => string
const lives = new Map<HTMLElement, Live>()
let raf = 0
function loop() {
  const day = sim.day
  lives.forEach((fn, el) => {
    const v = fn(day)
    if (el.textContent !== v) el.textContent = v
  })
  raf = lives.size ? requestAnimationFrame(loop) : 0
}
function useLive(fn: Live) {
  const ref = useRef<HTMLSpanElement>(null)
  const latest = useRef(fn)
  useEffect(() => {
    latest.current = fn
  })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    lives.set(el, (d) => latest.current(d))
    if (!raf) raf = requestAnimationFrame(loop)
    return () => void lives.delete(el)
  }, [])
  return ref
}

function Until({ day }: { day: number }) {
  const ref = useLive((d) => formatUntil(day - d))
  return <span ref={ref} className="tabular-nums" />
}

// ---- Actions ---------------------------------------------------------------

/** Takes the clock to an event's peak (a short time‑lapse), pauses, and marks it on the dial. */
function showEvent(e: CelestialEvent) {
  const sky = useSky.getState()
  useSimulation.getState().setPlaying(false)
  sky.setFocus(e)
  gsap.killTweensOf(sim)
  const reduced = useExperience.getState().reducedMotion
  if (reduced) {
    sim.day = e.peak
    return
  }
  sim.jumping = true
  gsap.to(sim, {
    day: e.peak,
    duration: Math.min(2.4, 0.9 + Math.log10(1 + Math.abs(e.peak - sim.day)) * 0.45),
    ease: 'power2.inOut',
    onComplete: () => void (sim.jumping = false),
  })
}

function reset() {
  gsap.killTweensOf(sim)
  useSky.getState().setFocus(null)
  resetSimulation()
}

// ---- Controls --------------------------------------------------------------

export function SimControls({ variant, active = true }: { variant: 'galaxy' | 'observatory'; active?: boolean }) {
  const playing = useSimulation((s) => s.playing)
  const speed = useSimulation((s) => s.speed)
  const orbits = useSimulation((s) => s.orbits)
  const { togglePlaying, stepSpeed, toggleOrbits } = useSimulation.getState()
  const motionPaused = useExperience((s) => s.motionPaused)
  const tab = active ? 0 : -1
  const clock = useLive((d) => formatSimDay(d))
  // The clock eases down while the camera is attached to a world (flying, focused, landed).
  const held = useLive(() => (playing && !motionPaused && !sim.jumping && sim.rate < SPEEDS[speed].perSec * 0.8 ? `slowed to ${+sim.rate.toFixed(1)} days / s near a world` : ''))

  return (
    <div className="sim" data-variant={variant} role="group" aria-label="Simulation time">
      <button type="button" className="quiet-button" onClick={togglePlaying} aria-pressed={!playing} title={playing ? 'Pause time (T)' : 'Run time (T)'} tabIndex={tab}>
        {playing ? <Pause size={15} strokeWidth={1.5} aria-hidden /> : <Play size={15} strokeWidth={1.5} aria-hidden />}
        <span className="sr-only">{playing ? 'Pause time' : 'Run time'}</span>
      </button>
      <span className="sim-speed">
        <button type="button" className="quiet-button" onClick={() => stepSpeed(-1)} disabled={speed === 0} title="Slower ([)" tabIndex={tab}>
          <ChevronsLeft size={15} strokeWidth={1.5} aria-hidden />
          <span className="sr-only">Slower</span>
        </button>
        <span className="sim-rate tabular-nums" aria-live="polite">
          {motionPaused ? 'Motion paused' : `${SPEEDS[speed].label} / s`}
        </span>
        <button type="button" className="quiet-button" onClick={() => stepSpeed(1)} disabled={speed === SPEEDS.length - 1} title="Faster (])" tabIndex={tab}>
          <ChevronsRight size={15} strokeWidth={1.5} aria-hidden />
          <span className="sr-only">Faster</span>
        </button>
      </span>
      <span className="sim-clock">
        <span ref={clock} className="tabular-nums" />
        <span ref={held} className="sim-held" />
      </span>
      <button type="button" className="quiet-button" onClick={reset} title="Back to the epoch" tabIndex={tab}>
        <RotateCcw size={14} strokeWidth={1.5} aria-hidden />
        <span className="sr-only">Back to the epoch</span>
      </button>
      <button type="button" className="quiet-button" onClick={toggleOrbits} aria-pressed={orbits} title={orbits ? 'Hide orbits' : 'Show orbits'} tabIndex={tab}>
        <Orbit size={15} strokeWidth={1.5} aria-hidden />
        <span className="sr-only">Orbits</span>
      </button>
    </div>
  )
}

/** Galaxy: one line under the controls — the event in progress, or the next one between worlds. */
export function SkyLine() {
  const now = useSky((s) => s.now)
  const next = useSky((s) => s.next)
  const event = now[0] ?? next.find((e) => e.kind !== 'lunar-eclipse' && e.kind !== 'solar-eclipse' && e.kind !== 'shadow-transit') ?? next[0]
  if (!event) return null
  const live = now.includes(event)
  return (
    <p className="sky-line" aria-live="polite">
      <span className="sky-line-mark">{live ? 'Now' : 'Next'}</span>
      <span>{event.title}</span>
      {!live && <Until day={event.peak} />}
    </p>
  )
}

/** Keyboard (T, [, ]) and the event watcher; mounted once. */
export function SimulationKeys() {
  useEffect(() => {
    watchSky()
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return
      const st = useExperience.getState()
      if (st.story || st.journal) return
      if (st.phase !== 'galaxy' && st.phase !== 'observatory') return
      const sim = useSimulation.getState()
      if (e.key === 't' || e.key === 'T') sim.togglePlaying()
      else if (e.key === '[') sim.stepSpeed(-1)
      else if (e.key === ']') sim.stepSpeed(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return null
}

// ---- Observatory -----------------------------------------------------------

function EventRow({ e, live, active }: { e: CelestialEvent; live: boolean; active: boolean }) {
  const focus = useSky((s) => s.focus)
  return (
    <li className="sky-event" data-live={live || undefined} data-focus={focus?.id === e.id || undefined}>
      <span className="sky-event-kind">{EVENT_KINDS[e.kind]}</span>
      <span className="sky-event-title">{e.title}</span>
      <span className="sky-event-when">{live ? 'Now' : <Until day={e.peak} />}</span>
      <p className="sky-event-detail">{e.detail}</p>
      {!live && (
        <button type="button" className="quiet-button sky-event-show px-3" onClick={() => showEvent(e)} tabIndex={active ? 0 : -1}>
          Show on the dial
          <span className="sr-only">: {e.title}</span>
        </button>
      )}
    </li>
  )
}

function Astronomy({ id, active }: { id: PlanetId; active: boolean }) {
  const p = PLANET_BY_ID[id]
  const a = ASTRONOMY[id]
  const all = useSky((s) => s.all)
  const day = useSky((s) => s.day)
  const next = useMemo(() => nextFor(id, all, day), [id, all, day])
  const air = p.facts.find((f) => f.label === 'Air')?.value
  const moons =
    p.moonCount === 0
      ? 'None'
      : a.moons.map((m) => `${m.name.replace(/^The /, '')} (${formatDuration(m.periodDays)}${m.retrograde ? ', retrograde' : ''})`).join(', ') +
        (p.moonCount > a.moons.length ? `, and ${p.moonCount - a.moons.length} smaller` : '')
  return (
    <div className="sky-astronomy">
      <h3 className="sky-subtitle">
        {p.name} <span>· orbital record</span>
      </h3>
      <dl className="obs-facts sky-facts">
        <div>
          <dt>Distance from Elys</dt>
          <dd className="tabular-nums">{formatAU(a.au)}</dd>
        </div>
        <div>
          <dt>Orbital period</dt>
          <dd className="tabular-nums">
            {formatDuration(a.yearDays)} · {(a.yearDays / 365.25).toFixed(2)} standard years
          </dd>
        </div>
        <div>
          <dt>Rotation</dt>
          <dd className="tabular-nums">{formatDay(a.dayHours, a.retrograde)}</dd>
        </div>
        <div>
          <dt>Axial tilt</dt>
          <dd className="tabular-nums">{a.axialTiltDeg.toFixed(0)}°</dd>
        </div>
        <div>
          <dt>Moons</dt>
          <dd>{moons}</dd>
        </div>
        {air && (
          <div>
            <dt>Atmosphere</dt>
            <dd>{air}</dd>
          </div>
        )}
        <div>
          <dt>Next event</dt>
          <dd>
            {next ? (
              <button type="button" className="sky-inline" onClick={() => showEvent(next)} tabIndex={active ? 0 : -1}>
                {next.title}, <Until day={next.peak} />
              </button>
            ) : (
              'None within the solved window'
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}

/** The Observatory's "Sky" section: clock, events now and next, and the selected world's orbital record. */
export function ObservatorySky({ observed, active }: { observed: PlanetId; active: boolean }) {
  const now = useSky((s) => s.now)
  const next = useSky((s) => s.next)
  return (
    <section id="obs-sky" className="obs-section" aria-labelledby="obs-sky-title">
      <h2 id="obs-sky-title" className="obs-section-title">
        The sky
      </h2>
      <p className="obs-section-note">
        A simulation of the Aether system. The values are fictional but consistent: every distance and moon follows from each world's year, day and mass, and every
        event below is solved from the same positions the dial shows. Rotation is drawn slowed so it can be followed.
      </p>
      <SimControls variant="observatory" active={active} />
      <div className="sky-grid">
        <div>
          <h3 className="sky-subtitle">Now</h3>
          {now.length === 0 ? (
            <p className="sky-empty">Nothing aligned at this moment.</p>
          ) : (
            <ol className="sky-events">
              {now.map((e) => (
                <EventRow key={e.id} e={e} live active={active} />
              ))}
            </ol>
          )}
          <h3 className="sky-subtitle">Coming</h3>
          <ol className="sky-events">
            {next.map((e) => (
              <EventRow key={e.id} e={e} live={false} active={active} />
            ))}
          </ol>
        </div>
        <Astronomy id={observed} active={active} />
      </div>
    </section>
  )
}
