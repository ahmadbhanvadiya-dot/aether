import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import { Group, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { READINGS, readingsFor, type SiteId } from '../data/waystation'
import { director, telemetry } from '../state/director'
import { readingFx } from '../state/site'

/**
 * Phase 11d: the readings of a deep-space site, shared by every site's scene.
 * Each frame it projects the site's anchors to the screen (`telemetry.site`,
 * read by the markers), hides those on a face turned away, and while a reading
 * is taken, sets the halo where light gathers at its point.
 */

const pos = new Vector3()
const nrm = new Vector3()
const toCam = new Vector3()

// Every reading's screen slot, once (the markers read these).
for (const r of READINGS) telemetry.site[r.id] = telemetry.site[r.id] ?? { x: 0, y: 0, on: false }

export function useSiteReadings(site: SiteId, spin: RefObject<Group | null>) {
  const halo = useRef<Mesh>(null)
  const camera = useThree((st) => st.camera)
  const size = useThree((st) => st.size)
  const anchors = useMemo(
    () =>
      readingsFor(site).map((r) => ({ id: r.id, frame: r.frame, local: new Vector3(...r.anchor), normal: new Vector3(...r.normal), world: new Vector3() })),
    [site],
  )

  useFrame(() => {
    const group = spin.current
    if (group) {
      group.updateWorldMatrix(true, false)
      for (const a of anchors) {
        if (a.frame === 'station') {
          a.world.copy(a.local).applyMatrix4(group.matrixWorld)
          nrm.copy(a.normal).transformDirection(group.matrixWorld)
        } else {
          a.world.copy(a.local)
          nrm.set(0, 0, 0)
        }
        toCam.subVectors(camera.position, a.world)
        const facing = nrm.lengthSq() === 0 || nrm.dot(toCam) > 0
        pos.copy(a.world).project(camera)
        const m = telemetry.site[a.id]
        m.x = (pos.x * 0.5 + 0.5) * size.width
        m.y = (-pos.y * 0.5 + 0.5) * size.height
        m.on = facing && pos.z < 1 && Math.abs(pos.x) < 1.02 && Math.abs(pos.y) < 1.02
      }
    }
    // While a reading is taken, light gathers at its point.
    const h = halo.current
    if (h) {
      const a = readingFx.id ? anchors.find((x) => x.id === readingFx.id) : null
      h.visible = !!a
      if (a) {
        h.position.copy(a.world)
        const p = readingFx.progress
        h.scale.setScalar(0.35 + 1.1 * (1 - p) + 0.08 * Math.sin(director.time * 9))
        ;(h.material as MeshBasicMaterial).opacity = 0.15 + 0.55 * p
      }
    }
  })

  return halo
}
