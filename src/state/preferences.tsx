import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import {
  PALETTES,
  MINIMAL_PALETTES,
  derive,
  paletteById,
  type Appearance,
  type Palette,
} from "../theme/palettes"
import { morphPresentation } from "../effects/coordinator"

export type Mode = "dynamic" | "ascii"
export type MotionPref = "system" | "on" | "off"

// Palette v3 keeps the minimal default even when an old colourful v2 choice
// becomes available again. Explicit choices from this collection are remembered.
const preferenceKey = (name: string) => `pf.v2.${name}`
const paletteKey = "pf.v3.palette"

// Storage may be unavailable (private mode, blocked); everything still works in memory.
const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* ignore */
    }
  },
}

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener("change", cb)
      return () => m.removeEventListener("change", cb)
    },
    () => window.matchMedia(query).matches,
  )
}

type Prefs = {
  mode: Mode
  setMode: (m: Mode) => void
  appearance: Appearance
  setAppearance: (a: Appearance) => void
  motionPref: MotionPref
  setMotionPref: (m: MotionPref) => void
  motion: boolean
  palette: Palette
  setPalette: (id: string) => void
  /** Step through the fixed palette list (dir 1 = next, -1 = previous). */
  cyclePalette: (dir: 1 | -1) => void
}
const Ctx = createContext<Prefs | null>(null)
export const usePrefs = () => useContext(Ctx)!

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const systemReduce = useMedia("(prefers-reduced-motion: reduce)")
  const [mode, setModeS] = useState<Mode>(() =>
    store.get("pf.mode") === "ascii" ? "ascii" : "dynamic",
  )
  const [appearance, setExplicit] = useState<Appearance>(() => {
    const v = store.get(preferenceKey("appearance"))
    return v === "light" ? "light" : "dark"
  })
  const [motionPref, setMotionS] = useState<MotionPref>(() => {
    const v = store.get(preferenceKey("motion"))
    return v === "system" || v === "off" ? v : "on"
  })
  const [paletteId, setPaletteId] = useState(() => {
    const saved = store.get(paletteKey)
    if (saved) return paletteById(saved).id
    const previous = store.get(preferenceKey("palette"))
    return paletteById(
      MINIMAL_PALETTES.some(({ id }) => id === previous) ? previous : null,
    ).id
  })

  const motion =
    motionPref === "on" ? true : motionPref === "off" ? false : !systemReduce
  const palette = useMemo<Palette>(
    () => derive(paletteById(paletteId), appearance),
    [paletteId, appearance],
  )

  // Keep the reading position anchored when a setting reflows the page (e.g. font change).
  const anchor = useRef<{
    el: Element
    top: number
  } | null>(null)
  const capture = () => {
    for (const el of document.querySelectorAll("[data-anchor]")) {
      const r = el.getBoundingClientRect()
      if (r.bottom > 0) {
        anchor.current = { el, top: r.top }
        return
      }
    }
  }
  const animateTheme = useCallback(() => {
    if (!motion) return
    const html = document.documentElement
    html.classList.add("theme-anim")
    window.setTimeout(() => html.classList.remove("theme-anim"), 320)
  }, [motion])

  useLayoutEffect(() => {
    const html = document.documentElement
    html.dataset.mode = mode
    html.dataset.theme = appearance
    html.dataset.motion = motion ? "on" : "off"
    html.style.colorScheme = appearance
    for (const [k, v] of Object.entries(palette.vars))
      html.style.setProperty(`--c-${k}`, v)
    if (anchor.current) {
      const { el, top } = anchor.current
      window.scrollBy({
        top: el.getBoundingClientRect().top - top,
        behavior: "instant" as ScrollBehavior,
      })
      anchor.current = null
    }
  }, [mode, appearance, motion, palette])

  const choose = (id: string) => {
    setPaletteId(id)
    store.set(paletteKey, id)
  }

  const value = useMemo<Prefs>(
    () => ({
      mode,
      setMode: (m) => {
        if (m === mode) return
        capture()
        if (motion) morphPresentation()
        setModeS(m)
        store.set("pf.mode", m)
      },
      appearance,
      setAppearance: (a) => {
        capture()
        animateTheme()
        setExplicit(a)
        store.set(preferenceKey("appearance"), a)
      },
      motionPref,
      setMotionPref: (m) => {
        setMotionS(m)
        store.set(preferenceKey("motion"), m)
      },
      motion,
      palette,
      setPalette: (id) => {
        animateTheme()
        choose(id)
      },
      cyclePalette: (dir) => {
        animateTheme()
        const i = PALETTES.findIndex((p) => p.id === paletteId)
        choose(PALETTES[(i + dir + PALETTES.length) % PALETTES.length].id)
      },
    }),
    [mode, appearance, motionPref, motion, palette, paletteId, animateTheme],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
