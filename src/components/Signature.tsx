import { useEffect, useId, useRef } from "react"
import { usePrefs } from "../state/preferences"
import { signatureProgress, SIGNATURE_STROKES } from "../effects/signature"

/** Trace masks reveal the supplied ink; completed geometry is never substituted. */
export default function Signature({ hero = false }: { hero?: boolean }) {
  const id = useId().replace(/:/g, "")
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const savedProgress = useRef(0)
  const { motion, mode, palette } = usePrefs()
  useEffect(() => {
    const el = host.current
    if (!el) return
    let raf = 0,
      last = 0,
      complete = !hero && savedProgress.current >= 1,
      visible = false,
      disposed = false,
      value = motion ? savedProgress.current : 1
    const source = new Image()
    let alpha: Uint8ClampedArray | null = null
    // A cached character image, with each glyph assigned its nearest pen-stroke time.
    const grid = document.createElement("canvas")
    grid.width = 112
    grid.height = 38
    const ctx = grid.getContext("2d", { willReadFrequently: true })
    const paint = (p: number) => {
      value = p
      if (!hero) savedProgress.current = p
      el.style.setProperty("--signature-progress", String(p))
      el.dataset.complete = p >= 1 ? "true" : "false"
      el.dataset.started = p > 0 ? "true" : "false"
      const out = canvas.current,
        g = out?.getContext("2d")
      if (!out || !g || !alpha) return
      const w = 672,
        h = 380
      if (out.width !== w) {
        out.width = w
        out.height = h
      }
      g.clearRect(0, 0, w, h)
      if (p <= 0) return
      g.fillStyle = hero ? "#edf5ff" : palette.vars.accent
      g.font = '600 10px "Geist Mono", monospace'
      for (let y = 0; y < 38; y++)
        for (let x = 0; x < 112; x++) {
          const a = alpha[(y * 112 + x) * 4 + 3]
          if (
            a < 20 ||
            signatureProgress(180 + (x * 240) / 112, 30 + (y * 135) / 38) > p
          )
            continue
          g.fillText(a > 170 ? "@" : a > 80 ? "+" : ":", x * 6, y * 10 + 9)
        }
    }
    source.onload = () => {
      if (disposed || !ctx) return
      ctx.drawImage(source, 180, 30, 240, 135, 0, 0, 112, 38)
      try {
        alpha = ctx.getImageData(0, 0, 112, 38).data
        paint(value)
      } catch {
        /* SVG remains the dynamic fallback. */
      }
    }
    if (mode === "ascii") source.src = "/signature.png"
    const tick = (now: number) => {
      raf = 0
      if (disposed || document.hidden || !visible) return
      const dt = last ? Math.max(0, Math.min(64, now - last)) : 0
      last = now
      const p = Math.min(1, value + dt / 1900)
      paint(p)
      if (p < 1) raf = requestAnimationFrame(tick)
      else complete = true
    }
    const frame = (event: Event) => {
      if (hero && motion) {
        const detail = (event as CustomEvent<{ heroProgress: number }>).detail
        paint(Math.min(1, Math.max(0, detail.heroProgress * 1.65)))
      }
    }
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
        last = 0
      } else if (!hero && motion && visible && !complete && !raf)
        raf = requestAnimationFrame(tick)
    }
    const io =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries) => {
              visible = entries[0].isIntersecting
              if (visible && motion && !hero && !complete && !raf)
                raf = requestAnimationFrame(tick)
              if (!visible) {
                cancelAnimationFrame(raf)
                raf = 0
                last = 0
              }
            },
            { threshold: 0.2 },
          )
        : null
    if (!hero) io?.observe(el)
    paint(
      !motion || (!hero && !io)
        ? 1
        : hero
          ? Math.min(1, Math.max(0, (scrollY / innerHeight) * 1.65))
          : savedProgress.current,
    )
    addEventListener("portfolio:frame", frame)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      io?.disconnect()
      source.onload = null
      removeEventListener("portfolio:frame", frame)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [hero, motion, mode, palette])
  return (
    <div
      ref={host}
      className={`signature ${hero ? "signature-hero" : ""}`}
      role="img"
      aria-label="Leo Li’s handwritten signature"
    >
      {mode === "ascii" ? (
        <canvas ref={canvas} aria-hidden="true" />
      ) : (
        <svg viewBox="180 30 240 135" aria-hidden="true">
          <defs>
            <mask
              id={`ink-${id}`}
              maskUnits="userSpaceOnUse"
              x="180"
              y="30"
              width="240"
              height="135"
              style={{ maskType: "alpha" }}
            >
              <image href="/signature.png" width="818" height="198" />
            </mask>
          </defs>
          <g mask={`url(#ink-${id})`}>
            {SIGNATURE_STROKES.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength="1"
                className={`signature-stroke signature-stroke-${i}`}
              />
            ))}
            <rect
              className="signature-finished"
              x="180"
              y="30"
              width="240"
              height="135"
              fill="currentColor"
            />
          </g>
        </svg>
      )}
    </div>
  )
}
