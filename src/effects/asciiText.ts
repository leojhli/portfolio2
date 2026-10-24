const RAMP = " .:+*#@"

export function asciiTextGlyph(alpha: number) {
  if (!Number.isFinite(alpha) || alpha < 28) return " "
  return RAMP[
    Math.min(
      RAMP.length - 1,
      Math.max(1, Math.round(Math.sqrt(alpha / 255) * (RAMP.length - 1))),
    )
  ]
}

const EXCLUDE =
  "script,style,noscript,pre,canvas,input,textarea,select,.sr-only,.ascii-out,[data-ascii-decor],[data-ascii-icon],[data-ascii-text],.ascii-range"
type Entry = {
  element: HTMLElement
  canvas: HTMLCanvasElement
  nodes: Text[]
  ready: boolean
  visible: boolean
}

/**
 * Rasterize each real text run into tiny ASCII glyphs, once when it becomes
 * visible. Cached local canvases move with the document; scrolling never
 * re-rasterizes text. Original DOM strings remain selectable and accessible.
 */
export function createAsciiText(root: HTMLElement) {
  const doc = root.ownerDocument
  const entries = new Map<HTMLElement, Entry>()
  const dirty = new Set<Entry>()
  const sample = doc.createElement("canvas")
  sample.dataset.asciiTextSample = ""
  const source = sample.getContext("2d", { willReadFrequently: true })
  let active = true,
    raf = 0,
    needsScan = true
  if (!source) return () => {}
  const range = doc.createRange()
  const visible = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return (
      r.width > 0 &&
      r.height > 0 &&
      r.right > -180 &&
      r.left < innerWidth + 180 &&
      r.bottom > -100 &&
      r.top < innerHeight + 100
    )
  }
  const schedule = () => {
    if (active && !raf) raf = requestAnimationFrame(work)
  }
  const mark = (entry: Entry) => {
    dirty.add(entry)
    schedule()
  }
  const intersection =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (records) => {
            for (const record of records) {
              const entry = entries.get(record.target as HTMLElement)
              if (!entry) continue
              entry.visible = record.isIntersecting
              if (entry.visible && (!entry.ready || dirty.has(entry)))
                mark(entry)
            }
          },
          { rootMargin: "180px" },
        )
      : null
  const resize = new ResizeObserver((records) => {
    for (const record of records) {
      const entry = entries.get(record.target as HTMLElement)
      if (entry) mark(entry)
    }
  })
  function scan() {
    needsScan = false
    const groups = new Map<HTMLElement, Text[]>()
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue
      const parent = node.parentElement
      if (!parent || parent.closest(EXCLUDE)) continue
      const nodes = groups.get(parent) ?? []
      nodes.push(node as Text)
      groups.set(parent, nodes)
    }
    for (const [element, entry] of entries) {
      if (!element.isConnected || !groups.has(element)) {
        intersection?.unobserve(element)
        resize.unobserve(element)
        entry.canvas.remove()
        entry.canvas.width = entry.canvas.height = 0
        delete element.dataset.asciiTextHost
        delete element.dataset.asciiTextPosition
        dirty.delete(entry)
        entries.delete(element)
      }
    }
    for (const [element, nodes] of groups) {
      const existing = entries.get(element)
      if (existing) {
        existing.nodes = nodes
        continue
      }
      const canvas = doc.createElement("canvas")
      canvas.dataset.asciiText = ""
      canvas.setAttribute("aria-hidden", "true")
      const entry: Entry = {
        element,
        canvas,
        nodes,
        ready: false,
        visible: visible(element),
      }
      entries.set(element, entry)
      resize.observe(element)
      intersection?.observe(element)
      dirty.add(entry)
    }
  }
  function render(entry: Entry) {
    const { element, canvas, nodes } = entry
    if (!element.isConnected) return
    const style = getComputedStyle(element)
    if (style.display === "none" || style.visibility === "hidden") return
    const rect = element.getBoundingClientRect(),
      size = parseFloat(style.fontSize) || 14
    if (rect.width <= 0 || rect.height <= 0) return
    const detailed = nodes.some((node) =>
      /\p{Script=Han}/u.test(node.textContent ?? ""),
    )
    const character = Math.max(1.7, size / (detailed ? 14 : 7.5)),
      advance = character * 0.6
    // First measure source ink. A short label never samples its whole wide button.
    const letters: Array<{
      text: string
      x: number
      y: number
      width: number
      height: number
    }> = []
    let left = rect.width,
      top = rect.height,
      right = 0,
      bottom = 0,
      count = 0
    for (const node of nodes) {
      const text = node.textContent ?? ""
      for (let i = 0; i < text.length && count < 1600; ) {
        let char = String.fromCodePoint(text.codePointAt(i)!)
        range.setStart(node, i)
        range.setEnd(node, i + char.length)
        i += char.length
        if (!char.trim()) continue
        const r = range.getBoundingClientRect()
        if (!r.width || !r.height) continue
        if (style.textTransform === "uppercase") char = char.toUpperCase()
        if (style.textTransform === "lowercase") char = char.toLowerCase()
        const x = r.left - rect.left,
          y = r.top - rect.top
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x + r.width)
        bottom = Math.max(bottom, y + r.height)
        letters.push({ text: char, x, y, width: r.width, height: r.height })
        count++
      }
    }
    if (!letters.length) return
    left = Math.max(0, Math.floor(left / advance) * advance)
    top = Math.max(0, Math.floor(top / character) * character)
    right = Math.min(rect.width, right)
    bottom = Math.min(rect.height, bottom)
    const columns = Math.max(1, Math.ceil((right - left) / advance))
    const rows = Math.max(1, Math.ceil((bottom - top) / character))
    sample.width = columns
    sample.height = rows
    source!.setTransform(
      1 / advance,
      0,
      0,
      1 / character,
      -left / advance,
      -top / character,
    )
    source!.fillStyle = "#ffffff"
    source!.font = `${style.fontStyle || "normal"} 600 ${size}px ${style.fontFamily || "monospace"}`
    source!.textBaseline = "alphabetic"
    for (const letter of letters)
      source!.fillText(
        letter.text,
        letter.x,
        letter.y + (letter.height + size) / 2 - size * 0.16,
      )
    const pixels = source!.getImageData(0, 0, columns, rows).data
    const dpr = Math.min(devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.ceil(rect.width * dpr))
    canvas.height = Math.max(1, Math.ceil(rect.height * dpr))
    canvas.style.width = rect.width + "px"
    canvas.style.height = rect.height + "px"
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = `600 ${character}px "Geist Mono",monospace`
    ctx.textBaseline = "top"
    ctx.fillStyle = style.color
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        const glyph = asciiTextGlyph(pixels[(row * columns + col) * 4 + 3])
        if (glyph !== " ") {
          ctx.fillText(glyph, left + col * advance, top + row * character)
          // Reinforce tiny UI marks with their exact same strokes. No blur or
          // ordinary text is substituted for the ASCII character artwork.
          if (character < 3)
            ctx.fillText(glyph, left + col * advance, top + row * character)
        }
      }
    // Commit only after successful rendering: there is never a blank loading state.
    if (style.position === "static" || !style.position)
      element.dataset.asciiTextPosition = "relative"
    if (canvas.parentElement !== element) element.appendChild(canvas)
    element.dataset.asciiTextHost = ""
    entry.ready = true
  }
  function work() {
    raf = 0
    if (!active) return
    if (needsScan) scan()
    const start = performance.now()
    let count = 0
    for (const entry of dirty) {
      if (!entry.visible && !visible(entry.element)) continue
      entry.visible = true
      dirty.delete(entry)
      try {
        render(entry)
      } catch {
        // Keep original ink visible if a canvas/font/readback is unavailable.
        delete entry.element.dataset.asciiTextHost
        entry.canvas.remove()
      }
      if (++count >= 5 || performance.now() - start > 5) break
    }
    if ([...dirty].some((entry) => entry.visible)) schedule()
  }
  const observer = new window.MutationObserver((records) => {
    for (const record of records) {
      const target =
        record.target instanceof Element
          ? record.target
          : record.target.parentElement
      if (!target || target.closest(EXCLUDE)) continue
      if (record.type === "attributes") {
        // Scene labels can become visible without changing their text or size.
        // Once drawn, their per-frame position styles must not redraw glyphs.
        const entry = entries.get(target as HTMLElement)
        if (
          entry &&
          !entry.ready &&
          entry.element.style.visibility !== "hidden"
        )
          mark(entry)
      } else if (record.type === "characterData") {
        const entry = entries.get(target as HTMLElement)
        if (entry) mark(entry)
        else needsScan = true
      } else if (
        [...record.addedNodes, ...record.removedNodes].some(
          (node) =>
            !(
              node instanceof Element &&
              (node.hasAttribute("data-ascii-text") ||
                node.hasAttribute("data-ascii-decor"))
            ),
        )
      ) {
        needsScan = true
        const entry = entries.get(target as HTMLElement)
        if (entry) mark(entry)
      }
    }
    if (needsScan) schedule()
  })
  observer.observe(root, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class", "hidden"],
  })
  const presentation = new window.MutationObserver(() => {
    entries.forEach((entry) => dirty.add(entry))
    schedule()
  })
  presentation.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: ["style", "data-theme"],
  })
  const scrolled = () => {
    if (!intersection)
      entries.forEach((entry) => {
        if (visible(entry.element)) {
          entry.visible = true
          if (!entry.ready) dirty.add(entry)
        }
      })
    if (dirty.size) schedule()
  }
  root.addEventListener("scroll", scrolled, { passive: true, capture: true })
  const fonts = () => {
    entries.forEach((entry) => dirty.add(entry))
    schedule()
  }
  doc.fonts?.addEventListener("loadingdone", fonts)
  doc.fonts?.ready.then(() => {
    if (active) fonts()
  })
  schedule()
  return () => {
    active = false
    cancelAnimationFrame(raf)
    observer.disconnect()
    presentation.disconnect()
    resize.disconnect()
    intersection?.disconnect()
    root.removeEventListener("scroll", scrolled, true)
    doc.fonts?.removeEventListener("loadingdone", fonts)
    entries.forEach((entry) => {
      entry.canvas.remove()
      entry.canvas.width = entry.canvas.height = 0
      delete entry.element.dataset.asciiTextHost
      delete entry.element.dataset.asciiTextPosition
    })
    entries.clear()
    dirty.clear()
    sample.width = sample.height = 0
  }
}
