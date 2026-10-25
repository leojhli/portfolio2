export type SoundCue = "hover" | "tap" | "select"

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
    const length = cue === "hover" ? 0.035 : cue === "tap" ? 0.065 : 0.11
    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(
      cue === "hover" ? 1100 : cue === "tap" ? 740 : 520,
      now,
    )
    oscillator.frequency.exponentialRampToValueAtTime(
      cue === "select" ? 880 : 340,
      now + length,
    )
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(
      cue === "hover" ? 0.012 : 0.035,
      now + 0.004,
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
