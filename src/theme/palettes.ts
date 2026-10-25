export type Appearance = "light" | "dark"
export type Five = [string, string, string, string, string]
export type PaletteDef = {
  id: string
  name: string
  colors: Five
}

/** Colours handed to the 3D scenes. */
export type SceneColors = {
  swatches: string[]
  vivid: [string, string, string]
  light: string
  dark: string
  accent: string
  fg: string
  bg: string
}
export type Palette = {
  id: string
  name: string
  appearance: Appearance
  colors: Five
  vars: Record<string, string>
  scene: SceneColors
}

export type ThemeId = "ink" | "paper" | "electric-blue"
export const PALETTES: PaletteDef[] = [
  {
    id: "ink",
    name: "Ink",
    colors: ["#0b0b0c", "#8fbaff", "#9593ca", "#c3cfdf", "#f3f5f8"],
  },
  {
    id: "paper",
    name: "Paper",
    colors: ["#182031", "#3562be", "#a8c4ef", "#c7bde5", "#f5f5f2"],
  },
  {
    id: "electric-blue",
    name: "Electric Blue",
    colors: ["#030611", "#268dff", "#44efff", "#8b6dff", "#effaff"],
  },
]
export const DEFAULT_PALETTE: ThemeId = "ink"
export const themeAppearance = (id: string): Appearance =>
  id === "paper" ? "light" : "dark"
export function migrateTheme(
  saved: string | null,
  appearance: string | null,
  previous: string | null,
): ThemeId {
  if (PALETTES.some((p) => p.id === saved)) return saved as ThemeId
  if (appearance === "light") return "paper"
  if (
    previous &&
    !["ink", "graphite", "slate", "sage", "paper"].includes(previous)
  )
    return "electric-blue"
  return "ink"
}

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const hex = (c: number[]) =>
  "#" +
  c
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
export const mix = (a: string, b: string, t: number) => {
  const x = rgb(a),
    y = rgb(b)
  return hex(x.map((v, i) => v + (y[i] - v) * t))
}
const luminance = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const chroma = (h: string) => {
  const c = rgb(h)
  return Math.max(...c) - Math.min(...c)
}

/**
 * Turn five swatches into a full, WCAG-checked theme. Light uses the lightest
 * swatch as the page and the darkest as ink (dark is the reverse); the three
 * middle swatches become the vivid accents. Text colours are nudged toward the
 * ink colour until they reach 4.5:1; raw swatches are used for fills, each with
 * its own readable "on" colour.
 */
export function derive(
  def: PaletteDef,
  appearance: Appearance = themeAppearance(def.id),
): Palette {
  const sorted = [...def.colors].sort((a, b) => luminance(a) - luminance(b))
  const dark = sorted[0],
    light = sorted[4]
  const isLight = appearance === "light"
  let bg = isLight ? light : dark
  let fg = isLight ? dark : light
  // Keep the page colour recognisable: push the ink first, then the page.
  for (let i = 0; i < 30 && contrast(fg, bg) < 7; i++) {
    if (i < 10 || i % 2) fg = mix(fg, isLight ? "#000000" : "#ffffff", 0.14)
    else bg = mix(bg, isLight ? "#ffffff" : "#000000", 0.14)
  }
  const surface = mix(bg, def.colors[1], isLight ? 0.055 : 0.085)
  const readable = (c: string) => {
    let x = c
    for (
      let i = 0;
      i < 30 && (contrast(x, bg) < 4.5 || contrast(x, surface) < 4.5);
      i++
    )
      x = mix(x, fg, 0.12)
    return x
  }
  const on = (c: string) => {
    for (const cand of [
      isLight ? dark : light,
      isLight ? light : dark,
      "#000000",
      "#ffffff",
    ])
      if (contrast(cand, c) >= 4.5) return cand
    return contrast("#000000", c) > contrast("#ffffff", c)
      ? "#000000"
      : "#ffffff"
  }
  const vivid = sorted
    .slice(1, 4)
    .sort((a, b) => chroma(b) - chroma(a)) as [string, string, string]
  const accent = readable(vivid[0])
  const focus =
    vivid
      .slice(1)
      .find((c) => contrast(c, bg) >= 3 && contrast(c, surface) >= 3) ?? accent
  const vars: Record<string, string> = {
    bg,
    surface,
    fg,
    accent,
    focus,
    muted: readable(mix(fg, bg, 0.38)),
    line: mix(bg, fg, 0.18),
    "on-accent": on(accent),
    "accent-fill": vivid[0],
    "on-accent-fill": on(vivid[0]),
    fx: vivid[0],
    ink: dark,
    "on-ink": on(dark),
    paper: light,
    "on-paper": on(light),
  }
  def.colors.forEach((c, i) => {
    vars[`s${i + 1}`] = c
    vars[`on-s${i + 1}`] = on(c)
  })
  vivid.forEach((c, i) => {
    vars[`v${i + 1}`] = c
    vars[`on-v${i + 1}`] = on(c)
  })
  return {
    id: def.id,
    name: def.name,
    appearance,
    colors: def.colors,
    vars,
    scene: {
      swatches: [...def.colors],
      vivid,
      light,
      dark,
      accent: vivid[0],
      fg,
      bg,
    },
  }
}

export const paletteById = (id: string | null) =>
  PALETTES.find((p) => p.id === id) ??
  PALETTES.find((p) => p.id === DEFAULT_PALETTE)!
