import { Orbit } from 'lucide-react'
import { useEffect, useState } from 'react'
import { sound } from '../audio/sound'
import { CATEGORIES } from '../data/discoveries'
import { LOCATION_BY_ID, locationsFor } from '../data/locations'
import { PLANET_BY_ID } from '../data/planets'
import { surfaceCam } from '../scene/surface/SurfaceRig'
import { useExploration } from '../state/exploration'
import { locationProgress, worldProgress } from '../state/progress'
import { useExperience } from '../state/useExperience'
import { startAscent, stepLocation, travelTo } from './exploreDirector'
import { cancelScan, closeCard, startScan } from './scanner'
import { CATEGORY_ICON, ScannerUI, unknownName, useScannable } from './ScannerUI'

/** One notice at a time, bottom-left above the status line (hidden discoveries noticed). */
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
            Detected
          </span>
          <span className="text-[0.95rem] text-starlight">{notice.title}</span>
          <span className="text-[0.8125rem] text-haze">{notice.detail}</span>
        </>
      )}
    </div>
  )
}

/** What can be scanned here: the keyboard and touch route to every target, on screen or not. */
function ScanList({ location, onSurface }: { location: string; onSurface: boolean }) {
  const discovered = useExploration((s) => s.discovered)
  const scanning = useExperience((s) => s.scanning)
  const targets = useScannable(location)
  const accent = PLANET_BY_ID[LOCATION_BY_ID[location].planet].accent
  return (
    <ul className="scan-list" aria-label="Here">
      {targets.map((d) => {
        const found = !!discovered[d.id]
        const Icon = CATEGORY_ICON[d.category]
        return (
          <li key={d.id}>
            <button
              type="button"
              className="scan-list-item"
              data-found={found || undefined}
              data-active={scanning === d.id || undefined}
              onClick={() => startScan(d.id)}
              tabIndex={onSurface ? 0 : -1}
              style={{ ['--accent' as string]: accent }}
            >
              <span className="signal-dot" data-found={found || undefined} aria-hidden />
              <span className="scan-list-name">{found ? d.name : unknownName(d)}</span>
              {found ? (
                <span className="scan-list-kind" title={CATEGORIES[d.category].label}>
                  <Icon size={13} strokeWidth={1.5} aria-hidden />
                  <span className="sr-only">{CATEGORIES[d.category].label}</span>
                </span>
              ) : (
                <span className="scan-list-kind">{scanning === d.id ? 'Scanning' : 'Scan'}</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function ExploreUI() {
  const phase = useExperience((s) => s.phase)
  const exploring = useExperience((s) => s.exploring)
  const location = useExperience((s) => s.location)
  const discovered = useExploration((s) => s.discovered)
  const visited = useExploration((s) => s.visited)
  const onSurface = phase === 'surface'
  const card = useExperience((s) => s.card)

  // Surface keys: Esc cancels a scan, closes a card, else returns to orbit;
  // ← / → travel; Shift + arrows look around. M toggles sound anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'm' || e.key === 'M') {
        sound.unlock()
        useExploration.getState().toggleSound()
        return
      }
      const st = useExperience.getState()
      if (st.phase !== 'surface') return
      if (e.key === 'Escape') {
        if (st.scanning) cancelScan()
        else if (st.card) closeCard()
        else startAscent()
        return
      }
      if (e.shiftKey && e.key.startsWith('Arrow')) {
        if (surfaceCam.mode !== 'free' || st.scanning) return
        e.preventDefault()
        if (e.key === 'ArrowLeft') surfaceCam.lookYaw -= 0.15
        if (e.key === 'ArrowRight') surfaceCam.lookYaw += 0.15
        if (e.key === 'ArrowUp') surfaceCam.lookPitch = Math.min(0.5, surfaceCam.lookPitch + 0.08)
        if (e.key === 'ArrowDown') surfaceCam.lookPitch = Math.max(-0.55, surfaceCam.lookPitch - 0.08)
        return
      }
      if (st.scanning) return
      if (e.key === 'ArrowRight') stepLocation(1)
      else if (e.key === 'ArrowLeft') stepLocation(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const loc = location ? LOCATION_BY_ID[location] : null
  const locs = exploring ? locationsFor(exploring) : []
  const world = exploring ? PLANET_BY_ID[exploring] : null
  const signalFound = loc ? !!discovered[loc.id] : false
  const progress = world ? worldProgress(world, discovered, visited) : null

  return (
    <>
      {/* Location title: shown on landing and after each flight. */}
      <div className="title-card" data-title-card aria-hidden>
        {loc && (
          <>
            <p className="title-card-name">{loc.name}</p>
            <p className="title-card-region">{loc.region}</p>
          </>
        )}
      </div>

      <div className="explore-ui" data-visible={onSurface || undefined} data-card={card ? true : undefined}>
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
          aria-label="Return to orbit"
        >
          <Orbit size={15} strokeWidth={1.5} aria-hidden />
          <span className="max-[479px]:hidden">Return to orbit</span>
        </button>

        {loc && world && progress && (
          <aside className="location-panel ui-hideable" aria-live="polite">
            <p className="text-[0.8125rem] text-haze">{loc.region}</p>
            <h2 className="location-name">{loc.name}</h2>
            <p className="location-copy" key={`${loc.id}-${signalFound}`}>
              {signalFound ? loc.lore : loc.hint}
            </p>
            <ScanList location={loc.id} onSurface={onSurface} />
            <p className="text-[0.8125rem] text-haze tabular-nums">
              {progress.found} of {progress.total} discoveries on {world.name}
              {progress.hiddenFound > 0 && `, ${progress.hiddenFound} hidden`}
            </p>
          </aside>
        )}

        <nav className="location-strip ui-hideable" aria-label={world ? `Locations on ${world.name}` : 'Locations'}>
          <ol>
            {locs.map((l) => {
              const p = locationProgress(l, discovered)
              const state = p.found === 0 ? undefined : p.found >= p.total ? 'complete' : 'partial'
              return (
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
                      data-found={state === 'complete' || undefined}
                      data-partial={state === 'partial' || undefined}
                      style={{ ['--accent' as string]: world?.accent }}
                      aria-hidden
                    />
                    {l.name}
                    <span className="sr-only">
                      , {p.found} of {p.total} discoveries found
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <ScannerUI />
        <DiscoveryNotice />
      </div>
    </>
  )
}
