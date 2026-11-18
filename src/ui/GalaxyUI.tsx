import { ChevronLeft, ChevronRight, Orbit, Undo2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { ORDINALS, PLANET_BY_ID, PLANETS, type PlanetId } from '../data/planets'
import { telemetry } from '../state/director'
import { useExperience } from '../state/useExperience'

/** Name + teaser on a leader line, following the hovered world. */
function HoverLabel() {
  const el = useRef<HTMLDivElement>(null)
  const hovered = useExperience((s) => s.hovered)
  const focus = useExperience((s) => s.focus)
  const shown = hovered && hovered !== focus ? PLANET_BY_ID[hovered] : null

  useEffect(() => {
    let raf = 0
    let side: string | null = null
    const tick = () => {
      const node = el.current
      if (node) {
        const h = telemetry.hover
        // Anchor on the disc's upper-right edge so the label never covers the world.
        const r = Math.max(h.radiusPx, 6) * 0.72
        const right = h.x < window.innerWidth * 0.64
        const x = right ? h.x + r : h.x - r
        node.style.transform = `translate3d(${x.toFixed(1)}px, ${(h.y - r).toFixed(1)}px, 0)`
        node.style.opacity = h.visible ? '1' : '0'
        const nextSide = right ? 'right' : 'left'
        if (nextSide !== side) {
          node.dataset.side = nextSide
          side = nextSide
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={el} className="orbit-label world-label" data-side="right" aria-hidden style={{ opacity: 0 }}>
      <span className="orbit-label-leader" />
      {shown && (
        <span className="orbit-label-text" key={shown.id}>
          <span className="font-display text-[1.35rem] leading-none tracking-[0.14em] text-starlight">
            {shown.name}
          </span>
          <span className="w-[24ch] whitespace-normal text-[0.8125rem] leading-snug text-haze">
            {shown.teaser}
          </span>
        </span>
      )}
    </div>
  )
}

/** The six worlds in orbital order — a quiet way in for keyboard and touch. */
function WorldIndex({ visible }: { visible: boolean }) {
  const hovered = useExperience((s) => s.hovered)
  const setHovered = useExperience((s) => s.setHovered)
  const setFocus = useExperience((s) => s.setFocus)

  return (
    <nav className="world-index ui-hideable" data-visible={visible || undefined} aria-label="Worlds of the Aether system">
      <ol>
        {PLANETS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="world-index-item"
              data-active={hovered === p.id || undefined}
              tabIndex={visible ? 0 : -1}
              onPointerEnter={() => setHovered(p.id)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(p.id)}
              onBlur={() => setHovered(null)}
              onClick={() => setFocus(p.id)}
            >
              <span className="world-index-dot" style={{ background: p.accent }} aria-hidden />
              {p.name}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Facts and story for the focused world. */
function InfoPanel({ focus }: { focus: PlanetId | null }) {
  const stepFocus = useExperience((s) => s.stepFocus)
  const setFocus = useExperience((s) => s.setFocus)
  const last = useRef<PlanetId | null>(null)
  if (focus) last.current = focus
  const id = focus ?? last.current
  const data = id ? PLANET_BY_ID[id] : null
  const index = id ? PLANETS.findIndex((p) => p.id === id) : 0
  const open = focus !== null

  return (
    <aside className="world-panel ui-hideable" data-open={open || undefined} aria-hidden={!open} aria-live="polite">
      {data && (
        <div className="world-panel-body" key={data.id}>
          <p className="text-[0.8125rem] text-haze">{ORDINALS[index]} world from Elys</p>
          <h2 className="world-panel-name">{data.name}</h2>
          <p className="flex items-center gap-2.5 text-[1.02rem] font-light text-starlight/85">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: data.accent, boxShadow: `0 0 10px ${data.accent}` }} aria-hidden />
            {data.classification}
          </p>
          <p className="world-panel-copy">{data.description}</p>
          <dl className="world-facts">
            {data.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          <div className="world-panel-actions">
            <button
              type="button"
              className="quiet-button px-3"
              onClick={() => stepFocus(-1)}
              tabIndex={open ? 0 : -1}
              aria-label="Previous world"
              title="Previous world (←)"
            >
              <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
            </button>
            <button
              type="button"
              className="quiet-button px-3"
              onClick={() => stepFocus(1)}
              tabIndex={open ? 0 : -1}
              aria-label="Next world"
              title="Next world (→)"
            >
              <ChevronRight size={16} strokeWidth={1.5} aria-hidden />
            </button>
            <button
              type="button"
              className="quiet-button ml-auto px-4"
              onClick={() => setFocus(null)}
              tabIndex={open ? 0 : -1}
              title="Return to galaxy (Esc)"
            >
              <Orbit size={15} strokeWidth={1.5} aria-hidden />
              Return to galaxy
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}

/** Keyboard: Esc returns to the galaxy, arrows step between worlds. Instant, no waiting. */
function useGalaxyKeys(active: boolean) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const { focus, setFocus, stepFocus } = useExperience.getState()
      if (!focus) return
      if (e.key === 'Escape') setFocus(null)
      else if (e.key === 'ArrowRight') stepFocus(1)
      else if (e.key === 'ArrowLeft') stepFocus(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}

export function GalaxyUI({ onReturnToVael }: { onReturnToVael: () => void }) {
  const phase = useExperience((s) => s.phase)
  const focus = useExperience((s) => s.focus)
  const inGalaxy = phase === 'galaxy'
  useGalaxyKeys(inGalaxy)

  return (
    <div className="galaxy-ui" data-visible={inGalaxy || undefined}>
      <HoverLabel />

      <button
        type="button"
        className="quiet-button ui-hideable pointer-events-auto absolute px-3"
        style={{
          top: 'calc(env(safe-area-inset-top) + var(--gutter) - 14px)',
          left: 'calc(env(safe-area-inset-left) + var(--gutter) + 26px)',
        }}
        onClick={onReturnToVael}
        tabIndex={inGalaxy && !focus ? 0 : -1}
        data-hidden={!inGalaxy || focus !== null || undefined}
      >
        <Undo2 size={15} strokeWidth={1.5} aria-hidden />
        Return to Vael
      </button>

      <WorldIndex visible={inGalaxy && !focus} />
      <InfoPanel focus={inGalaxy ? focus : null} />
    </div>
  )
}
