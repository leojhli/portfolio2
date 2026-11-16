import { useMemo, useRef, useState } from "react"
import { BUY_HOUR, HISTORY, HISTORY_START } from "../content/pickemHistory"

const W = 640
const H = 230
const PAD = { l: 34, r: 14, t: 18, b: 26 }
const start = new Date(HISTORY_START).getTime()
const end = HISTORY[HISTORY.length - 1][0]
// Show from a week before the bet so the flat stretch doesn't dominate.
const FROM = Math.max(0, BUY_HOUR - 24 * 9)
const points = HISTORY.filter(([t]) => t >= FROM)
const x = (t: number) => PAD.l + ((t - FROM) / (end - FROM)) * (W - PAD.l - PAD.r)
const y = (p: number) => PAD.t + (1 - p) * (H - PAD.t - PAD.b)
const day = (t: number) =>
  new Date(start + t * 3600_000).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" })
const priceAt = (t: number) => {
  let last = points[0][1]
  for (const [pt, p] of points) {
    if (pt > t) break
    last = p
  }
  return last
}

/**
 * The market's real price for "LPL wins Worlds", hour by hour, with the bet
 * marked on it. Everything above the entry price after the buy is profit.
 * Moving the pointer along the chart shows what the position was worth then.
 */
export default function OddsChart({
  shares,
  entry,
  stake,
  usdToCad,
  events,
}: {
  shares: number
  entry: number
  /** What the position cost, in US dollars, fees included. */
  stake: number
  usdToCad: number
  events: { hour: number; label: string }[]
}) {
  const host = useRef<SVGSVGElement>(null)
  const [at, setAt] = useState<number | null>(null)
  const line = useMemo(() => points.map(([t, p], i) => `${i ? "L" : "M"}${x(t).toFixed(1)} ${y(p).toFixed(1)}`).join(" "), [])
  const profit = useMemo(() => {
    const after = points.filter(([t]) => t >= BUY_HOUR)
    const top = after.map(([t, p]) => `L${x(t).toFixed(1)} ${y(Math.max(p, entry)).toFixed(1)}`).join(" ")
    return `M${x(BUY_HOUR).toFixed(1)} ${y(entry).toFixed(1)} ${top} L${x(end).toFixed(1)} ${y(entry).toFixed(1)} Z`
  }, [entry])
  const cad = (usd: number) => `C$${(usd * usdToCad).toFixed(2)}`
  const hover = at === null ? null : { t: at, p: priceAt(at) }

  const track = (clientX: number) => {
    const box = host.current?.getBoundingClientRect()
    if (!box?.width) return
    const t = FROM + ((((clientX - box.left) / box.width) * W - PAD.l) / (W - PAD.l - PAD.r)) * (end - FROM)
    setAt(Math.min(end, Math.max(FROM, t)))
  }

  return (
    <div className="pk-chart">
      <div className="pk-chart-head">
        <span>Market odds · LPL to win Worlds</span>
        <span className="pk-chart-read">
          {hover
            ? `${day(hover.t)} · ${(hover.p * 100).toFixed(0)}% · ${
                hover.t >= BUY_HOUR ? `position worth ${cad(shares * hover.p)}` : "before I bought"
              }`
            : "Move across the chart"}
        </span>
      </div>
      <svg
        ref={host}
        viewBox={`0 0 ${W} ${H}`}
        className="pk-chart-svg"
        role="img"
        aria-label={`Polymarket price for LPL winning Worlds 2026. Bought at ${(entry * 100).toFixed(0)} percent on ${day(BUY_HOUR)}; the market resolved at 100 percent.`}
        onMouseMove={(event) => track(event.clientX)}
        onMouseLeave={() => setAt(null)}
        onTouchMove={(event) => track(event.touches[0].clientX)}
        onTouchEnd={() => setAt(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p} className="pk-grid">
            <line x1={PAD.l} x2={W - PAD.r} y1={y(p)} y2={y(p)} />
            <text x={PAD.l - 6} y={y(p) + 3} textAnchor="end">
              {p * 100}%
            </text>
          </g>
        ))}
        {[FROM, BUY_HOUR, end].map((t, i) => (
          <text key={i} className="pk-axis" x={x(t)} y={H - 8} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}>
            {day(t)}
          </text>
        ))}
        <path d={profit} className="pk-profit" />
        <line x1={x(BUY_HOUR)} x2={W - PAD.r} y1={y(entry)} y2={y(entry)} className="pk-entry" />
        <path d={line} pathLength={1} className="pk-price" />
        {events.map((event) => (
          <g key={event.label} className="pk-event-mark">
            <line x1={x(event.hour)} x2={x(event.hour)} y1={PAD.t} y2={H - PAD.b} />
            <text x={x(event.hour) - 6} y={PAD.t + 9} textAnchor="end">
              {event.label}
            </text>
          </g>
        ))}
        <g className="pk-buy">
          <circle cx={x(BUY_HOUR)} cy={y(entry)} r={9} className="pk-buy-ring" />
          <circle cx={x(BUY_HOUR)} cy={y(entry)} r={4.5} />
          <text x={x(BUY_HOUR)} y={y(entry) + 22} textAnchor="middle">
            Bought · {+(entry * 100).toFixed(1)}% · {cad(stake)}
          </text>
        </g>
        {hover && (
          <g className="pk-scrub">
            <line x1={x(hover.t)} x2={x(hover.t)} y1={PAD.t} y2={H - PAD.b} />
            <circle cx={x(hover.t)} cy={y(hover.p)} r={4} />
          </g>
        )}
      </svg>
    </div>
  )
}
