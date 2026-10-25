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
  migrateTheme,
  themeAppearance,
  type ThemeId,
  derive,
  paletteById,
  type Appearance,
  type Palette,
} from "../theme/palettes"
import { morphPresentation } from "../effects/coordinator"

export type Mode = "dynamic" | "ascii"
export type MotionPref = "system" | "on" | "off"

const preferenceKey = (name: string) => `pf.v2.${name}`
const themeKey = "pf.v4.theme"

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
  themeId: ThemeId
  setTheme: (id: ThemeId) => void
  motionPref: MotionPref
  setMotionPref: (m: MotionPref) => void
  motion: boolean
  palette: Palette
}
const Ctx = createContext<Prefs | null>(null)
export const usePrefs = () => useContext(Ctx)!

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const systemReduce = useMedia("(prefers-reduced-motion: reduce)")
  const [mode, setModeS] = useState<Mode>(() =>
    store.get("pf.mode") === "ascii" ? "ascii" : "dynamic",
  )
  const [motionPref, setMotionS] = useState<MotionPref>(() => {
    const v = store.get(preferenceKey("motion"))
    return v === "system" || v === "off" ? v : "on"
  })
  const [themeId, setThemeId] = useState<ThemeId>(() =>
    migrateTheme(
      store.get(themeKey),
      store.get(preferenceKey("appearance")),
      store.get("pf.v3.palette") ?? store.get(preferenceKey("palette")),
    ),
  )
  const appearance = themeAppearance(themeId)

  const motion =
    motionPref === "on" ? true : motionPref === "off" ? false : !systemReduce
  const palette = useMemo<Palette>(
    () => derive(paletteById(themeId), appearance),
    [themeId, appearance],
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
    html.dataset.palette = themeId
    store.set(themeKey, themeId)
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
      themeId,
      setTheme: (id) => {
        capture()
        animateTheme()
        setThemeId(id)
        store.set(themeKey, id)
      },
      motionPref,
      setMotionPref: (m) => {
        setMotionS(m)
        store.set(preferenceKey("motion"), m)
      },
      motion,
      palette,
    }),
    [mode, appearance, motionPref, motion, palette, themeId, animateTheme],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
