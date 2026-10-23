import { clamp, smooth } from "./geometry"

export type ScreenVariant = "spill" | "pools" | "counterflow" | "pour" | "split" | "drain"
export const SCREEN_VARIANTS: readonly ScreenVariant[] = [
  "spill",
  "pools",
  "counterflow",
  "pour",
  "split",
  "drain",
]

export type FlowBand = {
  starts: Float64Array
  ends: Float64Array
  count: number
  dx: number
  dy: number
}

const progressOf = (progress: number) =>
  Number.isFinite(progress) ? clamp(progress) : 0

export function screenVariant(index: number): ScreenVariant {
  const i = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0
  return SCREEN_VARIANTS[i % SCREEN_VARIANTS.length]
}

/** Fine, sharp cells throughout; the incoming image is back to 2px before handoff. */
export function screenPixelSize(progress: number) {
  return (
    2 + Math.round(Math.sin(Math.PI * clamp(progressOf(progress) / 0.82)) * 2)
  )
}

/** 900ms navigation stays opaque beyond the underlying 700ms deck slide. */
export function screenOpacity(progress: number) {
  return 1 - smooth((progressOf(progress) - 0.86) / 0.14)
}

export function createFlowBand(): FlowBand {
  return {
    starts: new Float64Array(3),
    ends: new Float64Array(3),
    count: 0,
    dx: 0,
    dy: 0,
  }
}

function addSpan(out: FlowBand, start: number, end: number) {
  const lo = clamp(start),
    hi = clamp(end)
  if (hi <= lo) return
  const index = out.count++
  out.starts[index] = lo
  out.ends[index] = hi
}

/** Sort and coalesce the three pool cross-sections without allocating per frame. */
function mergeSpans(out: FlowBand) {
  for (let i = 1; i < out.count; i++) {
    let j = i
    while (j > 0 && out.starts[j] < out.starts[j - 1]) {
      const start = out.starts[j],
        end = out.ends[j]
      out.starts[j] = out.starts[j - 1]
      out.ends[j] = out.ends[j - 1]
      out.starts[--j] = start
      out.ends[j] = end
    }
  }
  let count = 0
  for (let i = 0; i < out.count; i++) {
    if (count && out.starts[i] <= out.ends[count - 1]) {
      out.ends[count - 1] = Math.max(out.ends[count - 1], out.ends[i])
    } else {
      out.starts[count] = out.starts[i]
      out.ends[count++] = out.ends[i]
    }
  }
  out.count = count
}

/**
 * A continuous liquid mask, sampled along horizontal bands (vertical for pour).
 * Spans describe fixed destination coverage; dx/dy advect source colors only.
 * Reusing out keeps animation frames allocation-free. All shapes are complete
 * and their flow is at rest before the final opaque frame at p=.86.
 */
export function screenFlowAt(
  position: number,
  progress: number,
  variant: ScreenVariant,
  direction: 1 | -1,
  out: FlowBand,
) {
  const s = progressOf(position),
    p = progressOf(progress),
    t = smooth((p - 0.035) / 0.765),
    envelope = Math.sin(Math.PI * t)
  out.count = 0
  out.dx = out.dy = 0
  if (t <= 0) return out
  if (t >= 1) {
    addSpan(out, 0, 1)
    return out
  }

  if (variant === "spill") {
    const front =
      t * 1.28 -
      0.14 +
      envelope *
        (0.075 * Math.sin(s * 8.5 + t * 2) + 0.03 * Math.sin(s * 21 - t * 3))
    addSpan(out, 0, front)
    out.dx = (0.9 + 0.25 * Math.sin(s * 8 - t * 3)) * envelope
    out.dy = 0.4 * Math.cos(s * 9 + t * 2) * envelope
  } else if (variant === "pools") {
    // Offset seeds grow and join into one body, rather than emitting pulse rings.
    for (let i = 0; i < 3; i++) {
      const cx = i === 0 ? 0.17 : i === 1 ? 0.58 : 0.87,
        cy = i === 0 ? 0.28 : i === 1 ? 0.77 : 0.12,
        radius = Math.max(
          0,
          Math.pow(t, 1.4) * 0.78 -
            0.025 +
            envelope * 0.018 * Math.sin(s * 13 + i * 2),
        ),
        distance = (s - cy) * 0.8
      if (Math.abs(distance) >= radius) continue
      const reach = Math.sqrt(radius * radius - distance * distance)
      addSpan(out, cx - reach, cx + reach)
    }
    out.dx = Math.sin(s * 8 + t * 2) * envelope
    out.dy = Math.cos(s * 11 - t * 3) * envelope * 0.7
  } else if (variant === "counterflow") {
    const side = smooth((s - 0.2) / 0.6),
      bend = envelope * 0.045 * Math.sin(s * 12 - t * 2),
      travel = Math.pow(t, 1.5) * 1.4
    addSpan(out, 0, travel - 0.12 - side * 0.6 + bend)
    addSpan(out, 1 - (travel - 0.12 - (1 - side) * 0.6 - bend), 1)
    out.dx = Math.cos(s * Math.PI) * envelope * 1.2
    out.dy = Math.sin(s * 7 - t * 3) * envelope * 0.6
  } else if (variant === "pour") {
    // Long, uneven vertical fingers form a pour, distinct from the lateral spill.
    const front =
      t * 1.5 -
      0.25 +
      envelope *
        (0.14 * Math.sin(s * 13 + t * 2) + 0.055 * Math.sin(s * 29 - t * 2))
    addSpan(out, 0, front)
    out.dx = Math.sin(s * 12 + t * 3) * envelope * 0.55
    out.dy = (1 + 0.25 * Math.sin(s * 9 - t * 2)) * envelope
  } else if (variant === "split") {
    // A wandering seam opens into two separating liquid banks.
    const center = 0.5 + envelope * 0.09 * Math.sin(s * 8 + t * 2),
      opening = Math.max(0, t * 0.76 - 0.05)
    addSpan(out, center - opening, center + opening)
    out.dx = Math.sin(s * 6 - t * 2) * envelope * 0.9
    out.dy = Math.cos(s * 10 + t * 2) * envelope * 0.5
  } else {
    // The old page contracts into an off-center pocket as the new page surrounds it.
    const center = 0.58 + envelope * 0.04 * Math.sin(s * 9 + t * 2),
      radius = Math.max(
        0,
        (1 - t) * 1.28 - 0.02 + envelope * 0.025 * Math.sin(s * 15 + t * 3),
      ),
      distance = (s - 0.48) * 0.85
    if (Math.abs(distance) < radius) {
      const reach = Math.sqrt(radius * radius - distance * distance)
      addSpan(out, 0, center - reach)
      addSpan(out, center + reach, 1)
    } else addSpan(out, 0, 1)
    out.dx = Math.sin(s * 10 - t * 3) * envelope * 0.6
    out.dy = (0.48 - s) * envelope * 1.5
  }

  mergeSpans(out)
  const mirror = variant === "pour" ? direction === -1 : direction === 1
  if (mirror) {
    for (let i = 0; i < out.count; i++) {
      const start = out.starts[i]
      out.starts[i] = 1 - out.ends[i]
      out.ends[i] = 1 - start
    }
    // Mirroring reverses interval order; restore it for gap-free strip painting.
    for (let i = 0; i < Math.floor(out.count / 2); i++) {
      const j = out.count - i - 1,
        start = out.starts[i],
        end = out.ends[i]
      out.starts[i] = out.starts[j]
      out.ends[i] = out.ends[j]
      out.starts[j] = start
      out.ends[j] = end
    }
    if (variant === "pour") out.dy *= -1
    else out.dx *= -1
  }
  return out
}
