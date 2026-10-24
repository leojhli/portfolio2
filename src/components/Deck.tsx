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
import { cancelEffects, transition, visiblePanel } from "../effects/coordinator"
import type { Point } from "../effects/geometry"
import { screenVariant } from "../effects/screenGeometry"
import { animateEntrance } from "../effects/entrances"

const Q = "(min-width: 1024px) and (min-height: 700px)"
const THRESH = 240
const subscribe = (cb: () => void) => {
  const m = matchMedia(Q)
  m.addEventListener("change", cb)
  return () => m.removeEventListener("change", cb)
}
const pad = (n: number) => String(n).padStart(2, "0")
type GoOptions = {
  history?: boolean
  animate?: boolean
  focus?: boolean
  origin?: Point
}

/** Retains the desktop page deck; compact layouts keep ordinary vertical scrolling. */
export default function Deck({
  nav,
  children,
}: {
  nav: Array<[string, string]>
  children: ReactNode
}) {
  const wide = useSyncExternalStore(subscribe, () => matchMedia(Q).matches)
  const { motion, mode } = usePrefs()
  const live = useRef({ motion, wide })
  live.current = { motion, wide }
  const track = useRef<HTMLDivElement>(null)
  const meter = useRef<HTMLSpanElement>(null)
  const idx = useRef(0)
  const lockUntil = useRef(0)
  const entrance = useRef(() => {})
  const arrival = useRef({ delay: 0, direction: 0 })
  const previousMode = useRef(mode)
  const [index, setIndex] = useState(0)
  const [pagesMeta, setPagesMeta] = useState<Array<{
    id: string
    label: string
  }>>([])
  const pages = () =>
    track.current
      ? [...track.current.children].filter(
          (el): el is HTMLElement =>
            el instanceof HTMLElement && el.hasAttribute("data-panel"),
        )
      : []
  const place = (i: number, animate: boolean) => {
    if (!track.current) return
    track.current.style.transition = animate
      ? "transform 0.56s cubic-bezier(0.22,1,0.36,1)"
      : "none"
    track.current.style.transform = `translate3d(${-i * 100}vw,0,0)`
  }
  const settle = useCallback(() => {
    entrance.current()
    cancelEffects()
    lockUntil.current = 0
    pages().forEach((p) => p.style.removeProperty("transform"))
    if (live.current.wide) place(idx.current, false)
    if (meter.current) meter.current.style.transform = "scaleX(0)"
  }, [])
  const go = useCallback((target: number, options: GoOptions = {}) => {
    const ps = pages(),
      i = Math.max(0, Math.min(ps.length - 1, target)),
      into = ps[i]
    const from = live.current.wide ? ps[idx.current] : visiblePanel()
    if (!into || (from === into && options.animate !== false)) return
    const fromIndex = from ? ps.indexOf(from) : -1
    const previousIndex = fromIndex >= 0 ? fromIndex : idx.current
    cancelEffects()
    entrance.current()
    ps.forEach((p) => p.style.removeProperty("transform"))
    idx.current = i
    setIndex(i)
    if (options.history !== false && location.hash !== `#${into.id}`)
      history.pushState(null, "", `#${into.id}`)
    const animate = live.current.motion && options.animate !== false
    arrival.current = {
      // The liquid reveal already supplies the entrance; let the live DOM settle
      // underneath it so the handoff cannot fade back to partly hidden text.
      delay: 0,
      direction: i > previousIndex ? 1 : -1,
    }
    // Snapshot outgoing content before moving the track. Destination coordinates are
    // normalized to its final viewport, so the liquid pixels resolve into its layout.
    if (animate && from && from !== into)
      transition(from, into, {
        origin: options.origin,
        align: true,
        direction: i > previousIndex ? 1 : -1,
        variant: screenVariant(Math.min(previousIndex, i)),
      })
    if (live.current.wide) place(i, animate)
    else into.scrollIntoView({ block: "start", behavior: "instant" })
    lockUntil.current = animate ? performance.now() + 760 : 0
    if (options.focus) {
      const heading = into.querySelector<HTMLElement>("h1,h2") ?? into
      heading.focus({ preventScroll: true })
    }
  }, [])

  // Arrival and direct hashes show content immediately. Resizing preserves the section.
  useLayoutEffect(() => {
    const html = document.documentElement,
      prev = html.dataset.layout,
      ps = pages()
    const previousPanel = prev === "v" ? visiblePanel() : null
    settle()
    if (wide) {
      const current = previousPanel
      idx.current = Math.max(
        0,
        current
          ? ps.indexOf(current)
          : ps.findIndex((p) => `#${p.id}` === location.hash),
      )
      html.dataset.layout = "h"
      place(idx.current, false)
    } else {
      html.dataset.layout = "v"
      track.current?.style.removeProperty("transform")
      track.current?.style.removeProperty("transition")
      const target =
        prev === "h"
          ? ps[idx.current]
          : ps.find((p) => `#${p.id}` === location.hash)
      target?.scrollIntoView({ block: "start", behavior: "instant" })
    }
    setIndex(idx.current)
    setPagesMeta(ps.map((p) => ({ id: p.id, label: p.dataset.panel ?? "" })))
    return cancelEffects
  }, [wide, settle])

  useEffect(() => {
    if (!motion) settle()
  }, [motion, settle])

  useEffect(() => {
    const root = pages()[index]
    if (motion && wide && root)
      entrance.current = animateEntrance(root, arrival.current)
    return () => entrance.current()
  }, [index, motion, wide])

  useEffect(() => {
    if (previousMode.current !== mode) entrance.current()
    previousMode.current = mode
  }, [mode])

  // Shared anchor/history handling for both layouts. Normal links keep native behavior.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return
      const link = (e.target as Element).closest?.(
        'a[href^="#"]',
      ) as HTMLAnchorElement | null
      const destination = link && document.getElementById(link.hash.slice(1))
      if (!destination || !track.current?.contains(destination)) return
      const page = destination.closest<HTMLElement>("[data-panel]")
      if (!page) return
      e.preventDefault()
      go(pages().indexOf(page), {
        focus: e.detail === 0,
        origin: e.detail ? { x: e.clientX, y: e.clientY } : undefined,
      })
    }
    const onHistory = () => {
      const i = pages().findIndex((p) => `#${p.id}` === location.hash)
      if (i >= 0 && i !== idx.current) go(i, { history: false, animate: false })
      else if (!location.hash) go(0, { history: false, animate: false })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle()
    }
    const onVisibility = () => {
      if (document.hidden) settle()
    }
    document.addEventListener("click", onClick)
    addEventListener("hashchange", onHistory)
    addEventListener("popstate", onHistory)
    addEventListener("keydown", onKey)
    addEventListener("resize", settle)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      document.removeEventListener("click", onClick)
      removeEventListener("hashchange", onHistory)
      removeEventListener("popstate", onHistory)
      removeEventListener("keydown", onKey)
      removeEventListener("resize", settle)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [go, settle])

  useEffect(() => {
    if (!wide) return
    let accum = 0,
      lastWheel = 0,
      quietNeeded = false,
      raf = 0
    const show = () => {
      const off = Math.max(-1, Math.min(1, accum / THRESH)),
        p = pages()[idx.current]
      if (p)
        p.style.transform =
          live.current.motion && off ? `translate3d(${-off * 40}px,0,0)` : ""
      if (meter.current)
        meter.current.style.transform = `scaleX(${Math.abs(off)})`
    }
    const decay = () => {
      raf = 0
      if (performance.now() - lastWheel < 140) {
        raf = requestAnimationFrame(decay)
        return
      }
      accum *= 0.82
      if (Math.abs(accum) < 1) accum = 0
      show()
      if (accum) raf = requestAnimationFrame(decay)
    }
    const onWheel = (e: WheelEvent) => {
      if (
        (e.target as Element).closest?.(
          "dialog,input,textarea,select,[contenteditable]",
        )
      )
        return
      const now = performance.now(),
        quiet = now - lastWheel
      if (now < lockUntil.current) {
        // Momentum does not queue pages. A fresh gesture can interrupt and settle.
        if (quiet > 220) settle()
        lastWheel = now
        return
      }
      if (quietNeeded && quiet < 180) {
        lastWheel = now
        return
      }
      quietNeeded = false
      lastWheel = now
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      const delta =
        raw * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1)
      const p = pages()[idx.current]
      // Inner scrolling regions (including shelves) keep their own scroll.
      let inner = e.target as HTMLElement | null
      while (inner && inner !== p) {
        if (
          inner.scrollWidth > inner.clientWidth + 2 &&
          Math.abs(e.deltaX) > Math.abs(e.deltaY)
        )
          return
        inner = inner.parentElement
      }
      if (
        p &&
        p.scrollHeight > p.clientHeight + 2 &&
        ((delta > 0 && p.scrollTop + p.clientHeight < p.scrollHeight - 2) ||
          (delta < 0 && p.scrollTop > 0))
      )
        return
      accum += delta
      if (Math.abs(accum) >= THRESH) {
        const dir = Math.sign(accum)
        accum = 0
        show()
        quietNeeded = true
        go(idx.current + dir)
        return
      }
      show()
      if (!raf) raf = requestAnimationFrame(decay)
    }
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : document.body
      if (
        e.defaultPrevented ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        target.closest(
          'input,textarea,select,[contenteditable],dialog,[role="slider"]',
        )
      )
        return
      let i = idx.current
      if (["ArrowRight", "ArrowDown", "PageDown"].includes(e.key)) i++
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) i--
      else if (e.key === " " && !target.closest("button,a"))
        i += e.shiftKey ? -1 : 1
      else if (e.key === "Home") i = 0
      else if (e.key === "End") i = pages().length - 1
      else return
      e.preventDefault()
      go(i, { focus: true })
    }
    let tx = 0,
      ty = 0,
      dragZone = false
    const onTouchStart = (e: TouchEvent) => {
      tx = e.touches[0].clientX
      ty = e.touches[0].clientY
      dragZone = !!(e.target as Element).closest?.(
        "[data-drag],button,a,input,dialog",
      )
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (dragZone || getSelection()?.toString()) return
      const p = e.changedTouches[0],
        dx = tx - p.clientX,
        dy = ty - p.clientY
      const distance = Math.abs(dx) > Math.abs(dy) ? dx : dy
      if (Math.abs(distance) > 60) go(idx.current + Math.sign(distance))
    }
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement,
        page = el.closest<HTMLElement>("[data-panel]")
      const i = page ? pages().indexOf(page) : -1
      if (i >= 0 && i !== idx.current) go(i, { animate: false })
    }
    addEventListener("wheel", onWheel, { passive: true })
    addEventListener("keydown", onKey)
    addEventListener("touchstart", onTouchStart, { passive: true })
    addEventListener("touchend", onTouchEnd, { passive: true })
    document.addEventListener("focusin", onFocus)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener("wheel", onWheel)
      removeEventListener("keydown", onKey)
      removeEventListener("touchstart", onTouchStart)
      removeEventListener("touchend", onTouchEnd)
      document.removeEventListener("focusin", onFocus)
      settle()
    }
  }, [wide, go, settle])

  // Natural scrolling uses a short, one-time reveal, never a full-screen transition.
  useEffect(() => {
    if (wide || !motion || !("IntersectionObserver" in window)) return
    const elements =
      track.current!.querySelectorAll<HTMLElement>("[data-reveal]")
    const stops: Array<() => void> = []
    const observer = new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          if (!isIntersecting) continue
          const el = target as HTMLElement
          if (
            el.getBoundingClientRect().top > 0 &&
            !el.contains(document.activeElement)
          )
            stops.push(animateEntrance(el))
          observer.unobserve(el)
        }
      },
      { threshold: 0.12 },
    )
    elements.forEach((el) => observer.observe(el))
    return () => {
      observer.disconnect()
      stops.forEach((stop) => stop())
    }
  }, [wide, motion, mode])

  const current = pagesMeta[index]
  return (
    <>
      <div className="deck">
        <div ref={track} className="deck-track">
          {children}
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {wide && current
          ? `Page ${index + 1} of ${pagesMeta.length}: ${current.label}`
          : ""}
      </p>
      <div
        data-deck-status
        className="site-status fixed inset-x-0 bottom-0 z-30 hidden h-14 items-center gap-6 bg-bg/85 px-8 font-sans text-xs text-muted backdrop-blur hz:flex"
      >
        <span className="w-16 shrink-0 tabular-nums text-fg">
          {pad(index + 1)}
          <span className="text-muted"> / {pad(pagesMeta.length || 1)}</span>
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
                "=".repeat(index) +
                ">" +
                "-".repeat(Math.max(0, pagesMeta.length - index - 1)) +
                "]"}
            </span>
          ) : (
            <div
              className="vivid-bar deck-progress absolute inset-y-0 left-0 w-full origin-left"
              style={{
                transform: `scaleX(${
                  pagesMeta.length > 1 ? index / (pagesMeta.length - 1) : 0
                })`,
              }}
            />
          )}
        </div>
        <span aria-hidden="true" className="ml-auto flex items-center gap-3">
          {index < pagesMeta.length - 1 ? "keep scrolling" : "the end"}
          {mode !== "ascii" && (
            <span className="relative h-[3px] w-14 overflow-hidden rounded bg-line">
              <span
                ref={meter}
                className="vivid-bar absolute inset-0 origin-left scale-x-0"
              />
            </span>
          )}
        </span>
      </div>
    </>
  )
}
