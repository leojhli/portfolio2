export const clampScroll = (value: number, maximum: number) =>
  Math.max(0, Math.min(maximum, Number.isFinite(value) ? value : 0))

/** Exact exponential damping: the same feel at 60Hz and 120Hz. */
export function scrollStep(current: number, target: number, seconds: number) {
  const dt = Math.max(0, Math.min(0.05, seconds))
  const next = current + (target - current) * (1 - Math.exp(-dt / 0.065))
  return Math.abs(next - target) < 0.15 ? target : next
}

/** Visual depth is scroll-linked, bounded, and independent of page text. */
export function depthOffset(
  panel: number,
  scroll: number,
  width: number,
  depth: number,
) {
  if (width <= 0) return 0
  const distance = Math.max(-1.5, Math.min(1.5, panel - scroll / width))
  if (distance === 0) return 0
  return Math.max(-54, Math.min(54, -distance * width * depth))
}

/** Reversible choreography, driven only by scroll distance (never a timer). */
export function scrollReveal(distance: number, order: number, artwork = false) {
  const stagger = Math.min(Math.max(order, 0), 4) * 0.035
  const t = Math.max(
    0,
    Math.min(1, (0.98 - Math.abs(distance) - stagger) / 0.72),
  )
  const visibility = t * t * (3 - 2 * t)
  const hidden = 1 - visibility
  return {
    opacity: 0.16 + 0.84 * visibility,
    y: hidden * (distance >= 0 ? (artwork ? 64 : 32) : artwork ? -28 : -14),
    scale: artwork ? 1 - hidden * 0.055 : 1,
  }
}
