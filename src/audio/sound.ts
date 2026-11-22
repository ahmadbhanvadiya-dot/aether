import type { WorldId } from '../data/planets'
import { useExploration } from '../state/exploration'

/** What a location's weather asks of its ambience (all 0 – 1). */
export interface AmbienceMix {
  rain: number
  waves: number
  aurora: number
  /** Gust strength, around 1. */
  gust: number
}

/** One world's ambient bed: its layers and the gains the weather controls. */
interface Bed {
  planet: WorldId
  out: GainNode
  sources: (AudioScheduledSourceNode)[]
  rain?: GainNode
  surf?: GainNode
  pad?: GainNode
  gust?: GainNode
}

/**
 * Subtle synthesized sound, no audio files. Everything is quiet by design:
 * a chime for discoveries, wind for descents and ascents, a soft swell for
 * travel between locations, distant thunder. The AudioContext is created on
 * the first user gesture (browsers block audio before that).
 */
class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private crackles: AudioBuffer | null = null
  private bed: Bed | null = null

  /** Call from any click handler. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    this.ctx = new Ctor()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(this.ctx.destination)
    // Two seconds of white noise, reused by every noise-based sound.
    const len = this.ctx.sampleRate * 2
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    // Sparse clicks (Nyx's crackling ground), reused as a loop.
    this.crackles = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const cd = this.crackles.getChannelData(0)
    for (let i = 0; i < len; i++) cd[i] = Math.random() < 0.0004 ? (Math.random() * 2 - 1) * 0.9 : 0
    // Master level follows the mute and volume settings, including for the ambience.
    this.applyLevel()
    useExploration.subscribe((s, prev) => {
      if (s.soundOn !== prev.soundOn || s.volume !== prev.volume) this.applyLevel()
    })
  }

  private applyLevel() {
    if (!this.ctx || !this.master) return
    const { soundOn, volume } = useExploration.getState()
    this.master.gain.setTargetAtTime(soundOn ? 0.9 * volume : 0, this.ctx.currentTime, 0.08)
  }

  private ready() {
    if (!useExploration.getState().soundOn) return null
    if (!this.ctx || !this.master) return null
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return { ctx: this.ctx, out: this.master }
  }

  /** A soft three-partial bell with a short shimmer. */
  chime() {
    const r = this.ready()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const delay = ctx.createDelay()
    delay.delayTime.value = 0.23
    const fb = ctx.createGain()
    fb.gain.value = 0.32
    const wet = ctx.createGain()
    wet.gain.value = 0.35
    delay.connect(fb).connect(delay)
    delay.connect(wet).connect(out)

    const partials = [
      { f: 659.25, g: 0.07, d: 2.6 },
      { f: 987.77, g: 0.045, d: 2.1 },
      { f: 1318.5, g: 0.025, d: 1.6 },
    ]
    partials.forEach((p, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = p.f
      const g = ctx.createGain()
      const start = t + i * 0.06
      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(p.g, start + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, start + p.d)
      osc.connect(g)
      g.connect(out)
      g.connect(delay)
      osc.start(start)
      osc.stop(start + p.d + 0.05)
    })
  }

  /**
   * Phase 6: the scan. A quiet sine rising a fourth with a soft tremolo, for
   * `duration` seconds. Returns a function that fades it out early (cancel).
   */
  scan(duration: number): () => void {
    const r = this.ready()
    if (!r) return () => {}
    const { ctx, out } = r
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(392, t)
    osc.frequency.exponentialRampToValueAtTime(523.25, t + duration)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 7
    const depth = ctx.createGain()
    depth.gain.value = 0.008
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.022, t + 0.25)
    g.gain.setValueAtTime(0.022, t + duration - 0.15)
    g.gain.linearRampToValueAtTime(0, t + duration)
    lfo.connect(depth).connect(g.gain)
    osc.connect(g).connect(out)
    osc.start(t)
    lfo.start(t)
    osc.stop(t + duration + 0.05)
    lfo.stop(t + duration + 0.05)
    return () => {
      const now = ctx.currentTime
      g.gain.cancelScheduledValues(now)
      g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(0, now + 0.12)
      osc.stop(now + 0.15)
      lfo.stop(now + 0.15)
    }
  }

  /** Phase 8: an incoming transmission — a breath of static, then a soft carrier. */
  transmission() {
    const r = this.ready()
    if (!r || !this.noise) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2400
    bp.Q.value = 1.4
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.02, t + 0.08)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
    src.connect(bp).connect(g).connect(out)
    src.start(t, Math.random() * 1.2)
    src.stop(t + 0.75)
    ;[880, 1318.5, 1760].forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      const og = ctx.createGain()
      const start = t + 0.45 + i * 0.22
      og.gain.setValueAtTime(0, start)
      og.gain.linearRampToValueAtTime(0.014, start + 0.03)
      og.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)
      osc.connect(og).connect(out)
      osc.start(start)
      osc.stop(start + 0.95)
    })
  }

  /** Phase 6: a hidden discovery noticed. Two faint high notes. */
  shimmer() {
    const r = this.ready()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    ;[1174.66, 1567.98].forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      const g = ctx.createGain()
      const start = t + i * 0.14
      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(0.018, start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, start + 1.2)
      osc.connect(g).connect(out)
      osc.start(start)
      osc.stop(start + 1.25)
    })
  }

  /** Filtered noise sweeping up (descent) or down (ascent). */
  wind(duration: number, direction: 'down' | 'up') {
    const r = this.ready()
    if (!r || !this.noise) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 0.8
    const [f0, f1] = direction === 'down' ? [260, 1400] : [1400, 260]
    filter.frequency.setValueAtTime(f0, t)
    filter.frequency.exponentialRampToValueAtTime(f1, t + duration * 0.7)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.06, t + duration * 0.55)
    g.gain.linearRampToValueAtTime(0, t + duration)
    src.connect(filter).connect(g).connect(out)
    src.start(t)
    src.stop(t + duration + 0.1)
  }

  /** A low swell for travel between locations. */
  swell(duration: number) {
    const r = this.ready()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.035, t + duration * 0.45)
    g.gain.linearRampToValueAtTime(0, t + duration)
    g.connect(out)
    ;[110, 164.81].forEach((f) => {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = f
      osc.detune.setValueAtTime(-8, t)
      osc.detune.linearRampToValueAtTime(8, t + duration)
      osc.connect(g)
      osc.start(t)
      osc.stop(t + duration + 0.05)
    })
  }

  /** Distant thunder: low-passed noise with a slow roll-off. */
  thunder(delay: number, strength: number) {
    const r = this.ready()
    if (!r || !this.noise) return
    const { ctx, out } = r
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 140
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.09 * strength, t + 0.25)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2)
    src.connect(filter).connect(g).connect(out)
    src.start(t)
    src.stop(t + 3.4)
  }

  // -------------------------------------------------------------------------
  // Phase 7: ambient soundscapes. One continuous bed per world, built from the
  // shared noise buffer and a few oscillators; the location's weather shapes it
  // (rain, surf, aurora, gusts). Beds crossfade; nothing plays before the
  // first click (the AudioContext does not exist until then).
  // -------------------------------------------------------------------------

  /** Sets the ambience: a world and its weather, or null for silence. Call often; it only changes what differs. */
  ambience(planet: WorldId | null, mix?: AmbienceMix) {
    if (!this.ctx || !this.master || !this.noise) return
    const ctx = this.ctx
    const t = ctx.currentTime
    if (!planet) {
      if (this.bed) this.retire(this.bed, 2.5)
      this.bed = null
      return
    }
    if (!this.bed || this.bed.planet !== planet) {
      if (this.bed) this.retire(this.bed, 2.5)
      this.bed = this.build(planet)
      this.bed.out.gain.setValueAtTime(0, t)
      this.bed.out.gain.linearRampToValueAtTime(1, t + 3)
    }
    if (!mix) return
    const b = this.bed
    // Weather moves smoothly (a second or two), so flights between locations crossfade.
    b.rain?.gain.setTargetAtTime(mix.rain * 0.05, t, 1.2)
    b.surf?.gain.setTargetAtTime(Math.min(1, mix.waves * 2.2) * 0.045, t, 1.5)
    b.pad?.gain.setTargetAtTime(mix.aurora * 0.006, t, 2)
    b.gust?.gain.setTargetAtTime(0.6 + 0.4 * mix.gust, t, 0.8)
  }

  private retire(bed: Bed, fade: number) {
    const t = this.ctx!.currentTime
    bed.out.gain.cancelScheduledValues(t)
    bed.out.gain.setValueAtTime(bed.out.gain.value, t)
    bed.out.gain.linearRampToValueAtTime(0, t + fade)
    for (const src of bed.sources) src.stop(t + fade + 0.1)
  }

  /** Filtered, looping noise: the base of wind, surf, rain and hiss. */
  private noiseLayer(bed: Bed, type: BiquadFilterType, freq: number, q: number, level: number, into: AudioNode) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    // Start at a random point so layers sharing the buffer never phase together.
    src.start(ctx.currentTime, Math.random() * 1.9)
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.value = level
    src.connect(f).connect(g).connect(into)
    bed.sources.push(src)
    return { filter: f, gain: g }
  }

  /** A slow LFO onto an AudioParam (gusts, swells, beating). */
  private lfo(bed: Bed, rate: number, depth: number, param: AudioParam) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.value = rate
    const d = ctx.createGain()
    d.gain.value = depth
    o.connect(d).connect(param)
    o.start()
    bed.sources.push(o)
  }

  private tone(bed: Bed, freqs: number[], type: OscillatorType, level: number, into: AudioNode) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.gain.value = level
    g.connect(into)
    for (const fr of freqs) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = fr
      o.detune.value = (Math.random() - 0.5) * 8
      o.connect(g)
      o.start()
      bed.sources.push(o)
    }
    return g
  }

  private build(planet: WorldId): Bed {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.connect(this.master!)
    const bed: Bed = { planet, out, sources: [] }
    // Gusts scale the wind layers: one shared gain the weather drives.
    const gust = ctx.createGain()
    gust.gain.value = 1
    gust.connect(out)
    bed.gust = gust

    switch (planet) {
      case 'aurelis': {
        // Sea wind, surf on the shore, and (under the aurora) a faint high air.
        const wind = this.noiseLayer(bed, 'bandpass', 520, 0.6, 0.02, gust)
        this.lfo(bed, 0.05, 0.008, wind.gain.gain)
        this.lfo(bed, 0.03, 160, wind.filter.frequency)
        const surf = this.noiseLayer(bed, 'lowpass', 420, 0.4, 1, out)
        bed.surf = ctx.createGain()
        bed.surf.gain.value = 0
        surf.gain.disconnect()
        surf.gain.connect(bed.surf).connect(out)
        this.lfo(bed, 0.09, 0.5, surf.gain.gain)
        bed.pad = this.tone(bed, [523.25, 659.25, 783.99], 'sine', 0, out)
        break
      }
      case 'nyx': {
        // A low, beating drone under the plains; the ground ticks as it cools.
        const drone = this.tone(bed, [55, 82.41], 'triangle', 0.012, out)
        this.lfo(bed, 0.07, 0.004, drone.gain)
        const wind = this.noiseLayer(bed, 'bandpass', 260, 0.7, 0.01, gust)
        this.lfo(bed, 0.04, 0.004, wind.gain.gain)
        const src = ctx.createBufferSource()
        src.buffer = this.crackles
        src.loop = true
        src.playbackRate.value = 0.7
        const f = ctx.createBiquadFilter()
        f.type = 'bandpass'
        f.frequency.value = 2600
        const g = ctx.createGain()
        g.gain.value = 0.05
        src.connect(f).connect(g).connect(out)
        src.start()
        bed.sources.push(src)
        break
      }
      case 'solara': {
        // Dry wind with strong gusts, and sand hissing when it blows.
        const wind = this.noiseLayer(bed, 'bandpass', 900, 0.9, 0.024, gust)
        this.lfo(bed, 0.07, 0.012, wind.gain.gain)
        this.lfo(bed, 0.05, 260, wind.filter.frequency)
        const hiss = this.noiseLayer(bed, 'highpass', 3200, 0.5, 0.007, gust)
        this.lfo(bed, 0.07, 0.004, hiss.gain.gain)
        break
      }
      case 'vesper': {
        // Deep cloud pad that slowly opens and closes; high, thin wind.
        const pad = this.tone(bed, [73.42, 110], 'triangle', 0.01, out)
        this.lfo(bed, 0.05, 0.004, pad.gain)
        const wind = this.noiseLayer(bed, 'bandpass', 1500, 1.2, 0.008, gust)
        this.lfo(bed, 0.06, 0.003, wind.gain.gain)
        break
      }
      case 'thalassa': {
        // The ocean breathing, wind across it, and rain where it falls.
        const swell = this.noiseLayer(bed, 'lowpass', 360, 0.5, 1, out)
        bed.surf = ctx.createGain()
        bed.surf.gain.value = 0
        swell.gain.disconnect()
        swell.gain.connect(bed.surf).connect(out)
        this.lfo(bed, 0.08, 0.5, swell.gain.gain)
        const wind = this.noiseLayer(bed, 'bandpass', 700, 0.7, 0.014, gust)
        this.lfo(bed, 0.05, 0.006, wind.gain.gain)
        const rain = this.noiseLayer(bed, 'highpass', 2200, 0.4, 1, out)
        bed.rain = ctx.createGain()
        bed.rain.gain.value = 0
        rain.gain.disconnect()
        rain.gain.connect(bed.rain).connect(out)
        break
      }
      case 'liris': {
        // Phase 11: warm wind over the steppe, a soft two-note pad (one for each
        // sun), and a little surf where the shore is.
        const wind = this.noiseLayer(bed, 'bandpass', 640, 0.7, 0.016, gust)
        this.lfo(bed, 0.045, 0.006, wind.gain.gain)
        this.lfo(bed, 0.028, 140, wind.filter.frequency)
        const pad = this.tone(bed, [196, 293.66], 'sine', 0.006, out)
        this.lfo(bed, 0.035, 0.003, pad.gain)
        const surf = this.noiseLayer(bed, 'lowpass', 400, 0.4, 1, out)
        bed.surf = ctx.createGain()
        bed.surf.gain.value = 0
        surf.gain.disconnect()
        surf.gain.connect(bed.surf).connect(out)
        this.lfo(bed, 0.08, 0.5, surf.gain.gain)
        break
      }
      case 'orion': {
        // A drone felt more than heard, a slow whoosh, and the ice of the rings.
        const drone = this.tone(bed, [41.2, 61.74], 'sine', 0.016, out)
        this.lfo(bed, 0.03, 0.005, drone.gain)
        const whoosh = this.noiseLayer(bed, 'bandpass', 300, 0.5, 0.02, gust)
        this.lfo(bed, 0.04, 0.01, whoosh.gain.gain)
        this.lfo(bed, 0.025, 120, whoosh.filter.frequency)
        const ice = this.tone(bed, [1975.5, 2637], 'sine', 0.0018, out)
        this.lfo(bed, 0.11, 0.0012, ice.gain)
        break
      }
    }
    return bed
  }
}

export const sound = new SoundEngine()
