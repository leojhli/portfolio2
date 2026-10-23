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

export function farthestCorner(p: Point, width: number, height: number) {
  return Math.hypot(Math.max(p.x, width - p.x), Math.max(p.y, height - p.y))
}

export function rippleAt(age: number, reach: number, duration = 900) {
  const p = clamp(age / duration)
  return { radius: reach * (1 - (1 - p) ** 2), alpha: (1 - p) ** 1.4 }
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

export function dustAt(
  origin: Point,
  direction: Point,
  progress: number,
): Point {
  const p = clamp(progress)
  const lift = Math.sin(Math.PI * p) * 22
  return { x: origin.x + direction.x * lift, y: origin.y + direction.y * lift }
}

export function particleBudget(width: number, height: number, coarse: boolean) {
  return Math.round(clamp((width * height) / 850, 180, coarse ? 480 : 1100))
}
