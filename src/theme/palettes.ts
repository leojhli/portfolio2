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

/** 20 hand-picked five-colour palettes (Coolors-style). Every swatch is used somewhere on the page. */
export const PALETTES: PaletteDef[] = [
  {
    id: "riso",
    name: "Riso Print",
    colors: ["#1b1b1e", "#f95738", "#ee964b", "#f4d35e", "#faf0ca"],
  },
  {
    id: "sunset",
    name: "Sunset Drive",
    colors: ["#264653", "#2a9d8f", "#e9c46a", "#f4a261", "#e76f51"],
  },
  {
    id: "harbor",
    name: "Harbor Flags",
    colors: ["#003049", "#d62828", "#f77f00", "#fcbf49", "#eae2b7"],
  },
  {
    id: "lagoon",
    name: "Deep Lagoon",
    colors: ["#03045e", "#0077b6", "#00b4d8", "#90e0ef", "#caf0f8"],
  },
  {
    id: "regatta",
    name: "Regatta",
    colors: ["#1d3557", "#e63946", "#457b9d", "#a8dadc", "#f1faee"],
  },
  {
    id: "candy",
    name: "Candy Shop",
    colors: ["#9b5de5", "#f15bb5", "#fee440", "#00bbf9", "#00f5d4"],
  },
  {
    id: "campfire",
    name: "Campfire",
    colors: ["#283618", "#606c38", "#dda15e", "#bc6c25", "#fefae0"],
  },
  {
    id: "vapor",
    name: "Vaporwave",
    colors: ["#3a86ff", "#8338ec", "#ff006e", "#fb5607", "#ffbe0b"],
  },
  {
    id: "pitlane",
    name: "Pit Lane",
    colors: ["#2b2d42", "#8d99ae", "#edf2f4", "#ef233c", "#d90429"],
  },
  {
    id: "mesa",
    name: "Mesa",
    colors: ["#432818", "#99582a", "#bb9457", "#ffe6a7", "#6f1d1b"],
  },
  {
    id: "reef",
    name: "Reef",
    colors: ["#05668d", "#028090", "#00a896", "#02c39a", "#f0f3bd"],
  },
  {
    id: "peach",
    name: "Peach Fizz",
    colors: ["#355070", "#6d597a", "#b56576", "#e56b6f", "#eaac8b"],
  },
  {
    id: "citrus",
    name: "Citrus Grove",
    colors: ["#033f63", "#28666e", "#7c9885", "#b5b682", "#fedc97"],
  },
  {
    id: "bubble",
    name: "Bubblegum",
    colors: ["#cdb4db", "#ffc8dd", "#ffafcc", "#bde0fe", "#a2d2ff"],
  },
  {
    id: "ember",
    name: "Ember",
    colors: ["#370617", "#6a040f", "#d00000", "#e85d04", "#ffba08"],
  },
  {
    id: "glacier",
    name: "Glacier",
    colors: ["#0d1b2a", "#1b263b", "#415a77", "#778da9", "#e0e1dd"],
  },
  {
    id: "matcha",
    name: "Matcha",
    colors: ["#344e41", "#3a5a40", "#588157", "#a3b18a", "#dad7cd"],
  },
  {
    id: "tropic",
    name: "Tropic",
    colors: ["#006d77", "#83c5be", "#edf6f9", "#ffddd2", "#e29578"],
  },
  {
    id: "grape",
    name: "Grape Soda",
    colors: ["#10002b", "#3c096c", "#7b2cbf", "#c77dff", "#e0aaff"],
  },
  {
    id: "arcade",
    name: "Arcade",
    colors: ["#0b0c10", "#f72585", "#7209b7", "#4cc9f0", "#f8f9fa"],
  },
]
export const DEFAULT_PALETTE = "candy"

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
export function derive(def: PaletteDef, appearance: Appearance): Palette {
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
  const surface = isLight ? mix(bg, "#ffffff", 0.6) : mix(bg, light, 0.08)
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
