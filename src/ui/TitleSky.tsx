import { useEffect, useRef } from 'react'

/**
 * Now and then, a shooting star over the title (every 7–14 s, in the upper sky,
 * under a second). The canvas only draws while one is crossing; otherwise it waits
 * on a timer. Off for reduced motion and outside the title (`active`).
 */
export function TitleSky({ active }: { active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvas.current
    if (!active || !c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const resize = () => {
      c.width = Math.round(window.innerWidth * dpr)
      c.height = Math.round(window.innerHeight * dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    let raf = 0
    let timer = 0
    const launch = () => {
      const W = c.width
      const H = c.height
      // From the upper sky, falling at a shallow angle, left or right.
      const dir = Math.random() < 0.5 ? -1 : 1
      const x = W * (dir < 0 ? 0.55 + Math.random() * 0.4 : 0.05 + Math.random() * 0.4)
      const y = H * (0.06 + Math.random() * 0.22)
      const angle = (dir < 0 ? Math.PI - 0.38 : 0.38) + (Math.random() - 0.5) * 0.2
      const speed = (900 + Math.random() * 500) * dpr
      const length = (110 + Math.random() * 90) * dpr
      const life = 0.75 + Math.random() * 0.35
      const t0 = performance.now()
      const step = (now: number) => {
        const t = (now - t0) / 1000
        ctx.clearRect(0, 0, W, H)
        if (t >= life) {
          timer = window.setTimeout(launch, 7000 + Math.random() * 7000)
          return
        }
        const k = t / life
        // Bright in the middle of its flight, gone at both ends.
        const alpha = Math.sin(k * Math.PI) ** 1.5
        const hx = x + Math.cos(angle) * speed * t
        const hy = y + Math.sin(angle) * speed * t
        const tx = hx - Math.cos(angle) * length
        const ty = hy - Math.sin(angle) * length
        const g = ctx.createLinearGradient(tx, ty, hx, hy)
        g.addColorStop(0, 'rgba(160, 190, 255, 0)')
        g.addColorStop(1, `rgba(235, 242, 255, ${0.85 * alpha})`)
        ctx.strokeStyle = g
        ctx.lineWidth = 1.3 * dpr
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(hx, hy)
        ctx.stroke()
        raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }
    timer = window.setTimeout(launch, 3500 + Math.random() * 3000)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      ctx.clearRect(0, 0, c.width, c.height)
    }
  }, [active])

  return <canvas ref={canvas} className="title-sky" aria-hidden />
}
