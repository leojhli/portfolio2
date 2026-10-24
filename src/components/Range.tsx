import type { InputHTMLAttributes } from "react"
import { usePrefs } from "../state/preferences"

/** Native keyboard/pointer range with a character-only visual in ASCII mode. */
export default function Range(props: InputHTMLAttributes<HTMLInputElement>) {
  const { mode } = usePrefs()
  if (mode !== "ascii") return <input {...props} type="range" />
  const min = Number(props.min ?? 0),
    max = Number(props.max ?? 1)
  const ratio =
    max > min
      ? Math.max(
          0,
          Math.min(1, (Number(props.value ?? min) - min) / (max - min)),
        )
      : 0
  const cells = 12,
    position = Math.round(ratio * (cells - 1))
  const bar =
    "[" + "=".repeat(position) + "o" + "-".repeat(cells - position - 1) + "]"
  return (
    <span
      className={`ascii-range relative inline-flex min-h-11 items-center ${props.className ?? ""}`}
    >
      <span aria-hidden="true" className="pointer-events-none text-xs">
        {bar}
      </span>
      <input
        {...props}
        type="range"
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </span>
  )
}
