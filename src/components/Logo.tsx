import { usePrefs } from "../state/preferences"

/** Two forward-leaning Ls; character lettering in the terminal presentation. */
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
      width="38"
      height="38"
      viewBox="0 0 42 42"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11 6H19L11.8 30H35L29 36H2L11 6ZM26 6H34L30.4 18H40L34 24H20.6L26 6Z" />
    </svg>
  )
}
