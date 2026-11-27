import type { Ref } from 'react'

const WORD = 'AETHER'

/** The title, split into letters so the arrival can resolve them one by one. */
export function Wordmark({ ref }: { ref?: Ref<HTMLHeadingElement> }) {
  return (
    <h1 ref={ref} className="wordmark" aria-label="Aether">
      {WORD.split('').map((letter, i) => (
        // The cell leans with the pointer; the letter inside is the arrival's to animate.
        <span key={i} className="wordmark-cell" data-magnet aria-hidden>
          <span className="wordmark-letter" data-reveal data-letter>
            {letter}
          </span>
        </span>
      ))}
    </h1>
  )
}
