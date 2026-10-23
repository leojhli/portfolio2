import { useEffect, useRef } from "react"
import type { Landmark } from "../content/data"
import { createPlanet, type PlanetApi } from "./planet"
import { useStage } from "./useStage"

type Props = {
  items: Array<{
    id: string
    title: string
    landmark: Landmark
  }>
  selected: number
  hovered: number
  focusKey: number
  onSelect(i: number): void
  onHover(i: number): void
  onFail(): void
}

/** The interactive canvas. Everything here is mirrored by the accessible project list. */
export default function PlanetView({
  items,
  selected,
  hovered,
  focusKey,
  onSelect,
  onHover,
  onFail,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const labels = useRef<Array<HTMLSpanElement | null>>([])
  const cbs = useRef({ onSelect, onHover })
  cbs.current = { onSelect, onHover }
  const kinds = items.map((p) => p.landmark)
  const api = useStage<PlanetApi>(
    host,
    (s, el, c) => {
      const a = createPlanet(s, el, kinds, c, {
        onHover: (i) => cbs.current.onHover(i),
        onSelect: (i) => cbs.current.onSelect(i),
      })
      a.setLabels(labels.current)
      a.select(selected, false)
      return a
    },
    [kinds.join()],
    onFail,
  )
  useEffect(() => {
    api.current?.select(selected, focusKey > 0)
  }, [selected, focusKey, api])
  useEffect(() => {
    api.current?.highlight(hovered)
  }, [hovered, api])

  return (
    <div
      ref={host}
      data-fx
      data-drag
      role="img"
      aria-label={`Planet with ${items.length} project landmarks. Use the project list to explore them.`}
      className="stage aspect-square w-full select-none"
    >
      {items.map((p, i) => (
        <span
          key={p.id}
          ref={(el) => {
            labels.current[i] = el
          }}
          aria-hidden="true"
          onClick={() => onSelect(i)}
          onPointerEnter={() => onHover(i)}
          onPointerLeave={() => onHover(-1)}
          className={`planet-label absolute left-0 top-0 cursor-pointer whitespace-nowrap rounded-full border-[1.5px] border-fg px-2.5 py-0.5 font-mono text-[11px] shadow-[2px_2px_0_var(--c-fg)] ${
            i === selected
              ? "bg-accent-fill text-on-accent-fill"
              : i === hovered
                ? "bg-v3 text-on-v3"
                : "bg-surface text-fg"
          }`}
          style={{ visibility: "hidden" }}
        >
          {String(i + 1).padStart(2, "0")} · {p.title}
        </span>
      ))}
    </div>
  )
}
