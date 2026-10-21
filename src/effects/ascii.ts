/** Shared character rasterizer for ASCII mode: 3D scenes and video both render through it. */
const RAMP = " .,:;-=+*#%@"
const CHAR_W = 0.6 // Geist Mono advance width in em

/**
 * Keep a pixel's hue (with a saturation lift) and scale its lightness towards a
 * range that reads against the page. Scaling rather than clamping keeps light and
 * dark features apart, so materials stay distinguishable by colour.
 */
function tint(r: number, g: number, b: number, inkIsDark: boolean) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2,
    c = max - min
  let h = 0,
    s = 0
  if (c > 0.001) {
    s = c / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / c + 6) % 6
    else if (max === g) h = (b - r) / c + 2
    else h = (r - g) / c + 4
    h *= 60
  }
  const L = inkIsDark ? 0.06 + l * 0.56 : 0.34 + l * 0.6
  const S = Math.min(1, s * 1.3)
  // Quantized so neighbouring cells share a fillStyle string.
  return `hsl(${Math.round(h / 4) * 4} ${Math.round(S * 25) * 4}% ${Math.round(L * 50) * 2}%)`
}

export class AsciiRaster {
  private c = document.createElement("canvas")
  private ctx = this.c.getContext("2d", { willReadFrequently: true })
  cols = 0
  rows = 0
  font = 0

  /** Size the character grid to fill `el`; returns false when there is no room. */
  fit(el: HTMLElement, w: number, h: number, cell = 7) {
    if (w < 10 || h < 10) return false
    this.cols = Math.max(24, Math.min(170, Math.floor(w / cell)))
    const font = w / this.cols / CHAR_W
    this.rows = Math.max(8, Math.floor(h / font))
    this.font = font
    el.style.fontSize = `${font}px`
    this.c.width = this.cols
    this.c.height = this.rows
    return true
  }

  /** Downsample `src` (cover-fitted to the grid's aspect) to one RGBA pixel per cell. */
  private sample(src: CanvasImageSource, srcW: number, srcH: number) {
    const { ctx, cols, rows } = this
    if (!ctx || !cols || !srcW || !srcH) return null
    const target = (cols * CHAR_W) / rows
    let sw = srcW,
      sh = srcH
    if (srcW / srcH > target) sw = srcH * target
    else sh = srcW / target
    ctx.clearRect(0, 0, cols, rows)
    try {
      ctx.drawImage(
        src,
        (srcW - sw) / 2,
        (srcH - sh) / 2,
        sw,
        sh,
        0,
        0,
        cols,
        rows,
      )
    } catch {
      return null
    }
    try {
      return ctx.getImageData(0, 0, cols, rows).data
    } catch {
      return null // cross-origin video without CORS
    }
  }

  /**
   * Sample `src` and return text.
   * `inkIsDark`: on light pages dense glyphs mean dark pixels; on dark pages, bright ones.
   * `alpha`: transparent pixels become blanks (used for 3D renders over the page).
   */
  frame(
    src: CanvasImageSource,
    srcW: number,
    srcH: number,
    inkIsDark: boolean,
    alpha = false,
  ) {
    const d = this.sample(src, srcW, srcH)
    if (!d) return ""
    const { cols, rows } = this
    const n = RAMP.length - 1
    let out = ""
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4
        if (alpha && d[i + 3] < 26) {
          out += " "
          continue
        }
        const lum =
          (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
        let v = inkIsDark ? 1 - lum : lum
        if (alpha) v = 0.12 + v * 0.88
        out += RAMP[Math.min(n, Math.max(0, Math.round(v * n)))]
      }
      out += "\n"
    }
    return out
  }

  /**
   * Coloured variant for 3D renders over the page: draws glyphs into `out` (a 2D
   * canvas `w`×`h` CSS px), each tinted with its pixel's hue. Transparent pixels stay blank.
   */
  paint(
    out: HTMLCanvasElement,
    w: number,
    h: number,
    src: CanvasImageSource,
    srcW: number,
    srcH: number,
    inkIsDark: boolean,
    family: string,
  ) {
    const g = out.getContext("2d")
    if (!g) return
    const k = out.width / w
    g.setTransform(k, 0, 0, k, 0, 0)
    g.clearRect(0, 0, w, h)
    const d = this.sample(src, srcW, srcH)
    if (!d) return
    const { cols, rows, font } = this
    const cw = w / cols
    const n = RAMP.length - 1
    g.font = `${font}px ${family}`
    g.textBaseline = "top"
    let last = ""
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4
        if (d[i + 3] < 26) continue
        const lum =
          (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
        // Floor at '=' so every surface has enough glyph weight to show its colour.
        const v = 0.5 + (inkIsDark ? 1 - lum : lum) * 0.5
        const fill = tint(d[i], d[i + 1], d[i + 2], inkIsDark)
        if (fill !== last) g.fillStyle = last = fill
        g.fillText(RAMP[Math.min(n, Math.round(v * n))], x * cw, y * font)
      }
    }
  }
}
