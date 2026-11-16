import { useEffect, useRef } from "react"

const SOURCE = "/models/cloister/cloister-still.webp"
const RAMP = " .:-=+*#%@"
const CELL_W = 7
const CELL_H = 12
const RADIUS = 170

/**
 * Quickview's background: the cloister from the film, drawn faintly in ink.
 * A round lens decodes it into ASCII, the way the Video to ASCII project
 * does. The lens follows the pointer and drifts slowly across the building
 * when the pointer is away. With reduced motion only the drawing shows.
 */
export default function QuickviewBackdrop() {
  const drawing = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const host = drawing.current
    const surface = lens.current
    const context = surface?.getContext?.("2d")
    if (!host || !surface || !context) return
    const plate: HTMLDivElement = host
    const ink: CanvasRenderingContext2D = context
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    const sampler = document.createElement("canvas")
    const sample = sampler.getContext("2d", { willReadFrequently: true })
    const image = new Image()
    image.decoding = "async"
    image.src = SOURCE

    let width = 0,
      height = 0,
      ratio = 1,
      frame = 0,
      last = 0
    // Where the drawing sits, in CSS pixels, before scrolling.
    const place = { x: 0, y: 0, w: 0, h: 0 }
    const target = { x: 0, y: 0 }
    const now = { x: 0, y: 0, size: 0 }
    let pointerAt = -1e9
    let color = "#111"
    let cols = 0,
      rows = 0
    let light = new Float32Array(0)

    const readColor = () => {
      const page = surface.closest(".rs-page") ?? document.body
      color = getComputedStyle(page).getPropertyValue("--rs-fg").trim() || "#111"
    }

    const layout = () => {
      width = window.innerWidth
      height = window.innerHeight
      ratio = Math.min(window.devicePixelRatio || 1, 2)
      surface.width = Math.round(width * ratio)
      surface.height = Math.round(height * ratio)
      const iw = image.naturalWidth || 1400
      const ih = image.naturalHeight || 1040
      // Beside the text on wide screens, behind it on narrow ones.
      const wide = width > 1100
      const scale = wide
        ? Math.min((width * 0.58) / iw, (height * 0.95) / ih)
        : Math.min(width / iw, height / ih) * 1.25
      place.w = iw * scale
      place.h = ih * scale
      place.x = wide ? width - place.w * 0.97 : (width - place.w) / 2
      place.y = (height - place.h) / 2 + height * 0.04
      plate.style.left = `${place.x}px`
      plate.style.top = `${place.y}px`
      plate.style.width = `${place.w}px`
      plate.style.height = `${place.h}px`
      // Sample the drawing once at character resolution.
      cols = Math.ceil(place.w / CELL_W)
      rows = Math.ceil(place.h / CELL_H)
      light = new Float32Array(cols * rows)
      // A hidden or zero-sized window has nothing to sample; drawing then
      // would throw and take the whole page down with it.
      if (sample && image.complete && image.naturalWidth && cols > 0 && rows > 0) {
        sampler.width = cols
        sampler.height = rows
        sample.imageSmoothingQuality = "high"
        sample.drawImage(image, 0, 0, cols, rows)
        const data = sample.getImageData(0, 0, cols, rows).data
        for (let i = 0; i < cols * rows; i++) {
          const v = (data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11) / 255
          light[i] = Math.min(1, Math.max(0, (v - 0.03) / 0.32))
        }
      }
      readColor()
    }

    const scroll = () => Math.min(window.scrollY, 3000) * 0.08

    function paint(time: number) {
      const shift = scroll()
      plate.style.transform = `translate3d(0, ${-shift}px, 0)`
      ink.setTransform(ratio, 0, 0, ratio, 0, 0)
      ink.clearRect(0, 0, width, height)
      if (still || !cols) return
      // Idle: drift along a slow figure-eight over the building.
      if (time - pointerAt > 2600) {
        const t = time / 1000
        target.x = place.x + place.w * (0.6 + 0.2 * Math.sin(t * 0.21))
        target.y = place.y - shift + place.h * (0.52 + 0.2 * Math.sin(t * 0.42 + 1))
      }
      now.x += (target.x - now.x) * 0.08
      now.y += (target.y - now.y) * 0.08
      now.size += (1 - now.size) * 0.05
      const radius = Math.min(RADIUS, width * 0.26) * now.size
      plate.style.setProperty("--lx", `${now.x - place.x}px`)
      plate.style.setProperty("--ly", `${now.y - (place.y - shift)}px`)
      plate.style.setProperty("--lr", `${radius}px`)
      ink.font = `${CELL_H - 2}px "Geist Mono", ui-monospace, monospace`
      ink.textBaseline = "top"
      ink.fillStyle = color
      const top = place.y - shift
      const c0 = Math.max(0, Math.floor((now.x - radius - place.x) / CELL_W))
      const c1 = Math.min(cols - 1, Math.ceil((now.x + radius - place.x) / CELL_W))
      const r0 = Math.max(0, Math.floor((now.y - radius - top) / CELL_H))
      const r1 = Math.min(rows - 1, Math.ceil((now.y + radius - top) / CELL_H))
      const flicker = Math.floor(time / 90)
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const x = place.x + col * CELL_W
          const y = top + row * CELL_H
          const d = Math.hypot(x + CELL_W / 2 - now.x, y + CELL_H / 2 - now.y) / radius
          if (d > 1) continue
          const v = light[row * cols + col]
          let index = Math.round(v * (RAMP.length - 1))
          // The rim scrambles, like a decoder catching up.
          if (d > 0.82 && v > 0.05) index = (row * 31 + col * 17 + flicker) % RAMP.length
          if (index <= 0) continue
          // Quieter where the lens crosses the reading column.
          const behindText = Math.max(0, 1 - Math.max(0, x - (width / 2 + 330)) / 120)
          ink.globalAlpha = (0.3 + 0.55 * v) * Math.min(1, (1 - d) * 5) * (1 - (width < 700 ? 0.78 : 0.65) * behindText)
          ink.fillText(RAMP[index], x, y)
        }
      }
      // The rim fades where the lens passes behind the reading column.
      const rimBehind = Math.max(0, 1 - Math.max(0, now.x - radius * 0.5 - (width / 2 + 330)) / 120)
      ink.globalAlpha = (width < 700 ? 0.18 : 0.35) * (1 - 0.7 * rimBehind)
      ink.strokeStyle = color
      ink.lineWidth = 1
      ink.beginPath()
      ink.arc(now.x, now.y, radius, 0, Math.PI * 2)
      ink.stroke()
      ink.globalAlpha = 1
    }

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick)
      if (document.hidden || time - last < 1000 / 40) return
      last = time
      paint(time)
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return
      target.x = event.clientX
      target.y = event.clientY
      pointerAt = performance.now()
    }
    const onScroll = () => {
      if (still) paint(performance.now())
    }
    const scheme = window.matchMedia?.("(prefers-color-scheme: dark)")
    const theme = () => readColor()

    image.onload = () => {
      layout()
      target.x = now.x = place.x + place.w / 2
      target.y = now.y = place.y + place.h / 2
      plate.dataset.ready = "true"
      paint(performance.now())
    }
    layout()
    window.addEventListener("resize", layout)
    window.addEventListener("scroll", onScroll, { passive: true })
    scheme?.addEventListener?.("change", theme)
    if (!still) {
      window.addEventListener("pointermove", move, { passive: true })
      frame = requestAnimationFrame(tick)
    }
    return () => {
      cancelAnimationFrame(frame)
      image.onload = null
      window.removeEventListener("resize", layout)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("pointermove", move)
      scheme?.removeEventListener?.("change", theme)
    }
  }, [])

  return (
    <div className="rs-backdrop" aria-hidden="true">
      <div ref={drawing} className="rs-drawing">
        <img src={SOURCE} alt="" decoding="async" />
      </div>
      <canvas ref={lens} />
    </div>
  )
}
