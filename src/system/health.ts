import { useEffect } from 'react'
import { useExperience } from '../state/useExperience'

/**
 * Phase 10: the checks behind FaultUI — WebGL support, a lost GPU context, and a
 * first scene that takes too long. Each reports a fault; none renders anything.
 */

/** WebGL 2 is required (three r187). Checked once, before the canvas is created. */
export const webglSupported = (() => {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    const ok = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return ok
  } catch {
    return false
  }
})()

export const NO_WEBGL = {
  id: 'no-webgl',
  title: 'This browser cannot draw AETHER',
  detail: 'AETHER needs WebGL 2. Turn on hardware acceleration in your browser settings, or open it in a current version of Chrome, Edge, Firefox or Safari.',
}

/** Reports the canvas losing its GPU context (driver reset, too many tabs, sleep). */
export function watchContext(canvas: HTMLCanvasElement) {
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    useExperience.getState().setFault({
      id: 'context-lost',
      title: 'The display was interrupted',
      detail: 'The graphics driver reset the scene. Reload to continue: your discoveries are saved.',
      reload: true,
    })
  })
}

/** If the first scene is not ready after a while, say so instead of counting forever. */
export function useStartWatchdog() {
  const ready = useExperience((s) => s.sceneReady)
  useEffect(() => {
    const st = useExperience.getState()
    if (ready) {
      if (st.fault?.id === 'slow-start') st.setFault(null)
      return
    }
    const t = setTimeout(() => {
      if (!useExperience.getState().sceneReady && !useExperience.getState().fault)
        useExperience.getState().setFault({
          id: 'slow-start',
          title: 'Still receiving',
          detail: 'Starting the scene is taking longer than it should. It may still arrive; reloading often helps.',
          reload: true,
          dismissible: true,
        })
    }, 15000)
    return () => clearTimeout(t)
  }, [ready])
}
