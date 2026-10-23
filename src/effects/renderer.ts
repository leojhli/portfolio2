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
import { snapshot, type Fragment } from "./snapshot"
import type { EffectDriver, EffectOptions } from "./coordinator"

type Dust = {
  source: Fragment
  direction: Point
  born: number
  life: number
  cover: string
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
  let cursor: Point | null = null
  let animations: Animation[] = []
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
  const budget = () => particleBudget(innerWidth, innerHeight, coarse())
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
    const dpr = Math.min(devicePixelRatio || 1, 1.5)
    canvas.width = Math.round(innerWidth * dpr)
    canvas.height = Math.round(innerHeight * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    cache.clear()
  }
  const cleanAnimations = () => {
    animations.forEach((a) => a.cancel())
    animations = []
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
    dust = []
    waves = []
    cursor = null
    cache.clear()
    seen.clear()
    resetSprings()
    springs = []
    cleanAnimations()
    const done = sequence?.done
    sequence = null
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
      ctx.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, size, size)
  }
  const safe = (el: HTMLElement) => {
    const active = document.activeElement
    const selection = getSelection()
    return (
      !el.closest("header,nav,dialog:not([open])") &&
      !(
        active &&
        active !== document.body &&
        (el.contains(active) || active.contains(el))
      ) &&
      !(selection && !selection.isCollapsed && selection.containsNode(el, true))
    )
  }
  const visuals = () =>
    [...document.querySelectorAll<HTMLElement>("[data-fx]")]
      .filter((el) => {
        if (!safe(el)) return false
        const r = el.getBoundingClientRect()
        return (
          r.width > 0 &&
          r.height > 0 &&
          r.left < innerWidth &&
          r.right > 0 &&
          r.top < innerHeight &&
          r.bottom > 0
        )
      })
      .slice(0, 24)
  const samplesFor = (el: HTMLElement, now: number) => {
    const old = cache.get(el),
      rect = el.getBoundingClientRect()
    if (
      old &&
      now - old.at < 400 &&
      Math.abs(old.rect.left - rect.left) < 1 &&
      Math.abs(old.rect.top - rect.top) < 1
    )
      return old.samples
    const samples = snapshot(el, coarse() ? 140 : 260)
    cache.set(el, { samples, rect, at: now })
    return samples
  }
  const emit = (sample: Fragment, center: Point, now: number, cover = "") => {
    if (dust.length >= Math.min(360, budget())) return
    const key = `${Math.round(sample.x / 6)},${Math.round(sample.y / 6)}`
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
    })
  }
  function frame(now: number) {
    raf = 0
    if (!enabled()) {
      cancel()
      return
    }
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    ctx.font = '600 11px "Geist Mono", monospace'
    ctx.textBaseline = "middle"
    if (sequence) {
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
          Math.max(2, f.to.size * (0.6 + Math.sin(Math.PI * p) * 0.4)),
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
        for (const el of visuals()) {
          const r = el.getBoundingClientRect(),
            nearestX = clamp(cursor.x, r.left, r.right),
            nearestY = clamp(cursor.y, r.top, r.bottom)
          if (Math.hypot(nearestX - cursor.x, nearestY - cursor.y) > 100)
            continue
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
        cursor = null
      }
      waves = waves.filter((w) => now - w.born < 900)
      for (const wave of waves) {
        const { radius, alpha } = rippleAt(now - wave.born, wave.reach)
        const count = Math.min(240, Math.ceil((2 * Math.PI * radius) / 12))
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2
          draw(
            {
              x: wave.x + Math.cos(a) * radius,
              y: wave.y + Math.sin(a) * radius,
            },
            2,
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
              1.5,
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
          Math.max(2, d.source.size - 1),
          d.source.color,
          opacity * 0.9,
          i,
        )
      }
    }
    ctx.globalAlpha = 1
    if (seen.size > 2400) seen.clear()
    if (sequence || dust.length || waves.length || cursor) kick()
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
            { opacity: 0.35, filter: ascii() ? "none" : "url(#px-14)" },
            {
              opacity: 0.75,
              filter: ascii() ? "none" : "url(#px-4)",
              offset: 0.7,
            },
            { opacity: 1, filter: "none" },
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
    const to = snapshot(into, budget(), options.align)
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
  const onMove = (e: PointerEvent) => {
    if (sequence || e.pointerType === "touch" || e.buttons || !enabled()) return
    cursor = { x: e.clientX, y: e.clientY }
    kick()
  }
  const onClick = (e: MouseEvent) => {
    if (
      !enabled() ||
      sequence ||
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
    const samples = visuals()
      .flatMap((el) => samplesFor(el, now))
      .slice(0, 650)
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
    if (!sequence || performance.now() - sequence.born > 80) cancel()
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
        start(snapshot(from, budget()), into, options)
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
        const from = snapshot(root, budget())
        pendingMorph = requestAnimationFrame(() => {
          pendingMorph = 0
          try {
            start(from, root, {}, 560)
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
        const from = snapshot(root, Math.min(400, budget()))
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
