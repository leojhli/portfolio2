import { monogramParts, monogramViewBox } from "../content/monogram"
import { usePrefs } from "../state/preferences"

/** Exact supplied silhouette, with the established color groups and glow. */
export default function Logo() {
  const { mode } = usePrefs()
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
      className="surname-mark"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {monogramParts.map(part => <path key={part.id} data-part={part.id} className={`mark-${part.tone}`} fillRule="evenodd" d={part.d} />)}
    </svg>
  )
}
