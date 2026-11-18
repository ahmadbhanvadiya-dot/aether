import type { Ref } from 'react'

const WORD = 'AETHER'

/** The title, split into letters so the arrival can resolve them one by one. */
export function Wordmark({ ref }: { ref?: Ref<HTMLHeadingElement> }) {
  return (
    <h1 ref={ref} className="wordmark" aria-label="Aether">
      {WORD.split('').map((letter, i) => (
        <span key={i} className="wordmark-letter" data-reveal data-letter aria-hidden>
          {letter}
        </span>
      ))}
    </h1>
  )
}
