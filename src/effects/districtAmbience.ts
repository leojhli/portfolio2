/** Original rain, ventilation and distant rail hum. No sampled music. */
export function playDistrictAmbience() {
  let context: AudioContext | undefined
  const sources: AudioScheduledSourceNode[] = []
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    for (const source of sources) {
      try {
        source.stop()
      } catch {
        /* Already stopped. */
      }
    }
    if (context && context.state !== "closed")
      void context.close().catch(() => {})
  }
  try {
    context = new AudioContext()
    const ctx = context
    void ctx.resume().catch(stop)
    const master = ctx.createGain()
    master.gain.setValueAtTime(0, ctx.currentTime)
    master.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 1.2)
    master.connect(ctx.destination)
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
    const samples = buffer.getChannelData(0)
    let seed = 71
    for (let i = 0; i < samples.length; i++) {
      seed = (seed * 16807) % 2147483647
      samples[i] = seed / 1073741823.5 - 1
    }
    const rain = ctx.createBufferSource()
    rain.buffer = buffer
    rain.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = 2100
    const level = ctx.createGain()
    level.gain.value = 0.2
    rain.connect(filter).connect(level).connect(master)
    rain.start()
    sources.push(rain)
    for (const frequency of [55, 82.4]) {
      const hum = ctx.createOscillator()
      const volume = ctx.createGain()
      hum.frequency.value = frequency
      volume.gain.value = 0.035
      hum.connect(volume).connect(master)
      hum.start()
      sources.push(hum)
    }
  } catch {
    stop()
  }
  return stop
}
