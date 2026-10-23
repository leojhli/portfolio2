export type Fragment = {
  x: number
  y: number
  color: string
  size: number
  rank: number
  alpha?: number
}

export type SampleRegion = {
  left: number
  top: number
  right: number
  bottom: number
}

/** Capture once per interaction; animation frames only read the resulting bitmap. */
function rasterize(
  root: HTMLElement,
  align = false,
  viewport = false,
  region?: SampleRegion,
) {
  const rect = root.getBoundingClientRect()
  const shiftX = align ? -rect.left : 0
  const shiftY =
    align && document.documentElement.dataset.layout !== "h" ? -rect.top : 0
  const left = Math.max(
    region?.left ?? 0,
    viewport ? 0 : Math.max(0, rect.left + shiftX),
  )
  const top = Math.max(
    region?.top ?? 0,
    viewport ? 0 : Math.max(0, rect.top + shiftY),
  )
  const right = Math.min(
    region?.right ?? innerWidth,
    viewport ? innerWidth : Math.min(innerWidth, rect.right + shiftX),
  )
  const bottom = Math.min(
    region?.bottom ?? innerHeight,
    viewport ? innerHeight : Math.min(innerHeight, rect.bottom + shiftY),
  )
  const width = Math.ceil(right - left),
    height = Math.ceil(bottom - top)
  if (width <= 0 || height <= 0) return null
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  const offsetX = shiftX - left,
    offsetY = shiftY - top
  const elements = [root, ...root.querySelectorAll<HTMLElement>("*")].slice(
    0,
    650,
  )
  const chrome = new Set<Element>()
  const textScopes = [root]
  if (viewport) {
    ctx.fillStyle =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--c-bg")
        .trim() || "#0d0d0d"
    ctx.fillRect(0, 0, width, height)
    ctx.save()
    ctx.translate(-left, -top)
    paintBackdrop(ctx, innerWidth, innerHeight)
    ctx.restore()
    for (const layer of document.querySelectorAll<HTMLElement>(
      "header,[data-deck-status]",
    )) {
      if (root.contains(layer)) continue
      textScopes.push(layer)
      for (const el of [layer, ...layer.querySelectorAll<HTMLElement>("*")]) {
        chrome.add(el)
        elements.push(el)
      }
    }
  }
  const offset = (el: Element) =>
    chrome.has(el) ? { x: -left, y: -top } : { x: offsetX, y: offsetY }
  const styles = new Map<Element, CSSStyleDeclaration>()
  const visible = (el: Element) => {
    const s = styles.get(el) ?? getComputedStyle(el)
    styles.set(el, s)
    return (
      s.display !== "none" &&
      s.visibility !== "hidden" &&
      Number(s.opacity) !== 0 &&
      !el.closest(
        "[data-effect-canvas], .sr-only, [hidden], dialog:not([open])",
      )
    )
  }
  const solid = (color: string) =>
    color !== "transparent" && color !== "rgba(0, 0, 0, 0)"
  const boxes = new Map<Element, {
    x: number
    y: number
    w: number
    h: number
  }>()
  const box = (el: Element) => {
    const cached = boxes.get(el)
    if (cached) return cached
    const r = el.getBoundingClientRect()
    const o = offset(el)
    const value = { x: r.left + o.x, y: r.top + o.y, w: r.width, h: r.height }
    boxes.set(el, value)
    return value
  }
  for (const el of elements) {
    if (!visible(el)) continue
    const s = styles.get(el)!,
      b = box(el)
    if (b.x + b.w < 0 || b.y + b.h < 0 || b.x > width || b.y > height) continue
    // The viewport base is already painted; smaller surfaces retain their fills.
    if (
      (viewport || (el !== root && b.w * b.h < width * height * 0.65)) &&
      solid(s.backgroundColor)
    ) {
      ctx.fillStyle = s.backgroundColor
      ctx.beginPath()
      ctx.roundRect(
        b.x,
        b.y,
        b.w,
        b.h,
        Math.min(parseFloat(s.borderRadius) || 0, b.w / 2, b.h / 2),
      )
      ctx.fill()
    }
    if (parseFloat(s.borderTopWidth) && solid(s.borderTopColor)) {
      ctx.strokeStyle = s.borderTopColor
      ctx.lineWidth = Math.min(3, parseFloat(s.borderTopWidth))
      ctx.strokeRect(b.x, b.y, b.w, b.h)
    }
    if (
      (el instanceof HTMLImageElement &&
        el.complete &&
        el.naturalWidth &&
        (new URL(el.currentSrc || el.src, location.href).origin ===
          location.origin ||
          el.crossOrigin)) ||
      (el instanceof HTMLCanvasElement && el.width && el.height)
    ) {
      // WebGL buffers may have been cleared since the last paint. Stages render
      // a fresh frame synchronously for sampling without enabling preserveDrawingBuffer.
      el.dispatchEvent(new Event("portfolio:sample"))
      // Isolate every media read so a tainted image cannot poison the entire snapshot.
      const media = document.createElement("canvas")
      media.width = Math.min(512, Math.ceil(b.w))
      media.height = Math.min(512, Math.ceil(b.h))
      const mc = media.getContext("2d")
      if (mc && media.width && media.height) {
        try {
          mc.drawImage(el as CanvasImageSource, 0, 0, media.width, media.height)
          mc.getImageData(0, 0, 1, 1)
          ctx.drawImage(media, b.x, b.y, b.w, b.h)
        } catch {
          /* Local DOM colors/text still provide a usable silhouette. */
        }
      }
    }
    if (el instanceof SVGSVGElement) {
      const vb = el.viewBox.baseVal
      if (!vb.width || !vb.height) continue
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.scale(b.w / vb.width, b.h / vb.height)
      ctx.translate(-vb.x, -vb.y)
      for (const path of [...el.querySelectorAll("path")].slice(0, 20)) {
        const ps = getComputedStyle(path),
          d = path.getAttribute("d")
        if (!d) continue
        const shape = new Path2D(d)
        if (ps.fill !== "none") {
          ctx.fillStyle = ps.fill
          ctx.fill(shape)
        }
        if (ps.stroke !== "none") {
          ctx.strokeStyle = ps.stroke
          ctx.lineWidth = parseFloat(ps.strokeWidth) || 1
          ctx.stroke(shape)
        }
      }
      ctx.restore()
    }
  }
  const headings = new Map<Element, DOMRect>()
  const range = document.createRange()
  for (const scope of textScopes) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
    let remaining = scope === root ? 5000 : 1500
    for (
      let node = walker.nextNode();
      node && remaining > 0;
      node = walker.nextNode()
    ) {
      const parent = node.parentElement,
        text = node.textContent ?? ""
      if (
        !parent ||
        !text.trim() ||
        !visible(parent) ||
        parent.closest("svg, script, style")
      )
        continue
      const s = styles.get(parent)!
      const o = offset(parent)
      const bounds = box(parent)
      if (
        bounds.x + bounds.w < 0 ||
        bounds.y + bounds.h < 0 ||
        bounds.x > width ||
        bounds.y > height
      )
        continue
      if (s.writingMode !== "horizontal-tb") continue
      ctx.fillStyle = s.color
      ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
      ctx.textBaseline = "alphabetic"
      const heading = parent.closest("h1,h2,h3")
      if (heading && !headings.has(heading))
        headings.set(heading, heading.getBoundingClientRect())
      for (let i = 0; i < text.length && remaining > 0; ) {
        const char = String.fromCodePoint(text.codePointAt(i)!)
        range.setStart(node, i)
        range.setEnd(node, i + char.length)
        i += char.length
        if (!char.trim()) continue
        const r = range.getBoundingClientRect()
        const x = r.left + o.x,
          y = r.top + o.y
        if (
          !r.width ||
          x + r.width < 0 ||
          y + r.height < 0 ||
          x > width ||
          y > height
        )
          continue
        ctx.fillText(
          char,
          x,
          y +
            (r.height + parseFloat(s.fontSize)) / 2 -
            parseFloat(s.fontSize) * 0.16,
        )
        remaining--
      }
    }
  }
  return { canvas, ctx, left, top, shiftX, shiftY, headings }
}

/** Full viewport raster includes the background, panel and fixed navigation. */
export function captureRaster(
  root: HTMLElement,
  align = false,
  viewport = true,
) {
  return rasterize(root, align, viewport)?.canvas ?? null
}

/** Sample actual text, fills, outlines and local media at their DOM positions. */
export function snapshot(
  root: HTMLElement,
  budget: number,
  align = false,
  spacing = 2,
  viewport = false,
  region?: SampleRegion,
): Fragment[] {
  if (budget <= 0) return []
  const raster = rasterize(root, align, viewport, region)
  if (!raster) return []
  const { canvas, ctx, left, top, shiftX, shiftY, headings } = raster
  const { width, height } = canvas
  const pixels = ctx.getImageData(0, 0, width, height).data
  canvas.width = canvas.height = 0
  // Resolution stays fine even when the pool is full. Limit the number of
  // samples with reservoir sampling instead of inflating pixels into blocks.
  const step = Math.max(1, Math.round(spacing))
  const headingRects = [...headings.values()]
  const limit = Math.max(1, Math.floor(budget))
  const candidates: Fragment[] = []
  let count = 0
  for (let y = 1; y < height; y += step) {
    for (let x = 1; x < width; x += step) {
      const k = (y * width + x) * 4
      if (pixels[k + 3] < 65) continue
      count++
      const slot =
        count <= limit ? count - 1 : Math.floor(Math.random() * count)
      if (slot >= limit) continue
      const px = x + left,
        py = y + top
      const rank = headingRects.some(
        (r) =>
          px >= r.left + shiftX &&
          px <= r.right + shiftX &&
          py >= r.top + shiftY &&
          py <= r.bottom + shiftY,
      )
        ? 0
        : 1
      candidates[slot] = {
        x: px,
        y: py,
        size: step,
        rank,
        color: `rgb(${pixels[k]} ${pixels[k + 1]} ${pixels[k + 2]})`,
        alpha: pixels[k + 3] / 255,
      }
    }
  }
  return candidates
}

/** Match the fixed CSS page texture so empty space also participates in the mosaic. */
function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const style = getComputedStyle(document.documentElement)
  const color = (name: string) => style.getPropertyValue(name).trim()
  ctx.save()
  if (document.documentElement.dataset.mode === "ascii") {
    ctx.globalAlpha = 0.35
    ctx.fillStyle = color("--c-v1") || "#a0a0a0"
    for (let y = 9; y < height; y += 18)
      for (let x = 9; x < width; x += 18) ctx.fillRect(x, y, 1, 1)
  } else {
    // Paint from back to front, in the same order as the body's CSS gradients.
    for (const [key, x, y, rx, ry, alpha] of [
      ["--c-v3", 0.78, 0.06, 0.4, 0.35, 0.05],
      ["--c-v2", 0.96, 0.92, 0.5, 0.45, 0.07],
      ["--c-v1", 0.06, 0.08, 0.6, 0.5, 0.06],
    ] as const) {
      ctx.save()
      ctx.translate(width * x, height * y)
      ctx.scale(width * rx, height * ry)
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.7)
      gradient.addColorStop(0, color(key) || "#a0a0a0")
      gradient.addColorStop(1, "transparent")
      ctx.globalAlpha = alpha
      ctx.fillStyle = gradient
      ctx.fillRect(-3, -3, 6, 6)
      ctx.restore()
    }
    ctx.globalAlpha = 0.02
    ctx.fillStyle = color("--c-fg") || "#f3f3f3"
    for (let x = 0; x < width; x += 48) ctx.fillRect(x, 0, 1, height)
    for (let y = 0; y < height; y += 48) ctx.fillRect(0, y, width, 1)
  }
  ctx.restore()
}
