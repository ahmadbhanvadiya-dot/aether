import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { director } from '../state/director'
import { enterGalaxyIntro } from '../scene/galaxy/GalaxyRig'
import { debugShot, useExperience } from '../state/useExperience'
import { GalaxyUI } from './GalaxyUI'
import { ExploreUI } from './ExploreUI'
// The Observatory's interface loads after the first paint (it is needed minutes later).
const ObservatoryUI = lazy(() => loadObservatoryUI().then((m) => ({ default: m.ObservatoryUI })))
import { closeObservatory, openObservatory } from './observatoryDirector'
import { loadObservatoryUI, observatoryUnavailable } from '../system/chunks'
import { Boundary } from '../system/SystemUI'
import { jumpToLocation } from './exploreDirector'
import type { PlanetId } from '../data/planets'
import { Hud } from './Hud'
import { JournalUI } from './JournalUI'
import { SimulationKeys } from './SimulationUI'
import { StoryUI } from './StoryUI'
import { OrbitLabel } from './OrbitLabel'
import { Wordmark } from './Wordmark'

gsap.registerPlugin(useGSAP, CustomEase)
// Strong UI ease-out — the same curve as --ease-out-ui in CSS.
CustomEase.create('uiOut', 'M0,0 C0.23,1 0.32,1 1,1')

function useFontsReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    const timeout = setTimeout(() => alive && setReady(true), 2500)
    document.fonts.ready.then(() => alive && setReady(true))
    return () => {
      alive = false
      clearTimeout(timeout)
    }
  }, [])
  return ready
}

/** Hide-interface shortcut. Instant: a keyboard toggle should never wait on an animation. */
function useCinemaShortcut() {
  const toggleCinema = useExperience((s) => s.toggleCinema)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'h' || e.key === 'H') toggleCinema()
      const st = useExperience.getState()
      // J opens and closes the Expedition Journal wherever exploring happens (Phase 8).
      if ((e.key === 'j' || e.key === 'J') && ['galaxy', 'surface', 'observatory'].includes(st.phase) && !st.story) {
        st.setJournal(!st.journal)
        return
      }
      if (st.story || st.journal) return
      if (e.key === 'o' || e.key === 'O') {
        const phase = useExperience.getState().phase
        if (phase === 'galaxy' || phase === 'surface') openObservatory()
        else if (phase === 'observatory') closeObservatory()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleCinema])
}

export function TitleScreen() {
  const root = useRef<HTMLDivElement>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const progress = useRef({ value: 0 })

  const sceneReady = useExperience((s) => s.sceneReady)
  const reducedMotion = useExperience((s) => s.reducedMotion)
  const phase = useExperience((s) => s.phase)
  const cinema = useExperience((s) => s.cinema)
  const setPhase = useExperience((s) => s.setPhase)
  const fontsReady = useFontsReady()
  useCinemaShortcut()

  // ---- Prelude: a real load count on black -----------------------------------
  const { contextSafe } = useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const count = q('[data-prelude-count]')[0]
      const target = (fontsReady ? 35 : 0) + (sceneReady ? 65 : 0)
      gsap.to(progress.current, {
        value: target,
        duration: target === 100 ? 0.7 : 1.2,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: () => {
          if (count) count.textContent = `${Math.round(progress.current.value)}%`
        },
      })
    },
    { scope: root, dependencies: [sceneReady, fontsReady] },
  )

  // ---- Arrival: the one orchestrated sequence --------------------------------
  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const letters = q('[data-letter]')
      const bars = q('[data-letterbox]')

      if (debugShot) {
        Object.assign(director, { arrival: 1, sun: 1, sky: 1, hud: 1, dive: 0 })
        gsap.set(q('[data-prelude]'), { autoAlpha: 0 })
        gsap.set(bars, { scaleY: 0 })
        gsap.set(q('[data-hud]'), { opacity: 1 })
        if (debugShot === 'orbit') {
          gsap.set(q('[data-letter], [data-tagline], [data-cta]'), { opacity: 1 })
          setPhase('orbit')
        } else {
          // Wait until the scene is ready: this branch re-runs when readiness changes,
          // and a late re-run would reset the camera mid-travel.
          if (!sceneReady || !fontsReady) return
          Object.assign(director, { galaxyIntro: 1, hud: 0 })
          const shot = debugShot
          if (shot.startsWith('loc:')) {
            jumpToLocation(shot.slice(4))
          } else {
            director.space = 'galaxy'
            enterGalaxyIntro()
            setPhase('galaxy')
            if (shot === 'observatory') setTimeout(openObservatory, 500)
            else if (shot !== 'galaxy') setTimeout(() => useExperience.getState().setFocus(shot as PlanetId), 300)
          }
        }
        return
      }

      if (!sceneReady || !fontsReady) return
      setPhase('arriving')
      const tl = gsap.timeline({ onComplete: () => setPhase('orbit') })
      timeline.current = tl

      // Let the count land on 100 before the void opens.
      tl.to(q('[data-prelude-line]'), {
        opacity: 0,
        filter: reducedMotion ? 'blur(0px)' : 'blur(8px)',
        duration: 0.7,
        ease: 'power2.out',
        delay: 0.75,
      }).to(q('[data-prelude]'), { autoAlpha: 0, duration: 0.6, ease: 'power1.out' }, '>-0.2')

      const start = tl.duration() - 0.3

      if (reducedMotion) {
        director.arrival = 1
        gsap.set(bars, { scaleY: 0 })
        tl.to(director, { sky: 1, sun: 1, duration: 1.4, ease: 'power1.out' }, start)
          .to(letters, { opacity: 1, duration: 0.8, stagger: 0.04, ease: 'power1.out' }, start + 0.4)
          .to(q('[data-tagline], [data-cta]'), { opacity: 1, duration: 0.6 }, start + 0.9)
          .to(q('[data-hud]'), { opacity: 1, duration: 0.6 }, start + 1.1)
          .to(director, { hud: 1, duration: 0.6 }, start + 1.1)
        return
      }

      tl.to(director, { sky: 1, duration: 2.4, ease: 'power2.out' }, start)
        .to(director, { arrival: 1, duration: 6.2, ease: 'power4.out' }, start)
        .to(director, { sun: 1, duration: 4.2, ease: 'power3.inOut' }, start + 0.5)
        .fromTo(
          letters,
          { opacity: 0, y: '0.2em', filter: 'blur(14px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'uiOut', stagger: 0.07 },
          start + 2.5,
        )
        .fromTo(
          q('[data-tagline]'),
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 1.1, ease: 'uiOut' },
          start + 3.4,
        )
        .fromTo(
          q('[data-cta]'),
          { opacity: 0, y: 10, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: 'uiOut' },
          start + 3.7,
        )
        // Control is handed over: the bars open and the instruments come up.
        .to(bars, { scaleY: 0, duration: 1.3, ease: 'uiOut' }, start + 4.1)
        .fromTo(
          q('[data-hud]'),
          { opacity: 0 },
          { opacity: 1, duration: 1.2, ease: 'power1.out', stagger: 0.08 },
          start + 4.3,
        )
        .to(director, { hud: 1, duration: 1.6, ease: 'power1.out' }, start + 4.5)
    },
    { scope: root, dependencies: [sceneReady, fontsReady] },
  )

  // ---- Enter universe: skim Vael's limb, jump, arrive in the Aether system ---
  const enter = contextSafe(() => {
    if (phase !== 'orbit' && phase !== 'arriving') return
    // If the arrival is still settling, let it finish smoothly instead of snapping.
    timeline.current?.kill()
    setPhase('warping')
    const q = gsap.utils.selector(root)
    const bars = q('[data-letterbox]')
    const veil = q('[data-veil]')
    const tl = gsap.timeline({ onComplete: () => setPhase('galaxy') })
    timeline.current = tl

    tl.to(director, { arrival: 1, sun: 1, sky: 1, duration: 1.2, ease: 'power2.out' }, 0)
      .to(q('[data-prelude]'), { autoAlpha: 0, duration: 0.3 }, 0)
      .to(director, { hud: 0, duration: 0.6, ease: 'power1.out' }, 0)
      .to(
        q('[data-letter]'),
        {
          opacity: 0,
          y: '-0.12em',
          filter: reducedMotion ? 'blur(0px)' : 'blur(10px)',
          duration: 0.6,
          ease: 'uiOut',
          stagger: { each: 0.04, from: 'end' },
        },
        0,
      )
      .to(q('[data-tagline], [data-cta]'), { opacity: 0, y: -6, duration: 0.45, ease: 'uiOut' }, 0)

    const switchToGalaxy = () => {
      Object.assign(director, { space: 'galaxy', galaxyIntro: 0, dive: 0 })
      enterGalaxyIntro()
    }

    if (reducedMotion) {
      tl.to(veil, { opacity: 1, duration: 0.5, ease: 'power1.inOut' }, 0.3)
        .call(switchToGalaxy)
        .set(director, { galaxyIntro: 1 })
        .to(veil, { opacity: 0, duration: 0.7, ease: 'power1.inOut' })
      return
    }

    // The camera takes over: bars close, it skims the lit limb, then jumps.
    tl.to(bars, { scaleY: 1, duration: 0.9, ease: 'uiOut' }, 0)
      .to(director, { dive: 0.42, duration: 1.7, ease: 'power2.in' }, 0.1)
      .to(director, { warp: 1, duration: 1.2, ease: 'power3.in' }, 0.9)
      .to(veil, { opacity: 0.9, duration: 0.25, ease: 'power2.in' }, 1.9)
      .call(switchToGalaxy, undefined, 2.15)
      .to(veil, { opacity: 0, duration: 1.1, ease: 'power2.out' }, 2.2)
      .to(director, { warp: 0, duration: 2.0, ease: 'power3.out' }, 2.2)
      .to(director, { galaxyIntro: 1, duration: 4.2, ease: 'power4.out' }, 2.15)
      .to(bars, { scaleY: 0, duration: 1.3, ease: 'uiOut' }, 4.0)
  })

  // ---- Return to Vael: the jump in reverse, then the title comes back --------
  const returnToVael = contextSafe(() => {
    if (phase !== 'galaxy') return
    useExperience.getState().setFocus(null)
    setPhase('returning')
    const q = gsap.utils.selector(root)
    const bars = q('[data-letterbox]')
    const veil = q('[data-veil]')
    const tl = gsap.timeline({ onComplete: () => setPhase('orbit') })
    timeline.current = tl

    const switchToVael = () => {
      Object.assign(director, { space: 'vael', dive: 0, arrival: reducedMotion ? 1 : 0.35 })
    }

    if (reducedMotion) {
      tl.to(veil, { opacity: 1, duration: 0.5, ease: 'power1.inOut' })
        .call(switchToVael)
        .set(director, { galaxyIntro: 0 })
        .to(veil, { opacity: 0, duration: 0.7, ease: 'power1.inOut' })
    } else {
      tl.to(bars, { scaleY: 1, duration: 0.9, ease: 'uiOut' }, 0)
        .to(director, { galaxyIntro: 0.55, duration: 1.4, ease: 'power2.in' }, 0)
        .to(director, { warp: 1, duration: 1.1, ease: 'power3.in' }, 0.6)
        .to(veil, { opacity: 0.9, duration: 0.25, ease: 'power2.in' }, 1.5)
        .call(switchToVael, undefined, 1.75)
        .set(director, { galaxyIntro: 0 }, 1.75)
        .to(veil, { opacity: 0, duration: 1.1, ease: 'power2.out' }, 1.8)
        .to(director, { warp: 0, duration: 2.0, ease: 'power3.out' }, 1.8)
        .to(director, { arrival: 1, duration: 3.8, ease: 'power4.out' }, 1.75)
        .to(bars, { scaleY: 0, duration: 1.3, ease: 'uiOut' }, 3.9)
    }

    const at = reducedMotion ? 1.2 : 3.2
    tl.to(
      q('[data-letter]'),
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'uiOut', stagger: 0.06 },
      at,
    )
      .to(
        q('[data-tagline], [data-cta]'),
        { opacity: 1, y: 0, duration: 0.9, ease: 'uiOut', stagger: 0.12 },
        at + 0.5,
      )
      .to(director, { hud: 1, duration: 1.2, ease: 'power1.out' }, at + 0.7)
  })

  const titleInteractive = phase === 'orbit' || phase === 'arriving'

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-10" data-cinema={cinema || undefined}>
      <OrbitLabel />

      {/* Title block: the wordmark sits on the planet's dark equator. */}
      <section
        className="ui-hideable absolute inset-x-0 top-1/2 flex flex-col items-center px-6 text-center"
        aria-hidden={!titleInteractive}
      >
        <div className="-translate-y-1/2">
          <Wordmark />
        </div>
        <p
          className="-mt-[min(2.4svh,3vw)] text-[clamp(1rem,1.4vw,1.3rem)] font-light tracking-[0.04em] text-starlight/80"
          data-reveal
          data-tagline
        >
          Beyond the known.
        </p>
        <button
          type="button"
          className={`enter-button mt-[min(6svh,9vw)] ${titleInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
          onClick={enter}
          disabled={!titleInteractive}
          tabIndex={titleInteractive ? 0 : -1}
          data-reveal
          data-cta
        >
          <span className="enter-glyph" aria-hidden />
          ENTER UNIVERSE
        </button>
      </section>

      <GalaxyUI onReturnToVael={returnToVael} />
      <ExploreUI />
      {/* Phase 10: if its code never arrives, the rest of AETHER carries on. */}
      <Boundary fault={() => (observatoryUnavailable.current = true)}>
        <Suspense fallback={null}>
          <ObservatoryUI />
        </Suspense>
      </Boundary>
      <JournalUI />
      <StoryUI />
      <SimulationKeys />

      <div className="pointer-events-auto">
        <Hud />
      </div>

      {/* A brief flash of light as the jump drops out of warp. */}
      <div className="veil pointer-events-none absolute inset-0 opacity-0" data-veil aria-hidden />

      {/* Letterbox: closed while the camera directs, open when you have control. */}
      <div className="letterbox letterbox-top" data-letterbox aria-hidden />
      <div className="letterbox letterbox-bottom" data-letterbox aria-hidden />

      {/* Prelude: one quiet line on black while shaders compile. */}
      <div className="prelude" data-prelude>
        <p className="prelude-line" data-prelude-line>
          <span>Receiving signal from Vael</span>
          <span className="prelude-count tabular-nums" data-prelude-count>
            0%
          </span>
        </p>
      </div>
    </div>
  )
}
