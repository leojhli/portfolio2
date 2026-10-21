import { useEffect, useRef } from 'react'

/**
 * Decorative, non-interactive overlay (pointer-events: none).
 * Pixel dissolution is an APPROXIMATION: grid cells over [data-fx] visuals are
 * masked in the background color (holes) while fragments drift outward, then
 * the visual "reconstructs" as the holes fade (~350 ms). DOM content itself never moves.
 */
type Cell = { x: number; y: number; vx: number; vy: number; t: number; ch: string }
type Ripple = { x: number; y: number; t: number }

const R = 100, LIFE = 350, RIP = 900, G = 8, MAX = 420
const CHARS = '.:+*#%'

export default function EffectsLayer({ ascii }: { ascii: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const asciiRef = useRef(ascii)
  asciiRef.current = ascii

  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      c.width = innerWidth * dpr
      c.height = innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    let cells: Cell[] = []
    let ripples: Ripple[] = []
    const seen = new Map<string, number>()
    let pending: { x: number; y: number } | null = null
    let raf = 0

    const spawn = (px: number, py: number, now: number) => {
      const sel = getSelection()
      const hasSel = !!sel && !sel.isCollapsed
      const active = document.activeElement
      for (const el of document.querySelectorAll<HTMLElement>('[data-fx]')) {
        const r = el.getBoundingClientRect()
        const nx = Math.max(r.left, Math.min(px, r.right)), ny = Math.max(r.top, Math.min(py, r.bottom))
        if (Math.hypot(nx - px, ny - py) > R) continue
        if (active && active !== document.body && (el.contains(active) || active.contains(el))) continue
        if (hasSel && sel!.containsNode(el, true)) continue
        const x0 = Math.floor(Math.max(r.left, px - R) / G) * G, x1 = Math.min(r.right, px + R)
        const y0 = Math.floor(Math.max(r.top, py - R) / G) * G, y1 = Math.min(r.bottom, py + R)
        for (let x = x0; x < x1; x += G) {
          for (let y = y0; y < y1; y += G) {
            if (cells.length >= MAX) return
            if (x < r.left - 1 || y < r.top - 1 || x + G > r.right + 1 || y + G > r.bottom + 1) continue
            const d = Math.hypot(x + G / 2 - px, y + G / 2 - py)
            if (d > R) continue
            const key = `${x},${y}`
            if ((seen.get(key) ?? -1e9) > now - LIFE * 0.7) continue
            if (Math.random() > (1 - d / R) * 0.75) continue
            seen.set(key, now)
            const a = Math.atan2(y - py, x - px)
            const sp = 0.02 + Math.random() * 0.05
            cells.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: now, ch: CHARS[Math.floor(Math.random() * CHARS.length)] })
          }
        }
      }
    }

    const frame = (now: number) => {
      raf = 0
      const css = getComputedStyle(document.documentElement)
      const bg = css.getPropertyValue('--c-bg').trim(), fx = css.getPropertyValue('--c-fx').trim()
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      if (pending) { spawn(pending.x, pending.y, now); pending = null }
      const asc = asciiRef.current
      ctx.font = '11px "JetBrains Mono", monospace'
      cells = cells.filter((k) => now - k.t < LIFE)
      for (const k of cells) {
        const p = (now - k.t) / LIFE
        const e = 1 - p * p
        ctx.globalAlpha = e
        ctx.fillStyle = bg
        ctx.fillRect(k.x, k.y, G, G)
        const age = now - k.t
        ctx.fillStyle = fx
        ctx.globalAlpha = e * 0.85
        const fx0 = k.x + k.vx * age * 6, fy0 = k.y + k.vy * age * 6
        if (asc) ctx.fillText(k.ch, fx0, fy0 + G)
        else ctx.fillRect(fx0 + 1, fy0 + 1, G - 3, G - 3)
      }
      ripples = ripples.filter((r) => now - r.t < RIP)
      const maxR = Math.hypot(innerWidth, innerHeight)
      for (const r of ripples) {
        // The rAF timestamp can predate the pointerdown's performance.now(); clamp so the radius never goes negative.
        const p = Math.max(0, (now - r.t) / RIP)
        const rad = (1 - (1 - p) ** 3) * maxR
        ctx.globalAlpha = (1 - p) * 0.4
        if (asc) {
          ctx.fillStyle = fx
          const n = Math.min(160, Math.floor((2 * Math.PI * rad) / 16))
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2
            ctx.fillText(i % 3 ? '·' : '*', r.x + Math.cos(a) * rad, r.y + Math.sin(a) * rad)
          }
        } else {
          ctx.strokeStyle = fx
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(r.x, r.y, rad, 0, Math.PI * 2)
          ctx.stroke()
          ctx.globalAlpha *= 0.5
          ctx.beginPath()
          ctx.arc(r.x, r.y, rad * 0.8, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
      if (seen.size > 4000) seen.clear()
      if (cells.length || ripples.length) kick()
    }
    const kick = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(frame) }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      pending = { x: e.clientX, y: e.clientY }
      kick()
    }
    const onDown = (e: PointerEvent) => {
      ripples.push({ x: e.clientX, y: e.clientY, t: performance.now() })
      if (ripples.length > 4) ripples.shift()
      kick()
      // Bounded spring on decorative elements only; hit areas never move.
      const maxD = Math.hypot(innerWidth, innerHeight)
      for (const el of document.querySelectorAll<HTMLElement>('[data-spring]')) {
        const r = el.getBoundingClientRect()
        if (r.bottom < 0 || r.top > innerHeight) continue
        const dx = r.left + r.width / 2 - e.clientX, dy = r.top + r.height / 2 - e.clientY
        const d = Math.hypot(dx, dy) || 1
        const f = Math.max(0, 1 - d / (maxD * 0.7))
        if (f <= 0) continue
        window.setTimeout(() => {
          el.style.transform = `translate(${((dx / d) * 3 * f).toFixed(2)}px, ${((dy / d) * 3 * f).toFixed(2)}px) rotate(${((Math.random() - 0.5) * 0.8 * f).toFixed(2)}deg)`
          window.setTimeout(() => (el.style.transform = ''), 140)
        }, (d / maxD) * RIP * 0.6)
      }
    }
    const clear = () => { cells = []; ctx.clearRect(0, 0, innerWidth, innerHeight) }
    const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; cells = []; ripples = [] } }

    addEventListener('pointermove', onMove, { passive: true })
    addEventListener('pointerdown', onDown, { passive: true })
    addEventListener('resize', resize)
    addEventListener('scroll', clear, { passive: true })
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerdown', onDown)
      removeEventListener('resize', resize)
      removeEventListener('scroll', clear)
      document.removeEventListener('visibilitychange', onVis)
      document.querySelectorAll<HTMLElement>('[data-spring]').forEach((el) => (el.style.transform = ''))
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 h-full w-full" />
}
