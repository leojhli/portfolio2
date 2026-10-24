import { useEffect, useRef, useState, type ReactNode } from "react"
import { usePrefs, type MotionPref } from "../state/preferences"
import { PALETTES, PALETTE_GROUPS } from "../theme/palettes"
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
      className="inline-flex rounded-[10px] border-[1.5px] border-fg bg-surface p-0.5 shadow-[3px_3px_0_var(--c-fg)]"
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
      <Segmented
        label="Appearance"
        value={p.appearance}
        onChange={p.setAppearance}
        options={[
          { v: "light", text: "Light", icon: "sun" },
          { v: "dark", text: "Dark", icon: "moon" },
        ]}
      />
      <div className="flex">
        <Popover
          id="palette-pop"
          wide
          trigger={<Swatches colors={p.palette.colors} className="h-4 w-10" />}
          label={
            <>
              <span className="sr-only">Palette: </span>
              {/* Swatch-only on phones so the controls fit two rows; the name stays for screen readers. */}
              <span className="max-sm:sr-only">{p.palette.name}</span>
            </>
          }
        >
          {() => (
            <fieldset>
              <legend className="mb-2 flex w-full items-baseline justify-between font-sans text-xs uppercase tracking-wide text-muted">
                Palette{" "}
                <span className="normal-case tracking-normal">
                  {PALETTES.length} sets · 5 colours each
                </span>
              </legend>
              <div className="max-h-[min(65vh,32rem)] space-y-4 overflow-y-auto pr-1">
                {PALETTE_GROUPS.map((group) => (
                  <fieldset key={group.name}>
                    <legend className="mb-1 px-2 font-sans text-xs text-muted">
                      {group.name}
                    </legend>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {group.palettes.map((def) => (
                        <label
                          key={def.id}
                          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm has-[:checked]:bg-line has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus hover:bg-line/60"
                        >
                          <input
                            type="radio"
                            name="palette"
                            value={def.id}
                            checked={p.palette.id === def.id}
                            onChange={() => p.setPalette(def.id)}
                            className="sr-only"
                          />
                          <Swatches
                            colors={def.colors}
                            className="h-6 w-16 shrink-0"
                          />
                          <span className="flex-1 truncate">{def.name}</span>
                          {p.palette.id === def.id && (
                            <span
                              aria-hidden="true"
                              className="font-sans text-xs text-accent"
                            >
                              {p.mode === "ascii" ? "*" : "●"}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </fieldset>
          )}
        </Popover>
        <button
          type="button"
          onClick={() => p.cyclePalette(1)}
          aria-label="Next palette"
          title="Next palette"
          className="pop pop-sm ml-1.5 !px-2.5"
        >
          <Icon name="chevron" size={15} />
        </button>
      </div>
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
        Palette: {p.palette.name}
      </p>
    </div>
  )
}
