import { Vector3 } from 'three'
import { SUN_END, SUN_START } from '../state/director'

const axis = new Vector3().crossVectors(SUN_START, SUN_END).normalize()
const angle = SUN_START.angleTo(SUN_END)

/** Sun direction for a given swing progress (0 = eclipsed, 1 = final crescent). */
export function sunDirection(t: number, out: Vector3) {
  return out.copy(SUN_START).applyAxisAngle(axis, angle * t)
}
