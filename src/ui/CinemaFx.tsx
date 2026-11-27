import { useEffect, useRef } from 'react'
import { WORLD_BY_ID } from '../data/planets'
import { surfaceCam } from '../scene/surface/SurfaceRig'
import { travelFx } from '../scene/motion'
import { director, telemetry } from '../state/director'
import { useExperience } from '../state/useExperience'

/**
 * Bold exploration pass: screen-space cinema over the scene, all driven from the
 * frame state (no React updates):
 *
 * - **Entry burn**: plasma glow around the frame's edge in the world's atmosphere
 *   colour as the camera hits the air (descent), fading through the landing; a
 *   gentler one on the climb back out.
 * - **Speed streaks**: lines rushing outward from the centre with the descent and
 *   with flights between places.
 * - **Lens flare**: when a sun is in view on a surface (above the horizon, not
 *   behind terrain, not lost in cloud), a glow at the sun and ghosts across the frame.
 *
 * Reduced motion: no burn, no streaks; the flare stays (light, not motion), still.
 */

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function CinemaFx() {
  const burn = useRef<HTMLDivElement>(null)
  const streaks = useRef<HTMLCanvasElement>(null)
  const flare = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const c = streaks.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const resize = () => {
      c.width = Math.round(window.innerWidth * dpr)
      c.height = Math.round(window.innerHeight * dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    // Streak field: each line has an angle, a radius it travels out along, and a speed.
    const N = 90
    let seed = 0x7f4a7c15
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
    const lines = Array.from({ length: N }, () => ({ a: rand() * Math.PI * 2, r: rand(), v: 0.6 + rand() * 0.9 }))

    let raf = 0
    let last = performance.now()
    let drawn = false
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const st = useExperience.getState()
      const reduced = st.reducedMotion
      const world = st.exploring ? WORLD_BY_ID[st.exploring] : null

      // ---- Entry burn: as the dive meets the air, until the landing is under way.
      let b = 0
      if (!reduced && world) {
        if (st.phase === 'descending') {
          b = director.space === 'galaxy' ? smooth(0.55, 0.95, director.descent) : 1 - smooth(0.05, 0.45, director.landing)
        } else if (st.phase === 'ascending') {
          b = 0.55 * (director.space === 'galaxy' ? smooth(0.6, 0.95, director.descent) : smooth(0.4, 0.9, 1 - director.landing))
        }
      }
      const bn = burn.current
      if (bn) {
        if (world) bn.style.setProperty('--burn', world.atmosphere.day)
        bn.style.opacity = b > 0.002 ? String(b * (0.86 + 0.14 * Math.sin(now * 0.031))) : '0'
      }

      // ---- Streaks: the descent's burn, or a flight's speed on a surface.
      const flying = director.space === 'surface' && surfaceCam.mode === 'travel'
      const s = reduced ? 0 : Math.max(b * 0.9, flying ? travelFx.speed * 0.8 : 0)
      const W = c.width
      const H = c.height
      if (s > 0.01) {
        ctx.clearRect(0, 0, W, H)
        const cx = W / 2
        const cy = H / 2
        const R = Math.hypot(cx, cy)
        ctx.lineCap = 'round'
        for (const l of lines) {
          l.r += l.v * dt * (0.5 + 1.6 * s)
          if (l.r > 1) {
            l.r -= 1
            l.a = rand() * Math.PI * 2
          }
          // Only the outer part of the frame: the centre stays clear.
          const r0 = (0.25 + 0.75 * l.r) * R
          const len = (0.04 + 0.16 * s) * R * l.r
          const ca = Math.cos(l.a)
          const sa = Math.sin(l.a)
          const alpha = s * 0.5 * Math.sin(l.r * Math.PI)
          ctx.strokeStyle = `rgba(225, 235, 255, ${alpha.toFixed(3)})`
          ctx.lineWidth = (0.6 + 1.2 * l.r) * dpr
          ctx.beginPath()
          ctx.moveTo(cx + ca * r0, cy + sa * r0)
          ctx.lineTo(cx + ca * (r0 + len), cy + sa * (r0 + len))
          ctx.stroke()
        }
        drawn = true
      } else if (drawn) {
        ctx.clearRect(0, 0, W, H)
        drawn = false
      }

      // ---- Lens flare: from the sun's projection (written by the surface scene).
      const fl = flare.current
      if (fl) {
        const f = telemetry.flare
        const on = director.space === 'surface' && st.phase === 'surface' && f.k > 0.01
        fl.style.opacity = on ? String(f.k) : '0'
        if (on) {
          const w = window.innerWidth
          const h = window.innerHeight
          fl.style.setProperty('--sx', `${f.x}px`)
          fl.style.setProperty('--sy', `${f.y}px`)
          // Ghosts lie on the line from the sun through the centre of the frame.
          fl.style.setProperty('--dx', `${w / 2 - f.x}px`)
          fl.style.setProperty('--dy', `${h / 2 - f.y}px`)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="cinema-fx" aria-hidden>
      <canvas ref={streaks} className="cfx-streaks" />
      <div ref={burn} className="cfx-burn" />
      <div ref={flare} className="cfx-flare">
        <span className="cfx-flare-core" />
        <span className="cfx-ghost" style={{ ['--f' as string]: 0.55, ['--s' as string]: '70px' }} />
        <span className="cfx-ghost" style={{ ['--f' as string]: 1.25, ['--s' as string]: '38px' }} />
        <span className="cfx-ghost cfx-ghost-ring" style={{ ['--f' as string]: 1.7, ['--s' as string]: '120px' }} />
      </div>
    </div>
  )
}
