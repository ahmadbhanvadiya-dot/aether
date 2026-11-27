import { useEffect, useRef } from 'react'
import { useExperience } from '../state/useExperience'
import { decode, preludeFx } from './titleFx'

/**
 * The prelude: what is on screen while the scene compiles. A signal scope tunes
 * in from static to the Listening Array's motif (three short pulses and one long)
 * as the load count rises; the pointer tunes it (the wave swells where it is).
 * The line decodes, a hairline fills, a status steps through the stages, and a
 * faint starfield drifts behind. Reduced motion: no static, no drift, no decode —
 * the same picture, settling with the count.
 *
 * The timeline in TitleScreen still owns the exit (`data-prelude`, `data-prelude-line`).
 */

const LINE = 'Receiving signal from Vael'

/** A soft bump centred at c with width w. */
const bump = (u: number, c: number, w: number) => Math.exp(-((u - c) ** 2) / (2 * w * w))

export function Prelude() {
  const root = useRef<HTMLDivElement>(null)
  const scope = useRef<HTMLCanvasElement>(null)
  const stars = useRef<HTMLCanvasElement>(null)
  const live = useRef<HTMLSpanElement>(null)
  const reduced = useExperience((s) => s.reducedMotion)

  // The headline decodes in.
  useEffect(() => {
    const el = live.current
    if (!el) return
    if (reduced) {
      el.textContent = LINE
      return
    }
    return decode(el, LINE, { duration: 1300, delay: 250 })
  }, [reduced])

  // A faint starfield, drawn once (it drifts by CSS).
  useEffect(() => {
    const c = stars.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = (c.width = Math.round(window.innerWidth * 1.1 * dpr))
    const h = (c.height = Math.round(window.innerHeight * 1.1 * dpr))
    const ctx = c.getContext('2d')
    if (!ctx) return
    let seed = 0x51ed27
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < 260; i++) {
      const r = rand() ** 3 * 1.3 + 0.3
      ctx.fillStyle = `rgba(${200 + rand() * 40}, ${210 + rand() * 30}, 255, ${0.15 + rand() * 0.55})`
      ctx.beginPath()
      ctx.arc(rand() * w, rand() * h, r * dpr, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [])

  // The scope: static → the motif, as the count rises.
  useEffect(() => {
    const c = scope.current
    const box = root.current
    if (!c || !box) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0
    let H = 0
    const resize = () => {
      const r = c.getBoundingClientRect()
      W = c.width = Math.round(r.width * dpr)
      H = c.height = Math.round(r.height * dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    // The pointer tunes it: where it is over the scope, and how close (eased).
    const tune = { x: 0.5, near: 0, target: 0, tx: 0.5 }
    const onMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      tune.tx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
      const dy = Math.abs(e.clientY - (r.top + r.height / 2))
      tune.target = e.clientX > r.left - 40 && e.clientX < r.right + 40 ? Math.max(0, 1 - dy / 220) : 0
    }
    const onLeave = () => (tune.target = 0)
    window.addEventListener('pointermove', onMove)
    document.addEventListener('pointerleave', onLeave)

    let raf = 0
    let last = performance.now()
    const draw = (now: number) => {
      // The prelude has gone (GSAP sets visibility: hidden on exit): stop drawing.
      if (box.style.visibility === 'hidden') return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = reduced ? 0 : now / 1000
      tune.near += (tune.target - tune.near) * Math.min(1, dt * 6)
      tune.x += (tune.tx - tune.x) * Math.min(1, dt * 8)
      const p = preludeFx.p
      // Clarity rises with the count; static falls away.
      const clarity = Math.min(1, Math.max(0, (p - 0.08) / 0.82))
      const noise = reduced ? 0 : (1 - clarity) ** 1.5

      ctx.clearRect(0, 0, W, H)
      const mid = H / 2
      // A faint baseline.
      ctx.globalAlpha = 0.18
      ctx.strokeStyle = '#8A93B8'
      ctx.lineWidth = dpr
      ctx.beginPath()
      ctx.moveTo(0, mid)
      ctx.lineTo(W, mid)
      ctx.stroke()
      ctx.globalAlpha = 1

      const grad = ctx.createLinearGradient(0, 0, W, 0)
      grad.addColorStop(0, 'rgba(90,176,255,0)')
      grad.addColorStop(0.15, 'rgba(90,176,255,0.9)')
      grad.addColorStop(0.55, 'rgba(170,190,255,1)')
      grad.addColorStop(0.85, 'rgba(140,108,255,0.9)')
      grad.addColorStop(1, 'rgba(140,108,255,0)')
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.4 * dpr
      ctx.shadowColor = 'rgba(90,176,255,0.7)'
      ctx.shadowBlur = 10 * dpr * (0.5 + 0.5 * clarity + 0.4 * tune.near)
      ctx.beginPath()
      const step = 2 * dpr
      const shift = (t * 0.07) % 1
      for (let x = 0; x <= W; x += step) {
        const u = x / W
        // The motif scrolls through: three short pulses, then one long.
        const v = (((u + shift) % 1) + 1) % 1
        const motif = bump(v, 0.18, 0.025) + bump(v, 0.3, 0.025) + bump(v, 0.42, 0.025) + 0.9 * bump(v, 0.66, 0.08)
        const carrier = Math.sin(u * Math.PI * 2 * 14 - t * 5)
        const lens = 1 + 0.9 * tune.near * bump(u, tune.x, 0.07)
        const signal = carrier * motif * clarity * lens * 0.85
        const hiss = noise * (Math.random() * 2 - 1) * (0.55 + 0.45 * Math.sin(u * 40 + t * 9))
        const y = mid + H * 0.4 * (signal + hiss * 0.8)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [reduced])

  return (
    <div ref={root} className="prelude" data-prelude>
      <canvas ref={stars} className="prelude-stars" aria-hidden />
      <div className="prelude-body" data-prelude-line>
        <canvas ref={scope} className="prelude-scope" aria-hidden />
        <p className="prelude-line">
          <span className="decode" aria-label={LINE}>
            <span className="decode-sizer" aria-hidden>
              {LINE}
            </span>
            <span ref={live} className="decode-live" aria-hidden />
          </span>
          <span className="prelude-count tabular-nums" data-prelude-count>
            0%
          </span>
        </p>
        <div className="prelude-bar" aria-hidden>
          <span />
        </div>
        <p className="prelude-stage" data-prelude-stage aria-live="polite">
          Searching the band
        </p>
      </div>
    </div>
  )
}
