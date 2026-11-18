import gsap from 'gsap'
import { galaxyCam } from './scene/galaxy/GalaxyRig'
import { Experience } from './scene/Experience'
import { director } from './state/director'
import { galaxy } from './state/galaxy'
import { useExperience } from './state/useExperience'
import { TitleScreen } from './ui/TitleScreen'

// Dev-only handles for inspecting live state from the console.
if (import.meta.env.DEV) {
  Object.assign(window, { __store: useExperience, __director: director, __galaxyCam: galaxyCam, __galaxy: galaxy, __gsap: gsap })
}

export default function App() {
  return (
    <main className="relative h-svh w-full overflow-hidden bg-void">
      <Experience />
      <TitleScreen />
    </main>
  )
}
