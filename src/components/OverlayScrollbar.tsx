import { useEffect, useRef } from "react"

/** Native document scrolling, with a draggable thumb that reserves no gutter. */
export default function OverlayScrollbar() {
  const rail = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = rail.current!,
      handle = thumb.current!,
      html = document.documentElement
    html.dataset.overlayScrollbar = "true"
    let raf = 0,
      travel = 1,
      maximum = 1,
      height = 40
    let drag: {
      pointer: number
      y: number
      scroll: number
    } | null = null
    const paint = () => {
      raf = 0
      const total = html.scrollHeight
      maximum = Math.max(0, total - innerHeight)
      const available = Math.max(1, innerHeight - 8)
      height = Math.min(
        available,
        Math.max(40, (available * innerHeight) / Math.max(1, total)),
      )
      travel = Math.max(1, available - height)
      el.hidden = maximum === 0
      handle.style.height = `${height}px`
      handle.style.transform = `translateY(${Math.max(0, Math.min(1, scrollY / Math.max(1, maximum))) * travel}px)`
      el.setAttribute(
        "aria-valuenow",
        String(Math.round((scrollY / Math.max(1, maximum)) * 100)),
      )
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(paint)
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return
      paint()
      event.preventDefault()
      el.focus({ preventScroll: true })
      if (event.target !== handle) {
        const y = event.clientY - el.getBoundingClientRect().top - height / 2
        window.scrollTo({
          top: Math.max(0, Math.min(1, y / travel)) * maximum,
          behavior: "instant",
        })
      }
      drag = { pointer: event.pointerId, y: event.clientY, scroll: scrollY }
      el.setPointerCapture(event.pointerId)
      el.dataset.dragging = "true"
    }
    const move = (event: PointerEvent) => {
      if (!drag || drag.pointer !== event.pointerId) return
      window.scrollTo({
        top: Math.max(
          0,
          Math.min(
            maximum,
            drag.scroll + ((event.clientY - drag.y) / travel) * maximum,
          ),
        ),
        behavior: "instant",
      })
    }
    const end = () => {
      drag = null
      delete el.dataset.dragging
    }
    const key = (event: KeyboardEvent) => {
      const deltas: Record<string, number> = {
        ArrowDown: 48,
        ArrowUp: -48,
        PageDown: innerHeight * 0.85,
        PageUp: -innerHeight * 0.85,
        " ": innerHeight * (event.shiftKey ? -0.85 : 0.85),
      }
      if (!(event.key in deltas) && event.key !== "Home" && event.key !== "End")
        return
      event.preventDefault()
      window.scrollTo({
        top:
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? maximum
              : Math.max(0, Math.min(maximum, scrollY + deltas[event.key])),
        behavior: "instant",
      })
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(document.body)
    addEventListener("scroll", schedule, { passive: true })
    addEventListener("resize", schedule)
    el.addEventListener("pointerdown", down)
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", end)
    el.addEventListener("pointercancel", end)
    el.addEventListener("lostpointercapture", end)
    el.addEventListener("keydown", key)
    paint()
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      removeEventListener("scroll", schedule)
      removeEventListener("resize", schedule)
      el.removeEventListener("pointerdown", down)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", end)
      el.removeEventListener("pointercancel", end)
      el.removeEventListener("lostpointercapture", end)
      el.removeEventListener("keydown", key)
      delete html.dataset.overlayScrollbar
    }
  }, [])
  return (
    <div
      ref={rail}
      className="overlay-scrollbar"
      role="scrollbar"
      aria-label="Page scroll"
      aria-controls="main"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      tabIndex={0}
    >
      <span ref={thumb} aria-hidden="true" />
    </div>
  )
}
