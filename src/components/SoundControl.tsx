import { useEffect, useRef, useState } from "react"
import { createInterfaceSounds } from "../effects/sounds"

export default function SoundControl() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem("pf.sound") !== "off"
    } catch {
      return true
    }
  })
  const engine = useRef<ReturnType<typeof createInterfaceSounds> | null>(null)
  const enabledRef = useRef(enabled)
  useEffect(() => {
    const sound = createInterfaceSounds()
    engine.current = sound
    sound.setEnabled(enabledRef.current)
    const control = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>(
            'button,a[href],summary,input[type="radio"],[role="tab"]',
          )
        : null
    const eligible = (target: HTMLElement | null) =>
      target &&
      !target.matches(':disabled,[aria-disabled="true"]') &&
      !target.closest("[data-sound-toggle],.cd-shell")
    const click = (event: MouseEvent) => {
      const target = control(event.target)
      if (!eligible(target) || document.hidden) return
      sound.play(
        target!.matches(
          'a[href^="#"],summary,input[type="radio"],[aria-controls]',
        )
          ? "select"
          : "tap",
        true,
      )
    }
    const hover = (event: PointerEvent) => {
      const target = control(event.target)
      if (
        event.pointerType === "touch" ||
        document.hidden ||
        !eligible(target) ||
        target === control(event.relatedTarget)
      )
        return
      sound.play("hover")
    }
    document.addEventListener("click", click)
    document.addEventListener("pointerover", hover)
    return () => {
      document.removeEventListener("click", click)
      document.removeEventListener("pointerover", hover)
      sound.dispose()
      engine.current = null
    }
  }, [])
  return (
    <button
      type="button"
      className="pop pop-sm"
      data-sound-toggle
      aria-label="Interface sounds"
      aria-pressed={enabled}
      onClick={() => {
        const next = !enabled
        enabledRef.current = next
        setEnabled(next)
        engine.current?.setEnabled(next)
        if (next) engine.current?.play("select", true)
        try {
          localStorage.setItem("pf.sound", next ? "on" : "off")
        } catch {
          /* In-memory preference still works. */
        }
      }}
    >
      Sound: {enabled ? "On" : "Off"}
    </button>
  )
}
