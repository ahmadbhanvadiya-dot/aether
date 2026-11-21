import { ArrowLeft, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SYSTEM_BY_ID, SYSTEMS, type SystemId } from '../data/systems'
import { telemetry } from '../state/director'
import { useExploration } from '../state/exploration'
import { expeditionStates } from '../state/expeditions'
import { systemProgress } from '../state/progress'
import { useExperience } from '../state/useExperience'
import { closeMap } from './mapDirector'

/**
 * Phase 11 (first step): the universe map, read‑only. The galaxy AETHER has always
 * drawn, seen from above its disc, with the star systems marked in its arms.
 * Elys is home. Tessaly is hinted at once Expedition II is complete, unnamed and
 * unreachable: the expedition that leads there is still to be written.
 */

function useKnown() {
  const discovered = useExploration((s) => s.discovered)
  return useMemo(() => {
    const second = expeditionStates(discovered).find((e) => e.expedition.id === 'exp-second-sky')
    return { tessaly: !!second && second.completedAt !== null }
  }, [discovered])
}

export function MapUI() {
  const phase = useExperience((s) => s.phase)
  const open = phase === 'map'
  const known = useKnown()
  const [selected, setSelected] = useState<SystemId>('elys')
  const marks = useRef<HTMLDivElement>(null)
  const discovered = useExploration((s) => s.discovered)
  const visited = useExploration((s) => s.visited)
  const progress = useMemo(() => systemProgress(discovered, visited), [discovered, visited])
  const shown = SYSTEMS.filter((s) => s.id === 'elys' || (s.id === 'tessaly' && known.tessaly))

  // Markers follow the projected systems (written by GalaxyRig in map mode).
  useEffect(() => {
    if (!open) return
    let raf = 0
    const tick = () => {
      marks.current?.querySelectorAll<HTMLElement>('[data-system]').forEach((el) => {
        const m = telemetry.map[el.dataset.system!]
        el.style.transform = `translate3d(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px, 0)`
        el.style.visibility = m.on ? 'visible' : 'hidden'
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const st = useExperience.getState()
      if (st.story || st.journal) return
      if (e.key === 'Escape') closeMap()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const sys = SYSTEM_BY_ID[selected]
  const sealed = sys.unlock === 'story'
  const tab = open ? 0 : -1

  return (
    <div className="map-ui" data-open={open || undefined} inert={!open} aria-hidden={!open}>
      <div ref={marks} className="map-marks">
        {shown.map((s) => (
          <button
            key={s.id}
            type="button"
            data-system={s.id}
            className="map-mark"
            data-selected={s.id === selected || undefined}
            data-sealed={s.unlock === 'story' || undefined}
            style={{ ['--star' as string]: s.color }}
            onClick={() => setSelected(s.id)}
            aria-pressed={s.id === selected}
            tabIndex={tab}
          >
            <span className="map-mark-dot" aria-hidden />
            <span className="map-mark-name">{s.unlock === 'story' ? s.unknownName : s.name}</span>
          </button>
        ))}
      </div>

      <aside className="map-panel" aria-live="polite">
        <p className="map-kicker">The galaxy</p>
        <h2 className="map-title">{sealed ? sys.unknownName : sys.name}</h2>
        <p className="map-copy">{sys.description}</p>
        <dl className="obs-facts map-facts">
          <div>
            <dt>Star</dt>
            <dd>{sealed ? 'Unresolved' : sys.star}</dd>
          </div>
          {sealed ? (
            <div>
              <dt>Status</dt>
              <dd>Not yet reachable</dd>
            </div>
          ) : (
            <>
              <div>
                <dt>Worlds</dt>
                <dd className="tabular-nums">{sys.worlds}</dd>
              </div>
              <div>
                <dt>Explored</dt>
                <dd className="tabular-nums">{progress.percent}%</dd>
              </div>
            </>
          )}
        </dl>
        {!known.tessaly && <p className="map-note">Beyond Elys, the galaxy is uncharted. Complete the expeditions to learn where they lead.</p>}
        <div className="map-actions">
          <button type="button" className="explore-button" onClick={closeMap} tabIndex={tab}>
            <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
            Back to Elys
          </button>
        </div>
      </aside>

      <button type="button" className="map-close quiet-button px-3" onClick={closeMap} title="Close the map (Esc)" tabIndex={tab}>
        <X size={15} strokeWidth={1.5} aria-hidden />
        Close
      </button>
    </div>
  )
}
