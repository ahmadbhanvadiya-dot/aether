import { useFrame } from '@react-three/fiber'
import { wrapEffect } from '@react-three/postprocessing'
import { Effect } from 'postprocessing'
import { useRef } from 'react'
import { MathUtils, Uniform, Vector3 } from 'three'
import { director } from '../state/director'
import { useExperience } from '../state/useExperience'
import { surface } from './surface/world'

/**
 * Phase 7: heat haze over Solara's sand. A UV-only effect merged into the
 * existing post-processing pass (no extra render): a thin band just above the
 * true horizon shimmers sideways, strongest in high daylight. Zero everywhere
 * else, and off for reduced motion.
 */

const fragment = /* glsl */ `
uniform float uStrength;
uniform float uTime;
uniform float uHorizon;

void mainUv(inout vec2 uv) {
  if (uStrength <= 0.0) return;
  float above = uv.y - uHorizon;
  float band = smoothstep(-0.025, 0.006, above) * (1.0 - smoothstep(0.02, 0.085, above));
  float w = sin(uv.y * 260.0 + uTime * 3.1) * 0.6 + sin(uv.y * 140.0 - uTime * 2.2 + uv.x * 25.0) * 0.4;
  uv.x += w * band * uStrength * 0.0013;
  uv.y += w * band * uStrength * 0.0005;
}
`

class HeatHazeEffect extends Effect {
  constructor() {
    super('HeatHazeEffect', fragment, {
      uniforms: new Map([
        ['uStrength', new Uniform(0)],
        ['uTime', new Uniform(0)],
        ['uHorizon', new Uniform(0.5)],
      ]),
    })
  }
}

const HeatHazeImpl = wrapEffect(HeatHazeEffect)

const forward = new Vector3()
const point = new Vector3()

export function HeatHaze() {
  const ref = useRef<HeatHazeEffect>(null)
  const strength = useRef(0)

  useFrame(({ camera }, delta) => {
    const effect = ref.current
    if (!effect) return
    const { exploring, reducedMotion } = useExperience.getState()
    const env = surface.env
    const sun = env ? env.sunDir.y : 0
    const target =
      director.space === 'surface' && exploring === 'solara' && !reducedMotion
        ? MathUtils.smoothstep(sun, 0.05, 0.5) * (1 - Math.min(1, director.atmo))
        : 0
    strength.current = MathUtils.damp(strength.current, target, 1.5, Math.min(delta, 0.05))
    const u = effect.uniforms
    u.get('uStrength')!.value = strength.current < 0.01 ? 0 : strength.current
    u.get('uTime')!.value = director.time
    // The horizon line on screen: the view direction flattened, projected.
    camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() > 1e-6) {
      point.copy(camera.position).addScaledVector(forward.normalize(), 1000).project(camera)
      u.get('uHorizon')!.value = point.y * 0.5 + 0.5
    }
  })

  return <HeatHazeImpl ref={ref} />
}
