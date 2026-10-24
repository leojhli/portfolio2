import { clamp } from "./geometry"
import type { ScreenTransition } from "./screen"
import { SCREEN_VARIANTS, type ScreenVariant } from "./screenGeometry"

/** Character-only navigation accents. No image capture, pixel masks or displacement. */
export function createAsciiTransition(options: {
  width: number
  height: number
  color: string
  direction?: 1 | -1
  variant: ScreenVariant
}): ScreenTransition {
  let disposed = false
  const index = SCREEN_VARIANTS.indexOf(options.variant)
  const phrases = [
    ">----->",
    ". : + : .",
    "<-- | -->",
    "| : | : |",
    "[ / / ]",
    "< . : . >",
  ]
  return {
    paint(ctx, progress) {
      if (disposed) return
      const p = clamp(progress)
      if (p <= 0 || p >= 1) return
      const direction = options.direction ?? 1
      ctx.save()
      ctx.font = '12px "Geist Mono", monospace'
      ctx.textBaseline = "middle"
      ctx.fillStyle = options.color
      ctx.globalAlpha = Math.sin(Math.PI * p) * 0.42
      // The document itself uses a native, smooth horizontal slide. These three
      // light character traces mark its passage without covering or scrambling it.
      for (let row = 0; row < 3; row++) {
        const travel = clamp(p * 1.25 - row * 0.12)
        const x = (direction > 0 ? 1 - travel : travel) * options.width
        const y = options.height * (0.24 + row * 0.26)
        ctx.fillText(phrases[index], x, y)
      }
      ctx.restore()
    },
    dispose() {
      disposed = true
    },
  }
}
