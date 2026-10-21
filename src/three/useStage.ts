import { useEffect, useRef, type RefObject } from "react"
import { usePrefs } from "../state/preferences"
import type { SceneColors } from "../theme/palettes"
import { Stage, webglAvailable } from "./stage"

type Scene = {
  setColors(c: SceneColors): void
  dispose(): void
}

/**
 * Mounts a Stage in `host`, builds a scene with `make`, and keeps it in sync with
 * the palette, ASCII mode and motion preference. Calls `onFail` when WebGL is
 * unavailable or the context is lost, so callers can show a static fallback.
 */
export function useStage<A extends Scene>(
  host: RefObject<HTMLElement | null>,
  make: (s: Stage, el: HTMLElement, c: SceneColors) => A,
  deps: unknown[],
  onFail?: () => void,
) {
  const { motion, mode, appearance, palette } = usePrefs()
  const ascii = mode === "ascii"
  const inkIsDark = appearance === "light"
  const api = useRef<A | null>(null)
  const stage = useRef<Stage | null>(null)
  const latest = useRef({ ascii, motion, inkIsDark, palette, onFail })
  latest.current = { ascii, motion, inkIsDark, palette, onFail }

  useEffect(() => {
    const el = host.current
    if (!el) return
    const fail = () => latest.current.onFail?.()
    if (!webglAvailable()) return fail()
    const l = latest.current
    let s: Stage, a: A
    try {
      s = new Stage(el, {
        ascii: l.ascii,
        motion: l.motion,
        inkIsDark: l.inkIsDark,
      })
    } catch {
      return fail()
    }
    try {
      a = make(s, el, l.palette.scene)
    } catch {
      s.dispose()
      return fail()
    }
    const lost = (e: Event) => {
      e.preventDefault()
      fail()
    }
    s.renderer.domElement.addEventListener("webglcontextlost", lost)
    stage.current = s
    api.current = a
    return () => {
      s.renderer.domElement.removeEventListener("webglcontextlost", lost)
      a.dispose()
      s.dispose()
      stage.current = null
      api.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    stage.current?.setOpts({ ascii, motion, inkIsDark })
  }, [ascii, motion, inkIsDark])
  useEffect(() => {
    api.current?.setColors(palette.scene)
  }, [palette])
  return api
}
