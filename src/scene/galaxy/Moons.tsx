import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BufferGeometry, Color, LineBasicMaterial, LineLoop, MathUtils, Mesh, ShaderMaterial, Vector3, Vector4 } from 'three'
import { ASTRONOMY, ELYS, moonLocal, moonOffsetKm, planetKm, type MoonInfo } from '../../data/astronomy'
import { PLANET_BY_ID, type PlanetData } from '../../data/planets'
import { director } from '../../state/director'
import { galaxy } from '../../state/galaxy'
import { sim, useSimulation } from '../../state/simulation'
import { useExperience } from '../../state/useExperience'

/**
 * Phase 9: a world's modelled moons, drawn in its equatorial plane at their true
 * angles (distances compressed). A moon that would circle faster than the eye can
 * follow is shown as a faint ring instead — a long exposure, not a strobe. A moon
 * inside its world's shadow (a lunar eclipse, from the same geometry as the events)
 * darkens.
 */

const moonVertex = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vPosW = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const moonFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uShade;
uniform float uOpacity;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 L = normalize(-vPosW);
  float ndl = max(dot(normalize(vNormalW), L), 0.0);
  vec3 c = uColor * (0.035 + 0.965 * ndl) * uShade;
  gl_FragColor = vec4(c, uOpacity);
}
`

const P = new Vector3()
const world = new Vector3()
const M = new Vector3()
const U = new Vector3()
const tmp = new Vector3()

/** 0 (lit) … 1 (inside the world's umbra), from the physics. */
function inShadow(m: MoonInfo, day: number) {
  planetKm(m.planet, day, P)
  moonOffsetKm(m, day, M)
  const D = P.length()
  U.copy(P).multiplyScalar(-1 / D) // toward Elys
  const along = M.dot(U)
  if (along >= 0) return 0
  const perp = tmp.copy(M).addScaledVector(U, -along).length()
  const Rp = PLANET_BY_ID[m.planet].radiusKm
  const umbra = Rp - (-along * (ELYS.radiusKm - Rp)) / D
  return 1 - MathUtils.smoothstep(perp, umbra - m.radiusKm, umbra + m.radiusKm)
}

export function Moons({ data, shadows }: { data: PlanetData; shadows: Vector4[] }) {
  const moons = ASTRONOMY[data.id].moons
  const meshes = useRef<(Mesh | null)[]>([])

  const parts = useMemo(
    () =>
      moons.map((m) => {
        const r = m.drawn * data.radius
        const size = Math.max(0.05, Math.min(0.24, (m.radiusKm / data.radiusKm) * data.radius * 1.4))
        const material = new ShaderMaterial({
          vertexShader: moonVertex,
          fragmentShader: moonFragment,
          uniforms: { uColor: { value: new Color(m.color) }, uShade: { value: 1 }, uOpacity: { value: 0 } },
          transparent: true,
        })
        const pts: Vector3[] = []
        for (let i = 0; i < 128; i++) {
          const a = (i / 128) * Math.PI * 2
          const v = new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)
          if (m.inclination) v.applyAxisAngle(new Vector3(1, 0, 0), m.inclination)
          pts.push(v)
        }
        const line = new LineLoop(
          new BufferGeometry().setFromPoints(pts),
          new LineBasicMaterial({ color: new Color(m.color).lerp(new Color('#ffffff'), 0.3), transparent: true, opacity: 0, depthWrite: false }),
        )
        return { m, r, size, material, line }
      }),
    [moons, data.radius, data.radiusKm],
  )

  useFrame(({ camera }) => {
    const day = sim.day
    const orbits = useSimulation.getState().orbits
    const focus = useExperience.getState().focus
    const dist = camera.position.distanceTo(galaxy.positions[data.id])
    // Moons and their orbits belong to the close view; far away they are specks.
    const near = 1 - MathUtils.smoothstep(dist, data.radius * 14, data.radius * 34)
    const intro = director.galaxyIntro
    parts.forEach((p, i) => {
      const mesh = meshes.current[i]
      if (!mesh) return
      moonLocal(p.m, day, p.r, mesh.position)
      // Apparent angular speed on screen: past ~3 rad/s it reads as a blur.
      const omega = (Math.PI * 2 * sim.rate) / p.m.periodDays
      const blur = MathUtils.smoothstep(omega, 2.5, 6)
      const u = p.material.uniforms
      u.uOpacity.value = (1 - blur) * intro
      u.uShade.value = 1 - 0.88 * inShadow(p.m, day)
      mesh.visible = u.uOpacity.value > 0.01
      // Its shadow for the world's eclipses (none while it is only a trail).
      const sh = shadows[i]
      if (sh) {
        if (mesh.visible && blur < 0.5) {
          mesh.getWorldPosition(world)
          sh.set(world.x, world.y, world.z, p.size)
        } else sh.w = 0
      }
      const lm = p.line.material as LineBasicMaterial
      // From inside a moon's orbit the line would cut across the world: let it go.
      const outside = MathUtils.smoothstep(dist, p.r * 1.3, p.r * 2.6)
      // Orbit lines belong to the world in view (Phase 10): a neighbour's would
      // draw ellipses behind the focused world's panel.
      const own = focus === data.id ? 1 : 0
      lm.opacity = intro * outside * Math.max(orbits ? 0.07 * near * own : 0, blur * 0.05 * Math.max(near, 0.35) * (focus && !own ? 0 : 1))
      p.line.visible = lm.opacity > 0.005
    })
  })

  if (!moons.length) return null
  return (
    <group>
      {parts.map((p, i) => (
        <group key={p.m.name}>
          <primitive object={p.line} />
          <mesh ref={(el: Mesh | null) => void (meshes.current[i] = el)} material={p.material}>
            <sphereGeometry args={[p.size, 20, 20]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
