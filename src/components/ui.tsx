import type { CSSProperties, ReactNode } from "react"
import { usePrefs } from "../state/preferences"
import type { Contact } from "../content/data"
import Icon from "./Icons"

/** One full-screen page in the deck (stacked sections on small screens). */
export function Panel({
  id,
  index,
  kicker,
  title,
  accent,
  children,
}: {
  id: string
  index: string
  kicker: string
  title: string
  accent?: string
  children: ReactNode
}) {
  const { mode } = usePrefs()
  const ascii = mode === "ascii"
  return (
    <section
      id={id}
      data-panel={kicker}
      data-anchor
      tabIndex={-1}
      aria-labelledby={`${id}-h`}
      className="panel outline-none"
      style={
        {
          "--ghost": `var(--c-v${(((Number(index) || 1) - 1) % 3) + 1})`,
        } as CSSProperties
      }
    >
      <span aria-hidden="true" className="ghost-num">
        {index}
      </span>
      <div data-reveal className="relative mb-10">
        <p className="font-mono text-xs text-muted">
          {ascii ? (
            <>
              [<span className="text-accent">{index}</span>] {kicker}
            </>
          ) : (
            <>
              <span className="text-accent">{index}</span> — {kicker}
            </>
          )}
        </p>
        <h2
          id={`${id}-h`}
          className="mt-3 font-display text-[clamp(2.25rem,4.4vw,3.75rem)] font-semibold leading-none tracking-[-0.045em]"
        >
          {title}
          {accent && <span className="text-accent"> {accent}</span>}
        </h2>
      </div>
      <div className="relative">{children}</div>
    </section>
  )
}

/**
 * Pixelation filters at fixed block sizes. CSS keyframes step through them so
 * elements render as chunky pixels that resolve into crisp UI.
 */
export const PIXEL_SIZES = [2, 4, 8, 14, 24, 40]
export function PixelFilters() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <defs>
        {PIXEL_SIZES.map((b) => (
          <filter
            key={b}
            id={`px-${b}`}
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feFlood x={b / 2} y={b / 2} width="1" height="1" />
            <feComposite width={b} height={b} />
            <feTile result="grid" />
            <feComposite in="SourceGraphic" in2="grid" operator="in" />
            <feMorphology operator="dilate" radius={b / 2} />
          </filter>
        ))}
      </defs>
    </svg>
  )
}

/** Per-letter hover animation; the real string stays available to assistive tech. */
export function Kinetic({
  text,
  className = "",
}: {
  text: string
  className?: string
}) {
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {[...text].map((ch, i) =>
          ch === " " ? (
            <span key={i}> </span>
          ) : (
            <span key={i} className="kl" style={{ "--i": i } as CSSProperties}>
              {ch}
            </span>
          ),
        )}
      </span>
    </span>
  )
}

const Dot = ({ i }: { i: number }) => (
  <span
    aria-hidden="true"
    className="size-2.5 shrink-0 rounded-full border border-fg"
    style={{ background: `var(--c-v${((i + 1) % 3) + 1})` }}
  />
)

export function ContactLinks({
  contacts,
  size = "md",
}: {
  contacts: Contact[]
  size?: "md" | "lg"
}) {
  const { mode } = usePrefs()
  const ascii = mode === "ascii"
  const sz = size === "lg" ? "text-lg min-h-14 px-6" : "text-sm"
  return (
    <ul className="flex flex-wrap gap-3">
      {contacts.map((c, i) => (
        <li key={c.id}>
          {c.href ? (
            <a
              href={c.href}
              {...(c.id !== "email" && !c.href.startsWith("/")
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
              className={`pop ${sz} ${i === 0 ? "pop-accent" : ""}`}
            >
              <Dot i={i} />
              {ascii ? `[ ${c.label} ]` : c.label}
              <Icon name="arrow" size={16} />
            </a>
          ) : (
            <span
              className={`pop pop-off ${sz}`}
              title={`${c.label} link not yet added`}
            >
              <Dot i={i} />
              {ascii ? `[ ${c.label} ]` : c.label}
              <span className="font-mono text-[10px] font-normal uppercase tracking-wider">
                soon
              </span>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Character artwork: hidden on narrow screens, replaced by a short text fallback. */
export function AsciiArt({
  art,
  fallback,
  label,
  className = "",
}: {
  art: string
  fallback: string
  label: string
  className?: string
}) {
  return (
    <figure className={className} aria-label={label} role="img">
      <pre
        aria-hidden="true"
        className="hidden font-mono text-[12px] leading-[1.15] text-muted sm:block"
      >
        {art}
      </pre>
      <p aria-hidden="true" className="font-mono text-sm text-muted sm:hidden">
        {fallback}
      </p>
    </figure>
  )
}
