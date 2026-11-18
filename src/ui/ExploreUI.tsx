import { Orbit } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { sound } from '../audio/sound'
import { LOCATION_BY_ID, locationsFor } from '../data/locations'
import { PLANET_BY_ID } from '../data/planets'
import { telemetry } from '../state/director'
import { discoveredCount, useExploration } from '../state/exploration'
import { quality, useExperience } from '../state/useExperience'
import { startAscent, stepLocation, travelTo } from './exploreDirector'

/** Leader-line label on the surface signal. */
function SignalLabel({ found, finding }: { found: boolean; finding: string }) {
  const el = useRef<HTMLDivElement>(null)
  const hovered = useExperience((s) => s.signalHovered)
  // Touch has no hover: undiscovered signals keep a quiet label instead.
  const show = hovered || (quality.coarse && !found)

  useEffect(() => {
    let raf = 0
    let side: string | null = null
    const tick = () => {
      const node = el.current
      if (node) {
        const sg = telemetry.signal
        // Narrow screens: centre the label under the signal. Otherwise flip
        // to the left whenever it would run off the right edge.
        const narrow = window.innerWidth < 560
        const right = sg.x < window.innerWidth - 250
        const x = narrow ? sg.x : right ? sg.x + 14 : sg.x - 14
        const y = narrow ? sg.y + 22 : sg.y - 14
        node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
        node.style.opacity = sg.visible && show ? '1' : '0'
        const next = narrow ? 'below' : right ? 'right' : 'left'
        if (next !== side) {
          node.dataset.side = next
          side = next
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [show])

  return (
    <div ref={el} className="orbit-label world-label" data-side="right" aria-hidden style={{ opacity: 0 }}>
      <span className="orbit-label-leader" />
      <span className="orbit-label-text">
        <span className="font-display text-[1.2rem] leading-none tracking-[0.08em] text-starlight">
          {found ? finding : 'Unidentified signal'}
        </span>
        <span className="text-[0.8125rem] text-haze">
          {found ? 'Discovered' : quality.coarse ? 'Tap to investigate' : 'Select to investigate'}
        </span>
      </span>
    </div>
  )
}

/** One discovery at a time, bottom-left above the status line. */
function DiscoveryNotice() {
  const notice = useExperience((s) => s.notice)
  const setNotice = useExperience((s) => s.setNotice)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!notice) return
    setVisible(true)
    const hide = setTimeout(() => setVisible(false), 5600)
    const clear = setTimeout(() => setNotice(null), 6000)
    return () => {
      clearTimeout(hide)
      clearTimeout(clear)
    }
  }, [notice, setNotice])

  return (
    <div className="discovery-notice ui-hideable" data-visible={(visible && notice) || undefined} role="status" aria-live="polite">
      {notice && (
        <>
          <span className="flex items-center gap-2.5 text-[0.8125rem] text-haze">
            <span className="discovery-dot" aria-hidden />
            Discovered
          </span>
          <span className="text-[0.95rem] text-starlight">{notice.title}</span>
          <span className="text-[0.8125rem] text-haze tabular-nums">{notice.detail}</span>
        </>
      )}
    </div>
  )
}

export function ExploreUI() {
  const phase = useExperience((s) => s.phase)
  const exploring = useExperience((s) => s.exploring)
  const location = useExperience((s) => s.location)
  const discovered = useExploration((s) => s.discovered)
  const onSurface = phase === 'surface'

  // Surface keys: ← / → travel, Esc returns to orbit. M toggles sound anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'm' || e.key === 'M') {
        sound.unlock()
        useExploration.getState().toggleSound()
        return
      }
      if (useExperience.getState().phase !== 'surface') return
      if (e.key === 'Escape') startAscent()
      else if (e.key === 'ArrowRight') stepLocation(1)
      else if (e.key === 'ArrowLeft') stepLocation(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const loc = location ? LOCATION_BY_ID[location] : null
  const locs = exploring ? locationsFor(exploring) : []
  const found = loc ? !!discovered[loc.id] : false
  const world = exploring ? PLANET_BY_ID[exploring] : null
  const count = exploring ? discoveredCount(discovered, exploring) : 0

  return (
    <>
      <div className="atmo-veil" data-atmo-veil aria-hidden />

      {/* Location title: shown on landing and after each flight. */}
      <div className="title-card" data-title-card aria-hidden>
        {loc && (
          <>
            <p className="title-card-name">{loc.name}</p>
            <p className="title-card-region">{loc.region}</p>
          </>
        )}
      </div>

      <div className="explore-ui" data-visible={onSurface || undefined}>
        <button
          type="button"
          className="quiet-button ui-hideable pointer-events-auto absolute px-3"
          style={{
            top: 'calc(env(safe-area-inset-top) + var(--gutter) - 14px)',
            left: 'calc(env(safe-area-inset-left) + var(--gutter) + 26px)',
          }}
          onClick={() => startAscent()}
          tabIndex={onSurface ? 0 : -1}
          title="Return to orbit (Esc)"
        >
          <Orbit size={15} strokeWidth={1.5} aria-hidden />
          Return to orbit
        </button>

        {loc && world && (
          <aside className="location-panel ui-hideable" aria-live="polite">
            <p className="text-[0.8125rem] text-haze">{loc.region}</p>
            <h2 className="location-name">{loc.name}</h2>
            <p className="flex items-center gap-2.5 text-[0.9rem] text-starlight/85">
              <span
                className="signal-dot"
                data-found={found || undefined}
                style={{ ['--accent' as string]: world.accent }}
                aria-hidden
              />
              {found ? loc.finding : 'Unexplored signal'}
            </p>
            <p className="location-copy" key={`${loc.id}-${found}`}>
              {found ? loc.lore : loc.hint}
            </p>
            <p className="text-[0.8125rem] text-haze tabular-nums">
              {count} of 3 signals found on {world.name}
            </p>
          </aside>
        )}

        <nav className="location-strip ui-hideable" aria-label={world ? `Locations on ${world.name}` : 'Locations'}>
          <ol>
            {locs.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className="world-index-item"
                  data-active={l.id === location || undefined}
                  aria-current={l.id === location ? 'location' : undefined}
                  tabIndex={onSurface ? 0 : -1}
                  onClick={() => travelTo(l.id)}
                >
                  <span
                    className="signal-dot"
                    data-found={discovered[l.id] ? true : undefined}
                    style={{ ['--accent' as string]: world?.accent }}
                    aria-hidden
                  />
                  {l.name}
                  <span className="sr-only">{discovered[l.id] ? ', discovered' : ', not yet discovered'}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {loc && <SignalLabel found={found} finding={loc.finding} />}
        <DiscoveryNotice />
      </div>
    </>
  )
}
