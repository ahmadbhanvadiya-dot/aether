import gsap from 'gsap'
import { galaxyCam } from './scene/galaxy/GalaxyRig'
import { surfaceCam } from './scene/surface/SurfaceRig'
import { surface } from './scene/surface/world'
import { Experience } from './scene/Experience'
import { director, telemetry } from './state/director'
import { sound } from './audio/sound'
import { useExploration } from './state/exploration'
import { galaxy } from './state/galaxy'
import { scanFx } from './scene/motion'
import { sim, useSimulation } from './state/simulation'
import { useSky } from './state/sky'
import { useExperience } from './state/useExperience'
import { NO_WEBGL, useStartWatchdog, webglSupported } from './system/health'
import { Boundary, FaultUI } from './system/SystemUI'
import { TitleScreen } from './ui/TitleScreen'

// Dev-only handles for inspecting live state from the console.
if (import.meta.env.DEV) {
  Object.assign(window, { __store: useExperience, __director: director, __galaxyCam: galaxyCam, __galaxy: galaxy, __gsap: gsap, __telemetry: telemetry, __sound: sound, __exploration: useExploration, __surfaceCam: surfaceCam, __surface: surface, __sim: sim, __simulation: useSimulation, __sky: useSky, __scanFx: scanFx })
}

// Phase 10: without WebGL 2 there is no scene to wait for; say so at once.
if (!webglSupported) useExperience.getState().setFault(NO_WEBGL)

const sceneFault = () =>
  useExperience.getState().setFault({
    id: 'scene-error',
    title: 'The scene stopped',
    detail: 'Something in the 3D scene failed on this device. Reload to continue: your discoveries are saved.',
    reload: true,
  })

export default function App() {
  useStartWatchdog()
  return (
    <main className="relative h-svh w-full overflow-hidden bg-void">
      {webglSupported && (
        <Boundary fault={sceneFault}>
          <Experience />
        </Boundary>
      )}
      <TitleScreen />
      <FaultUI />
    </main>
  )
}
