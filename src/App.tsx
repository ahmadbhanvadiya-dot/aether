import { Experience } from './scene/Experience'
import { TitleScreen } from './ui/TitleScreen'

export default function App() {
  return (
    <main className="relative h-svh w-full overflow-hidden bg-void">
      <Experience />
      <TitleScreen />
    </main>
  )
}
