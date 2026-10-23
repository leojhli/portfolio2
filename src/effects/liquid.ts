import { clamp, smooth, type Point } from "./geometry"
import {
  constrainLiquid,
  LIQUID_FREQUENCY,
  LIQUID_INFLUENCE,
  LIQUID_RADIUS,
  liquidTarget,
  stepLiquid,
  type LiquidParticle,
} from "./liquidGeometry"
import type { Fragment } from "./snapshot"

export const LIQUID_CAPACITY = 24000
const ENGAGE_MS = 120
const GLYPHS = "+*:#=%@"

type Cell = {
  source: Fragment
  state: LiquidParticle
  target: Point
  steering: Point
  cover: string
  born: number
}

// A spring aimed across an obstacle would press into the same side forever.
// Give it a short waypoint along the nearest arc until its real target is in
// clear view. Exact opposite sides consistently choose the same arc direction.
function waypoint(
  state: Point,
  target: Point,
  pointer: Point | null,
  radius: number,
  out: Point,
): Point {
  if (!pointer || radius <= 0) return target
  const ax = state.x - pointer.x,
    ay = state.y - pointer.y,
    bx = target.x - pointer.x,
    by = target.y - pointer.y,
    dx = bx - ax,
    dy = by - ay,
    lengthSq = dx * dx + dy * dy
  if (lengthSq < 0.0001) return target
  const t = clamp(-(ax * dx + ay * dy) / lengthSq)
  if (Math.hypot(ax + dx * t, ay + dy * t) >= radius - 0.0001) return target
  const angle = Math.atan2(ax * by - ay * bx, ax * bx + ay * by)
  if (Math.abs(angle) < 0.02) return target
  const heading = Math.atan2(ay, ax) + clamp(angle, -0.4, 0.4),
    reach = Math.max(radius + 4, Math.min(Math.hypot(ax, ay), radius + 10))
  out.x = pointer.x + Math.cos(heading) * reach
  out.y = pointer.y + Math.sin(heading) * reach
  return out
}

/** A persistent local field; frame age never re-emits or pulses its pixels. */
export function createLiquidField() {
  const cells = new Map<string, Cell>(),
    displaced: Cell[] = []
  let pointer: Point | null = null,
    centre: LiquidParticle | null = null,
    engagedAt = 0,
    lastPaint: number | null = null

  function setPointer(point: Point | null, now: number) {
    // A sleeping field retains its last painted pixels. New input starts a new
    // frame interval instead of integrating the entire idle time as movement.
    if (lastPaint !== null && now - lastPaint > 50) lastPaint = now
    if (!point) {
      pointer = null
      centre = null
      return
    }
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return
    if (!pointer) {
      engagedAt = now
      centre = { ...point, vx: 0, vy: 0 }
      pointer = { ...point }
    } else {
      pointer.x = point.x
      pointer.y = point.y
    }
  }

  function add(
    samples: readonly Fragment[],
    cover: string,
    now: number,
    refresh = false,
  ) {
    if (!pointer) return
    for (const source of samples) {
      if (
        !Number.isFinite(source.x) ||
        !Number.isFinite(source.y) ||
        !Number.isFinite(source.size) ||
        source.size <= 0 ||
        Math.hypot(source.x - pointer.x, source.y - pointer.y) >=
          LIQUID_INFLUENCE
      )
        continue
      const key = `${Math.round(source.x / source.size)}:${Math.round(source.y / source.size)}:${source.size}`
      const existing = cells.get(key)
      if (existing) {
        if (refresh) {
          existing.source.color = source.color
          existing.source.alpha = source.alpha
          existing.cover = cover
        }
        continue
      }
      if (source.alpha !== undefined && source.alpha <= 0) continue
      if (cells.size >= LIQUID_CAPACITY) continue
      cells.set(key, {
        source: { ...source },
        state: { x: source.x, y: source.y, vx: 0, vy: 0 },
        target: { x: source.x, y: source.y },
        steering: { x: source.x, y: source.y },
        cover,
        born: now,
      })
    }
  }

  /** Paint after the owner clears its canvas; false means this image can rest. */
  function paint(ctx: CanvasRenderingContext2D, now: number, ascii = false) {
    const dt = lastPaint === null ? 0 : Math.max(0, (now - lastPaint) / 1000)
    lastPaint = now
    let moving = false
    if (pointer && centre) {
      stepLiquid(centre, pointer, dt, 40, centre)
      moving =
        centre.x !== pointer.x ||
        centre.y !== pointer.y ||
        centre.vx !== 0 ||
        centre.vy !== 0
    }
    const active = pointer ? centre : null
    const engagement = active ? smooth((now - engagedAt) / ENGAGE_MS) : 0
    displaced.length = 0
    cells.forEach((cell, key) => {
      const localEngagement = active ? smooth((now - cell.born) / ENGAGE_MS) : 0
      const radius = LIQUID_RADIUS * Math.min(engagement, localEngagement)
      const target = liquidTarget(
        cell.source,
        active,
        radius,
        LIQUID_INFLUENCE,
        cell.target,
      )
      const current = constrainLiquid(cell.state, active, radius, cell.state)
      stepLiquid(
        current,
        waypoint(current, target, active, radius, cell.steering),
        dt,
        LIQUID_FREQUENCY,
        current,
      )
      constrainLiquid(current, active, radius, current)
      const settled =
        cell.state.x === target.x &&
        cell.state.y === target.y &&
        cell.state.vx === 0 &&
        cell.state.vy === 0
      const affected =
        active &&
        Math.hypot(cell.source.x - active.x, cell.source.y - active.y) <
          LIQUID_INFLUENCE
      if (!affected && settled) {
        cells.delete(key)
        return
      }
      if (!settled || (affected && radius < LIQUID_RADIUS)) moving = true
      if (
        Math.hypot(cell.state.x - cell.source.x, cell.state.y - cell.source.y) >
        0.08
      )
        displaced.push(cell)
    })

    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.globalAlpha = 1
    // Erase only occupied source cells. All masks precede all moved pixels so
    // neighbouring cells cannot erase another cell's displaced foreground.
    for (const cell of displaced) {
      const source = cell.source,
        half = source.size / 2
      ctx.fillStyle = cell.cover
      ctx.fillRect(source.x - half, source.y - half, source.size, source.size)
    }
    if (ascii) {
      ctx.font = '5px "Geist Mono", monospace'
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
    }
    for (const cell of displaced) {
      const source = cell.source,
        x = Math.round(cell.state.x * 2) / 2,
        y = Math.round(cell.state.y * 2) / 2
      ctx.globalAlpha = clamp(source.alpha ?? 1)
      ctx.fillStyle = source.color
      if (ascii) {
        const glyph =
          Math.abs(Math.round(source.x * 3 + source.y * 7)) % GLYPHS.length
        ctx.fillText(GLYPHS[glyph], x, y)
      } else {
        const size = Math.min(2, source.size)
        ctx.fillRect(x - size / 2, y - size / 2, size, size)
      }
    }
    ctx.restore()
    return cells.size > 0 && moving
  }

  function clear() {
    cells.clear()
    displaced.length = 0
    pointer = null
    centre = null
    engagedAt = 0
    lastPaint = null
  }

  return { setPointer, add, paint, clear, size: () => cells.size }
}
