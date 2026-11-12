import { useEffect, useRef } from "react"

const RAMP = " .,:;i1tfLCG08@"
const COLUMNS = 104
const WIDTH = 960
const HEIGHT = 540

/** The source video with a divider sweeping across it: footage on the left,
 * the same frame as ASCII on the right. Hovering moves the divider by hand. */
export default function AsciiPreview({ src }: { src: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const surface = canvas.current
    const source = video.current
    const ink = surface?.getContext?.("2d")
    if (!surface || !source || !ink) return
    const cell = WIDTH / COLUMNS
    const line = cell * 2
    const rows = Math.floor(HEIGHT / line)
    const grid = document.createElement("canvas")
    grid.width = COLUMNS
    grid.height = rows
    const sampler = grid.getContext("2d", { willReadFrequently: true })
    // Halve the frame in steps so thin lines average into grey instead of
    // falling between samples.
    const half = document.createElement("canvas")
    half.width = COLUMNS * 3
    half.height = rows * 3
    const averager = half.getContext("2d")
    if (!sampler || !averager) return
    sampler.imageSmoothingQuality = averager.imageSmoothingQuality = "high"
    void source.play?.()?.catch?.(() => {})
    let frame = 0,
      last = 0,
      split = .5,
      held = false
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      if (now - last < 33 || source.readyState < 2) return
      last = now
      if (!held) split = .5 + .4 * Math.sin(now / 2400)
      const edge = Math.round(split * WIDTH)
      ink.fillStyle = "#000"
      ink.fillRect(0, 0, WIDTH, HEIGHT)
      ink.drawImage(
        source,
        0, 0, source.videoWidth * split, source.videoHeight,
        0, 0, edge, HEIGHT,
      )
      averager.drawImage(source, 0, 0, half.width, half.height)
      sampler.drawImage(half, 0, 0, COLUMNS, rows)
      const pixels = sampler.getImageData(0, 0, COLUMNS, rows).data
      ink.save()
      ink.beginPath()
      ink.rect(edge, 0, WIDTH - edge, HEIGHT)
      ink.clip()
      ink.fillStyle = "#f5f5f2"
      ink.font = `${line * .92}px "Geist Mono", ui-monospace, monospace`
      ink.textBaseline = "top"
      for (let row = 0; row < rows; row++)
        for (let column = Math.floor(edge / cell); column < COLUMNS; column++) {
          const i = (row * COLUMNS + column) * 4
          const light =
            (pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114) / 255
          // The film is thin pale lines on black, so lift the faint cells.
          const glyph =
            RAMP[Math.min(RAMP.length - 1, Math.floor(light ** .55 * 2.1 * RAMP.length))]
          if (glyph !== " ") ink.fillText(glyph, column * cell, row * line)
        }
      ink.restore()
      ink.fillStyle = "#fff"
      ink.fillRect(edge - 1, 0, 2, HEIGHT)
      ink.beginPath()
      ink.arc(edge, HEIGHT / 2, 9, 0, Math.PI * 2)
      ink.fill()
    }
    const move = (event: PointerEvent) => {
      const box = surface.getBoundingClientRect()
      if (!box.width) return
      held = true
      split = Math.min(.97, Math.max(.03, (event.clientX - box.left) / box.width))
    }
    const release = () => {
      held = false
    }
    surface.addEventListener("pointermove", move)
    surface.addEventListener("pointerdown", move)
    surface.addEventListener("pointerleave", release)
    surface.addEventListener("pointercancel", release)
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      surface.removeEventListener("pointermove", move)
      surface.removeEventListener("pointerdown", move)
      surface.removeEventListener("pointerleave", release)
      surface.removeEventListener("pointercancel", release)
      source.pause?.()
    }
  }, [src])

  return (
    <figure className="cine-ascii">
      <video ref={video} src={src} muted loop playsInline autoPlay preload="auto" />
      <canvas
        ref={canvas}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label="A video clip with a divider sweeping across it. Left of the divider is the original footage; right of it the same frame is drawn in ASCII characters."
      />
      <figcaption>
        <span>Original</span>
        <span>ASCII</span>
      </figcaption>
    </figure>
  )
}
