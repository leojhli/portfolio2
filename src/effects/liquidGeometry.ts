import { clamp, smooth, type Point } from "./geometry"

export const LIQUID_RADIUS = 48
export const LIQUID_INFLUENCE = 104
export const LIQUID_FREQUENCY = 22

export type LiquidPointer = Point & {
  /** Pointer velocity in CSS pixels per second. */
  vx?: number
  vy?: number
}

export type LiquidParticle = Point & {
  vx: number
  vy: number
}

function writePoint(x: number, y: number, out?: Point): Point {
  if (!out) return { x, y }
  out.x = x
  out.y = y
  return out
}

function writeParticle(
  x: number,
  y: number,
  vx: number,
  vy: number,
  out?: LiquidParticle,
): LiquidParticle {
  if (!out) return { x, y, vx, vy }
  out.x = x
  out.y = y
  out.vx = vx
  out.vy = vy
  return out
}

/**
 * A continuous displacement field around a circular cursor obstacle. Its target
 * depends only on the current pointer, never on an animation age or pulse phase.
 * At rest the field holds its shape, and outside its reach pixels stay at home.
 */
export function liquidTarget(
  home: Point,
  pointer: LiquidPointer | null,
  radius = LIQUID_RADIUS,
  influence = LIQUID_INFLUENCE,
  out?: Point,
): Point {
  if (!pointer || radius <= 0) return writePoint(home.x, home.y, out)
  const outer = Math.max(radius * 1.6, influence)
  const dx = home.x - pointer.x,
    dy = home.y - pointer.y,
    distance = Math.hypot(dx, dy)
  if (distance >= outer) return writePoint(home.x, home.y, out)

  // The centre has a fixed direction so even exact coordinate collisions remain
  // finite and deterministic. The spring smooths changes in radial direction.
  const nx = distance > 0.0001 ? dx / distance : 1,
    ny = distance > 0.0001 ? dy / distance : 0,
    falloff = 1 - smooth(distance / outer),
    radial = distance + radius * falloff,
    tx = -ny,
    ty = nx,
    vx = Number.isFinite(pointer.vx) ? (pointer.vx ?? 0) : 0,
    vy = Number.isFinite(pointer.vy) ? (pointer.vy ?? 0) : 0,
    flow = clamp((vx * tx + vy * ty) * 0.016, -12, 12) * falloff

  return writePoint(
    pointer.x + nx * radial + tx * flow,
    pointer.y + ny * radial + ty * flow,
    out,
  )
}

/**
 * Exact integration of a critically damped spring over dt seconds. A constant
 * target follows the same path at 30, 60 or 120 fps without oscillating. Reaching
 * the tiny rest threshold snaps exactly home and lets the renderer stop its RAF.
 */
export function stepLiquid(
  particle: LiquidParticle,
  target: Point,
  dt: number,
  frequency = LIQUID_FREQUENCY,
  out?: LiquidParticle,
): LiquidParticle {
  if (!Number.isFinite(dt) || dt <= 0)
    return writeParticle(particle.x, particle.y, particle.vx, particle.vy, out)
  const omega = Math.max(1, frequency),
    decay = Math.exp(-omega * dt),
    dx = particle.x - target.x,
    dy = particle.y - target.y,
    cx = particle.vx + omega * dx,
    cy = particle.vy + omega * dy,
    x = target.x + (dx + cx * dt) * decay,
    y = target.y + (dy + cy * dt) * decay,
    vx = (particle.vx - omega * cx * dt) * decay,
    vy = (particle.vy - omega * cy * dt) * decay

  if (
    Math.hypot(x - target.x, y - target.y) < 0.025 &&
    Math.hypot(vx, vy) < 0.1
  )
    return writeParticle(target.x, target.y, 0, 0, out)
  return writeParticle(x, y, vx, vy, out)
}

/** Keep travel around the cursor circle, including while the pointer moves. */
export function constrainLiquid(
  particle: LiquidParticle,
  pointer: Point | null,
  radius = LIQUID_RADIUS,
  out?: LiquidParticle,
): LiquidParticle {
  if (!pointer || radius <= 0)
    return writeParticle(particle.x, particle.y, particle.vx, particle.vy, out)
  const dx = particle.x - pointer.x,
    dy = particle.y - pointer.y,
    distance = Math.hypot(dx, dy)
  if (distance > radius)
    return writeParticle(particle.x, particle.y, particle.vx, particle.vy, out)
  const nx = distance > 0.0001 ? dx / distance : 1,
    ny = distance > 0.0001 ? dy / distance : 0,
    inward = Math.min(0, particle.vx * nx + particle.vy * ny)
  return writeParticle(
    pointer.x + nx * radius,
    pointer.y + ny * radius,
    particle.vx - nx * inward,
    particle.vy - ny * inward,
    out,
  )
}
