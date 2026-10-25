import { useId, type CSSProperties } from "react"
import li from "../assets/name/li.json"
import jia from "../assets/name/jia.json"
import he from "../assets/name/he.json"
import { usePrefs } from "../state/preferences"

const characters = [li, jia, he]

/** Individual silhouettes clipped to their own pen trajectories, in stroke order. */
export default function NameDrawing({ background = false }: { background?: boolean }) {
  const id = useId().replace(/:/g, "")
  const { mode } = usePrefs()
  if (mode === "ascii") return background ? null : <>Leo Li<span className="hero-period">.</span></>
  if (!background) return (
    <span className="english-name-drawing">
      <span className="sr-only">Leo Li.</span>
      <svg viewBox="0 0 520 160" aria-hidden="true">
        <text x="0" y="132" textLength="500" lengthAdjust="spacingAndGlyphs">Leo Li.</text>
      </svg>
    </span>
  )
  let preceding = 0
  return (
    <div className="chinese-name-drawing" aria-hidden="true">
      {characters.map((character, index) => {
        const start = preceding
        preceding += character.strokes.length
        return (
          <svg key={index} viewBox="0 0 1024 1024" data-character={"李嘉和"[index]}>
            <g transform="translate(0 900) scale(1 -1)">
              {character.strokes.map((outline, stroke) => {
                const clip = `${id}-${index}-${stroke}`
                const median = character.medians[stroke]
                return (
                  <g key={stroke}>
                    <defs><clipPath id={clip}><path d={outline} /></clipPath></defs>
                    <path
                      className="name-pen-stroke"
                      clipPath={`url(#${clip})`}
                      d={median.map(([x, y], point) => `${point ? "L" : "M"}${x} ${y}`).join(" ")}
                      pathLength="1"
                      style={{ "--pen-delay": `${0.35 + (start + stroke) * 0.115}s` } as CSSProperties}
                    />
                  </g>
                )
              })}
            </g>
          </svg>
        )
      })}
    </div>
  )
}
