export type WalkRect = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}
export type WalkPoint = {
  x: number
  z: number
}
/** Circle against horizontal solid footprints, including wall/corner clearance. */
export function canStand(
  point: WalkPoint,
  solids: readonly WalkRect[],
  bounds: WalkRect,
  radius = 0.32,
) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return false
  if (
    point.x < bounds.minX + radius ||
    point.x > bounds.maxX - radius ||
    point.z < bounds.minZ + radius ||
    point.z > bounds.maxZ - radius
  )
    return false
  return !solids.some((rect) => {
    const x = Math.max(rect.minX, Math.min(rect.maxX, point.x))
    const z = Math.max(rect.minZ, Math.min(rect.maxZ, point.z))
    return (point.x - x) ** 2 + (point.z - z) ** 2 < radius * radius - 1e-10
  })
}
/** Small collision steps prevent tunnelling; separate axes let the player slide along walls. */
export function moveWalker(
  point: WalkPoint,
  dx: number,
  dz: number,
  solids: readonly WalkRect[],
  bounds: WalkRect,
  radius = 0.32,
): WalkPoint {
  if (![point.x, point.z, dx, dz].every(Number.isFinite)) return { ...point }
  const distance = Math.hypot(dx, dz)
  if (!distance) return { ...point }
  const steps = Math.ceil(distance / (radius * 0.45))
  if (steps > 2048) return { ...point }
  let x = point.x,
    z = point.z
  const slide = (axis: "x" | "z", delta: number) => {
    const candidate = { x, z, [axis]: (axis === "x" ? x : z) + delta }
    if (canStand(candidate, solids, bounds, radius)) return candidate[axis]
    let low = 0,
      high = 1
    for (let i = 0; i < 10; i++) {
      const mid = (low + high) / 2
      candidate[axis] = (axis === "x" ? x : z) + delta * mid
      if (canStand(candidate, solids, bounds, radius)) low = mid
      else high = mid
    }
    return (axis === "x" ? x : z) + delta * low
  }
  for (let i = 0; i < steps; i++) {
    x = slide("x", dx / steps)
    z = slide("z", dz / steps)
  }
  return { x, z }
}
