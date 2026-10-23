import { clamp, noise, smooth } from "./geometry"

export type ScreenVariant = "scan" | "diagonal" | "dissolve"
export const SCREEN_VARIANTS: readonly ScreenVariant[] = [
  "scan",
  "diagonal",
  "dissolve",
]

const progressOf = (progress: number) =>
  Number.isFinite(progress) ? clamp(progress) : 0

export function screenVariant(index: number): ScreenVariant {
  return SCREEN_VARIANTS[Math.abs(Math.trunc(index)) % SCREEN_VARIANTS.length]
}

/** Nearest-neighbour resolution steps: crisp 2px -> clear 8px mosaic -> 2px. */
export function screenPixelSize(progress: number) {
  const p = progressOf(progress)
  return Math.max(2, Math.min(8, Math.round(2 + Math.sin(Math.PI * p) * 6)))
}

/** The overlay covers every pixel until the final handoff to live HTML. */
export function screenOpacity(progress: number) {
  return 1 - smooth((progressOf(progress) - 0.86) / 0.14)
}

export function screenTileOrder(
  index: number,
  column: number,
  row: number,
  columns: number,
  rows: number,
  variant: ScreenVariant,
) {
  const x = column / Math.max(1, columns - 1)
  const y = row / Math.max(1, rows - 1)
  const random = noise(index * 2.71 + 0.37)
  if (variant === "dissolve") return random
  if (variant === "diagonal") return clamp((x + y) * 0.42 + random * 0.16)
  return clamp(x * 0.78 + y * 0.06 + random * 0.16)
}

/** Tiles replace pixels rather than blending two images into a blurry frame. */
export function screenTileReveal(progress: number, order: number) {
  return smooth((progressOf(progress) - (0.08 + clamp(order) * 0.56)) / 0.22)
}
