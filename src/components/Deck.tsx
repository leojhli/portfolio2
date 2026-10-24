import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { usePrefs } from "../state/preferences"
import { cancelEffects } from "../effects/coordinator"
import { animateEntrance } from "../effects/entrances"
import {
  clampScroll,
  depthOffset,
  scrollStep,
  scrollReveal,
} from "../effects/scrollGeometry"

const Q = "(min-width: 1024px) and (min-height: 700px)"
const subscribe = (cb: () => void) => {
  const query = matchMedia(Q)
  query.addEventListener("change", cb)
  return () => query.removeEventListener("change", cb)
}
const pad = (n: number) => String(n).padStart(2, "0")
type PanelMeta = {
  id: string
  label: string
}

/** A native, unsnapped horizontal document; compact screens keep vertical flow. */
export default function Deck({
  nav,
  children,
}: {
  nav: Array<[string, string]>
  children: ReactNode
}) {
  const wide = useSyncExternalStore(subscribe, () => matchMedia(Q).matches)
  const { motion, mode } = usePrefs()
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const index = useRef(0)
  const fraction = useRef(0)
  const navigate = useRef<(i: number, smooth?: boolean) => void>(() => {})
  const [active, setActive] = useState(0)
  const [meta, setMeta] = useState<PanelMeta[]>([])
  const panels = useCallback(
    () =>
      track.current
        ? [...track.current.children].filter(
            (el): el is HTMLElement =>
              el instanceof HTMLElement && el.hasAttribute("data-panel"),
          )
        : [],
    [],
  )

  useLayoutEffect(() => {
    const html = document.documentElement,
      ps = panels(),
      el = viewport.current
    if (!el) return
    const prior = html.dataset.layout
    html.dataset.layout = wide ? "h" : "v"
    const hash = ps.findIndex((p) => "#" + p.id === location.hash)
    if (hash >= 0 && prior !== "h") index.current = hash
    if (wide) {
      const left =
        (prior === "h" ? fraction.current : index.current) *
        (el.clientWidth || innerWidth)
      el.scrollLeft = left
      fraction.current = left / (el.clientWidth || innerWidth)
    } else {
      el.scrollLeft = 0
      if (prior === "h" || hash >= 0)
        ps[index.current]?.scrollIntoView({
          block: "start",
          behavior: "instant",
        })
    }
    setActive(index.current)
    setMeta(ps.map((p) => ({ id: p.id, label: p.dataset.panel ?? "" })))
    return cancelEffects
  }, [wide, panels])

  useEffect(() => {
    const el = viewport.current,
      ps = panels()
    if (!el) return
    let raf = 0,
      paintRaf = 0,
      last = 0,
      target = el.scrollLeft,
      authored = el.scrollLeft,
      stopped = false
    const width = () => el.clientWidth || innerWidth
    const maximum = () => Math.max(0, ps.length * width() - width())
    const layers = ps.flatMap((p, i) =>
      [...p.querySelectorAll<HTMLElement>("[data-depth]")].map((node) => ({
        node,
        panel: i,
        depth: Number(node.dataset.depth) || 0,
      })),
    )
    const stops: Array<() => void> = []
    const reveals = ps.flatMap((p, panel) =>
      [...p.querySelectorAll<HTMLElement>("[data-reveal]")]
        .filter((node) => !node.parentElement?.closest("[data-reveal]"))
        .map((node, order) => ({
          node,
          panel,
          order,
          artwork: node.hasAttribute("data-depth"),
        })),
    )
    if (wide && motion)
      reveals.forEach(({ node }) => node.setAttribute("data-scroll-reveal", ""))
    const paint = () => {
      paintRaf = 0
      if (!wide) return
      const w = width(),
        left = el.scrollLeft,
        max = maximum()
      fraction.current = left / w
      const i = Math.max(0, Math.min(ps.length - 1, Math.round(left / w)))
      if (i !== index.current) {
        index.current = i
        setActive(i)
        history.replaceState(null, "", "#" + ps[i].id)
      }
      if (progress.current)
        progress.current.style.transform = `scaleX(${max ? left / max : 0})`
      for (const layer of layers) {
        const x = motion ? depthOffset(layer.panel, left, w, layer.depth) : 0
        layer.node.style.setProperty("--depth-x", x.toFixed(2) + "px")
      }
      if (motion)
        for (const group of reveals) {
          const state = scrollReveal(
            group.panel - left / w,
            group.order,
            group.artwork,
          )
          group.node.style.setProperty(
            "--scroll-opacity",
            state.opacity.toFixed(4),
          )
          group.node.style.setProperty(
            "--scroll-y",
            (mode === "ascii" ? 0 : state.y).toFixed(2) + "px",
          )
          group.node.style.setProperty(
            "--scroll-scale",
            (mode === "ascii" ? 1 : state.scale).toFixed(5),
          )
        }
    }
    const schedule = () => {
      if (!paintRaf && !stopped) paintRaf = requestAnimationFrame(paint)
    }
    const halt = () => {
      cancelAnimationFrame(raf)
      raf = 0
      last = 0
      target = el.scrollLeft
    }
    const frame = (now: number) => {
      raf = 0
      if (stopped) return
      const dt = last ? (now - last) / 1000 : 1 / 60
      last = now
      const next = scrollStep(el.scrollLeft, target, dt)
      authored = next
      el.scrollLeft = next
      schedule()
      if (next !== target) raf = requestAnimationFrame(frame)
      else last = 0
    }
    const to = (left: number, smooth = true) => {
      target = clampScroll(left, maximum())
      if (!smooth || !motion) {
        cancelAnimationFrame(raf)
        raf = 0
        last = 0
        el.scrollLeft = target
        authored = target
        schedule()
      } else if (!raf) raf = requestAnimationFrame(frame)
    }
    navigate.current = (i, smooth = true) => {
      const p = ps[Math.max(0, Math.min(ps.length - 1, i))]
      if (!p) return
      cancelEffects()
      if (wide) to(ps.indexOf(p) * width(), smooth)
      else
        p.scrollIntoView({
          block: "start",
          behavior: smooth && motion ? "smooth" : "instant",
        })
    }
    const scroll = () => {
      if (raf && Math.abs(el.scrollLeft - authored) > 2) halt()
      if (!raf) target = el.scrollLeft
      cancelEffects()
      schedule()
    }
    const wheel = (event: WheelEvent) => {
      if (!wide || event.ctrlKey || event.defaultPrevented) return
      const element = event.target as HTMLElement
      if (element.closest?.("dialog,input,textarea,select,[contenteditable]"))
        return
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      // Preserve native trackpad momentum and horizontal shelf scrolling.
      if (horizontal) {
        halt()
        return
      }
      const dy =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1)
      let parent: HTMLElement | null = element
      while (parent && parent !== el) {
        if (
          parent.scrollHeight > parent.clientHeight + 2 &&
          ((dy > 0 &&
            parent.scrollTop + parent.clientHeight < parent.scrollHeight - 2) ||
            (dy < 0 && parent.scrollTop > 0))
        )
          return
        parent = parent.parentElement
      }
      const next = clampScroll((raf ? target : el.scrollLeft) + dy, maximum())
      if (next === el.scrollLeft && !raf) return
      event.preventDefault()
      to(next)
    }
    const key = (event: KeyboardEvent) => {
      const element =
        event.target instanceof HTMLElement ? event.target : document.body
      if (
        !wide ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        element.closest(
          'input,textarea,select,[contenteditable],dialog,[role="slider"]',
        )
      )
        return
      let delta = 0,
        absolute: number | null = null
      if (event.key === "ArrowRight" || event.key === "ArrowDown") delta = 96
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") delta = -96
      else if (event.key === "PageDown") delta = width() * 0.85
      else if (event.key === "PageUp") delta = -width() * 0.85
      else if (event.key === " " && !element.closest("button,a"))
        delta = width() * 0.85 * (event.shiftKey ? -1 : 1)
      else if (event.key === "Home") absolute = 0
      else if (event.key === "End") absolute = maximum()
      else if (event.key === "Escape") {
        halt()
        cancelEffects()
        return
      } else return
      event.preventDefault()
      to(absolute ?? (raf ? target : el.scrollLeft) + delta)
    }
    const resize = () => {
      const position = fraction.current
      halt()
      if (wide) {
        el.scrollLeft = clampScroll(position * width(), maximum())
        target = el.scrollLeft
      }
      schedule()
    }
    let observer: IntersectionObserver | undefined
    if (!wide && motion && "IntersectionObserver" in window) {
      const seen = new Set<Element>()
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting || seen.has(entry.target)) continue
            seen.add(entry.target)
            stops.push(animateEntrance(entry.target as HTMLElement))
            observer?.unobserve(entry.target)
          }
        },
        { root: wide ? el : null, threshold: 0.12 },
      )
      const reveal = [...el.querySelectorAll<HTMLElement>("[data-reveal]")]
      for (const node of reveal) {
        if (!node.parentElement?.closest("[data-reveal]"))
          observer.observe(node)
      }
    }
    el.addEventListener("scroll", scroll, { passive: true })
    el.addEventListener("wheel", wheel, { passive: false })
    el.addEventListener("pointerdown", halt, { passive: true })
    el.addEventListener("touchstart", halt, { passive: true })
    addEventListener("keydown", key)
    addEventListener("resize", resize)
    schedule()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      cancelAnimationFrame(paintRaf)
      observer?.disconnect()
      stops.forEach((stop) => stop())
      layers.forEach(({ node }) => node.style.removeProperty("--depth-x"))
      reveals.forEach(({ node }) => {
        node.removeAttribute("data-scroll-reveal")
        for (const property of [
          "--scroll-opacity",
          "--scroll-y",
          "--scroll-scale",
        ])
          node.style.removeProperty(property)
      })
      el.removeEventListener("scroll", scroll)
      el.removeEventListener("wheel", wheel)
      el.removeEventListener("pointerdown", halt)
      el.removeEventListener("touchstart", halt)
      removeEventListener("keydown", key)
      removeEventListener("resize", resize)
    }
  }, [wide, motion, mode, panels])

  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const link = (event.target as Element).closest?.(
        'a[href^="#"]',
      ) as HTMLAnchorElement | null
      const into = link && document.getElementById(link.hash.slice(1))
      const ps = panels(),
        page = into?.closest<HTMLElement>("[data-panel]")
      if (!page || !track.current?.contains(page)) return
      event.preventDefault()
      if (location.hash !== "#" + page.id)
        history.pushState(null, "", "#" + page.id)
      navigate.current(ps.indexOf(page))
      if (event.detail === 0)
        (page.querySelector<HTMLElement>("h1,h2") ?? page).focus({
          preventScroll: true,
        })
    }
    const historyChange = () => {
      const ps = panels(),
        i = ps.findIndex((p) => "#" + p.id === location.hash)
      navigate.current(i < 0 ? 0 : i, false)
    }
    document.addEventListener("click", click)
    addEventListener("hashchange", historyChange)
    addEventListener("popstate", historyChange)
    return () => {
      document.removeEventListener("click", click)
      removeEventListener("hashchange", historyChange)
      removeEventListener("popstate", historyChange)
    }
  }, [panels])

  const current = meta[active]
  return (
    <>
      <div ref={viewport} className="deck" data-horizontal-scroll>
        <div ref={track} className="deck-track">
          {children}
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {wide && current
          ? `Section ${active + 1} of ${meta.length}: ${current.label}`
          : ""}
      </p>
      <div
        data-deck-status
        className="site-status fixed inset-x-0 bottom-0 z-30 hidden h-14 items-center gap-6 bg-bg/85 px-8 font-sans text-xs text-muted backdrop-blur hz:flex"
      >
        <span className="w-16 shrink-0 tabular-nums text-fg">
          {pad(active + 1)}
          <span className="text-muted"> / {pad(meta.length || 1)}</span>
        </span>
        <nav
          aria-label="Sections"
          className="absolute left-1/2 -translate-x-1/2"
        >
          <ul className="flex gap-1">
            {nav.map(([id, text]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={current?.id === id ? "true" : undefined}
                  className="nav-link inline-flex min-h-11 items-center px-2"
                >
                  {text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div
          aria-hidden="true"
          className="relative mr-auto h-[3px] w-20 overflow-hidden rounded bg-line xl:w-28"
        >
          {mode === "ascii" ? (
            <span className="text-xs text-muted">
              {"[" +
                "=".repeat(active) +
                ">" +
                "-".repeat(Math.max(0, meta.length - active - 1)) +
                "]"}
            </span>
          ) : (
            <div
              ref={progress}
              className="vivid-bar absolute inset-0 origin-left scale-x-0"
            />
          )}
        </div>
        <span aria-hidden="true" className="ml-auto text-xs">
          {active < meta.length - 1 ? "scroll to explore" : "the end"}
        </span>
      </div>
    </>
  )
}
