import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { sound } from '../../audio/sound'
import { director } from '../../state/director'
import { useExploration } from '../../state/exploration'
import { useExperience } from '../../state/useExperience'
import { living } from './living'
import { surface } from './world'

/**
 * Phase 7: tells the sound engine which world the camera is on and what its
 * weather is, a few times a second (not every frame; the engine glides between
 * values). Silence in space and the Observatory; nothing is built while muted.
 */
export function AmbienceDriver() {
  const timer = useRef(0)
  useFrame((_, delta) => {
    timer.current += delta
    if (timer.current < 0.4) return
    timer.current = 0
    const { exploring } = useExperience.getState()
    const { soundOn } = useExploration.getState()
    const planet = soundOn && director.space === 'surface' ? exploring : null
    const env = surface.env
    sound.ambience(
      planet,
      env ? { rain: env.rain, waves: env.waves, aurora: env.aurora, gust: living.gust } : undefined,
    )
  })
  return null
}
