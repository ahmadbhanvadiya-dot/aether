import { memoImport } from '../../system/chunks'

/**
 * The surface scene (terrain, sky, water, weather, landmarks, scanner glints)
 * is loaded on demand: it is only needed once a descent begins. The loader is
 * memoised so prefetching, React.lazy and the descent share one request, and it
 * retries before giving up (Phase 10).
 */
export const loadSurfaceScene = memoImport(() => import('./SurfaceScene'))
