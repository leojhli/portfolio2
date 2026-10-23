import {
  assemblyAt,
  clamp,
  noise,
  particleBudget,
  type Point,
} from "./geometry"
import { captureRaster, snapshot, type Fragment } from "./snapshot"
import { createScreenTransition, type ScreenTransition } from "./screen"
import { screenVariant } from "./screenGeometry"
import { createLiquidField } from "./liquid"
import { LIQUID_INFLUENCE } from "./liquidGeometry"
import type { EffectDriver, EffectOptions } from "./coordinator"
import { visiblePanel } from "./coordinator"

type Flight = {
  from: Fragment
  to: Fragment
  seed: number
  delay: number
}
type Sequence = {
  flights: Flight[]
  born: number
  life: number
  exiting: boolean
  done?: () => void
}
const GLYPHS = "+*:#=%@"
const TILE = 64

/** One scheduler owns a local liquid field and explicit navigation/reveal effects. */
export function createRenderer(
  canvas: HTMLCanvasElement,
): EffectDriver & { dispose(): void } {
  const context = canvas.getContext("2d")
  if (!context)
    return {
      transition() {},
      assemble() {},
      morph() {},
      disperse: (_, done) => done(),
      cancel() {},
      dispose() {},
    }
  const ctx = context
  const liquid = createLiquidField()
  let raf = 0,
    pendingMorph = 0,
    turn = 0
  let sequence: Sequence | null = null
  let screen: {
    effect: ScreenTransition
    born: number
    life: number
  } | null = null
  let pendingRaster: HTMLCanvasElement | null = null
  let pointer: Point | null = null
  let pointerDirty = false
  let patch: {
    root: HTMLElement
    key: string
    samples: Fragment[]
    cover: string
  } | null = null
  let animations: Animation[] = []
  const screenLayers = new Set<HTMLElement>()
  const ascii = () => document.documentElement.dataset.mode === "ascii"
  const enabled = () =>
    document.documentElement.dataset.motion === "on" && !document.hidden
  const budget = () => {
    const pixels = particleBudget(
      innerWidth,
      innerHeight,
      matchMedia("(pointer: coarse)").matches,
    )
    return ascii() ? Math.min(6500, pixels) : pixels
  }
  const editing = () =>
    document.activeElement?.matches(
      'input,textarea,select,[contenteditable="true"]',
    )
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    canvas.width = Math.round(innerWidth * dpr)
    canvas.height = Math.round(innerHeight * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false
  }
  const home = () => {
    const parent = document.querySelector("dialog[open]") ?? document.body
    if (canvas.parentElement !== parent) parent.appendChild(canvas)
  }
  const cleanAnimations = () => {
    animations.forEach((a) => a.cancel())
    animations = []
    screenLayers.forEach((el) => delete el.dataset.screenPixelation)
    screenLayers.clear()
  }
  const cancel = () => {
    cancelAnimationFrame(raf)
    cancelAnimationFrame(pendingMorph)
    raf = pendingMorph = 0
    if (pendingRaster) pendingRaster.width = pendingRaster.height = 0
    pendingRaster = null
    pointer = null
    pointerDirty = false
    patch = null
    liquid.clear()
    delete canvas.dataset.liquidActive
    cleanAnimations()
    const done = sequence?.done
    sequence = null
    screen?.effect.dispose()
    screen = null
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    done?.()
    home()
  }
  const kick = () => {
    if (!raf && enabled())
      raf = requestAnimationFrame((now) => {
        try {
          frame(now)
        } catch {
          cancel()
        }
      })
  }
  const draw = (
    p: Point,
    size: number,
    color: string,
    alpha: number,
    seed: number,
  ) => {
    ctx.globalAlpha = clamp(alpha)
    ctx.fillStyle = color
    if (ascii())
      ctx.fillText(GLYPHS[Math.floor(noise(seed) * GLYPHS.length)], p.x, p.y)
    else
      ctx.fillRect(
        Math.round(p.x),
        Math.round(p.y),
        Math.max(1, Math.round(size)),
        Math.max(1, Math.round(size)),
      )
  }
  const captureLocal = (point: Point, now: number) => {
    if (editing() || !getSelection()?.isCollapsed) return
    const root =
      document.querySelector<HTMLElement>("dialog[open]") ??
      visiblePanel() ??
      document.body
    const x = Math.floor(point.x / TILE) * TILE
    const y = Math.floor(point.y / TILE) * TILE
    const key = x + ":" + y + ":" + (ascii() ? "ascii" : "dynamic")
    let refreshed = false
    if (!patch || patch.root !== root || patch.key !== key) {
      // Capture a bounded neighborhood once on entry. The fine grid has no random
      // reservoir omissions and its identities remain stable while the mouse rests.
      const region = {
        left: Math.max(0, x - LIQUID_INFLUENCE),
        top: Math.max(0, y - LIQUID_INFLUENCE),
        right: Math.min(innerWidth, x + TILE + LIQUID_INFLUENCE),
        bottom: Math.min(innerHeight, y + TILE + LIQUID_INFLUENCE),
      }
      patch = {
        root,
        key,
        samples: snapshot(root, 20000, false, 2, true, region),
        cover:
          getComputedStyle(document.documentElement)
            .getPropertyValue("--c-bg")
            .trim() || "#0d0d0d",
      }
      refreshed = true
    }
    liquid.add(patch.samples, patch.cover, now, refreshed)
  }
  function frame(now: number) {
    raf = 0
    if (!enabled()) {
      cancel()
      return
    }
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    ctx.font = '600 7px "Geist Mono", monospace'
    ctx.textBaseline = "middle"
    let moving = false
    if (screen) {
      const s = screen
      const progress = clamp((now - s.born) / s.life)
      s.effect.paint(ctx, progress)
      if (progress >= 1) {
        s.effect.dispose()
        screen = null
        cleanAnimations()
        home()
      }
    } else if (sequence) {
      const s = sequence,
        age = Math.max(0, now - s.born)
      for (const [i, f] of s.flights.entries()) {
        const end = f.to.rank === 0 ? 0.78 : 1
        const p = clamp((age / s.life - f.delay) / (end - f.delay))
        draw(
          assemblyAt(f.from, f.to, p, f.seed),
          Math.max(0.8, f.to.size * (0.6 + Math.sin(Math.PI * p) * 0.4)),
          p < 0.45 ? f.from.color : f.to.color,
          s.exiting ? (1 - p) * 0.85 : Math.sin(Math.PI * p) * 0.92,
          i,
        )
      }
      if (age >= s.life) {
        sequence = null
        cleanAnimations()
        s.done?.()
        home()
      }
    } else {
      if (pointerDirty && pointer) {
        pointerDirty = false
        captureLocal(pointer, now)
      }
      moving = liquid.paint(ctx, now, ascii())
      if (liquid.size()) canvas.dataset.liquidActive = ""
      else {
        delete canvas.dataset.liquidActive
        if (!pointer) patch = null
      }
    }
    ctx.globalAlpha = 1
    if (screen || sequence || moving || pointerDirty) kick()
  }
  const revealScreen = () => {
    // Only lifecycle markers: the single opaque canvas owns the pixelation.
    for (const el of document.querySelectorAll<HTMLElement>(
      "header,.deck,[data-deck-status]",
    )) {
      screenLayers.add(el)
      el.dataset.screenPixelation = ""
    }
  }
  const reveal = (root: HTMLElement, duration: number) => {
    // Never fade or mask a control/hit area. Only inert text and visual leaves soften.
    const leaves = [...root.querySelectorAll<HTMLElement>("h1,h2,h3,[data-fx]")]
      .filter(
        (el) =>
          !el.closest('button,a,[role="button"]') &&
          !el.querySelector('button,a,input,select,textarea,[tabindex="0"]'),
      )
      .slice(0, 28)
    for (const el of leaves) {
      if (typeof el.animate !== "function") continue
      animations.push(
        el.animate(
          [
            { opacity: 0.65 },
            {
              opacity: 0.75,
              offset: 0.7,
            },
            { opacity: 1 },
          ],
          {
            duration: el.matches("h1,h2,h3") ? duration * 0.78 : duration,
            easing: "ease-out",
          },
        ),
      )
    }
  }
  const flights = (
    from: Fragment[],
    to: Fragment[],
    origin?: Point,
  ): Flight[] => {
    if (!to.length) return []
    return to.map((target, i) => {
      const seed = noise(i)
      const source = from.length
        ? from[Math.floor((i / to.length) * from.length)]
        : {
            ...target,
            x: origin?.x ?? target.x - 20,
            y: origin?.y ?? target.y + 16,
          }
      return {
        from: source,
        to: target,
        seed,
        delay: target.rank * 0.1 + seed * 0.09,
      }
    })
  }
  const start = (
    from: Fragment[],
    into: HTMLElement,
    options: EffectOptions = {},
    duration = 1000,
  ) => {
    if (!enabled()) return
    const to = snapshot(
      into,
      budget(),
      options.align,
      ascii() ? 4 : 2,
      options.screen,
    )
    if (!to.length) return

    home()
    sequence = {
      flights: flights(from, to, options.origin),
      born: performance.now(),
      life: duration,
      exiting: false,
    }
    reveal(into, duration)
    kick()
  }
  const startScreen = (
    from: HTMLCanvasElement,
    into: HTMLElement,
    align = false,
    life = 840,
  ) => {
    let to: HTMLCanvasElement | null = null
    try {
      if (!enabled()) return
      to = captureRaster(into, align)
      if (!to) return
      const effect = createScreenTransition(from, to, {
        width: innerWidth,
        height: innerHeight,
        ascii: ascii(),
        variant: screenVariant(turn++),
      })
      home()
      screen = { effect, born: performance.now(), life }
      revealScreen()
      // Cover the moving DOM before Deck changes its transform.
      ctx.globalAlpha = 1
      effect.paint(ctx, 0)
      kick()
    } finally {
      from.width = from.height = 0
      if (to) to.width = to.height = 0
    }
  }
  const releasePointer = () => {
    pointer = null
    pointerDirty = false
    liquid.setPointer(null, performance.now())
    if (liquid.size()) kick()
  }
  const onMove = (e: PointerEvent) => {
    if (screen || sequence || !enabled()) return
    if (e.pointerType === "touch" || e.buttons || editing()) {
      releasePointer()
      return
    }
    pointer = { x: e.clientX, y: e.clientY }
    liquid.setPointer(pointer, performance.now())
    pointerDirty = true
    home()
    kick()
  }
  const onOut = (e: PointerEvent) => {
    if (!e.relatedTarget) releasePointer()
  }
  const onClick = () => {
    // Controls may change their content; refresh only the local source. A click
    // never emits an expanding ring or moves an entire element.
    patch = null
    if (pointer && !screen && !sequence) {
      pointerDirty = true
      kick()
    }
  }
  const onScroll = () => {
    const active = screen ?? sequence
    if (!active || performance.now() - active.born > 80) cancel()
  }
  const onResize = () => {
    cancel()
    resize()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") cancel()
  }
  const onVisibility = () => {
    if (document.hidden) cancel()
  }
  const onSelection = () => {
    if (!getSelection()?.isCollapsed) cancel()
  }
  const onFocus = () => {
    if (editing()) cancel()
  }
  // Loaded fonts and presentation settings can invalidate cached pixel colors
  // or text geometry. Preserve explicit section/mode transitions while they run.
  const invalidate = () => {
    if (!screen && !sequence && !pendingMorph) cancel()
  }
  const presentation = new window.MutationObserver(invalidate)
  presentation.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style", "data-theme", "data-mode", "data-motion"],
  })
  document.fonts?.addEventListener("loadingdone", invalidate)
  resize()
  addEventListener("pointermove", onMove, { passive: true })
  addEventListener("pointerout", onOut, { passive: true })
  addEventListener("pointerdown", releasePointer, { passive: true })
  addEventListener("blur", releasePointer)
  document.addEventListener("click", onClick)
  document.addEventListener("focusin", onFocus)
  addEventListener("scroll", onScroll, { passive: true, capture: true })
  addEventListener("resize", onResize)
  addEventListener("keydown", onKey)
  document.addEventListener("visibilitychange", onVisibility)
  document.addEventListener("selectionchange", onSelection)
  return {
    transition(from, into, options = {}) {
      cancel()
      if (!enabled()) return
      try {
        const raster = captureRaster(from)
        if (raster) startScreen(raster, into, options.align)
      } catch {
        cancel()
      }
    },
    assemble(root) {
      cancel()
      try {
        start([], root, {}, 460)
      } catch {
        cancel()
      }
    },
    morph(root) {
      cancel()
      if (!enabled()) return
      try {
        const wholeScreen = !root.closest("dialog")
        pendingRaster = wholeScreen ? captureRaster(root) : null
        const from = wholeScreen
          ? []
          : snapshot(root, budget(), false, ascii() ? 4 : 2)
        pendingMorph = requestAnimationFrame(() => {
          pendingMorph = 0
          const raster = pendingRaster
          pendingRaster = null
          try {
            if (raster) startScreen(raster, root, false, 560)
            else start(from, root, {}, 560)
          } catch {
            cancel()
          }
        })
      } catch {
        cancel()
      }
    },
    disperse(root, done) {
      cancel()
      if (!enabled()) {
        done()
        return
      }
      try {
        const from = snapshot(
          root,
          Math.min(8000, budget()),
          false,
          ascii() ? 4 : 2,
        )
        if (!from.length) {
          done()
          return
        }
        home()
        const to = from.map((p, i) => ({
          ...p,
          x: p.x + (noise(i) - 0.5) * 90,
          y: p.y - 35 - noise(i + 1) * 40,
        }))
        sequence = {
          flights: flights(from, to),
          born: performance.now(),
          life: 240,
          exiting: true,
          done,
        }
        kick()
      } catch {
        done()
        cancel()
      }
    },
    cancel,
    dispose() {
      presentation.disconnect()
      document.fonts?.removeEventListener("loadingdone", invalidate)
      cancel()
      removeEventListener("pointermove", onMove)
      removeEventListener("pointerout", onOut)
      removeEventListener("pointerdown", releasePointer)
      removeEventListener("blur", releasePointer)
      document.removeEventListener("click", onClick)
      document.removeEventListener("focusin", onFocus)
      removeEventListener("scroll", onScroll, true)
      removeEventListener("resize", onResize)
      removeEventListener("keydown", onKey)
      document.removeEventListener("visibilitychange", onVisibility)
      document.removeEventListener("selectionchange", onSelection)
    },
  }
}
