import { Orbit } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { SYSTEM_BY_ID } from '../data/systems'
import { useExperience } from '../state/useExperience'

/**
 * Phase 11d: the record of a deep-space site, opened by selecting it in the
 * scene (`siteOpen`). The same panel as a world's, with what is known of the
 * site instead of a world's facts.
 */

const FACTS = [
  { label: 'Built', value: 'By the old survey' },
  { label: 'Lamps', value: 'Three of nine still turning' },
  { label: 'Light', value: 'No star; the galaxy’s core' },
  { label: 'Found', value: 'Expedition IV, from Liris' },
]

export function SiteUI() {
  const phase = useExperience((s) => s.phase)
  const active = useExperience((s) => s.activeSystem)
  const siteOpen = useExperience((s) => s.siteOpen)
  const setSiteOpen = useExperience((s) => s.setSiteOpen)
  const aside = useRef<HTMLElement>(null)
  const open = siteOpen && phase === 'galaxy' && active === 'waystation'

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

  const site = SYSTEM_BY_ID.waystation
  return (
    <aside ref={aside} className="world-panel ui-hideable" data-open={open || undefined} aria-hidden={!open} inert={!open} aria-live="polite">
      <div className="world-panel-body">
        <p className="text-[0.8125rem] text-haze">Deep space · between the arms</p>
        <h2 className="world-panel-name">{site.name.toUpperCase()}</h2>
        <p className="flex items-center gap-2.5 text-[1.02rem] font-light text-starlight/85">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: site.color, boxShadow: `0 0 10px ${site.color}` }} aria-hidden />
          {site.siteKind}
        </p>
        <p className="world-panel-copy">
          A station the old survey left in the dark between the arms, turned out of the plane of the galaxy. Its hull carries their mark, three rising lines
          over a circle, and three of its nine lamps still turn, slower every year.
        </p>
        <dl className="world-facts">
          {FACTS.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="world-panel-actions">
          <button type="button" className="quiet-button ml-auto px-4" onClick={() => setSiteOpen(false)} tabIndex={open ? 0 : -1} title="Close (Esc)">
            <Orbit size={15} strokeWidth={1.5} aria-hidden />
            Return to the station
          </button>
        </div>
      </div>
    </aside>
  )
}
