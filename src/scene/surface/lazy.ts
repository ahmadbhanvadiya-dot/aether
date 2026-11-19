/**
 * The surface scene (terrain, sky, water, weather, landmarks, scanner glints)
 * is loaded on demand: it is only needed once a descent begins. The loader is
 * memoised so prefetching, React.lazy and the descent share one request.
 */
let pending: Promise<typeof import('./SurfaceScene')> | null = null

export function loadSurfaceScene() {
  pending ??= import('./SurfaceScene')
  return pending
}
