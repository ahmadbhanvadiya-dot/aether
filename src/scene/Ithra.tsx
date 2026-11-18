import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three'
import { director, labels, palette } from '../state/director'
import { useExperience } from '../state/useExperience'
import { noiseGLSL } from './shaders/noise'
import { sphereVertex } from './shaders/planet'
import { sunDirection } from './sun'

/** Orbit radius in planet radii. Chosen to clear the wordmark on every screen. */
const ORBIT_RADIUS = 1.78
const MOON_RADIUS = 0.07
/** Orbit plane nearly faces the camera, so the ring encircles the title like an orrery. */
const ORBIT_TILT_X = 1.18
const ORBIT_TILT_Z = -0.22
const PERIOD_S = 240

const moonFragment = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
${noiseGLSL}
void main() {
  vec3 p = normalize(vObjPos);
  float craters = fbm(p * 5.0);
  float maria = smoothstep(0.05, 0.3, snoise(p * 1.6 + 4.0));
  vec3 albedo = mix(vec3(0.42, 0.41, 0.44), vec3(0.22, 0.22, 0.26), maria);
  albedo *= 0.85 + craters * 0.3;
  vec3 N = normalize(vWorldNormal);
  float lit = max(dot(N, normalize(uSunDir)), 0.0);
  vec3 col = albedo * uSunColor * lit * 1.8 + albedo * vec3(0.3, 0.38, 0.8) * 0.03;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/** Dashed orbit drawn as points so the dashes stay round and crisp at any DPR. */
const orbitVertex = /* glsl */ `
attribute float aIndex;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uCount;
uniform float uPhase;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = 2.1 * uPixelRatio;
  // Brighter just behind the moon, fading around the ring like a wake.
  float along = fract((aIndex / uCount) - uPhase);
  vAlpha = uOpacity * (0.42 + 0.58 * pow(1.0 - along, 3.0));
}
`

const orbitFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.15, length(c)) * vAlpha;
  gl_FragColor = vec4(uColor * a, a);
}
`

const DOTS = 180
const moonWorld = new Vector3()

export function Ithra() {
  const orbit = useRef<Group>(null)
  const moon = useRef<Mesh>(null)
  const motionPaused = useExperience((s) => s.motionPaused)
  const angle = useRef(2.35)

  const { moonMaterial, orbitMaterial, orbitGeometry } = useMemo(() => {
    const moonMaterial = new ShaderMaterial({
      vertexShader: sphereVertex,
      fragmentShader: moonFragment,
      uniforms: {
        uSunDir: { value: new Vector3() },
        uSunColor: { value: palette.sun },
      },
      defines: { OCTAVES: 4 },
    })

    const positions = new Float32Array(DOTS * 3)
    const index = new Float32Array(DOTS)
    for (let i = 0; i < DOTS; i++) {
      const a = (i / DOTS) * Math.PI * 2
      positions.set([Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS], i * 3)
      index[i] = i
    }
    const orbitGeometry = new BufferGeometry()
    orbitGeometry.setAttribute('position', new BufferAttribute(positions, 3))
    orbitGeometry.setAttribute('aIndex', new BufferAttribute(index, 1))

    const orbitMaterial = new ShaderMaterial({
      vertexShader: orbitVertex,
      fragmentShader: orbitFragment,
      uniforms: {
        uPixelRatio: { value: 1 },
        uOpacity: { value: 0 },
        uCount: { value: DOTS },
        uPhase: { value: 0 },
        uColor: { value: palette.ion.clone().lerp(palette.sun, 0.35).multiplyScalar(1.6) },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    return { moonMaterial, orbitMaterial, orbitGeometry }
  }, [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20)
    if (!motionPaused) angle.current -= (dt / PERIOD_S) * Math.PI * 2
    const a = angle.current
    if (moon.current) {
      moon.current.position.set(Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS)
      moon.current.rotation.y = -a
      moon.current.getWorldPosition(moonWorld)
      labels.ithra.copy(moonWorld)
    }
    sunDirection(director.sun, moonMaterial.uniforms.uSunDir.value)
    orbitMaterial.uniforms.uPixelRatio.value = state.viewport.dpr
    // The orbit appears with the HUD, when control is handed over.
    orbitMaterial.uniforms.uOpacity.value = director.hud * (1 - director.dive) * 0.9
    const phase = (((a / (Math.PI * 2)) % 1) + 1) % 1
    orbitMaterial.uniforms.uPhase.value = phase
  })

  return (
    <group ref={orbit} rotation={[ORBIT_TILT_X, 0, ORBIT_TILT_Z]}>
      <points geometry={orbitGeometry} material={orbitMaterial} frustumCulled={false} />
      <mesh ref={moon} material={moonMaterial}>
        <sphereGeometry args={[MOON_RADIUS, 48, 48]} />
      </mesh>
    </group>
  )
}
