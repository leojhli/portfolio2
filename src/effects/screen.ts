import {
  screenOpacity,
  screenPixelSize,
  screenTileOrder,
  screenTileReveal,
  type ScreenVariant,
} from "./screenGeometry"

type ScreenOptions = {
  width: number
  height: number
  ascii?: boolean
  variant?: ScreenVariant
}

type Tile = {
  x: number
  y: number
  width: number
  height: number
  order: number
  reverse: boolean
}

type MosaicPair = {
  from: HTMLCanvasElement
  into: HTMLCanvasElement
}

export type ScreenTransition = {
  paint(ctx: CanvasRenderingContext2D, progress: number): void
  dispose(): void
}

/**
 * Full-screen, nearest-neighbour mosaic with ordered pixel replacement.
 * All DOM reads, allocations and raster resizing happen once, at creation.
 * paint() uses only cached buffers and tile geometry; no blur or SVG filters.
 */
export function createScreenTransition(
  fromRaster: HTMLCanvasElement,
  intoRaster: HTMLCanvasElement,
  options: ScreenOptions,
): ScreenTransition {
  const width = Math.max(1, Math.ceil(options.width))
  const height = Math.max(1, Math.ceil(options.height))
  const variant = options.variant ?? "scan"
  const mosaics = new Map<number, MosaicPair>()
  const buffers: HTMLCanvasElement[] = []
  let disposed = false

  const mosaic = (source: HTMLCanvasElement, pixelSize: number) => {
    const buffer = source.ownerDocument.createElement("canvas")
    buffers.push(buffer)
    buffer.width = Math.max(1, Math.ceil(width / pixelSize))
    buffer.height = Math.max(1, Math.ceil(height / pixelSize))
    const ctx = buffer.getContext("2d")
    if (!ctx) throw new Error("Screen mosaic canvas is unavailable")
    // Both downsampling and display use actual pixel colors, never interpolation.
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
    for (let size = 2; size <= 8; size++) {
      mosaics.set(size, {
        from: mosaic(fromRaster, size),
        into: mosaic(intoRaster, size),
      })
    }
  } catch (error) {
    buffers.forEach((buffer) => {
      buffer.width = buffer.height = 0
    })
    buffers.length = 0
    mosaics.clear()
    throw error
  }

  // Keep blit count bounded on large monitors. The image inside each tile still
  // has the independent, much finer 2–8px mosaic grid.
  const tileSize = Math.max(
    16,
    Math.ceil(Math.sqrt((width * height) / 2200) / 2) * 2,
  )
  const columns = Math.ceil(width / tileSize)
  const rows = Math.ceil(height / tileSize)
  const tiles: Tile[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column
      tiles.push({
        x: column * tileSize,
        y: row * tileSize,
        width: Math.min(tileSize, width - column * tileSize),
        height: Math.min(tileSize, height - row * tileSize),
        order: screenTileOrder(index, column, row, columns, rows, variant),
        reverse: variant === "dissolve" ? index % 2 === 0 : row % 2 === 0,
      })
    }
  }

  const blit = (
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    ctx.drawImage(
      source,
      (x / width) * source.width,
      (y / height) * source.height,
      (w / width) * source.width,
      (h / height) * source.height,
      x,
      y,
      w,
      h,
    )
  }

  return {
    paint(ctx, progress) {
      if (disposed) return
      const alpha = screenOpacity(progress)
      if (!alpha) return
      const pair = mosaics.get(screenPixelSize(progress))!
      ctx.save()
      ctx.imageSmoothingEnabled = false
      ctx.globalAlpha = alpha

      // Replacement is complete before the fade starts. Fade one composed
      // incoming frame, otherwise translucent outgoing tiles ghost underneath it.
      if (alpha < 1) {
        ctx.drawImage(pair.into, 0, 0, width, height)
        ctx.restore()
        return
      }

      // A complete outgoing raster is always underneath partially revealed
      // incoming tiles, so no part of the moving HTML escapes pixelation.
      ctx.drawImage(pair.from, 0, 0, width, height)
      for (const tile of tiles) {
        const reveal = screenTileReveal(progress, tile.order)
        if (reveal <= 0) continue
        if (reveal >= 1) {
          blit(ctx, pair.into, tile.x, tile.y, tile.width, tile.height)
          continue
        }
        if (variant === "dissolve") {
          const w = Math.min(
            tile.width,
            Math.ceil((tile.width * reveal) / 2) * 2,
          )
          const h = Math.min(
            tile.height,
            Math.ceil((tile.height * reveal) / 2) * 2,
          )
          const x = tile.x + Math.floor((tile.width - w) / 4) * 2
          const y = tile.y + Math.floor((tile.height - h) / 4) * 2
          blit(ctx, pair.into, x, y, w, h)
        } else {
          const w = Math.min(
            tile.width,
            Math.ceil((tile.width * reveal) / 2) * 2,
          )
          const x = tile.reverse ? tile.x + tile.width - w : tile.x
          blit(ctx, pair.into, x, tile.y, w, tile.height)
        }
        if (options.ascii && tile.width >= 20 && tile.height >= 20) {
          ctx.globalAlpha = alpha * 0.18
          ctx.font = '600 7px "Geist Mono", monospace'
          ctx.fillStyle = "#ffffff"
          ctx.fillText(
            tile.reverse ? "+" : ":",
            tile.x + tile.width / 2,
            tile.y + tile.height / 2,
          )
          ctx.globalAlpha = alpha
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
      mosaics.clear()
      tiles.length = 0
    },
  }
}
