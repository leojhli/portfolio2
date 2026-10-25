export const clampScroll = (value: number, maximum: number) =>
  Math.max(0, Math.min(maximum, Number.isFinite(value) ? value : 0))

export const railPosition = (scroll: number, top: number, travel: number) =>
  clampScroll(scroll - top, Math.max(0, travel))
export const revealProgress = (progress: number) => {
  const t = clampScroll(progress, 1)
  return t * t * (3 - 2 * t)
}
