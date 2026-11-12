/**
 * Sound for the cloister film: a quiet generated score, and the two short cues
 * that mark the film stopping at a chapter and starting again.
 *
 * Pass `src` to play a music file in place of the generated score. Nothing
 * makes sound until `unlock()` runs inside a user gesture.
 */
export type CloisterAudio = ReturnType<typeof createCloisterAudio>

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12)
// A slow four-bar cycle in A minor.
const CHORDS = [
  [45, 57, 60, 64, 71],
  [41, 53, 57, 60, 64],
  [36, 55, 60, 64, 67],
  [40, 52, 55, 59, 62],
]
const BELLS = [69, 72, 74, 76, 79, 81, 84]
const BAR = 9

export function createCloisterAudio(
  src?: string,
  factory: (() => AudioContext) | undefined = typeof AudioContext === "undefined"
    ? undefined
    : () => new AudioContext(),
) {
  let context: AudioContext | undefined
  let master: GainNode, music: GainNode, tone: BiquadFilterNode, echo: GainNode
  let meter: AnalyserNode | undefined
  let wind: GainNode | undefined, windBand: BiquadFilterNode | undefined
  let air = .28
  let noise: AudioBuffer | undefined
  let element: HTMLAudioElement | undefined
  let enabled = true,
    reading = false,
    disposed = false,
    timer = 0,
    nextBar = 0,
    nextBell = 0,
    bar = 0

  function build() {
    if (context || !factory || disposed) return
    try {
      context = factory()
    } catch {
      return
    }
    const c = context
    master = c.createGain()
    master.gain.value = 0
    meter = c.createAnalyser()
    meter.fftSize = 2048
    // A limiter keeps a cue landing on a loud bar from clipping.
    const limiter = c.createDynamicsCompressor()
    limiter.threshold.value = -14
    limiter.knee.value = 8
    limiter.ratio.value = 12
    limiter.attack.value = .003
    limiter.release.value = .2
    master.connect(limiter)
    limiter.connect(meter)
    limiter.connect(c.destination)
    tone = c.createBiquadFilter()
    tone.type = "lowpass"
    tone.frequency.value = 16000
    tone.connect(master)
    music = c.createGain()
    music.gain.value = .55
    music.connect(tone)
    // A feedback echo stands in for the stone room.
    echo = c.createGain()
    echo.gain.value = .5
    const delay = c.createDelay(1)
    delay.delayTime.value = .41
    const feedback = c.createGain()
    feedback.gain.value = .46
    const damp = c.createBiquadFilter()
    damp.type = "lowpass"
    damp.frequency.value = 1900
    echo.connect(delay)
    delay.connect(damp)
    damp.connect(feedback)
    feedback.connect(delay)
    damp.connect(music)
    const samples = Math.floor(c.sampleRate * 2.3)
    noise = c.createBuffer(1, samples, c.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1
    // Wind: looped noise through a wandering band, always under the film.
    const gust = c.createBufferSource()
    gust.buffer = noise
    gust.loop = true
    windBand = c.createBiquadFilter()
    windBand.type = "bandpass"
    windBand.Q.value = .7
    windBand.frequency.value = 420
    wind = c.createGain()
    wind.gain.value = 0
    const sway = c.createOscillator()
    sway.frequency.value = .11
    const swayDepth = c.createGain()
    swayDepth.gain.value = 130
    sway.connect(swayDepth)
    swayDepth.connect(windBand.frequency)
    gust.connect(windBand)
    windBand.connect(wind)
    wind.connect(master)
    gust.start()
    sway.start()
    if (src && typeof Audio !== "undefined") {
      element = new Audio(src)
      element.loop = true
      element.preload = "auto"
      c.createMediaElementSource(element).connect(music)
    }
  }

  function pad(at: number, notes: number[]) {
    const c = context!
    const voice = c.createGain()
    voice.gain.setValueAtTime(0, at)
    voice.gain.linearRampToValueAtTime(1, at + 3.2)
    voice.gain.setValueAtTime(1, at + BAR - 1)
    voice.gain.linearRampToValueAtTime(0, at + BAR + 3.5)
    const warm = c.createBiquadFilter()
    warm.type = "lowpass"
    warm.frequency.setValueAtTime(520, at)
    warm.frequency.linearRampToValueAtTime(900, at + BAR / 2)
    warm.frequency.linearRampToValueAtTime(560, at + BAR + 3.5)
    voice.connect(warm)
    warm.connect(music)
    warm.connect(echo)
    notes.forEach((note, index) => {
      for (const detune of index === 0 ? [0] : [-7, 6]) {
        const osc = c.createOscillator()
        osc.type = index === 0 ? "sine" : "sawtooth"
        osc.frequency.value = midi(note)
        osc.detune.value = detune
        const level = c.createGain()
        level.gain.value = index === 0 ? .2 : .028
        osc.connect(level)
        level.connect(voice)
        osc.start(at)
        osc.stop(at + BAR + 3.6)
      }
    })
  }

  function bell(at: number, note: number) {
    const c = context!
    const level = c.createGain()
    level.gain.setValueAtTime(0, at)
    level.gain.linearRampToValueAtTime(.05, at + .015)
    level.gain.exponentialRampToValueAtTime(.0004, at + 3.2)
    level.connect(music)
    level.connect(echo)
    for (const [ratio, gain] of [[1, 1], [2.01, .22]]) {
      const osc = c.createOscillator()
      osc.type = "sine"
      osc.frequency.value = midi(note) * ratio
      const part = c.createGain()
      part.gain.value = gain
      osc.connect(part)
      part.connect(level)
      osc.start(at)
      osc.stop(at + 3.3)
    }
  }

  function schedule() {
    if (!context || element) return
    const now = context.currentTime
    if (nextBar < now) nextBar = now + .1
    while (nextBar < now + 2.5) {
      pad(nextBar, CHORDS[bar++ % CHORDS.length])
      nextBar += BAR
    }
    if (nextBell < now) nextBell = now + 3
    while (nextBell < now + 2.5) {
      bell(nextBell, BELLS[Math.floor(Math.random() * BELLS.length)])
      nextBell += 2.4 + Math.random() * 4.2
    }
  }

  function breathe() {
    if (!context || !wind || !windBand) return
    const level = reading ? .16 : air
    wind.gain.setTargetAtTime(.02 + .13 * level, context.currentTime, .35)
    windBand.frequency.setTargetAtTime(340 + 620 * level, context.currentTime, .5)
  }

  /** A burst of filtered noise: the grit in a step, the cloth in a vault. */
  function burst(
    at: number,
    length: number,
    type: BiquadFilterType,
    from: number,
    to: number,
    level: number,
    attack = .004,
  ) {
    const c = context!
    const source = c.createBufferSource()
    source.buffer = noise!
    const filter = c.createBiquadFilter()
    filter.type = type
    filter.Q.value = type === "bandpass" ? 1.1 : .5
    filter.frequency.setValueAtTime(from, at)
    filter.frequency.exponentialRampToValueAtTime(to, at + length)
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(level, at + attack)
    gain.gain.exponentialRampToValueAtTime(.0005, at + length)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    source.start(at, Math.random() * .3)
    source.stop(at + length + .02)
  }

  /** The weight of the body arriving: a short falling tone. */
  function thump(at: number, from: number, to: number, length: number, level: number) {
    const c = context!
    const osc = c.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(from, at)
    osc.frequency.exponentialRampToValueAtTime(to, at + length)
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(level, at + .006)
    gain.gain.exponentialRampToValueAtTime(.0005, at + length)
    osc.connect(gain)
    gain.connect(master)
    osc.start(at)
    osc.stop(at + length + .02)
  }

  function footstep(at: number, weight = 1) {
    const vary = .85 + Math.random() * .3
    thump(at, 105 * vary, 58, .07, .1 * weight)
    burst(at, .06, "lowpass", 1500 * vary, 500, .09 * weight)
    burst(at + .004, .025, "highpass", 2600, 3400, .028 * weight)
  }

  function apply() {
    if (!context) return
    const now = context.currentTime
    master.gain.setTargetAtTime(enabled ? .85 : 0, now, enabled ? .5 : .08)
    // While the film is stopped the score sits back, as if heard through a wall.
    // A recorded track is softened less, since most of a visit is spent reading.
    tone.frequency.setTargetAtTime(reading ? (element ? 3400 : 1100) : 16000, now, .25)
    music.gain.setTargetAtTime(reading ? .38 : .55, now, .3)
    breathe()
    if (enabled) {
      void context.resume().catch(() => {})
      if (element) void element.play().catch(() => {})
      else if (!timer) {
        schedule()
        timer = window.setInterval(schedule, 1000)
      }
    } else {
      element?.pause()
      window.clearInterval(timer)
      timer = 0
    }
  }

  return {
    /** Call from a click or key press; browsers allow sound only after one. */
    unlock() {
      if (disposed || context) return
      build()
      apply()
    },
    setEnabled(next: boolean) {
      enabled = next
      apply()
    },
    /** The film is either moving or stopped at a chapter. */
    setReading(next: boolean) {
      reading = next
      apply()
    },
    /** Sounds that follow the runner: steps, the vault, the jump, the wind. */
    scene(
      event:
        | { kind: "step" | "vault" | "mount" | "takeoff" }
        | { kind: "land"; weight: number }
        | { kind: "air"; level: number },
    ) {
      if (event.kind === "air") {
        if (Math.abs(event.level - air) < .02) return
        air = event.level
        breathe()
        return
      }
      if (!context || !enabled || !noise || context.state !== "running") return
      const at = context.currentTime + .005
      if (event.kind === "step") footstep(at)
      else if (event.kind === "vault") {
        // Cloth rushing past, then the palm on the bench.
        burst(at, .34, "bandpass", 500, 1500, .06, .12)
        burst(at + .2, .05, "lowpass", 1800, 600, .1)
        thump(at + .2, 140, 70, .06, .07)
      } else if (event.kind === "mount") {
        footstep(at, 1.1)
        burst(at + .05, .16, "bandpass", 900, 2200, .045, .03)
        footstep(at + .3, .9)
      } else if (event.kind === "takeoff") {
        footstep(at, 1.35)
        burst(at + .02, .45, "bandpass", 420, 1900, .07, .2)
      } else if (event.kind === "land") {
        const weight = event.weight
        thump(at, 120, 42, .2, .26 * weight)
        burst(at, .14, "lowpass", 900, 260, .17 * weight)
        burst(at + .003, .04, "highpass", 2200, 3600, .05 * weight)
        if (weight > .8) footstep(at + .13, .7)
      }
    },
    /** A falling sweep as the film stops; a rising one as it starts again. */
    cue(kind: "stop" | "go") {
      if (!context || !enabled || !noise || context.state !== "running") return
      const c = context
      const at = c.currentTime + .01
      const stop = kind === "stop"
      const length = stop ? .42 : .34
      const source = c.createBufferSource()
      source.buffer = noise
      const band = c.createBiquadFilter()
      band.type = "bandpass"
      band.Q.value = 1.3
      band.frequency.setValueAtTime(stop ? 2600 : 320, at)
      band.frequency.exponentialRampToValueAtTime(stop ? 240 : 3200, at + length)
      const level = c.createGain()
      level.gain.setValueAtTime(0, at)
      level.gain.linearRampToValueAtTime(stop ? .05 : .06, at + (stop ? .03 : length * .8))
      level.gain.linearRampToValueAtTime(0, at + length)
      source.connect(band)
      band.connect(level)
      level.connect(master)
      source.start(at)
      source.stop(at + length + .02)
      const osc = c.createOscillator()
      osc.type = "sine"
      const body = c.createGain()
      if (stop) {
        osc.frequency.setValueAtTime(150, at + .05)
        osc.frequency.exponentialRampToValueAtTime(48, at + .4)
        body.gain.setValueAtTime(0, at + .05)
        body.gain.linearRampToValueAtTime(.11, at + .08)
        body.gain.exponentialRampToValueAtTime(.001, at + .5)
      } else {
        osc.frequency.setValueAtTime(70, at)
        osc.frequency.exponentialRampToValueAtTime(190, at + .3)
        body.gain.setValueAtTime(0, at)
        body.gain.linearRampToValueAtTime(.07, at + .22)
        body.gain.linearRampToValueAtTime(0, at + .34)
      }
      osc.connect(body)
      body.connect(master)
      osc.start(at)
      osc.stop(at + .55)
    },
    /** Largest sample currently leaving the mixer, for checking levels. */
    peak() {
      if (!meter) return 0
      const data = new Float32Array(meter.fftSize)
      meter.getFloatTimeDomainData(data)
      let peak = 0
      for (const value of data) peak = Math.max(peak, Math.abs(value))
      return peak
    },
    dispose() {
      disposed = true
      window.clearInterval(timer)
      element?.pause()
      void context?.close().catch(() => {})
      context = undefined
    },
  }
}
