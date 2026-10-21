/** Page-turn effects. All canvases are decorative and never intercept input. */

const GLYPHS = '!<>-_\\/[]{}=+*^?#%&$@01'
const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
const active = new WeakMap<Element, () => void>()

/**
 * ASCII mode: text cycles through random glyphs and locks in left-to-right,
 * like the page is brute-forcing its own copy. Non-ASCII (e.g. 李嘉和) never changes.
 */
export function bruteforce(root: HTMLElement, delay = 0) {
  active.get(root)?.()
  type N = { node: Text; orig: string[]; last: string; at: number[]; dead: boolean }
  const nodes: N[] = []
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
    const v = n.nodeValue ?? ''
    if (!v.trim() || n.parentElement?.closest('[aria-live], [data-noscramble], pre')) continue
    const chars = [...v]
    const span = Math.min(650, 140 + chars.length * 20)
    nodes.push({ node: n, orig: chars, last: v, dead: false, at: chars.map((_, i) => delay + (i / chars.length) * span + Math.random() * 200) })
  }
  if (!nodes.length) return
  const t0 = performance.now()
  let raf = 0, lastSwap = 0
  const stop = () => {
    cancelAnimationFrame(raf)
    for (const n of nodes) if (!n.dead && n.node.nodeValue === n.last) n.node.nodeValue = n.orig.join('')
    active.delete(root)
  }
  active.set(root, stop)
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    if (now - lastSwap < 45) return
    lastSwap = now
    const t = now - t0
    let pending = false
    for (const n of nodes) {
      if (n.dead) continue
      // React re-rendered this text: leave it alone.
      if (n.node.nodeValue !== n.last) { n.dead = true; continue }
      const out = n.orig.map((ch, i) => (t >= n.at[i] || !/[!-~]/.test(ch) ? ch : ((pending = true), glyph()))).join('')
      n.node.nodeValue = out
      n.last = out
    }
    if (!pending) stop()
  }
  raf = requestAnimationFrame(frame)
}

/** Grid-aligned pixel wipe that sweeps across the screen in the direction of travel. */
export function pixelWipe(dir: 1 | -1, ascii: boolean) {
  const css = getComputedStyle(document.documentElement)
  const v = (n: string) => css.getPropertyValue(n).trim()
  const colors = [v('--c-accent'), v('--c-fg'), v('--c-accent'), v('--c-muted')]
  const W = window.innerWidth, H = window.innerHeight
  const c = document.createElement('canvas')
  c.setAttribute('aria-hidden', 'true')
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:45'
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  c.width = W * dpr
  c.height = H * dpr
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.font = '600 18px "Geist Mono", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  document.body.appendChild(c)

  const G = 48, LIFE = 340, SWEEP = 640
  const cols = Math.ceil(W / G), rows = Math.ceil(H / G)
  const cells: Array<{ x: number; y: number; start: number; col: string }> = []
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (Math.random() > 0.58) continue
      const order = dir > 0 ? cols - 1 - i : i
      cells.push({ x: i * G, y: j * G, start: (order / cols) * SWEEP + Math.random() * 160, col: colors[Math.floor(Math.random() * colors.length)] })
    }
  }
  const t0 = performance.now()
  let raf = 0
  const end = () => { cancelAnimationFrame(raf); c.remove() }
  const frame = (now: number) => {
    const t = now - t0
    ctx.clearRect(0, 0, W, H)
    for (const cell of cells) {
      const p = (t - cell.start) / LIFE
      if (p < 0 || p > 1) continue
      const k = Math.sin(Math.PI * p)
      ctx.fillStyle = cell.col
      if (ascii) {
        ctx.globalAlpha = k
        ctx.fillText(glyph(), cell.x + G / 2, cell.y + G / 2)
      } else {
        const s = Math.round((G - 2) * k)
        ctx.globalAlpha = 0.9 * k
        ctx.fillRect(cell.x + (G - s) / 2, cell.y + (G - s) / 2, s, s)
      }
    }
    if (t > SWEEP + LIFE + 200) return end()
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  window.setTimeout(end, 2000)
}
