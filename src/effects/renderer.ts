import {
  assemblyAt,
  clamp,
  dustAt,
  farthestCorner,
  noise,
  particleBudget,
  rippleAt,
  type Point,
} from "./geometry"
import { captureRaster, snapshot, type Fragment } from "./snapshot"
import { createScreenTransition, type ScreenTransition } from "./screen"
import { screenVariant } from "./screenGeometry"
import type { EffectDriver, EffectOptions } from "./coordinator"
import { visiblePanel } from "./coordinator"

type Dust = {
  source: Fragment
  direction: Point
  born: number
  life: number
  cover: string
  gain: number
}
type Wave = Point & {
  born: number
  reach: number
  samples: Fragment[]
  emitted: Set<number>
}
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
const REACTIVE =
  "h1,h2,h3,h4,p,li,dt,dd,span,figcaption,button,a,input,textarea,select,svg,img,canvas,pre,.card,.box,.stage,.ghost-num,.palette-strip,.planet-label,[data-fx]"
type Nearby = {
  el: HTMLElement
  x: number
  y: number
  targetX: number
  targetY: number
  updated: number
  seen: number
  translate: string
  baseX: string
  baseY: string
}

/** One scheduler owns particles, ripples and temporary reveal animations. */
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
  let raf = 0,
    pendingMorph = 0
  let dust: Dust[] = [],
    waves: Wave[] = [],
    sequence: Sequence | null = null
  let screen: {
    effect: ScreenTransition
    born: number
    life: number
  } | null = null
  let turn = 0
  let pendingRaster: HTMLCanvasElement | null = null
  let cursor: Point | null = null
  let backdrop: {
    x: number
    y: number
    at: number
  } | null = null
  let animations: Animation[] = []
  const nearby = new Map<HTMLElement, Nearby>()
  const screenLayers = new Set<HTMLElement>()
  let waveCache: {
    root: HTMLElement
    at: number
    samples: Fragment[]
  } | null = null
  let candidates: HTMLElement[] = [],
    candidatesAt = -Infinity
  const backgroundPosition = document.body.style.backgroundPosition
  const restoreNearby = (n: Nearby) => {
    n.el.style.translate = n.translate
    delete n.el.dataset.proximityActive
  }
  const clearNearby = () => {
    nearby.forEach(restoreNearby)
    nearby.clear()
    document.body.style.backgroundPosition = backgroundPosition
  }
  let springs: Array<{
    el: HTMLElement
    center: Point
  }> = []
  const cache = new Map<HTMLElement, {
    at: number
    samples: Fragment[]
    rect: DOMRect
  }>()
  const seen = new Map<string, number>()
  const ascii = () => document.documentElement.dataset.mode === "ascii"
  const enabled = () =>
    document.documentElement.dataset.motion === "on" && !document.hidden
  const coarse = () => matchMedia("(pointer: coarse)").matches
  const budget = () => {
    const pixels = particleBudget(innerWidth, innerHeight, coarse())
    // Glyphs occupy more space than individual pixels; retain readable ASCII.
    return ascii() ? Math.min(6500, pixels) : pixels
  }
  let colors = { bg: "#faf0ca", fx: "#b24430", ink: "#1b1b1e" }
  const refreshColors = () => {
    const s = getComputedStyle(document.documentElement)
    colors = {
      bg: s.getPropertyValue("--c-bg").trim(),
      fx: s.getPropertyValue("--c-fx").trim(),
      ink: s.getPropertyValue("--c-fg").trim(),
    }
  }
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    canvas.width = Math.round(innerWidth * dpr)
    canvas.height = Math.round(innerHeight * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false
    cache.clear()
  }
  const cleanAnimations = () => {
    animations.forEach((a) => a.cancel())
    animations = []
    screenLayers.forEach((el) => {
      delete el.dataset.screenPixelation
    })
    screenLayers.clear()
  }
  const home = () => {
    const dialog = document.querySelector("dialog[open]")
    const parent = dialog ?? document.body
    if (canvas.parentElement !== parent) parent.appendChild(canvas)
  }
  const resetSprings = () =>
    springs.forEach(({ el }) => el.style.removeProperty("translate"))
  const cancel = () => {
    cancelAnimationFrame(raf)
    cancelAnimationFrame(pendingMorph)
    raf = pendingMorph = 0
    if (pendingRaster) pendingRaster.width = pendingRaster.height = 0
    pendingRaster = null
    dust = []
    waves = []
    cursor = null
    backdrop = null
    cache.clear()
    seen.clear()
    resetSprings()
    springs = []
    clearNearby()
    candidates = []
    candidatesAt = -Infinity
    waveCache = null
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
  const glyph = (seed: number) =>
    GLYPHS[Math.floor(noise(seed) * GLYPHS.length)]
  const draw = (
    p: Point,
    size: number,
    color: string,
    alpha: number,
    seed: number,
  ) => {
    ctx.globalAlpha = clamp(alpha)
    ctx.fillStyle = color
    if (ascii()) ctx.fillText(glyph(seed), p.x, p.y)
    else
      ctx.fillRect(
        Math.round(p.x),
        Math.round(p.y),
        Math.max(1, Math.round(size)),
        Math.max(1, Math.round(size)),
      )
  }
  const safe = (el: HTMLElement) => {
    const active = document.activeElement
    const selection = getSelection()
    return (
      !el.closest("[data-effect-canvas],dialog:not([open]),.sr-only") &&
      !(
        active &&
        active !== document.body &&
        active.matches('input,textarea,select,[contenteditable="true"]') &&
        (el.contains(active) || active.contains(el))
      ) &&
      !(selection && !selection.isCollapsed && selection.containsNode(el, true))
    )
  }
  const visuals = (now: number) => {
    if (now - candidatesAt > 500) {
      candidates = [...document.querySelectorAll<HTMLElement>(REACTIVE)]
      candidatesAt = now
    }
    const visible = candidates
      .filter(safe)
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(
        ({ rect: r }) =>
          r.width > 0 &&
          r.height > 0 &&
          r.left < innerWidth &&
          r.right > 0 &&
          r.top < innerHeight &&
          r.bottom > 0,
      )
      .slice(0, 500)
    // Move one visual group, never both a heading/card and its nested labels.
    const groups = new Set(visible.map(({ el }) => el))
    return visible.filter(({ el }) => {
      for (let parent = el.parentElement; parent; parent = parent.parentElement)
        if (groups.has(parent)) return false
      return true
    })
  }
  const reactTo = (
    el: HTMLElement,
    point: Point,
    rect: DOMRect,
    distance: number,
    now: number,
  ) => {
    let n = nearby.get(el)
    if (!n) {
      const style = getComputedStyle(el)
      const translate =
        style.translate && style.translate !== "none"
          ? style.translate.split(" ")
          : ["0px", "0px"]
      n = {
        el,
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        updated: now,
        seen: now,
        translate: el.style.translate,
        baseX: translate[0],
        baseY: translate[1] || "0px",
      }
      nearby.set(el, n)
    }
    const dx = rect.left + rect.width / 2 - point.x,
      dy = rect.top + rect.height / 2 - point.y
    // A soft center avoids the direction flip of normalizing a near-zero vector.
    const length = Math.sqrt(dx * dx + dy * dy + 32 * 32)
    const force =
      (1 - distance / 140) *
      (el.matches("button,a,input,select,textarea") ? 3 : 6)
    n.targetX = (dx / length) * force
    n.targetY = (dy / length) * force
    n.seen = now
  }
  const updateNearby = (now: number) => {
    for (const [el, n] of nearby) {
      const active = now - n.seen < 100 && safe(el)
      const ease =
        1 - Math.exp(-Math.min(64, Math.max(0, now - n.updated)) / 75)
      n.updated = now
      n.x += ((active ? n.targetX : 0) - n.x) * ease
      n.y += ((active ? n.targetY : 0) - n.y) * ease
      if (!el.isConnected || (!active && Math.hypot(n.x, n.y) < 0.015)) {
        restoreNearby(n)
        nearby.delete(el)
        continue
      }
      el.style.translate = `calc(${n.baseX} + ${n.x.toFixed(2)}px) calc(${n.baseY} + ${n.y.toFixed(2)}px)`
      el.dataset.proximityActive = ""
    }
  }
  const samplesFor = (el: HTMLElement, now: number) => {
    const old = cache.get(el),
      rect = el.getBoundingClientRect()
    if (
      old &&
      now - old.at < 400 &&
      Math.abs(old.rect.left - rect.left) < 12 &&
      Math.abs(old.rect.top - rect.top) < 12
    )
      return old.samples
    const spacing = ascii() ? 4 : 2
    const localBudget = Math.min(
      coarse() ? 8000 : 18000,
      Math.ceil((rect.width * rect.height) / (spacing * spacing)),
    )
    const samples = snapshot(el, localBudget, false, spacing)
    cache.set(el, { samples, rect, at: now })
    return samples
  }
  const emit = (
    sample: Fragment,
    center: Point,
    now: number,
    cover = "",
    gain = 1,
  ) => {
    if (dust.length >= Math.min(ascii() ? 2400 : 10000, budget())) return
    const key = `${Math.round(sample.x / 2)},${Math.round(sample.y / 2)}`
    if (now - (seen.get(key) ?? -1000) < 250) return
    seen.set(key, now)
    const dx = sample.x - center.x,
      dy = sample.y - center.y,
      length = Math.hypot(dx, dy) || 1
    dust.push({
      source: sample,
      direction: { x: dx / length, y: dy / length },
      born: now,
      life: 350,
      cover,
      gain,
    })
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
        const position = assemblyAt(f.from, f.to, p, f.seed)
        const opacity = s.exiting
          ? (1 - p) * 0.85
          : Math.sin(Math.PI * p) * 0.92
        draw(
          position,
          Math.max(0.8, f.to.size * (0.6 + Math.sin(Math.PI * p) * 0.4)),
          p < 0.45 ? f.from.color : f.to.color,
          opacity,
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
      if (cursor && !getSelection()?.toString()) {
        refreshColors()
        const near: HTMLElement[] = []
        for (const { el, rect: r } of visuals(now)) {
          const nearestX = clamp(cursor.x, r.left, r.right),
            nearestY = clamp(cursor.y, r.top, r.bottom)
          const distance = Math.hypot(nearestX - cursor.x, nearestY - cursor.y)
          if (distance > 140) continue
          reactTo(el, cursor, r, distance, now)
          if (distance < 100) near.push(el)
        }
        for (const el of near) {
          const surface = getComputedStyle(el).backgroundColor
          for (const sample of samplesFor(el, now)) {
            const distance = Math.hypot(
              sample.x - cursor.x,
              sample.y - cursor.y,
            )
            if (
              distance < 100 &&
              noise(sample.x + sample.y) < (1 - distance / 100) * 0.65
            )
              emit(
                sample,
                cursor,
                now,
                surface === "rgba(0, 0, 0, 0)" ? colors.bg : surface,
              )
          }
        }
        // Empty page space has the same fine pixel field, with a quiet glow and
        // background parallax rather than depending on a nearby marked visual.
        for (
          let x = Math.floor((cursor.x - 90) / 6) * 6;
          x < cursor.x + 90;
          x += 6
        ) {
          for (
            let y = Math.floor((cursor.y - 90) / 6) * 6;
            y < cursor.y + 90;
            y += 6
          ) {
            const distance = Math.hypot(x - cursor.x, y - cursor.y)
            if (
              x >= 0 &&
              y >= 0 &&
              x < innerWidth &&
              y < innerHeight &&
              distance < 90 &&
              noise(x * 3 + y) < (1 - distance / 90) * 0.35
            )
              emit(
                { x, y, color: colors.fx, size: 1.5, rank: 1 },
                cursor,
                now,
                "",
                0.2,
              )
          }
        }
        backdrop = {
          x: (cursor.x / innerWidth - 0.5) * 8,
          y: (cursor.y / innerHeight - 0.5) * 8,
          at: now,
        }
        cursor = null
      }
      waves = waves.filter((w) => now - w.born < 900)
      for (const wave of waves) {
        const { radius, alpha } = rippleAt(now - wave.born, wave.reach)
        const count = Math.min(
          ascii() ? 600 : 3000,
          Math.ceil((2 * Math.PI * radius) / (ascii() ? 7 : 3)),
        )
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2
          draw(
            {
              x: wave.x + Math.cos(a) * radius,
              y: wave.y + Math.sin(a) * radius,
            },
            1.25,
            colors.fx,
            alpha * 0.45,
            i,
          )
          if (i % 2 === 0)
            draw(
              {
                x: wave.x + Math.cos(a) * radius * 0.88,
                y: wave.y + Math.sin(a) * radius * 0.88,
              },
              1,
              colors.fx,
              alpha * 0.18,
              i + 3,
            )
        }
        for (const [i, sample] of wave.samples.entries()) {
          if (
            !wave.emitted.has(i) &&
            Math.hypot(sample.x - wave.x, sample.y - wave.y) <= radius
          ) {
            wave.emitted.add(i)
            emit(sample, wave, now)
          }
        }
      }
      for (const { el, center } of springs) {
        if (nearby.has(el)) continue
        let x = 0,
          y = 0
        for (const w of waves) {
          const dx = center.x - w.x,
            dy = center.y - w.y,
            distance = Math.hypot(dx, dy) || 1
          const radius = rippleAt(now - w.born, w.reach).radius
          const impulse =
            Math.sin((radius - distance) / 42) *
            Math.exp(-Math.abs(radius - distance) / 70) *
            3
          x += (dx / distance) * impulse
          y += (dy / distance) * impulse
        }
        // Individual decorations move at most 3px, independently of hover transforms.
        el.style.translate = `${clamp(x, -3, 3)}px ${clamp(y, -3, 3)}px`
      }
      if (!waves.length) {
        resetSprings()
        springs = []
      }
      dust = dust.filter((d) => now - d.born < d.life)
      for (const [i, d] of dust.entries()) {
        const p = clamp((now - d.born) / d.life),
          opacity = Math.sin(Math.PI * p)
        if (d.cover) {
          ctx.globalAlpha = opacity * 0.8
          ctx.fillStyle = d.cover
          ctx.fillRect(d.source.x, d.source.y, d.source.size, d.source.size)
        }
        draw(
          dustAt(d.source, d.direction, p),
          Math.max(0.8, d.source.size - 0.4),
          d.source.color,
          opacity * 0.9 * d.gain,
          i,
        )
      }
      updateNearby(now)
      if (backdrop) {
        const strength = 1 - clamp((now - backdrop.at) / 350)
        document.body.style.backgroundPosition = `${backdrop.x * strength}px ${backdrop.y * strength}px`
        if (!strength) {
          backdrop = null
          document.body.style.backgroundPosition = backgroundPosition
        }
      }
    }
    ctx.globalAlpha = 1
    if (seen.size > 50000) seen.clear()
    if (
      screen ||
      sequence ||
      dust.length ||
      waves.length ||
      cursor ||
      nearby.size ||
      backdrop
    )
      kick()
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
    refreshColors()
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
  const onMove = (e: PointerEvent) => {
    if (
      screen ||
      sequence ||
      e.pointerType === "touch" ||
      e.buttons ||
      !enabled()
    )
      return
    cursor = { x: e.clientX, y: e.clientY }
    kick()
  }
  const onClick = (e: MouseEvent) => {
    if (
      !enabled() ||
      sequence ||
      screen ||
      e.button !== 0 ||
      e.defaultPrevented ||
      (e.target as Element).closest?.(
        'a[href^="#"],input,textarea,select,[contenteditable],dialog,[data-drag]',
      )
    )
      return
    refreshColors()
    home()
    const point =
      e.detail === 0 && e.target instanceof Element
        ? e.target.getBoundingClientRect()
        : null
    const x = point ? point.left + point.width / 2 : e.clientX,
      y = point ? point.top + point.height / 2 : e.clientY
    const now = performance.now()
    const root = visiblePanel() ?? document.body
    if (!waveCache || waveCache.root !== root || now - waveCache.at > 400) {
      waveCache = {
        root,
        at: now,
        samples: snapshot(
          root,
          Math.min(10000, budget()),
          false,
          ascii() ? 4 : 2,
          true,
        ),
      }
    }
    const samples = waveCache.samples
    waves.push({
      x,
      y,
      born: now,
      reach: farthestCorner({ x, y }, innerWidth, innerHeight),
      samples,
      emitted: new Set(),
    })
    if (waves.length > 3) waves.shift()
    springs = [...document.querySelectorAll<HTMLElement>("[data-spring]")]
      .filter(safe)
      .slice(0, 16)
      .map((el) => {
        const r = el.getBoundingClientRect()
        return {
          el,
          center: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
        }
      })
    kick()
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
  resize()
  refreshColors()
  addEventListener("pointermove", onMove, { passive: true })
  document.addEventListener("click", onClick)
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
      cancel()
      removeEventListener("pointermove", onMove)
      document.removeEventListener("click", onClick)
      removeEventListener("scroll", onScroll, true)
      removeEventListener("resize", onResize)
      removeEventListener("keydown", onKey)
      document.removeEventListener("visibilitychange", onVisibility)
      document.removeEventListener("selectionchange", onSelection)
    },
  }
}
