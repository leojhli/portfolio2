import { clamp, type Point } from "./geometry"
import { captureRaster, snapshot, type Fragment } from "./snapshot"
import { createScreenTransition, type ScreenTransition } from "./screen"
import { createScreenSurface } from "./screenSurface"
import { screenVariant } from "./screenGeometry"
import { createLiquidField } from "./liquid"
import { LIQUID_INFLUENCE } from "./liquidGeometry"
import type { EffectDriver, EffectOptions } from "./coordinator"
import { visiblePanel } from "./coordinator"
import { animateEntrance } from "./entrances"
import { createAsciiTransition } from "./asciiTransition"

type Sequence = {
  born: number
  life: number
  done?: () => void
}
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
    lines: Array<{
      left: number
      top: number
      width: number
    }>
  } | null = null
  let animations: Animation[] = []
  let stopEntrance = () => {}
  const screenLayers = new Set<HTMLElement>()
  const ascii = () => document.documentElement.dataset.mode === "ascii"
  const enabled = () =>
    document.documentElement.dataset.motion === "on" && !document.hidden
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
    stopEntrance()
    stopEntrance = () => {}
    animations.forEach((a) => a.cancel())
    animations = []
    screenLayers.forEach((el) => delete el.dataset.screenPixelation)
    screenLayers.clear()
    delete document.documentElement.dataset.pageTransition
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
  // Compile once while mounting, reuse across navigation, and render directly
  // to its own composited canvas (no WebGL-to-2D copy on every frame).
  const surface = createScreenSurface(canvas, cancel)
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
        // Leave the one-pixel UI feedback in the live DOM, above displaced
        // pixels. The browser remains responsible for its native CSS timing.
        lines: [
          ...document.querySelectorAll<HTMLElement>(
            "a.nav-link,a.text-link,a.contact-link",
          ),
        ].flatMap((link) => {
          const rect = link.getBoundingClientRect()
          if (!rect.width || rect.bottom < 0 || rect.top > innerHeight)
            return []
          const font = parseFloat(getComputedStyle(link).fontSize) || 16
          const rem =
            parseFloat(getComputedStyle(document.documentElement).fontSize) ||
            16
          const top = link.classList.contains("nav-link")
            ? rect.bottom - rem * 0.5 - 1
            : rect.top + (rect.height - 1) / 2 + font * 0.65
          return [
            {
              left: Math.floor(rect.left),
              top: Math.floor(top),
              width: Math.ceil(rect.width),
            },
          ]
        }),
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
    if (!screen?.effect.composited) {
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      ctx.font = '600 7px "Geist Mono", monospace'
      ctx.textBaseline = "middle"
    }
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
      if (liquid.size()) {
        canvas.dataset.liquidActive = ""
        for (const line of patch?.lines ?? [])
          ctx.clearRect(line.left, line.top, line.width, 2)
      } else {
        delete canvas.dataset.liquidActive
        if (!pointer) patch = null
      }
    }
    ctx.globalAlpha = 1
    if (screen || sequence || moving || pointerDirty) kick()
  }
  const revealScreen = () => {
    document.documentElement.dataset.pageTransition = ""
    // Only lifecycle markers: the single opaque canvas owns the pixelation.
    for (const el of document.querySelectorAll<HTMLElement>(
      "header,.deck,[data-deck-status]",
    )) {
      screenLayers.add(el)
      el.dataset.screenPixelation = ""
    }
  }
  const start = (root: HTMLElement, duration = 620) => {
    if (!enabled()) return
    home()
    sequence = { born: performance.now(), life: duration + 160 }
    stopEntrance = animateEntrance(root)
    kick()
  }
  const startScreen = (
    from: HTMLCanvasElement,
    into: HTMLElement,
    align = false,
    life = 720,
    options: EffectOptions = {},
  ) => {
    let to: HTMLCanvasElement | null = null
    try {
      if (!enabled()) return
      to = captureRaster(into, align)
      if (!to) return
      const screenOptions = {
        width: innerWidth,
        height: innerHeight,
        ascii: ascii(),
        variant: options.variant ?? screenVariant(turn++),
        direction: options.direction,
      }
      home()
      const effect =
        surface?.start(from, to, screenOptions) ??
        createScreenTransition(from, to, screenOptions)
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
  const startAscii = (options: EffectOptions = {}) => {
    if (!enabled()) return
    home()
    screen = {
      effect: createAsciiTransition({
        width: innerWidth,
        height: innerHeight,
        color:
          getComputedStyle(document.documentElement)
            .getPropertyValue("--c-muted")
            .trim() || "#999999",
        variant: options.variant ?? screenVariant(turn++),
        direction: options.direction,
      }),
      born: performance.now(),
      life: 560,
    }
    kick()
  }
  const releasePointer = () => {
    pointer = null
    pointerDirty = false
    liquid.setPointer(null, performance.now())
    if (liquid.size()) kick()
  }
  const onMove = (e: PointerEvent) => {
    if (screen || sequence || !enabled() || ascii()) return
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
      if (ascii()) {
        startAscii(options)
        return
      }
      try {
        const raster = captureRaster(from)
        if (raster) startScreen(raster, into, options.align, 720, options)
      } catch {
        cancel()
      }
    },
    assemble(root) {
      cancel()
      try {
        start(root)
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
        pendingMorph = requestAnimationFrame(() => {
          pendingMorph = 0
          const raster = pendingRaster
          pendingRaster = null
          try {
            if (ascii()) {
              if (raster) raster.width = raster.height = 0
              startAscii()
            } else if (raster) startScreen(raster, root, false, 560)
            else start(root)
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
        home()
        if (typeof root.animate === "function")
          animations.push(
            root.animate(
              [
                { opacity: 1, transform: "translate3d(0,0,0) scale(1)" },
                { opacity: 0, transform: "translate3d(0,8px,0) scale(0.985)" },
              ],
              {
                duration: 180,
                easing: "cubic-bezier(0.4,0,1,1)",
                fill: "forwards",
              },
            ),
          )
        sequence = {
          born: performance.now(),
          life: 180,
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
      surface?.dispose()
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
