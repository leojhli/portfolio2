import { useEffect, useRef, useState, type ReactNode } from "react"
import MusicDock from "./MusicDock"
import { usePrefs } from "../state/preferences"
import { cancelEffects } from "../effects/coordinator"
import { railPosition, revealProgress } from "../effects/scrollGeometry"

type Rail = {
  root: HTMLElement
  track: HTMLElement
  top: number
  travel: number
  x: number
}
type Reveal = {
  node: HTMLElement
  top: number
  left: number
  width: number
  rail?: Rail
  artwork: boolean
}

/** Native vertical document; selected chapters travel sideways inside sticky frames. */
export default function Deck({
  nav,
  children,
}: {
  nav: Array<[string, string]>
  children: ReactNode
}) {
  const { motion, mode } = usePrefs()
  const root = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const bookmark = useRef<{
    id: string
    fraction: number
  } | null>(null)
  const [active, setActive] = useState("intro")
  useEffect(() => {
    const host = root.current
    if (!host) return
    const html = document.documentElement
    html.dataset.layout = "story"
    const chapters = [...host.querySelectorAll<HTMLElement>("[data-panel]")]
    const rails: Rail[] = [
      ...host.querySelectorAll<HTMLElement>("[data-horizontal]"),
    ].map((node) => ({
      root: node,
      track: node.querySelector<HTMLElement>(".rail-track")!,
      top: 0,
      travel: 0,
      x: 0,
    }))
    let reveal: Reveal[] = [],
      positions: number[] = [],
      raf = 0,
      dirty = true,
      disposed = false
    let current = "",
      maxScroll = 1
    let restore = bookmark.current !== null,
      viewportWidth = innerWidth,
      viewportHeight = innerHeight
    const query = matchMedia("(min-width: 1024px) and (min-height: 700px)")
    const measure = () => {
      // Measure the layout position, never the previous decorative translation.
      host.querySelectorAll<HTMLElement>("[data-reveal]").forEach((node) => {
        node.style.setProperty("--reveal-y", "0px")
        node.style.setProperty("--reveal-scale", "1")
      })
      const horizontal = query.matches && motion
      html.dataset.rails = horizontal ? "on" : "off"
      for (const rail of rails) {
        rail.travel = horizontal
          ? Math.max(0, rail.track.scrollWidth - innerWidth)
          : 0
        rail.root.style.height = rail.travel
          ? `${innerHeight + rail.travel}px`
          : ""
        rail.track.style.transform = ""
        rail.x = 0
      }
      for (const rail of rails)
        rail.top = rail.root.getBoundingClientRect().top + scrollY
      positions = chapters.map(
        (node) => node.getBoundingClientRect().top + scrollY,
      )
      reveal = [...host.querySelectorAll<HTMLElement>("[data-reveal]")]
        .filter((node) => !node.parentElement?.closest("[data-reveal]"))
        .map((node) => {
          const rect = node.getBoundingClientRect()
          const rail = rails.find((r) => r.track.contains(node))
          return {
            node,
            top: rect.top + scrollY,
            left: rail
              ? rect.left - rail.track.getBoundingClientRect().left
              : 0,
            width: rect.width,
            rail,
            artwork: node.hasAttribute("data-artwork"),
          }
        })
      maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - innerHeight,
      )
      if (restore && bookmark.current) {
        const index = chapters.findIndex(
          (node) => node.id === bookmark.current!.id,
        )
        if (index >= 0) {
          const end = positions[index + 1] ?? maxScroll
          window.scrollTo({
            top: Math.max(
              0,
              Math.min(
                maxScroll,
                positions[index] +
                  bookmark.current.fraction *
                    Math.max(0, end - positions[index]),
              ),
            ),
            behavior: "instant",
          })
        }
      }
      restore = false
      dirty = false
    }
    const paint = () => {
      raf = 0
      if (disposed) return
      if (dirty) measure()
      const y = scrollY
      let readingIndex = 0
      for (let i = 0; i < positions.length; i++)
        if (positions[i] <= y + 1) readingIndex = i
      const span =
        (positions[readingIndex + 1] ?? maxScroll) - positions[readingIndex]
      if (chapters[readingIndex])
        bookmark.current = {
          id: chapters[readingIndex].id,
          fraction: Math.max(
            0,
            Math.min(1, (y - positions[readingIndex]) / Math.max(1, span)),
          ),
        }
      for (const rail of rails) {
        rail.x = railPosition(y, rail.top, rail.travel)
        rail.track.style.transform = rail.travel
          ? `translate3d(${-rail.x}px,0,0)`
          : ""
      }
      for (const item of reveal) {
        const p = !motion
          ? 1
          : item.rail?.travel
            ? revealProgress(
                (innerWidth * 0.94 - (item.left - item.rail.x)) /
                  Math.min(innerWidth * 0.65, Math.max(240, item.width)),
              )
            : revealProgress(
                (innerHeight * 0.96 - (item.top - y)) / (innerHeight * 0.55),
              )
        item.node.style.setProperty("--reveal-opacity", String(0.12 + p * 0.88))
        item.node.style.setProperty(
          "--reveal-y",
          `${
            motion && mode !== "ascii" ? (1 - p) * (item.artwork ? 64 : 30) : 0
          }px`,
        )
        item.node.style.setProperty(
          "--reveal-scale",
          String(mode !== "ascii" && item.artwork ? 0.96 + 0.04 * p : 1),
        )
        item.node.style.setProperty(
          "--photo-x",
          `${
            motion && item.rail?.travel
              ? Math.max(
                  -24,
                  Math.min(
                    24,
                    (item.left - item.rail.x - innerWidth * 0.35) * 0.055,
                  ),
                )
              : 0
          }px`,
        )
      }
      const heroProgress = Math.max(
        0,
        Math.min(1, y / Math.max(1, innerHeight)),
      )
      host.style.setProperty(
        "--hero-progress",
        String(motion ? heroProgress : 0),
      )
      if (progress.current)
        progress.current.style.transform = `scaleX(${Math.min(1, y / maxScroll)})`
      let next = chapters[0]?.id ?? "intro"
      for (let i = 0; i < chapters.length; i++)
        if (positions[i] <= y + innerHeight * 0.38) next = chapters[i].id
      if (current !== next) {
        current = next
        setActive(next)
      }
      dispatchEvent(
        new CustomEvent("portfolio:frame", {
          detail: { y, height: innerHeight, heroProgress },
        }),
      )
    }
    const schedule = () => {
      if (!raf && !disposed) raf = requestAnimationFrame(paint)
    }
    const scroll = () => {
      cancelEffects()
      schedule()
    }
    const resize = () => {
      if (viewportWidth !== innerWidth || viewportHeight !== innerHeight) {
        restore = true
        viewportWidth = innerWidth
        viewportHeight = innerHeight
      }
      dirty = true
      schedule()
    }
    const navigate = (id: string, smooth: boolean) => {
      const target = document.getElementById(id)
      if (!target) return
      if (dirty) measure()
      const chapter = chapters.findIndex((p) => p === target)
      window.scrollTo({
        top:
          chapter >= 0
            ? positions[chapter]
            : target.getBoundingClientRect().top + scrollY - 96,
        behavior: smooth && motion ? "smooth" : "instant",
      })
      schedule()
    }
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
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        'a[href^="#"]',
      )
      if (!link || !document.getElementById(link.hash.slice(1))) return
      event.preventDefault()
      history.pushState(null, "", link.hash)
      navigate(link.hash.slice(1), true)
      if (event.detail === 0)
        document
          .getElementById(link.hash.slice(1))
          ?.focus({ preventScroll: true })
    }
    const historyChange = () =>
      navigate(location.hash.slice(1) || "intro", false)
    const focus = (event: FocusEvent) => {
      const target = event.target as HTMLElement
      const rail = rails.find((r) => r.travel > 0 && r.track.contains(target))
      if (!rail) return
      const rect = target.getBoundingClientRect()
      if (rect.left >= 24 && rect.right <= innerWidth - 24) return
      window.scrollTo({
        top:
          rail.top +
          Math.max(0, Math.min(rail.travel, rail.x + rect.left - 80)),
        behavior: "instant",
      })
      schedule()
    }
    const ro =
      typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null
    ro?.observe(host)
    rails.forEach((r) => ro?.observe(r.track))
    addEventListener("scroll", scroll, { passive: true })
    addEventListener("resize", resize)
    addEventListener("popstate", historyChange)
    addEventListener("hashchange", historyChange)
    query.addEventListener("change", resize)
    document.addEventListener("click", click)
    host.addEventListener("focusin", focus)
    document.fonts?.addEventListener("loadingdone", resize)
    measure()
    if (location.hash && !host.dataset.positioned) historyChange()
    host.dataset.positioned = "true"
    paint()
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
      removeEventListener("scroll", scroll)
      removeEventListener("resize", resize)
      removeEventListener("popstate", historyChange)
      removeEventListener("hashchange", historyChange)
      query.removeEventListener("change", resize)
      document.removeEventListener("click", click)
      host.removeEventListener("focusin", focus)
      document.fonts?.removeEventListener("loadingdone", resize)
      rails.forEach((r) => {
        r.root.style.height = ""
        r.track.style.transform = ""
      })
      reveal.forEach(({ node }) =>
        [
          "--reveal-opacity",
          "--reveal-y",
          "--reveal-scale",
          "--photo-x",
        ].forEach((p) => node.style.removeProperty(p)),
      )
      delete html.dataset.rails
    }
  }, [motion, mode])
  const navActive = ["gallery", "playground", "listening", "games"].includes(
    active,
  )
    ? "about"
    : active
  return (
    <>
      <div ref={root} className="story">
        {children}
      </div>
      <div className="story-status site-status" data-deck-status>
        <a href="#intro" className="status-home" aria-label="Back to start">
          LL / <span>portfolio</span>
        </a>
        <nav aria-label="Sections">
          <ul>
            {nav.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="nav-link"
                  aria-current={navActive === id ? "true" : undefined}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <MusicDock />
        <div className="story-progress" aria-hidden="true">
          <div ref={progress} />
        </div>
      </div>
    </>
  )
}
