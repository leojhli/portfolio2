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
            'button,a[href],summary,input,select,[role="tab"],[role="button"],.stage,[data-sound-object]',
          )
        : null
    const eligible = (target: HTMLElement | null) =>
      target &&
      !target.matches(':disabled,[aria-disabled="true"]') &&
      !target.closest("[data-sound-toggle]")
    const click = (event: MouseEvent) => {
      const target = control(event.target)
      if (document.hidden || !(event.target instanceof Element)) return
      if (
        event.target.closest(
          '[data-sound-toggle],:disabled,[aria-disabled="true"],[role="scrollbar"]',
        )
      )
        return
      // Labels dispatch a second click on their input; play only that activation.
      if (event.target.closest("label") && !event.target.matches("input"))
        return
      sound.play(target ? "select" : "tap", true)
    }
    let lastKey = -Infinity
    const typing = (event: KeyboardEvent) => {
      if (
        document.hidden ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing
      )
        return
      const editing =
        event.target instanceof Element &&
        event.target.matches('input,textarea,[contenteditable="true"]')
      if (
        event.key.length !== 1 &&
        !["Backspace", "Delete"].includes(event.key) &&
        !(editing && event.key === "Enter")
      )
        return
      // Space on a button is an activation, not typing; its click gets one cue.
      if (event.key === " " && !editing && control(event.target)) return
      const now = performance.now()
      if (now - lastKey < 25) return
      lastKey = now
      sound.play("typing", true)
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
    document.addEventListener("keydown", typing)
    return () => {
      document.removeEventListener("click", click)
      document.removeEventListener("pointerover", hover)
      document.removeEventListener("keydown", typing)
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
