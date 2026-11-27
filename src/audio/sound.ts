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
  // Sound for the bold motion: the jump between spaces, the scan's lock and
  // burst, the entry roar, flights, the opening's lock and new map routes.
  // Same rules as the rest: synthesized, quiet, nothing before the first click.
  // -------------------------------------------------------------------------

  /** A gain that rises to `peak` in `attack`, then falls away by `end` (seconds after t). */
  private env(ctx: AudioContext, t: number, peak: number, attack: number, end: number) {
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + end)
    return g
  }

  /** The shared noise, looping from a random point, for `dur` seconds. */
  private noiseFrom(ctx: AudioContext, t: number, dur: number, buffer = this.noise) {
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.start(t, Math.random() * 1.9)
    src.stop(t + dur + 0.05)
    return src
  }

  /** A short echo into `out`, for tones that should ring in space. */
  private space(ctx: AudioContext, out: AudioNode, time = 0.31, feedback = 0.34, level = 0.32) {
    const delay = ctx.createDelay(1)
    delay.delayTime.value = time
    const fb = ctx.createGain()
    fb.gain.value = feedback
    const wet = ctx.createGain()
    wet.gain.value = level
    delay.connect(fb).connect(delay)
    delay.connect(wet).connect(out)
    return delay
  }

  /**
   * The arrival on the far side of a jump: a deep drop, an open fifth that
   * blooms and rings, and a breath of bright air. `strength` 0 – 1.
   */
  bloom(strength = 1, at = 0) {
    const r = this.ready()
    if (!r || !this.noise) return
    const { ctx, out } = r
    const t = ctx.currentTime + at
    const echo = this.space(ctx, out, 0.37, 0.4, 0.3)
    // The drop: a sine falling an octave and more, felt more than heard.
    const boom = ctx.createOscillator()
    boom.type = 'sine'
    boom.frequency.setValueAtTime(72, t)
    boom.frequency.exponentialRampToValueAtTime(31, t + 1.4)
    const bg = this.env(ctx, t, 0.13 * strength, 0.012, 2.6)
    boom.connect(bg).connect(out)
    boom.start(t)
    boom.stop(t + 2.7)
    // The open fifth, slightly detuned, swelling in and ringing out.
    ;[110, 164.81, 220, 329.63].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = i < 2 ? 'triangle' : 'sine'
      o.frequency.value = f
      o.detune.value = (i % 2 ? 1 : -1) * 4
      const g = this.env(ctx, t, (i < 2 ? 0.02 : 0.012) * strength, 0.5, 5.2)
      o.connect(g)
      g.connect(out)
      g.connect(echo)
      o.start(t)
      o.stop(t + 5.3)
    })
    // Bright air, as the light floods back.
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 4800
    const ag = this.env(ctx, t, 0.022 * strength, 0.02, 1.1)
    this.noiseFrom(ctx, t, 1.2).connect(hp).connect(ag).connect(out)
  }

  /**
   * The jump between spaces (Enter universe, Return to Vael): air and a tone
   * rising together for `build` seconds, cut at the flash, then the bloom.
   */
  jump(build: number) {
    const r = this.ready()
    if (!r || !this.noise) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const end = t + build
    // Rushing air, tightening and rising toward the flash.
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.1
    bp.frequency.setValueAtTime(180, t)
    bp.frequency.exponentialRampToValueAtTime(2800, end)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.0001, t)
    ng.gain.exponentialRampToValueAtTime(0.055, end - 0.05)
    ng.gain.linearRampToValueAtTime(0, end + 0.12)
    this.noiseFrom(ctx, t, build + 0.2).connect(bp).connect(ng).connect(out)
    // A low tone climbing two octaves underneath it.
    const riser = ctx.createOscillator()
    riser.type = 'sawtooth'
    riser.frequency.setValueAtTime(55, t)
    riser.frequency.exponentialRampToValueAtTime(220, end)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(300, t)
    lp.frequency.exponentialRampToValueAtTime(1400, end)
    const rg = ctx.createGain()
    rg.gain.setValueAtTime(0.0001, t)
    rg.gain.exponentialRampToValueAtTime(0.02, end - 0.05)
    rg.gain.linearRampToValueAtTime(0, end + 0.08)
    riser.connect(lp).connect(rg).connect(out)
    riser.start(t)
    riser.stop(end + 0.15)
    this.bloom(1, build)
  }

  /**
   * The opening's lock (only heard if a click has already enabled sound):
   * static thinning out as a pure tone settles in.
   */
  tuneIn(duration = 1) {
    const r = this.ready()
    if (!r || !this.noise) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2200
    bp.Q.value = 0.9
    const sg = ctx.createGain()
    sg.gain.setValueAtTime(0.035, t)
    sg.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.8)
    this.noiseFrom(ctx, t, duration).connect(bp).connect(sg).connect(out)
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(840, t)
    o.frequency.exponentialRampToValueAtTime(880, t + duration * 0.6)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0, t)
    og.gain.linearRampToValueAtTime(0.022, t + duration * 0.6)
    og.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.5)
    o.connect(og).connect(out)
    o.start(t)
    o.stop(t + duration + 0.55)
  }

  /** The scan locks on (the beam reaches the target): two quick high blips. */
  lock() {
    const r = this.ready()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    ;[1760, 2637].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = this.env(ctx, t + i * 0.075, 0.02, 0.006, 0.2)
      o.connect(g).connect(out)
      o.start(t + i * 0.075)
      o.stop(t + i * 0.075 + 0.22)
    })
  }

  /** A find lands: a soft low thump and a puff of air under the chime. */
  burst() {
    const r = this.ready()
    if (!r || !this.noise) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.35)
    const g = this.env(ctx, t, 0.11, 0.006, 0.9)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + 0.95)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(1400, t)
    bp.frequency.exponentialRampToValueAtTime(500, t + 0.4)
    bp.Q.value = 0.7
    const ng = this.env(ctx, t, 0.032, 0.008, 0.45)
    this.noiseFrom(ctx, t, 0.5).connect(bp).connect(ng).connect(out)
  }

  /**
   * Atmospheric entry (descent, `down`) or the climb out (`up`, gentler): a low
   * roar that swells with the entry burn, with plasma crackle on the way in.
   */
  entry(duration: number, direction: 'down' | 'up') {
    const r = this.ready()
    if (!r || !this.noise) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const k = direction === 'down' ? 1 : 0.55
    const peak = t + duration * (direction === 'down' ? 0.6 : 0.75)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 0.6
    lp.frequency.setValueAtTime(110, t)
    lp.frequency.exponentialRampToValueAtTime(560, peak)
    lp.frequency.exponentialRampToValueAtTime(140, t + duration)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.17 * k, peak)
    g.gain.linearRampToValueAtTime(0, t + duration)
    this.noiseFrom(ctx, t, duration).connect(lp).connect(g).connect(out)
    if (direction === 'down' && this.crackles) {
      const src = ctx.createBufferSource()
      src.buffer = this.crackles
      src.loop = true
      src.playbackRate.value = 2.2
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1900
      const cg = ctx.createGain()
      cg.gain.setValueAtTime(0, t)
      cg.gain.linearRampToValueAtTime(0.14, peak)
      cg.gain.linearRampToValueAtTime(0, t + duration * 0.9)
      src.connect(bp).connect(cg).connect(out)
      src.start(t)
      src.stop(t + duration)
    }
  }

  /**
   * A flight passing through (between places, between worlds, across the map):
   * air that rises and falls with the speed, panning across. `strength` 0 – 1.
   */
  whoosh(duration: number, strength = 1) {
    const r = this.ready()
    if (!r || !this.noise) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const mid = t + duration * 0.48
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.9
    bp.frequency.setValueAtTime(260, t)
    bp.frequency.exponentialRampToValueAtTime(1700, mid)
    bp.frequency.exponentialRampToValueAtTime(320, t + duration)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.1 * strength, mid)
    g.gain.linearRampToValueAtTime(0, t + duration)
    const chain = this.noiseFrom(ctx, t, duration).connect(bp).connect(g)
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner()
      pan.pan.setValueAtTime(-0.5, t)
      pan.pan.linearRampToValueAtTime(0.5, t + duration)
      chain.connect(pan).connect(out)
    } else chain.connect(out)
  }

  /** A new route traces itself on the map: a soft glide up an octave. */
  trace(duration = 1.6) {
    const r = this.ready()
    if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const echo = this.space(ctx, out, 0.27, 0.3, 0.3)
    ;[
      [523.25, 0.014],
      [1046.5, 0.005],
    ].forEach(([f, peak]) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(f, t)
      o.frequency.exponentialRampToValueAtTime(f * 2, t + duration)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.15)
      g.gain.setValueAtTime(peak, t + duration * 0.8)
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.6)
      o.connect(g)
      g.connect(out)
      g.connect(echo)
      o.start(t)
      o.stop(t + duration + 0.65)
    })
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
