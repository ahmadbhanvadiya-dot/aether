/**
 * The opening screens' small effects, outside React's render path: a text decode
 * (scrambled glyphs settling into place), and the shared state the prelude's
 * signal scope reads every frame.
 */

/** Loading progress for the prelude's scope (0 → 1), written by TitleScreen's load count. */
export const preludeFx = { p: 0 }

const GLYPHS = 'ABCDEFGHIKLMNOPRSTUVXYZ0123456789:/+=<>·'

/**
 * Decodes `text` into `el`: each character flickers through glyphs, then settles,
 * left to right. Writes text only (no layout of its own: pair it with a hidden
 * copy that holds the line's width). Returns a cancel function.
 */
export function decode(el: HTMLElement, text: string, { duration = 1100, delay = 0 } = {}) {
  let raf = 0
  const start = performance.now() + delay
  const n = text.length
  const tick = (now: number) => {
    const t = (now - start) / duration
    if (t >= 1) {
      el.textContent = text
      return
    }
    let out = ''
    for (let i = 0; i < n; i++) {
      const ch = text[i]
      const at = (i / n) * 0.65
      if (ch === ' ') out += ' '
      else if (t > at + 0.35) out += ch
      else if (t > at) out += GLYPHS[(Math.random() * GLYPHS.length) | 0]
      else out += ' '
    }
    el.textContent = out
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}
