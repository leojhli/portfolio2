export const CLOISTER_SEGMENT_DURATIONS = [3.15, 2.3, 2.8, 4.7, 5] as const
export const CLOISTER_SEGMENT_STARTS = [0, 3.15, 5.45, 8.25, 12.95] as const
export const CLOISTER_MAX_FRAME_DELTA = 0.05

export type CloisterPhase = "loading" | "playing" | "paused" | "reading" | "aerial" | "fallback"

export type CloisterTimelineSample = {
  segment: number
  time: number
  progress: number
  completed: boolean
}

/** A shot clock independent of renderer time, camera paths and animation assets. */
export class CloisterTimeline {
  private readonly durations: readonly number[]
  private phase: CloisterPhase = "loading"
  private segment = 0
  private revision = 0
  private elapsed = 0
  private completionEmitted = false
  private disposed = false

  constructor(durations: readonly number[] = CLOISTER_SEGMENT_DURATIONS) {
    if (
      durations.length !== CLOISTER_SEGMENT_DURATIONS.length ||
      durations.some((duration) => !Number.isFinite(duration) || duration <= 0)
    )
      throw new RangeError("The cloister requires five positive shot durations")
    this.durations = [...durations]
  }

  get time() {
    return this.elapsed
  }

  configure(phase: CloisterPhase, segment: number, revision: number) {
    if (this.disposed) return
    if (
      !Number.isInteger(segment) ||
      segment < 0 ||
      segment >= this.durations.length
    )
      throw new RangeError("Unknown cloister segment")
    if (!Number.isFinite(revision))
      throw new RangeError("A replay revision must be finite")

    if (segment !== this.segment || revision !== this.revision) {
      this.segment = segment
      this.revision = revision
      this.elapsed = 0
      this.completionEmitted = false
    }
    this.phase = phase
    // Chapter navigation is a seek to its composed reading pose, not playback.
    if (phase === "reading" || phase === "aerial") {
      this.elapsed = this.durations[this.segment]
      this.completionEmitted = true
    }
  }

  /** Returns the segment once on completion; the caller chooses the next state. */
  advance(dt: number): number | null {
    if (
      this.disposed ||
      this.phase !== "playing" ||
      this.completionEmitted ||
      !Number.isFinite(dt) ||
      dt <= 0
    )
      return null
    const duration = this.durations[this.segment]
    const next = this.elapsed + Math.min(dt, CLOISTER_MAX_FRAME_DELTA)
    // Snap accumulated floating-point error at the exact authored endpoint.
    this.elapsed = next >= duration - 1e-9 ? duration : next
    if (this.elapsed < duration) return null
    this.completionEmitted = true
    return this.segment
  }

  sample(): CloisterTimelineSample {
    const duration = this.durations[this.segment]
    return {
      segment: this.segment,
      time: this.elapsed,
      progress: this.elapsed / duration,
      completed: this.elapsed === duration,
    }
  }

  dispose() {
    this.disposed = true
  }
}
