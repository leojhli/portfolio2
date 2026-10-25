export type SoundCue = "hover" | "tap" | "typing" | "select"

// Separate timbres, envelopes and pitch contours make each action recognizable.
const cues: Record<SoundCue, {
  wave: OscillatorType
  start: number
  end: number
  length: number
  volume: number
}> = {
  hover: { wave: "sine", start: 1100, end: 800, length: 0.035, volume: 0.035 },
  tap: { wave: "triangle", start: 920, end: 180, length: 0.045, volume: 0.12 },
  typing: {
    wave: "square",
    start: 180,
    end: 105,
    length: 0.022,
    volume: 0.055,
  },
  select: { wave: "sine", start: 480, end: 1080, length: 0.105, volume: 0.14 },
}

/** Original synthesized UI cues. No downloads, autoplay, or music-player state. */
export function createInterfaceSounds(factory = () => new AudioContext()) {
  let context: AudioContext | null = null
  let enabled = true,
    disposed = false,
    lastHover = -Infinity
  const voices = new Set<{
    oscillator: OscillatorNode
    gain: GainNode
  }>()
  const stop = () => {
    for (const voice of voices) {
      voice.oscillator.onended = null
      voice.oscillator.stop()
      voice.oscillator.disconnect()
      voice.gain.disconnect()
    }
    voices.clear()
  }
  const tone = (cue: SoundCue) => {
    if (
      !context ||
      !enabled ||
      disposed ||
      context.state !== "running" ||
      voices.size >= 4
    )
      return
    const now = context.currentTime
    if (cue === "hover" && now - lastHover < 0.09) return
    if (cue === "hover") lastHover = now
    const oscillator = context.createOscillator(),
      gain = context.createGain()
    const { wave, start, end, length, volume } = cues[cue]
    oscillator.type = wave
    oscillator.frequency.setValueAtTime(start, now)
    oscillator.frequency.exponentialRampToValueAtTime(end, now + length)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(
      volume,
      now + (cue === "typing" ? 0.002 : 0.004),
    )
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length)
    oscillator.connect(gain)
    gain.connect(context.destination)
    const voice = { oscillator, gain }
    voices.add(voice)
    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
      voices.delete(voice)
    }
    oscillator.start(now)
    oscillator.stop(now + length + 0.01)
  }
  return {
    setEnabled(value: boolean) {
      enabled = value
      if (!value) stop()
    },
    play(cue: SoundCue, gesture = false) {
      if (!enabled || disposed) return
      try {
        if (!context) {
          if (!gesture) return
          context = factory()
        }
        if (context.state === "suspended") {
          if (gesture)
            void context
              .resume()
              .then(() => tone(cue))
              .catch(() => {})
          return
        }
        tone(cue)
      } catch {
        /* Audio unavailable: every interaction still works. */
      }
    },
    dispose() {
      disposed = true
      stop()
      if (context && context.state !== "closed")
        void context.close().catch(() => {})
    },
  }
}
