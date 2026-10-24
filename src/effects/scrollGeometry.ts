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
