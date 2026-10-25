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

test("exactly three themes retain restrained color and one blue identity", () => {
  assert.deepEqual(
    themes.PALETTES.map((p) => [p.id, p.name]),
    [
      ["ink", "Ink"],
      ["paper", "Paper"],
      ["electric-blue", "Electric Blue"],
    ],
  )
  assert.equal(themes.DEFAULT_PALETTE, "ink")
  for (const p of themes.PALETTES) {
    const t = themes.derive(p)
    assert.notEqual(
      t.vars.accent.slice(1, 3),
      t.vars.accent.slice(3, 5),
      "accent is colored, not grayscale",
    )
    assert.equal(t.appearance, p.id === "paper" ? "light" : "dark")
  }
  assert.equal(themes.migrateTheme(null, "light", "candy"), "paper")
  assert.equal(themes.migrateTheme(null, "dark", "candy"), "electric-blue")
  assert.equal(themes.migrateTheme(null, "dark", "graphite"), "ink")
  assert.equal(themes.migrateTheme("ink", "light", "candy"), "ink")
  assert.equal(themes.migrateTheme(null, null, null), "ink")
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
