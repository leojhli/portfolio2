import { useId, type CSSProperties } from "react"
import { monogramParts, monogramViewBox } from "../content/monogram"
import { usePrefs } from "../state/preferences"

// The order 李 is written in (木: 横, 竖, 点, 撇, 捺; then 子), and the
// direction each piece of the logo is drawn in, in degrees (y points down).
const strokes: Record<string, number> = {
  "upper-left": -20,
  "upper-right": 70,
  dot: 110,
  "left-leg": 144,
  "right-leg": 36,
  "lower-hook": 80,
  counter: -14,
}
const order = ["upper-left", "upper-right", "dot", "left-leg", "right-leg", "lower-hook", "counter"]

function bounds(d: string) {
  const values = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [0, 0]
  const xs = values.filter((_, i) => i % 2 === 0)
  const ys = values.filter((_, i) => i % 2 === 1)
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const y0 = Math.min(...ys), y1 = Math.max(...ys)
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, reach: Math.hypot(x1 - x0, y1 - y0) / 2 + 24 }
}

/**
 * The 李 monogram. With `write`, it is drawn stroke by stroke in the order
 * the character is written, like a brush, then holds.
 */
export default function Logo({ write = false, pace = 1 }: { write?: boolean; pace?: number }) {
  const { mode } = usePrefs()
  const uid = useId().replace(/:/g, "")
  if (mode === "ascii")
    return (
      <span aria-hidden="true" className="text-sm tracking-tight">
        [LL]
      </span>
    )
  return (
    <svg
      width="44"
      height="56"
      viewBox={monogramViewBox}
      className={write ? "surname-mark surname-mark-write" : "surname-mark"}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {write && (
        <defs>
          {monogramParts.map((part) => {
            const { cx, cy, reach } = bounds(part.d)
            const index = order.indexOf(part.id)
            const style = {
              "--from": `${-2 * reach}px`,
              animationDuration: `${0.36 * pace}s`,
              animationDelay: `${(0.12 + index * 0.3) * pace}s`,
            } as CSSProperties
            return (
              <mask key={part.id} id={`${uid}-${part.id}`} maskUnits="userSpaceOnUse" x="-400" y="-400" width="1800" height="2000">
                <g transform={`rotate(${strokes[part.id] ?? 0} ${cx} ${cy})`}>
                  <rect className="stroke-wipe" style={style} x={cx - reach} y={cy - reach} width={reach * 2} height={reach * 2} fill="#fff" />
                </g>
              </mask>
            )
          })}
        </defs>
      )}
      {monogramParts.map((part) => (
        <path
          key={part.id}
          data-part={part.id}
          className={`mark-${part.tone}`}
          fillRule="evenodd"
          d={part.d}
          mask={write ? `url(#${uid}-${part.id})` : undefined}
        />
      ))}
    </svg>
  )
}
