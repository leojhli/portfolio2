/** Original sword slash, spatial tear and crossing rush; no sampled anime audio. */
export function playGargantaSound() {
  let context: AudioContext | null = null
  let timer = 0
  const sources: AudioScheduledSourceNode[] = []
  const stop = () => {
    clearTimeout(timer)
    sources.forEach((source) => {
      try {
        source.stop()
      } catch {
        /* already ended */
      }
    })
    if (context && context.state !== "closed")
      void context.close().catch(() => {})
  }
  try {
    context = new AudioContext()
    const ctx = context
    void ctx.resume().catch(() => {})
    const master = ctx.createGain()
    master.gain.value = 0.48
    master.connect(ctx.destination)
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let seed = 17
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 16807) % 2147483647
      data[i] = (seed / 2147483647) * 2 - 1
    }
    const noise = (
      delay: number,
      length: number,
      from: number,
      to: number,
      volume: number,
    ) => {
      const source = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter(),
        gain = ctx.createGain(),
        t = ctx.currentTime + delay
      source.buffer = buffer
      source.loop = true
      filter.type = "bandpass"
      filter.Q.value = 0.8
      filter.frequency.setValueAtTime(from, t)
      filter.frequency.exponentialRampToValueAtTime(to, t + length)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(volume, t + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      source.start(t)
      source.stop(t + length + 0.03)
      sources.push(source)
    }
    noise(0, 0.2, 7200, 1100, 0.7) // the sword cuts
    noise(0.16, 1.25, 1800, 100, 0.5) // the seam tears open
    noise(1.1, 1.15, 220, 3400, 0.42) // pass through the aperture
    const bass = ctx.createOscillator(),
      gain = ctx.createGain(),
      t = ctx.currentTime
    bass.type = "sine"
    bass.frequency.setValueAtTime(78, t)
    bass.frequency.exponentialRampToValueAtTime(32, t + 2.2)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.28, t + 0.12)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.3)
    bass.connect(gain)
    gain.connect(master)
    bass.start(t)
    bass.stop(t + 2.4)
    sources.push(bass)
    timer = window.setTimeout(stop, 2800)
  } catch {
    stop()
  }
  return stop
}
