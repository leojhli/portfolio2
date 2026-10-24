import { clamp } from "./geometry"
import {
  createFlowBand,
  screenFlowAt,
  screenOpacity,
  type ScreenVariant,
} from "./screenGeometry"

type ScreenOptions = {
  width: number
  height: number
  ascii?: boolean
  variant?: ScreenVariant
  direction?: 1 | -1
}

type MosaicPair = {
  from: HTMLCanvasElement
  into: HTMLCanvasElement
}

export type ScreenTransition = {
  composited?: boolean
  paint(ctx: CanvasRenderingContext2D, progress: number): void
  dispose(): void
}

/**
 * Liquid fronts carry fine pixels from one viewport into the next. Fixed,
 * opaque destination strips prevent cracks; source-coordinate advection bends
 * both images near their shared boundary. No blur, DOM reads or frame buffers
 * are allocated during paint. This is the lightweight fallback when WebGL is
 * unavailable; the normal path renders a single fullscreen GPU triangle.
 */
export function createScreenTransition(
  fromRaster: HTMLCanvasElement,
  intoRaster: HTMLCanvasElement,
  options: ScreenOptions,
): ScreenTransition {
  const width = Math.max(1, Math.ceil(options.width)),
    height = Math.max(1, Math.ceil(options.height)),
    variant = options.variant ?? "spill",
    direction = options.direction ?? 1,
    vertical = variant === "pour",
    length = vertical ? height : width,
    cross = vertical ? width : height,
    bandSize = Math.max(2, Math.ceil(cross / 96 / 2) * 2),
    reach = Math.max(2, Math.round(Math.min(64, length * 0.065) / 2) * 2),
    strength = Math.min(38, Math.min(width, height) * 0.045),
    flow = createFlowBand(),
    buffers: HTMLCanvasElement[] = []
  let pair: MosaicPair
  let disposed = false

  const mosaic = (source: HTMLCanvasElement, pixelSize: number) => {
    const buffer = source.ownerDocument.createElement("canvas")
    buffers.push(buffer)
    buffer.width = Math.max(1, Math.ceil(width / pixelSize))
    buffer.height = Math.max(1, Math.ceil(height / pixelSize))
    const ctx = buffer.getContext("2d")
    if (!ctx) throw new Error("Screen mosaic canvas is unavailable")
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      source,
      0,
      0,
      source.width,
      source.height,
      0,
      0,
      buffer.width,
      buffer.height,
    )
    return buffer
  }

  try {
    pair = {
      from: mosaic(fromRaster, 2),
      into: mosaic(intoRaster, 2),
    }
  } catch (error) {
    buffers.forEach((buffer) => {
      buffer.width = buffer.height = 0
    })
    buffers.length = 0
    throw error
  }

  const blit = (
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement,
    along: number,
    across: number,
    extent: number,
    thickness: number,
    dx = 0,
    dy = 0,
  ) => {
    if (extent <= 0) return
    const x = vertical ? across : along,
      y = vertical ? along : across,
      w = vertical ? thickness : extent,
      h = vertical ? extent : thickness
    // Clamping the sample origin, rather than clipping its destination, keeps
    // full opaque coverage even when the flow meets a viewport edge.
    ctx.drawImage(
      source,
      (clamp(x + dx, 0, width - w) / width) * source.width,
      (clamp(y + dy, 0, height - h) / height) * source.height,
      (w / width) * source.width,
      (h / height) * source.height,
      x,
      y,
      w,
      h,
    )
  }

  // The fallback uses one sample per edge; the GPU path evaluates every pixel.
  const edge = (
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement,
    start: number,
    end: number,
    at: number,
    across: number,
    thickness: number,
    phase: number,
  ) => {
    const steps = 1,
      step = Math.max(2, Math.ceil((end - start) / steps / 2) * 2)
    for (let a = start; a < end; a += step) {
      const b = Math.min(end, a + step),
        distance = Math.abs((a + b) / 2 - at),
        weight = Math.pow(Math.max(0, 1 - distance / reach), 2) * phase
      blit(
        ctx,
        source,
        a,
        across,
        b - a,
        thickness,
        flow.dx * strength * weight,
        flow.dy * strength * weight,
      )
    }
  }

  return {
    paint(ctx, progress) {
      if (disposed) return
      const p = Number.isFinite(progress) ? clamp(progress) : 0,
        alpha = screenOpacity(p)
      if (!alpha) return
      ctx.save()
      ctx.imageSmoothingEnabled = false
      ctx.globalAlpha = alpha
      // Fade a single settled incoming raster; compositing both would ghost.
      if (alpha < 1 || p >= 0.8) {
        ctx.drawImage(pair.into, 0, 0, width, height)
        ctx.restore()
        return
      }

      // This synchronous base masks the entire moving deck, header and footer.
      ctx.drawImage(pair.from, 0, 0, width, height)
      for (let across = 0; across < cross; across += bandSize) {
        const thickness = Math.min(bandSize, cross - across)
        screenFlowAt(
          (across + thickness / 2) / cross,
          p,
          variant,
          direction,
          flow,
        )
        for (let i = 0; i < flow.count; i++) {
          const start = Math.max(
              0,
              Math.floor((flow.starts[i] * length) / 2) * 2,
            ),
            end = Math.min(length, Math.ceil((flow.ends[i] * length) / 2) * 2),
            left = i ? Math.ceil((flow.ends[i - 1] * length) / 2) * 2 : 0,
            right =
              i + 1 < flow.count
                ? Math.floor((flow.starts[i + 1] * length) / 2) * 2
                : length,
            innerLeft = start > 0 ? Math.min(end, start + reach) : start,
            innerRight = end < length ? Math.max(innerLeft, end - reach) : end

          // The outgoing side is pulled along the interface. The arriving side
          // follows the same current with a shorter trailing displacement.
          if (start > 0)
            edge(
              ctx,
              pair.from,
              Math.max(left, start - reach),
              start,
              start,
              across,
              thickness,
              1,
            )
          if (end < length)
            edge(
              ctx,
              pair.from,
              end,
              Math.min(right, end + reach),
              end,
              across,
              thickness,
              1,
            )
          edge(
            ctx,
            pair.into,
            start,
            innerLeft,
            start,
            across,
            thickness,
            -0.65,
          )
          blit(
            ctx,
            pair.into,
            innerLeft,
            across,
            innerRight - innerLeft,
            thickness,
          )
          edge(ctx, pair.into, innerRight, end, end, across, thickness, -0.65)

          if (
            options.ascii &&
            across % (bandSize * 8) === 0 &&
            end - start > 12 &&
            end < length
          ) {
            ctx.globalAlpha = 0.16
            ctx.font = '600 7px "Geist Mono", monospace'
            ctx.fillStyle = "#ffffff"
            ctx.fillText(
              variant === "pools" ? ":" : "+",
              vertical ? across : end,
              vertical ? end : across,
            )
            ctx.globalAlpha = 1
          }
        }
      }
      ctx.restore()
    },
    dispose() {
      if (disposed) return
      disposed = true
      buffers.forEach((buffer) => {
        buffer.width = buffer.height = 0
      })
      buffers.length = 0
    },
  }
}
