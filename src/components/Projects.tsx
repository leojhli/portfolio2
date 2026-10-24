import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import type { Landmark, Project } from "../content/data"
import { usePrefs } from "../state/preferences"
import { assemble } from "../effects/coordinator"

const PlanetView = lazy(() => import("../three/PlanetView"))
const KINDS: Landmark[] = [
  "lighthouse",
  "observatory",
  "rocket",
  "windmill",
  "antenna",
]
const NAMES: Record<Landmark, string> = {
  lighthouse: "Lighthouse",
  observatory: "Observatory",
  rocket: "Launch pad",
  windmill: "Windmill",
  antenna: "Radio dish",
}
const d = (n: number) => ({ "--d": n }) as CSSProperties
const pad = (i: number) => String(i + 1).padStart(2, "0")
// Literal class strings so Tailwind can see them.
const TONE = ["bg-v1 text-on-v1", "bg-v2 text-on-v2", "bg-v3 text-on-v3"]
const SWATCH = [
  "bg-s1 text-on-s1",
  "bg-s2 text-on-s2",
  "bg-s3 text-on-s3",
  "bg-s4 text-on-s4",
  "bg-s5 text-on-s5",
]
const tone = (i: number) => TONE[i % 3]

function Placeholder() {
  return (
    <div
      aria-hidden="true"
      className="grid aspect-square w-full place-items-center"
    >
      <div className="hatch size-[62%] rounded-full border-[1.5px] border-dashed border-muted" />
    </div>
  )
}

/**
 * Projects as landmarks on a small planet. The list is the primary, accessible
 * control; the planet mirrors it (drag to spin, click a landmark to select).
 * Without WebGL the planet is dropped and the list + detail remain.
 */
export default function Projects({ projects }: { projects: Project[] }) {
  const { mode } = usePrefs()
  const ascii = mode === "ascii"
  const [sel, setSel] = useState(0)
  const [hover, setHover] = useState(-1)
  const [focusKey, setFocusKey] = useState(0)
  const [failed, setFailed] = useState(false)
  const detail = useRef<HTMLElement>(null)
  const previous = useRef(sel)
  useEffect(() => {
    if (previous.current !== sel) assemble(detail.current)
    previous.current = sel
  }, [sel])
  const items = projects.map((p, i) => ({
    id: p.id,
    title: p.title,
    landmark: p.landmark ?? KINDS[i % KINDS.length],
  }))
  const choose = (i: number) => {
    setSel(i)
    setFocusKey((k) => k + 1)
  }
  const p = projects[sel]

  return (
    <div
      className={`grid gap-8 lg:items-center ${
        failed ? "" : "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12"
      }`}
    >
      {!failed && (
        <div
          data-reveal
          data-depth="0.065"
          style={d(1)}
          className="relative mx-auto w-full max-w-[min(540px,58vh)]"
        >
          <Suspense fallback={<Placeholder />}>
            <PlanetView
              items={items}
              selected={sel}
              hovered={hover}
              focusKey={focusKey}
              onSelect={choose}
              onHover={setHover}
              onFail={() => setFailed(true)}
            />
          </Suspense>
          <p className="mt-2 text-center font-sans text-xs text-muted">
            {ascii
              ? "< drag to spin · click a landmark >"
              : "Drag to spin · click a landmark"}
          </p>
        </div>
      )}

      <div
        data-reveal
        style={d(2)}
        className={failed ? "grid gap-8 lg:grid-cols-2 lg:items-start" : ""}
      >
        <ul aria-label="Projects" className="grid gap-2">
          {items.map((x, i) => (
            <li key={x.id}>
              <button
                type="button"
                aria-pressed={sel === i}
                aria-controls="project-detail"
                onClick={() => choose(i)}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(-1)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(-1)}
                className={`group flex min-h-12 w-full items-center gap-3 rounded-[10px] border-[1.5px] px-3 text-left transition-colors ${
                  sel === i
                    ? "border-fg bg-surface shadow-[3px_3px_0_var(--c-fg)]"
                    : hover === i
                      ? "border-fg bg-surface/70"
                      : "border-line"
                } ${ascii ? "!rounded-none !border-dashed !shadow-none" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-8 shrink-0 place-items-center rounded-md border-[1.5px] border-fg font-sans text-xs font-semibold ${tone(i)}`}
                >
                  {pad(i)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {x.title}
                </span>
                <span className="shrink-0 font-sans text-[11px] text-muted">
                  {NAMES[x.landmark]}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <article
          id="project-detail"
          ref={detail}
          aria-live="polite"
          className={`card overflow-hidden ${failed ? "" : "mt-6"}`}
          style={{ "--hover": `var(--c-v${(sel % 3) + 1})` } as CSSProperties}
        >
          <div
            className={`flex items-end gap-4 border-b-[1.5px] border-fg px-6 py-4 ${tone(sel)} ${
              ascii ? "!bg-transparent !text-fg border-dashed" : ""
            }`}
          >
            <span className="font-sans text-4xl font-semibold leading-none tracking-tighter">
              {pad(sel)}
            </span>
            <span className="ml-auto font-sans text-[11px] uppercase tracking-wider">
              {NAMES[items[sel].landmark]}
            </span>
          </div>
          {p.image && (
            <img
              src={p.image}
              alt=""
              className="aspect-[16/7] w-full border-b-[1.5px] border-fg object-cover"
            />
          )}
          <div className="p-6">
            <h3 className="text-xl font-semibold tracking-tight">{p.title}</h3>
            <p className="mt-2 text-muted">{p.summary}</p>
            <ul aria-label="Technologies" className="mt-4 flex flex-wrap gap-2">
              {p.technologies.map((x, i) => (
                <li
                  key={x}
                  className={`rounded-md border border-fg px-2 py-0.5 font-sans text-xs ${SWATCH[i % 5]}`}
                >
                  {x}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1">
              {p.repoUrl ? (
                <a
                  className="text-link text-sm"
                  href={p.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Repository
                </a>
              ) : (
                <span className="text-link text-link-off text-sm">
                  repo · soon
                </span>
              )}
              {p.liveUrl ? (
                <a
                  className="text-link text-sm"
                  href={p.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Live
                </a>
              ) : (
                <span className="text-link text-link-off text-sm">
                  live · soon
                </span>
              )}
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
