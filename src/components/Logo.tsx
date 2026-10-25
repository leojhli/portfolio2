import { usePrefs } from "../state/preferences"

/** Interlocking forward-cut Ls, drawn on one consistent diagonal grid. */
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
      viewBox="0 0 48 40"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 4H21L10 29H29L25 37H0L12 4ZM29 4H38L31 20H48L43 28H18L29 4Z" />
    </svg>
  )
}
