import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, Mesh, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Vector3 } from 'three'
import { director } from '../state/director'
import { useExperience } from '../state/useExperience'
import { atmosphereFx } from './motion'

/**
 * The air between orbit and ground. A full-screen layer drawn inside the
 * scene (so bloom and tone mapping grade it like everything else): sky
 * colours graded about the true horizon line, a brighter scattering band at
 * the horizon, and cloud wisps that stream past with the camera's motion.
 *
 * It thickens as the camera enters the atmosphere in orbit, carries the
 * hand-over between the galaxy and surface spaces, and thins as the ground
 * appears. It is never a flat colour: even at full density the horizon,
 * gradient and wisps keep the frame reading as sky.
 */

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const fragment = /* glsl */ `
uniform float uDensity;
uniform float uTime;
uniform float uHorizon;
uniform float uAspect;
uniform vec3 uLow;
uniform vec3 uHigh;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  float y = vUv.y * 2.0 - 1.0;
  float above = y - uHorizon;
  // Above the horizon: sky deepening to the zenith. Below: the cloud deck,
  // the horizon colour darkening with depth. The band at the horizon scatters brightest.
  vec3 sky = mix(uLow, uHigh, smoothstep(0.0, 0.85, above));
  vec3 deck = mix(uLow, mix(uHigh, uLow, 0.4), smoothstep(0.0, -1.1, above));
  vec3 col = mix(deck, sky, smoothstep(-0.03, 0.03, above));
  col += uLow * 0.22 * exp(-abs(above) * 7.0);

  // Two layers of cloud on planes above and below the eye: perspective depth
  // from the distance to the horizon line, streaming toward the camera; the
  // far layer drifts slower, so the haze has its own parallax.
  float depth = 0.42 / max(abs(above), 0.05);
  float edge = smoothstep(0.02, 0.3, abs(above));
  vec2 xy = vec2((vUv.x - 0.5) * uAspect, 0.0);
  float n1 = fbm(vec2(xy.x * depth, depth + uTime) * vec2(1.1, 0.55));
  float n2 = fbm(vec2(xy.x * depth * 0.55, depth * 0.55 + uTime * 0.55 + 7.3) * vec2(1.6, 0.8));
  float w1 = smoothstep(0.44, 0.76, n1) * edge;
  float w2 = smoothstep(0.5, 0.82, n2) * edge;
  vec3 lit = mix(uLow, vec3(1.0), 0.42);
  vec3 shade = mix(uLow, uHigh, 0.55) * 0.82;
  col = mix(col, mix(shade, lit, smoothstep(0.4, 0.85, n1)), w1 * 0.6);
  col = mix(col, lit, w2 * 0.3);
  col *= 0.88;

  // Thicker toward the horizon, thinner overhead: depth even at full density.
  float body = mix(1.0, 0.82, smoothstep(0.1, 1.2, abs(above)));
  float a = clamp(uDensity * (body + (w1 + w2) * 0.14) * 1.08, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}
`

const forwardV = new Vector3()
const horizonDir = new Vector3()
const projected = new Vector3()
const tmp = new Color()

export function Atmosphere() {
  const mesh = useRef<Mesh>(null)
  const size = useThree((s) => s.size)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uDensity: { value: 0 },
          uTime: { value: 0 },
          uHorizon: { value: 0 },
          uAspect: { value: 1 },
          uLow: { value: new Color() },
          uHigh: { value: new Color() },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  )
  const geometry = useMemo(() => new PlaneGeometry(2, 2), [])
  const clock = useRef(0)

  useFrame(({ camera }, delta) => {
    const m = mesh.current
    if (!m) return
    const d = director.atmo
    m.visible = d > 0.002 && director.space !== 'vael'
    if (!m.visible) return
    const u = material.uniforms
    u.uDensity.value = d
    u.uAspect.value = size.width / size.height

    // Wisps stream with the camera's motion, and stand still when motion is paused or reduced.
    const { motionPaused, reducedMotion } = useExperience.getState()
    if (!motionPaused && !reducedMotion) clock.current += Math.min(delta, 1 / 20) * atmosphereFx.flow
    u.uTime.value = clock.current

    // Colours: in orbit, the planet's limb thickening into the location's sky;
    // on the surface, the sky itself.
    const sky = director.space === 'surface' ? 1 : Math.min(1, d)
    tmp.copy(atmosphereFx.orbitLow).lerp(atmosphereFx.skyLow, sky)
    u.uLow.value.copy(tmp)
    tmp.copy(atmosphereFx.orbitHigh).lerp(atmosphereFx.skyHigh, sky)
    u.uHigh.value.copy(tmp)

    // The horizon: the camera's view direction flattened onto the local
    // horizontal, projected to the screen.
    const cam = camera as PerspectiveCamera
    cam.getWorldDirection(forwardV)
    const up = atmosphereFx.up
    horizonDir.copy(forwardV).addScaledVector(up, -forwardV.dot(up))
    if (horizonDir.lengthSq() < 1e-6) {
      u.uHorizon.value = -2
    } else {
      horizonDir.normalize().multiplyScalar(Math.cos(atmosphereFx.dip)).addScaledVector(up, -Math.sin(atmosphereFx.dip))
      projected.copy(cam.position).addScaledVector(horizonDir, 100).project(cam)
      u.uHorizon.value = Math.max(-3, Math.min(3, projected.y))
    }
  })

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={1000} />
}
