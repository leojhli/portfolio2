import { useEffect, useRef } from "react"
import { usePrefs } from "../state/preferences"
import { AsciiRaster } from "../effects/ascii"

/** Same photograph in both modes; ASCII caches colored characters on load/resize. */
export default function Photo({
  name,
  alt,
  className = "",
  eager = false,
}: {
  name: string
  alt: string
  className?: string
  eager?: boolean
}) {
  const { mode, appearance } = usePrefs()
  const host = useRef<HTMLSpanElement>(null)
  const output = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (mode !== "ascii" || !host.current || !output.current) return
    const el = host.current,
      canvas = output.current,
      image = new Image(),
      raster = new AsciiRaster()
    let alive = true,
      visible = !("IntersectionObserver" in window),
      raf = 0
    const draw = () => {
      raf = 0
      if (!alive || !visible || !image.complete || !image.naturalWidth) return
      const w = el.clientWidth,
        h = el.clientHeight
      if (!raster.fit(canvas, w, h, 5)) return
      canvas.width = Math.round(w * Math.min(devicePixelRatio || 1, 2))
      canvas.height = Math.round(h * Math.min(devicePixelRatio || 1, 2))
      raster.paint(
        canvas,
        w,
        h,
        image,
        image.naturalWidth,
        image.naturalHeight,
        appearance === "light" && !el.closest(".hero-chapter"),
        '"Geist Mono", monospace',
      )
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    image.onload = schedule
    image.src = `/photos/${name}-640.webp`
    const ro =
      typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null
    ro?.observe(el)
    const io =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries) => {
              visible = entries[0].isIntersecting
              if (visible) schedule()
            },
            { rootMargin: "200px" },
          )
        : null
    io?.observe(el)
    schedule()
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      ro?.disconnect()
      io?.disconnect()
      image.onload = null
    }
  }, [mode, appearance, name])
  return (
    <span
      ref={host}
      className={`photo ${className}`}
      role={mode === "ascii" ? "img" : undefined}
      aria-label={mode === "ascii" ? alt : undefined}
    >
      <img
        src={`/photos/${name}-1280.webp`}
        srcSet={`/photos/${name}-640.webp 640w, /photos/${name}-1280.webp 1280w`}
        sizes={name === "city" ? "100vw" : "(min-width: 1024px) 50vw, 100vw"}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
      />
      {mode === "ascii" && (
        <canvas ref={output} className="ascii-out" aria-hidden="true" />
      )}
    </span>
  )
}
