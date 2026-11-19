import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from 'three'
import { quality } from '../../state/useExperience'
import { travelFx } from '../motion'

/**
 * The near layer of the galaxy's parallax: sparse, faint motes in a box that
 * wraps around the camera. At rest they are invisible; during travel they
 * stream past, so the far stars (fixed), the system (mid) and this dust
 * (near) move at three different rates and the distance reads as scale.
 */

const BOX = 64
const COUNT = quality.tier === 'high' ? 720 : 360

const vertex = /* glsl */ `
uniform vec3 uCam;
uniform float uBox;
uniform float uPx;
attribute float aSeed;
varying float vFade;
varying float vSeed;
void main() {
  // Wrap each mote into a box centred on the camera.
  vec3 p = mod(position - uCam + 0.5 * uBox, uBox) - 0.5 * uBox;
  vec4 mv = modelViewMatrix * vec4(uCam + p, 1.0);
  float dist = -mv.z;
  // Fade at the box edges (no popping) and right at the lens.
  vFade = smoothstep(uBox * 0.5, uBox * 0.22, length(p)) * smoothstep(0.4, 2.2, dist);
  vSeed = aSeed;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * (0.6 + aSeed) * 7.0 / max(dist, 0.5);
}
`

const fragment = /* glsl */ `
uniform float uSpeed;
varying float vFade;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  vec3 col = mix(vec3(0.62, 0.74, 1.0), vec3(0.78, 0.7, 1.0), vSeed);
  gl_FragColor = vec4(col * core, core * vFade * uSpeed * 0.55);
}
`

const camPos = new Vector3()

// Seeded once at module load (not during render).
const POSITIONS = new Float32Array(COUNT * 3)
const SEEDS = new Float32Array(COUNT)
for (let i = 0; i < COUNT; i++) {
  POSITIONS[i * 3] = Math.random() * BOX
  POSITIONS[i * 3 + 1] = Math.random() * BOX
  POSITIONS[i * 3 + 2] = Math.random() * BOX
  SEEDS[i] = Math.random()
}

export function SpaceDust() {
  const points = useMemo(() => {
    const pos = POSITIONS
    const seed = SEEDS
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new BufferAttribute(seed, 1))
    const m = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uCam: { value: new Vector3() },
        uBox: { value: BOX },
        uPx: { value: 1 },
        uSpeed: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const p = new Points(g, m)
    p.frustumCulled = false
    return p
  }, [])

  useFrame(({ camera, viewport }) => {
    const m = points.material as ShaderMaterial
    const speed = travelFx.speed
    points.visible = speed > 0.01
    if (!points.visible) return
    camera.getWorldPosition(camPos)
    m.uniforms.uCam.value.copy(camPos)
    m.uniforms.uPx.value = viewport.dpr
    m.uniforms.uSpeed.value = speed
  })

  return <primitive object={points} />
}
