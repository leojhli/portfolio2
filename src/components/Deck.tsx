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
import { bruteforce, pixelWipe } from "../effects/pager"

// Paged layout only where a full page fits; smaller screens stack vertically.
const Q = "(min-width: 1024px) and (min-height: 700px)"
const THRESH = 240
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(Q)
  m.addEventListener("change", cb)
  return () => m.removeEventListener("change", cb)
}
const pad = (n: number) => String(n).padStart(2, "0")
const delayOf = (el: HTMLElement) =>
  (Number(el.style.getPropertyValue("--d")) || 0) * 95

/**
 * Each section is a full-screen page laid out left to right. Scrolling builds up
 * "pull"; past the threshold the deck turns to the next page, a pixel wipe sweeps
 * across, and the new page's elements pixelate (or brute-force, in ASCII) into place.
 */
export default function Deck({
  nav,
  children,
}: {
  nav: Array<[string, string]>
  children: ReactNode
}) {
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(Q).matches,
  )
  const { motion, mode } = usePrefs()
  const live = useRef({ motion, ascii: mode === "ascii" })
  live.current = { motion, ascii: mode === "ascii" }
  const track = useRef<HTMLDivElement>(null)
  const meter = useRef<HTMLSpanElement>(null)
  const idx = useRef(0)
  const lockUntil = useRef(0)
  const timers = useRef<number[]>([])
  const [index, setIndex] = useState(0)
  const [pagesMeta, setPagesMeta] = useState<Array<{
    id: string
    label: string
  }>>([])

  const pages = () =>
    track.current
      ? [...track.current.children].filter(
          (n): n is HTMLElement =>
            n instanceof HTMLElement && n.hasAttribute("data-panel"),
        )
      : []

  const enter = (page: HTMLElement | undefined) => {
    page?.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      el.classList.remove("px-in", "px-out")
      void el.offsetWidth
      el.classList.add("is-in")
      if (!live.current.motion) return
      el.classList.add("px-in")
      window.setTimeout(() => el.classList.remove("px-in"), 1800)
      if (live.current.ascii) bruteforce(el, delayOf(el))
    })
  }
  const leave = (page: HTMLElement) =>
    page.querySelectorAll("[data-reveal]").forEach((el) => {
      el.classList.remove("px-in")
      el.classList.add("px-out")
    })
  const hide = (page: HTMLElement) =>
    page
      .querySelectorAll("[data-reveal]")
      .forEach((el) => el.classList.remove("px-out", "px-in", "is-in"))
  const place = (i: number, animate: boolean) => {
    const t = track.current
    if (!t) return
    t.style.transition = animate
      ? "transform 0.8s cubic-bezier(0.76, 0, 0.24, 1)"
      : "none"
    t.style.transform = `translate3d(${-i * 100}vw,0,0)`
  }

  const go = useCallback((target: number) => {
    const ps = pages()
    const i = Math.max(0, Math.min(ps.length - 1, target))
    const from = idx.current
    if (i === from || !ps[i]) return
    timers.current.forEach(clearTimeout)
    timers.current = []
    idx.current = i
    setIndex(i)
    history.replaceState(null, "", `#${ps[i].id}`)
    const out = ps[from],
      into = ps[i]
    out.style.transform = ""
    if (!live.current.motion) {
      hide(out)
      place(i, false)
      enter(into)
      return
    }
    lockUntil.current = performance.now() + 1100
    leave(out)
    pixelWipe(i > from ? 1 : -1, live.current.ascii)
    timers.current.push(window.setTimeout(() => place(i, true), 180))
    timers.current.push(
      window.setTimeout(() => {
        hide(out)
        enter(into)
      }, 560),
    )
  }, [])

  // Keep the reader on the same section when the layout switches.
  useLayoutEffect(() => {
    const html = document.documentElement
    const prev = html.dataset.layout
    const ps = pages()
    if (wide) {
      let k =
        prev === "v"
          ? ps.findIndex(
              (p) =>
                p.getBoundingClientRect().bottom > window.innerHeight * 0.4,
            )
          : ps.findIndex((p) => `#${p.id}` === location.hash)
      k = Math.max(0, k)
      idx.current = k
      setIndex(k)
      html.dataset.layout = "h"
    } else {
      html.dataset.layout = "v"
      if (prev === "h") ps[idx.current]?.scrollIntoView({ block: "start" })
    }
  }, [wide])

  useEffect(() => {
    const t = track.current!
    const ps = pages()
    setPagesMeta(ps.map((p) => ({ id: p.id, label: p.dataset.panel ?? "" })))
    if (!wide) {
      t.style.transform = ""
      t.style.transition = ""
      ps.forEach((p) => (p.style.transform = ""))
      return
    }
    place(idx.current, false)
    ps.forEach((p, k) => k !== idx.current && hide(p))
    enter(ps[idx.current])

    let accum = 0,
      lastWheel = 0,
      quietNeeded = false,
      raf = 0
    const show = () => {
      const p = pages()[idx.current]
      const off = Math.max(-1, Math.min(1, accum / THRESH))
      if (p) p.style.transform = off ? `translate3d(${-off * 56}px,0,0)` : ""
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
    const turn = (dir: number) => {
      accum = 0
      show()
      quietNeeded = true
      go(idx.current + dir)
    }

    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest?.("dialog")) return
      const now = performance.now()
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      const delta =
        raw *
        (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1)
      // Ignore trackpad momentum that follows a page turn.
      if (now < lockUntil.current || (quietNeeded && now - lastWheel < 180)) {
        lastWheel = now
        return
      }
      quietNeeded = false
      lastWheel = now
      const p = pages()[idx.current]
      if (p && p.scrollHeight > p.clientHeight + 2) {
        if (delta > 0 && p.scrollTop + p.clientHeight < p.scrollHeight - 2)
          return
        if (delta < 0 && p.scrollTop > 0) return
      }
      accum += delta
      if (Math.abs(accum) >= THRESH) return turn(Math.sign(accum))
      show()
      if (!raf) raf = requestAnimationFrame(decay)
    }
    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement
      if (tg.closest("input, textarea, select, [contenteditable], dialog"))
        return
      const k = e.key
      let d = 0
      if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown") d = 1
      else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") d = -1
      else if (k === " " && !tg.closest("button, a")) d = e.shiftKey ? -1 : 1
      else if (k === "Home" || k === "End") {
        e.preventDefault()
        go(k === "Home" ? 0 : pages().length - 1)
        return
      }
      if (!d) return
      e.preventDefault()
      if (performance.now() >= lockUntil.current) go(idx.current + d)
    }
    let tx = 0,
      ty = 0,
      dragZone = false
    // Swipes that start on a draggable 3D stage spin it instead of turning the page.
    const onTouchStart = (e: TouchEvent) => {
      tx = e.touches[0].clientX
      ty = e.touches[0].clientY
      dragZone = !!(e.target as Element).closest?.("[data-drag]")
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (dragZone) return
      const p = e.changedTouches[0]
      const dx = tx - p.clientX,
        dy = ty - p.clientY
      const m = Math.abs(dx) > Math.abs(dy) ? dx : dy
      if (Math.abs(m) > 60 && performance.now() >= lockUntil.current)
        go(idx.current + Math.sign(m))
    }
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey
      )
        return
      const a = (e.target as Element).closest?.(
        'a[href^="#"]',
      ) as HTMLAnchorElement | null
      const el = a && document.getElementById(a.hash.slice(1))
      if (!el || !t.contains(el)) return
      e.preventDefault()
      const p = el.closest<HTMLElement>("[data-panel]")
      if (!p) return
      go(pages().indexOf(p))
      p.focus({ preventScroll: true })
    }
    // Tabbing into another page turns to it.
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (!t.contains(el)) return
      const i = pages().indexOf(el.closest<HTMLElement>("[data-panel]")!)
      if (i >= 0 && i !== idx.current) go(i)
    }
    window.addEventListener("wheel", onWheel, { passive: true })
    window.addEventListener("keydown", onKey)
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchend", onTouchEnd, { passive: true })
    document.addEventListener("click", onClick)
    document.addEventListener("focusin", onFocus)
    return () => {
      cancelAnimationFrame(raf)
      timers.current.forEach(clearTimeout)
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchend", onTouchEnd)
      document.removeEventListener("click", onClick)
      document.removeEventListener("focusin", onFocus)
    }
  }, [wide, go])

  // Switching Dynamic/ASCII replays the current page's build-in.
  const firstMode = useRef(true)
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false
      return
    }
    if (wide) enter(pages()[idx.current])
  }, [mode])

  // Stacked layout: elements pixelate in as they enter the viewport (and replay).
  useEffect(() => {
    if (wide) return
    const els = track.current!.querySelectorAll<HTMLElement>("[data-reveal]")
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("is-in"))
      return
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach(({ target, isIntersecting }) => {
          const el = target as HTMLElement
          if (isIntersecting && !el.classList.contains("is-in")) {
            el.classList.add("is-in")
            if (!live.current.motion) return
            el.classList.add("px-in")
            window.setTimeout(() => el.classList.remove("px-in"), 1800)
            if (live.current.ascii) bruteforce(el, delayOf(el))
          } else if (!isIntersecting) el.classList.remove("is-in", "px-in")
        }),
      { threshold: 0.12 },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [wide, mode])

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
      <div className="fixed inset-x-0 bottom-0 z-30 hidden h-14 items-center gap-6 border-t border-line bg-bg/85 px-8 font-mono text-xs text-muted backdrop-blur hz:flex">
        <span className="w-16 shrink-0 tabular-nums text-fg">
          {pad(index + 1)}
          <span className="text-muted"> / {pad(pagesMeta.length || 1)}</span>
        </span>
        <nav aria-label="Sections">
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
          className="relative h-[3px] flex-1 overflow-hidden rounded bg-line"
        >
          <div
            className="vivid-bar absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
            style={{
              width: `${
                pagesMeta.length > 1
                  ? (index / (pagesMeta.length - 1)) * 100
                  : 0
              }%`,
            }}
          />
        </div>
        <span aria-hidden="true" className="flex items-center gap-3">
          {index < pagesMeta.length - 1 ? "keep scrolling" : "the end"}
          <span className="relative h-[3px] w-14 overflow-hidden rounded bg-line">
            <span
              ref={meter}
              className="vivid-bar absolute inset-0 origin-left scale-x-0"
            />
          </span>
        </span>
      </div>
    </>
  )
}
