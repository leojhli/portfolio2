import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server, themes
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  themes = await server.ssrLoadModule("/src/theme/palettes.ts")
})
after(async () => server?.close())

test("minimal themes lead the complete restored colourful collection with a neutral default", () => {
  assert.deepEqual(
    themes.PALETTES.map(({ id, name }) => [id, name]),
    [
      ["graphite", "Graphite"],
      ["slate", "Slate"],
      ["sage", "Sage"],
      ["paper", "Paper"],
      ["riso", "Riso Print"],
      ["sunset", "Sunset Drive"],
      ["harbor", "Harbor Flags"],
      ["lagoon", "Deep Lagoon"],
      ["regatta", "Regatta"],
      ["candy", "Candy Shop"],
      ["campfire", "Campfire"],
      ["vapor", "Vaporwave"],
      ["pitlane", "Pit Lane"],
      ["mesa", "Mesa"],
      ["reef", "Reef"],
      ["peach", "Peach Fizz"],
      ["citrus", "Citrus Grove"],
      ["bubble", "Bubblegum"],
      ["ember", "Ember"],
      ["glacier", "Glacier"],
      ["matcha", "Matcha"],
      ["tropic", "Tropic"],
      ["grape", "Grape Soda"],
      ["arcade", "Arcade"],
    ],
  )
  assert.equal(themes.DEFAULT_PALETTE, "graphite")
  assert.deepEqual(
    themes.PALETTE_GROUPS.map(({ name, palettes }) => [name, palettes.length]),
    [
      ["Minimal", 4],
      ["Colorful", 20],
    ],
  )
  assert.equal(new Set(themes.PALETTES.map(({ id }) => id)).size, 24)
  assert.equal(themes.paletteById("candy").id, "candy")
  assert.equal(themes.paletteById("missing").id, "graphite")
  assert.equal(themes.paletteById(null).id, "graphite")
  assert.deepEqual(themes.paletteById("candy").colors, [
    "#9b5de5",
    "#f15bb5",
    "#fee440",
    "#00bbf9",
    "#00f5d4",
  ])
})

test("every curated light and dark theme keeps text and interactive fills readable", () => {
  for (const palette of themes.PALETTES) {
    assert.equal(palette.colors.length, 5)
    for (const appearance of ["light", "dark"]) {
      const { vars } = themes.derive(palette, appearance)
      const label = `${palette.id} ${appearance}`
      assert.ok(themes.contrast(vars.fg, vars.bg) >= 7, `${label}: body`)
      for (const background of [vars.bg, vars.surface]) {
        for (const name of ["accent", "muted"])
          assert.ok(
            themes.contrast(vars[name], background) >= 4.5,
            `${label}: ${name}`,
          )
        assert.ok(
          themes.contrast(vars.focus, background) >= 3,
          `${label}: focus`,
        )
      }
      for (const fill of [
        "accent",
        "accent-fill",
        "ink",
        "paper",
        "s1",
        "s2",
        "s3",
        "s4",
        "s5",
        "v1",
        "v2",
        "v3",
      ])
        assert.ok(
          themes.contrast(vars[fill], vars[`on-${fill}`]) >= 4.5,
          `${label}: ${fill} fill`,
        )
    }
  }
})

test("initial CSS exactly matches the default dark theme before React hydrates", async () => {
  const css = await readFile(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  )
  const root = css.match(/:root\s*\{([^}]+)\}/)?.[1]
  assert.ok(root)
  const initialVars = Object.fromEntries(
    [...root.matchAll(/--c-([\w-]+):\s*(#[\da-f]{6});/gi)].map(
      ([, key, value]) => [key, value],
    ),
  )
  assert.deepEqual(
    initialVars,
    themes.derive(themes.paletteById(themes.DEFAULT_PALETTE), "dark").vars,
  )
})
