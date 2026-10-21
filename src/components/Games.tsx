import {
  useEffect,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from "react"
import type { Game } from "../content/data"
import { usePrefs } from "../state/preferences"
import ClipScreen from "./ClipScreen"

// Official marks via Simple Icons (CC0 icon data). Trademarks belong to their owners.
const OFFICIAL: Record<string, string> = {
  lol: "m1.912 0 1.212 2.474v19.053L1.912 24h14.73l1.337-4.682H8.33V0ZM12 1.516c-.913 0-1.798.112-2.648.312v1.74a9.738 9.738 0 0 1 2.648-.368c5.267 0 9.536 4.184 9.536 9.348a9.203 9.203 0 0 1-2.3 6.086l-.273.954-.602 2.112c2.952-1.993 4.89-5.335 4.89-9.122C23.25 6.468 18.213 1.516 12 1.516Zm0 2.673c-.924 0-1.814.148-2.648.414v13.713h8.817a8.246 8.246 0 0 0 2.36-5.768c0-4.617-3.818-8.359-8.529-8.359zM2.104 7.312A10.858 10.858 0 0 0 .75 12.576c0 1.906.492 3.7 1.355 5.266z",
  valorant:
    "M23.792 2.152a.252.252 0 0 0-.098.083c-3.384 4.23-6.769 8.46-10.15 12.69-.107.093-.025.288.119.265 2.439.003 4.877 0 7.316.001a.66.66 0 0 0 .552-.25c.774-.967 1.55-1.934 2.324-2.903a.72.72 0 0 0 .144-.49c-.002-3.077 0-6.153-.003-9.23.016-.11-.1-.206-.204-.167zM.077 2.166c-.077.038-.074.132-.076.205.002 3.074.001 6.15.001 9.225a.679.679 0 0 0 .158.463l7.64 9.55c.12.152.308.25.505.247 2.455 0 4.91.003 7.365 0 .142.02.222-.174.116-.265C10.661 15.176 5.526 8.766.4 2.35c-.08-.094-.174-.272-.322-.184z",
  roblox:
    "M18.926 23.998 0 18.892 5.075.002 24 5.108ZM15.348 10.09l-5.282-1.453-1.414 5.273 5.282 1.453z",
}

// No public vector mark available here: stand-in symbols until an official file is added via `logo`.
const S = (c: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width="30"
    height="30"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinejoin="round"
    strokeLinecap="round"
  >
    {c}
  </svg>
)
const STANDIN: Record<string, ReactNode> = {
  rocket: S(
    <>
      <circle cx="17" cy="8" r="3.5" />
      <path d="M2 17l3-4h8l2 4z" />
      <circle cx="6" cy="18" r="1.5" />
      <circle cx="12.5" cy="18" r="1.5" />
    </>,
  ),
  minecraft: S(
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </>,
  ),
  gd: S(
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <rect x="8" y="8" width="3" height="3" />
      <rect x="13" y="8" width="3" height="3" />
      <path d="M8 15h8" />
    </>,
  ),
  clash: S(
    <>
      <path d="M4 18l-1-10 5 4 4-7 4 7 5-4-1 10z" />
      <path d="M4 21h16" />
    </>,
  ),
  brawl: S(
    <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
  ),
  poker: S(
    <>
      <path
        d="M12 3c3 4 7 6 7 10a4 4 0 0 1-7 2.6A4 4 0 0 1 5 13c0-4 4-6 7-10z"
        fill="currentColor"
      />
      <path d="M12 15l-2 6h4z" fill="currentColor" />
    </>,
  ),
  chess: S(
    <>
      <path d="M8 21h9M9 21l1-5c-2-1-3-3-2.5-6L12 4l1.5 2 2 .5c1.5 2 2 5 .5 7.5l-1 2.5.5 4.5" />
      <circle cx="12.5" cy="8.5" r=".6" fill="currentColor" />
    </>,
  ),
}
const short: Record<string, string> = {
  lol: "LoL",
  valorant: "VAL",
  roblox: "RBX",
  rocket: "RL",
  minecraft: "MC",
  gd: "GD",
  clash: "CR",
  brawl: "BS",
  poker: "♠",
  chess: "♞",
}

function Mark({ g }: { g: Game }) {
  const [failed, setFailed] = useState(false)
  if (g.logo && !failed)
    return (
      <img
        src={g.logo}
        alt=""
        className="size-8 object-contain"
        onError={() => setFailed(true)}
      />
    )
  if (OFFICIAL[g.id])
    return (
      <svg
        viewBox="0 0 24 24"
        width="30"
        height="30"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d={OFFICIAL[g.id]} />
      </svg>
    )
  return <>{STANDIN[g.id]}</>
}

const TILE = [1, 2, 3, 4, 5].map((n) => ({
  "--tile": `var(--c-s${n})`,
  "--tile-fg": `var(--c-on-s${n})`,
}))

export default function Games({ games }: { games: Game[] }) {
  const { mode } = usePrefs()
  const ascii = mode === "ascii"
  const [hover, setHover] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [tapped, setTapped] = useState<string | null>(null)
  useEffect(() => {
    if (!tapped) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTapped(null)
    const onDown = (e: PointerEvent) =>
      !(e.target as Element).closest?.("[data-game]") && setTapped(null)
    addEventListener("keydown", onKey)
    addEventListener("pointerdown", onDown)
    return () => {
      removeEventListener("keydown", onKey)
      removeEventListener("pointerdown", onDown)
    }
  }, [tapped])
  // Hover previews on pointer devices; focus previews for keyboards; a tap pins a game (touch).
  const activeId = hover ?? focus ?? tapped
  const ai = games.findIndex((g) => g.id === activeId)

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12">
      <div data-game className="lg:order-2">
        <ClipScreen game={ai >= 0 ? games[ai] : null} channel={ai + 1} />
      </div>
      <div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-4 sm:grid-cols-5">
          {games.map((g, gi) => {
            const cls =
              "game-tile group relative inline-flex size-[72px] items-center justify-center sm:size-20"
            const style = {
              "--r": `${(gi % 2 ? -1 : 1) * (3 + (gi % 3) * 2)}deg`,
              ...TILE[gi % 5],
            } as CSSProperties
            const inner = ascii ? (
              <span className="font-mono text-sm">[{short[g.id]}]</span>
            ) : (
              <Mark g={g} />
            )
            const tip = (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-3 -translate-x-1/2 whitespace-nowrap rounded-md border border-fg bg-fg px-2.5 py-1 font-mono text-xs text-bg ${
                  tapped === g.id
                    ? "block"
                    : "hidden group-hover:block group-focus-visible:block"
                }`}
              >
                {g.name}
              </span>
            )
            const events = {
              onPointerEnter: (e: RPointerEvent) =>
                e.pointerType !== "touch" && setHover(g.id),
              onPointerLeave: () => setHover(null),
              onFocus: () => setFocus(g.id),
              onBlur: () => setFocus(null),
            }
            return (
              <li key={g.id} data-game data-fx>
                {g.url ? (
                  <a
                    href={g.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={g.name}
                    style={style}
                    className={cls}
                    {...events}
                  >
                    {inner}
                    {tip}
                  </a>
                ) : (
                  <button
                    type="button"
                    aria-label={g.name}
                    aria-pressed={tapped === g.id}
                    data-open={tapped === g.id}
                    style={style}
                    onClick={() => setTapped((t) => (t === g.id ? null : g.id))}
                    className={cls}
                    {...events}
                  >
                    {inner}
                    {tip}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <p className="mt-6 font-mono text-xs text-muted">
          Hover, focus or tap a tile to preview its clip.
        </p>
      </div>
    </div>
  )
}
