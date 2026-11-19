import { useExploration } from '../state/exploration'

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
}

export const sound = new SoundEngine()
