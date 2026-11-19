import { Eye, EyeOff, Pause, Play, Telescope, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { telemetry } from '../state/director'
import { sound } from '../audio/sound'
import { openObservatory } from './observatoryDirector'
import { PLANET_BY_ID } from '../data/planets'
import { discoveredCount, hiddenCount, TOTAL_DISCOVERIES, useExploration } from '../state/exploration'
import { quality, useExperience, type Phase } from '../state/useExperience'

const STATUS: Record<Phase, string> = {
  boot: 'Approaching Vael',
  arriving: 'Approaching Vael',
  orbit: 'Now orbiting Vael',
  warping: "Leaving Vael's orbit",
  galaxy: 'The Aether system',
  returning: 'Returning to Vael',
  descending: 'Descending',
  surface: 'Exploring',
  ascending: 'Returning to orbit',
  observatory: 'The Observatory',
}

/** Live readout, written straight to the DOM from whichever camera rig is active. */
function Readout() {
  const el = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    let last = ''
    const tick = () => {
      const text = telemetry.readout
      if (text !== last && el.current) {
        el.current.textContent = text
        last = text
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <span ref={el} className="tabular-nums" />
}

/** An eclipse mark: a dark disc with a lit upper limb, like the scene itself. */
function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="9.25" stroke="rgb(138 147 184 / 0.45)" strokeWidth="1" />
      <path
        d="M3.2 7.6A9.25 9.25 0 0 1 18.4 5.6"
        stroke="#5AB0FF"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Hud() {
  const phase = useExperience((s) => s.phase)
  const motionPaused = useExperience((s) => s.motionPaused)
  const toggleMotion = useExperience((s) => s.toggleMotion)
  const cinema = useExperience((s) => s.cinema)
  const toggleCinema = useExperience((s) => s.toggleCinema)
  const focus = useExperience((s) => s.focus)
  const exploring = useExperience((s) => s.exploring)
  const location = useExperience((s) => s.location)
  const soundOn = useExploration((s) => s.soundOn)
  const toggleSound = useExploration((s) => s.toggleSound)
  const discovered = useExploration((s) => s.discovered)
  const signalFound = location ? !!discovered[location] : false
  const world = exploring ? PLANET_BY_ID[exploring].name : ''
  const status =
    phase === 'galaxy' && focus
      ? `In orbit around ${PLANET_BY_ID[focus].name}`
      : phase === 'descending'
        ? `Descending to ${world}`
        : phase === 'surface'
          ? `Exploring ${world}`
          : STATUS[phase]
  const inGalaxy = phase === 'galaxy'
  const onSurface = phase === 'surface'
  const inObservatory = phase === 'observatory'
  const showTotal = inGalaxy || onSurface || inObservatory
  const canObserve = inGalaxy || onSurface
  const hint = motionPaused
    ? 'Motion paused'
    : inObservatory
      ? quality.coarse
        ? 'Tap a world on the dial'
        : 'Select a world on the dial'
      : onSurface
      ? signalFound
        ? quality.coarse
          ? 'Drag to look around, tap a light to scan'
          : 'Drag to look around, select a light to scan'
        : quality.coarse
          ? 'Drag to look around, tap the signal to scan'
          : 'Drag to look around, select the signal to scan'
      : phase === 'descending' || phase === 'ascending'
        ? ''
        : inGalaxy
      ? focus
        ? quality.coarse
          ? 'Drag to orbit, pinch to zoom'
          : 'Drag to orbit, scroll to zoom'
        : quality.coarse
          ? 'Drag to rotate, tap a world'
          : 'Drag to rotate, select a world'
      : quality.coarse
        ? 'Drag to look around'
        : 'Move the cursor to drift'

  return (
    <>
      <div
        className="hud-corner ui-hideable flex items-center gap-3"
        style={{
          top: 'calc(env(safe-area-inset-top) + var(--gutter) - 6px)',
          left: 'calc(env(safe-area-inset-left) + var(--gutter))',
        }}
        data-reveal
        data-hud
      >
        <Mark />
      </div>

      <div
        className="hud-corner flex items-center gap-1"
        style={{
          top: 'calc(env(safe-area-inset-top) + var(--gutter) - 14px)',
          right: 'calc(env(safe-area-inset-right) + var(--gutter) - 10px)',
        }}
        data-reveal
        data-hud
      >
        {canObserve && (
          <button
            type="button"
            className="quiet-button ui-hideable px-3"
            onClick={() => openObservatory()}
            title="Open the Observatory (O)"
          >
            <Telescope size={15} strokeWidth={1.5} aria-hidden />
            <span className="hidden sm:inline">Observatory</span>
            <span className="sr-only sm:hidden">Observatory</span>
          </button>
        )}
        <button
          type="button"
          className="quiet-button ui-hideable px-3"
          onClick={toggleMotion}
          aria-pressed={motionPaused}
          aria-label={motionPaused ? 'Resume motion' : 'Pause motion'}
        >
          {motionPaused ? <Play size={15} strokeWidth={1.5} /> : <Pause size={15} strokeWidth={1.5} />}
          <span className="hidden sm:inline">{motionPaused ? 'Resume motion' : 'Pause motion'}</span>
        </button>
        <button
          type="button"
          className="quiet-button ui-hideable px-3"
          onClick={() => {
            sound.unlock()
            toggleSound()
          }}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}
          title={soundOn ? 'Sound off (M)' : 'Sound on (M)'}
        >
          {soundOn ? <Volume2 size={15} strokeWidth={1.5} /> : <VolumeX size={15} strokeWidth={1.5} />}
          <span className="hidden lg:inline">{soundOn ? 'Sound on' : 'Sound off'}</span>
        </button>
        <button
          type="button"
          className="quiet-button px-3"
          onClick={toggleCinema}
          aria-pressed={cinema}
          aria-label={cinema ? 'Show interface' : 'Hide interface'}
          title={cinema ? 'Show interface (H)' : 'Hide interface (H)'}
        >
          {cinema ? <Eye size={15} strokeWidth={1.5} /> : <EyeOff size={15} strokeWidth={1.5} />}
          <span className="hidden sm:inline">{cinema ? 'Show interface' : 'Hide interface'}</span>
        </button>
      </div>

      <div
        className="hud-corner ui-hideable hud-status flex flex-col"
        data-obs={inObservatory || undefined}
        data-panel={(inGalaxy && focus !== null) || undefined}
        style={{
          bottom: 'calc(env(safe-area-inset-bottom) + var(--gutter))',
          left: 'calc(env(safe-area-inset-left) + var(--gutter))',
        }}
        data-reveal
        data-hud
      >
        <span className="text-starlight/90" aria-live="polite">
          {status}
        </span>
        <Readout />
        {showTotal && (
          <span className="tabular-nums">
            {discoveredCount(discovered)} of {TOTAL_DISCOVERIES} discoveries
            {hiddenCount(discovered) > 0 && <>, {hiddenCount(discovered)} hidden</>}
          </span>
        )}
      </div>

      <div
        className="hud-corner ui-hideable hud-hint text-right"
        data-obs={inObservatory || undefined}
        data-panel={(inGalaxy && focus !== null) || undefined}
        style={{
          bottom: 'calc(env(safe-area-inset-bottom) + var(--gutter))',
          right: 'calc(env(safe-area-inset-right) + var(--gutter))',
        }}
        data-reveal
        data-hud
      >
        {hint}
      </div>
    </>
  )
}
