import { BookOpen, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FRAGMENT_BY_ID, FRAGMENT_KINDS } from '../data/expeditions'
import { useExploration } from '../state/exploration'
import { expeditionStates, unlockedFragments } from '../state/expeditions'
import { formatWhen } from '../state/progress'
import { useExperience } from '../state/useExperience'
import { dismissStory, presentNext, storyCanPlay } from './storyDirector'

/**
 * Phase 8: the story event. A lower‑third transmission or archive record on a
 * scrim — kind, source and time; a carrier waveform for transmissions; the
 * title; lines revealed one after another. Close (Esc) or open the journal.
 */

/** Plays queued fragments when nothing else is happening (checked twice a second). */
function StoryHost() {
  const queued = useExperience((s) => s.storyQueue.length)
  useEffect(() => {
    if (!queued) return
    let ready = 0
    const id = setInterval(() => {
      // Wait for a calm moment: a second in a row with nothing else going on.
      ready = storyCanPlay() ? ready + 1 : 0
      if (ready >= 2) presentNext()
    }, 500)
    return () => clearInterval(id)
  }, [queued])
  return null
}

function Waveform() {
  return (
    <svg className="story-wave" viewBox="0 0 240 24" aria-hidden preserveAspectRatio="none">
      <path d="M0 12 Q 10 2 20 12 T 40 12 T 60 12 T 80 12 T 100 12 T 120 12 T 140 12 T 160 12 T 180 12 T 200 12 T 220 12 T 240 12" />
      <path d="M0 12 Q 15 18 30 12 T 60 12 T 90 12 T 120 12 T 150 12 T 180 12 T 210 12 T 240 12" />
    </svg>
  )
}

export function StoryUI() {
  const id = useExperience((s) => s.story)
  const setJournal = useExperience((s) => s.setJournal)
  const discovered = useExploration((s) => s.discovered)
  const close = useRef<HTMLButtonElement>(null)
  // Keep the last fragment rendered while it fades out.
  const [last, setLast] = useState<string | null>(null)
  if (id && id !== last) setLast(id)
  const shown = id ?? last
  const entry = shown ? FRAGMENT_BY_ID[shown] : null

  const meta = useMemo(() => {
    if (!entry) return null
    const states = expeditionStates(discovered)
    const s = states.find((x) => x.expedition.id === entry.expedition.id)!
    const at = unlockedFragments(states).find((f) => f.fragment.id === entry.fragment.id)?.at
    return { done: s.done, total: s.total, at: at ? formatWhen(at) : null }
  }, [entry, discovered])

  // The galaxy and Observatory panels step aside while a story plays (see index.css).
  useEffect(() => {
    document.documentElement.toggleAttribute('data-story', !!id)
  }, [id])

  // Keyboard: focus Close on open; Esc closes.
  useEffect(() => {
    if (!id) return
    const t = setTimeout(() => close.current?.focus({ preventScroll: true }), 300)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        dismissStory()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [id])

  return (
    <>
      <StoryHost />
      <section
        className="story ui-hideable"
        data-open={id ? true : undefined}
        data-kind={entry?.fragment.kind}
        role="dialog"
        aria-modal="false"
        aria-labelledby="story-title"
        aria-hidden={!id}
        inert={!id}
      >
        {entry && (
          <div className="story-panel" key={entry.fragment.id}>
            <p className="story-kind">
              <span>{FRAGMENT_KINDS[entry.fragment.kind]}</span>
              <span className="story-source">{entry.fragment.source}</span>
              {meta?.at && (
                <time className="story-time tabular-nums" dateTime={meta.at.iso}>
                  {meta.at.date}, {meta.at.time}
                </time>
              )}
            </p>
            {entry.fragment.kind === 'transmission' && <Waveform />}
            <h2 id="story-title" className="story-title">
              {entry.fragment.title}
            </h2>
            <div className="story-body">
              {entry.fragment.body.map((line, i) => (
                <p key={i} style={{ ['--i' as string]: i }}>
                  {line}
                </p>
              ))}
            </div>
            <div className="story-foot">
              <p className="story-expedition tabular-nums">
                {entry.expedition.code} · {entry.expedition.title}
                {meta && ` · ${meta.done} of ${meta.total}`}
              </p>
              <span className="story-actions">
                <button
                  type="button"
                  className="quiet-button px-3"
                  onClick={() => {
                    dismissStory()
                    setJournal(true)
                  }}
                >
                  <BookOpen size={14} strokeWidth={1.5} aria-hidden />
                  Open journal
                </button>
                <button ref={close} type="button" className="quiet-button px-3" onClick={dismissStory}>
                  <X size={14} strokeWidth={1.5} aria-hidden />
                  Close
                </button>
              </span>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
