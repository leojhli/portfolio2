import { useEffect, useRef, useState, type ReactNode } from "react"
import { usePrefs, type MotionPref } from "../state/preferences"
import { PALETTES, type ThemeId } from "../theme/palettes"
import Icon from "./Icons"

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{
    v: T
    text: string
    icon?: string
  }>
  onChange: (v: T) => void
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="presentation-switch inline-flex p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-[7px] px-3 text-sm font-medium transition-colors ${
            value === o.v
              ? "bg-accent-fill text-on-accent-fill"
              : "text-fg hover:bg-line"
          }`}
        >
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.text}
        </button>
      ))}
    </div>
  )
}

/** Five-swatch strip used on the trigger and in every picker option. */
export function Swatches({
  colors,
  className = "",
}: {
  colors: readonly string[]
  className?: string
}) {
  const { mode } = usePrefs()
  const ascii = mode === "ascii"
  return (
    <span
      aria-hidden="true"
      className={`inline-flex overflow-hidden rounded-[5px] border-[1.5px] border-fg ${className}`}
    >
      {colors.map((c, i) => (
        <span
          key={i}
          className="h-full flex-1"
          style={ascii ? { color: c } : { background: c }}
        >
          {ascii ? String(i + 1) : null}
        </span>
      ))}
    </span>
  )
}

/** Disclosure popover: Escape and outside clicks close it and return focus to the trigger. */
function Popover({
  id,
  label,
  trigger,
  children,
  wide,
}: {
  id: string
  label: ReactNode
  trigger?: ReactNode
  children: (close: () => void) => ReactNode
  wide?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    btn.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        close()
      }
    }
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    addEventListener("keydown", onKey)
    addEventListener("pointerdown", onDown)
    return () => {
      removeEventListener("keydown", onKey)
      removeEventListener("pointerdown", onDown)
    }
  }, [open])
  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="pop pop-sm"
      >
        {trigger}
        {label}
      </button>
      {open && (
        <div
          id={id}
          className={`popover right-0 top-full z-50 mt-3 rounded-xl border-[1.5px] border-fg p-3 shadow-[5px_5px_0_var(--c-fg)] max-sm:left-0 max-sm:right-auto ${
            wide ? "w-[min(34rem,calc(100vw-2.5rem))]" : "w-56"
          }`}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}

export default function Controls() {
  const p = usePrefs()
  return (
    <div
      role="region"
      aria-label="Appearance settings"
      className="flex flex-wrap items-center gap-2"
    >
      <Segmented
        label="Presentation"
        value={p.mode}
        onChange={p.setMode}
        options={[
          { v: "dynamic", text: "Dynamic" },
          { v: "ascii", text: "ASCII" },
        ]}
      />
      <Popover
        id="theme-pop"
        label={p.palette.name}
        trigger={<span aria-hidden="true" className="theme-dot" />}
      >
        {(close) => (
          <fieldset>
            <legend className="eyebrow mb-3">Choose your atmosphere</legend>
            {PALETTES.map((def) => (
              <label key={def.id} className="theme-option">
                <input
                  type="radio"
                  name="theme"
                  value={def.id}
                  checked={p.themeId === def.id}
                  className={p.mode === "ascii" ? "sr-only" : undefined}
                  onChange={() => {
                    p.setTheme(def.id as ThemeId)
                    close()
                  }}
                />
                {p.mode === "ascii" && (
                  <span aria-hidden="true">
                    {p.themeId === def.id ? "(*)" : "( )"}
                  </span>
                )}
                <Swatches colors={def.colors} className="h-5 w-12" />
                <span>{def.name}</span>
              </label>
            ))}
          </fieldset>
        )}
      </Popover>
      <Popover
        id="motion-pop"
        label={
          <>
            Motion: <span className="capitalize">{p.motionPref}</span>
          </>
        }
        trigger={<Icon name="settings" size={15} />}
      >
        {() => (
          <>
            <fieldset>
              <legend className="mb-2 font-sans text-xs uppercase tracking-wide text-muted">
                Motion
              </legend>
              {(["system", "on", "off"] as MotionPref[]).map((m) => (
                <label
                  key={m}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-2 text-sm hover:bg-line/50"
                >
                  <input
                    type="radio"
                    name="motion"
                    value={m}
                    checked={p.motionPref === m}
                    onChange={() => p.setMotionPref(m)}
                    className={
                      p.mode === "ascii"
                        ? "sr-only"
                        : "accent-[var(--c-accent)]"
                    }
                  />
                  {p.mode === "ascii" && (
                    <span aria-hidden="true">
                      {p.motionPref === m ? "(*)" : "( )"}
                    </span>
                  )}
                  {m === "system" ? "System" : m === "on" ? "On" : "Off"}
                </label>
              ))}
            </fieldset>
            <p className="mt-2 text-xs text-muted">
              Effective: {p.motion ? "motion on" : "reduced motion"}
            </p>
          </>
        )}
      </Popover>
      <p aria-live="polite" className="sr-only">
        Theme: {p.palette.name}
      </p>
    </div>
  )
}
