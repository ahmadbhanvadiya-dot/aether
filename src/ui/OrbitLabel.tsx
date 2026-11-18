import { useEffect, useRef } from 'react'
import { director, telemetry } from '../state/director'

/**
 * A leader-line label that follows Ithra across the screen. It flips to the
 * moon's left when the moon nears the right edge, so it never runs off-screen.
 */
export function OrbitLabel() {
  const el = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let side: 'left' | 'right' | null = null
    const tick = () => {
      const node = el.current
      if (node) {
        const t = telemetry.ithra
        // Stay clear of the HUD corners at the top and bottom of the frame.
        const h = window.innerHeight
        const clear = t.y > h * 0.12 && t.y < h * 0.82
        const opacity = t.visible && clear ? director.hud * (1 - director.dive) : 0
        node.style.opacity = opacity.toFixed(3)
        node.style.transition = 'opacity 400ms ease'
        node.style.transform = `translate3d(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px, 0)`
        const nextSide = t.x > window.innerWidth * 0.62 ? 'left' : 'right'
        if (nextSide !== side) {
          node.dataset.side = nextSide
          side = nextSide
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={el} className="orbit-label" data-side="right" aria-hidden style={{ opacity: 0 }}>
      <span className="orbit-label-ring" />
      <span className="orbit-label-leader" />
      <span className="orbit-label-text">
        <span className="font-display text-[1.15rem] leading-none tracking-[0.06em] text-starlight">
          Ithra
        </span>
        <span className="text-[0.75rem] text-haze">Moon of Vael</span>
      </span>
    </div>
  )
}
