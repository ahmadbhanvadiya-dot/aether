/**
 * The opening screens' small effects, outside React's render path: a text decode
 * (scrambled glyphs settling into place), and the shared state the prelude's
 * signal scope reads every frame.
 */

/**
 * The prelude's scope: loading progress (0 → 1, from TitleScreen's load count),
 * and the lock at the end (0 → 1, the arrival timeline): the wave flattens into a
 * line, the line draws in to a point.
 */
export const preludeFx = { p: 0, lock: 0 }

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export { smooth }

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
  // Frames can starve (a background tab): the text still lands, on time.
  const done = window.setTimeout(() => {
    cancelAnimationFrame(raf)
    el.textContent = text
  }, delay + duration + 60)
  return () => {
    cancelAnimationFrame(raf)
    clearTimeout(done)
  }
}

const LETTER_GLYPHS = 'ΛΞΣΠΦΨΩAEHRTVXKMN'

/**
 * One wordmark letter tuning in: it flickers through a few glyphs, then holds.
 * The letter's cell is held at its width meanwhile, so the word never shifts.
 */
export function flicker(letter: HTMLElement, { frames = 7, every = 55 } = {}) {
  const final = letter.dataset.char ?? letter.textContent ?? ''
  letter.dataset.char = final
  const cell = letter.parentElement
  if (cell) {
    cell.style.width = `${cell.getBoundingClientRect().width}px`
    cell.style.textAlign = 'center'
  }
  let i = 0
  const id = window.setInterval(() => {
    i++
    if (i >= frames) {
      window.clearInterval(id)
      letter.textContent = final
      if (cell) {
        cell.style.width = ''
        cell.style.textAlign = ''
      }
      return
    }
    letter.textContent = LETTER_GLYPHS[(Math.random() * LETTER_GLYPHS.length) | 0]
  }, every)
}
