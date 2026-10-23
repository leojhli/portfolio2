export type Point = {
  x: number
  y: number
}

export const clamp = (n: number, lo = 0, hi = 1) =>
  Math.max(lo, Math.min(hi, n))
export const smooth = (n: number) => {
  const p = clamp(n)
  return p * p * (3 - 2 * p)
}

/** Stable per-fragment variation; no random jitter between frames. */
export const noise = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Scatter, curved travel, then settle exactly onto the destination silhouette. */
export function assemblyAt(
  from: Point,
  to: Point,
  progress: number,
  seed: number,
): Point {
  const p = clamp(progress)
  const travel = smooth((p - 0.13) / 0.77)
  const envelope = Math.sin(Math.PI * p)
  const angle = seed * Math.PI * 2 + p * Math.PI * 1.8
  const reach = Math.min(
    150,
    28 + Math.hypot(to.x - from.x, to.y - from.y) * 0.16,
  )
  return {
    x: from.x + (to.x - from.x) * travel + Math.cos(angle) * envelope * reach,
    y:
      from.y +
      (to.y - from.y) * travel +
      Math.sin(angle) * envelope * reach * 0.65,
  }
}

export function particleBudget(width: number, height: number, coarse: boolean) {
  return Math.round(clamp((width * height) / 40, 1600, coarse ? 12000 : 36000))
}
