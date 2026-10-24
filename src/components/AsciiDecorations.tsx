import { useEffect } from "react"

const SELECTOR =
  ".card,.box,.popover,.game-tile,[role='group'],#project-detail,[data-ascii-frame]"

/** Decorative character frames; native text, focus targets and media stay live. */
export default function AsciiDecorations() {
  useEffect(() => {
    const frames = new Map<HTMLElement, HTMLPreElement>()
    let raf = 0
    let active = true
    const draw = () => {
      raf = 0
      for (const [el, frame] of frames) {
        if (!el.isConnected) {
          resize.unobserve(el)
          frame.remove()
          delete el.dataset.asciiFramed
          frames.delete(el)
          continue
        }
        if (!frame.isConnected) {
          resize.unobserve(el)
          frames.delete(el)
          continue
        }
      }
      for (const el of document.querySelectorAll<HTMLElement>(SELECTOR)) {
        if (el.closest("[data-ascii-decor]") || frames.has(el)) continue
        const frame = document.createElement("pre")
        frame.dataset.asciiDecor = ""
        frame.setAttribute("aria-hidden", "true")
        el.dataset.asciiFramed = ""
        el.appendChild(frame)
        frames.set(el, frame)
        resize.observe(el)
      }
      // Read all sizes before writing character grids.
      const sizes = [...frames].map(([el, frame]) => ({
        frame,
        rect: el.getBoundingClientRect(),
      }))
      for (const { frame, rect } of sizes) {
        if (rect.width < 12 || rect.height < 12) continue
        const columns = Math.max(4, Math.min(220, Math.floor(rect.width / 7.2)))
        const font = rect.width / columns / 0.6
        const rows = Math.max(
          3,
          Math.min(80, Math.round(rect.height / (font * 1.35))),
        )
        const edge = "+" + "-".repeat(columns - 2) + "+"
        const middle = "|" + " ".repeat(columns - 2) + "|"
        const text = [edge, ...Array(rows - 2).fill(middle), edge].join("\n")
        if (frame.textContent !== text) frame.textContent = text
        frame.style.fontSize = font + "px"
        frame.style.lineHeight = rect.height / rows + "px"
      }
    }
    const schedule = () => {
      if (active && !raf) raf = requestAnimationFrame(draw)
    }
    const resize = new ResizeObserver(schedule)
    const mutation = new window.MutationObserver((records) => {
      const changed = records.some((record) => {
        if ((record.target as Element).closest?.("[data-ascii-decor]"))
          return false
        return [...record.addedNodes, ...record.removedNodes].some(
          (node) =>
            node instanceof Element && !node.hasAttribute("data-ascii-decor"),
        )
      })
      if (changed) schedule()
    })
    mutation.observe(document.body, { childList: true, subtree: true })
    draw()
    document.fonts?.ready.then(schedule)
    return () => {
      active = false
      mutation.disconnect()
      resize.disconnect()
      cancelAnimationFrame(raf)
      frames.forEach((frame, el) => {
        frame.remove()
        delete el.dataset.asciiFramed
      })
      frames.clear()
    }
  }, [])
  return null
}
