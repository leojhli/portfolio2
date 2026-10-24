# portfolio2

Leo Li's React and TypeScript portfolio, exported from [Figma Make](https://www.figma.com/make/WbYExogxExIsD3YYpaH9oa/Portfolio) and adapted to run independently with Vite.

## Run locally

Requires Node.js 22.12+ (or 24+). npm is included with Node.js.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. To check and build the production version, run `npm run build`; `npm run preview` serves that build at http://127.0.0.1:4173.

Dependencies are already installed in this checkout, so you can run `npm run dev` immediately. If PowerShell blocks `npm.ps1`, use `npm.cmd run dev`. The exported pnpm lockfile is retained for users who prefer `pnpm install --frozen-lockfile`.

Run `npm test` for interaction and state-preservation checks (Node 22.22.2+, 24.15+, or 26+). See [interaction effects](docs/interaction-effects.md) for the local liquid cursor field, screen transitions, and visual verification limits.

The arrival preset is **Dark / Graphite / Motion On**. Four minimal themes—Graphite, Slate, Sage and Paper—appear first, followed by the original twenty colorful themes. Desktop is one continuous horizontal document with native scrolling, proportional wheel input and subtle scroll-linked depth on artwork. There are no page-switch transitions or snapping. Compact screens keep vertical flow. The header/footer dividers are removed and bottom navigation is centered.

Dynamic mode uses Hanken Grotesk, animated hairline links, a local liquid cursor and restrained entrance animations. ASCII mode literally draws the letter shapes from tiny ASCII symbols, alongside character frames, icons, controls and colored character artwork. Original text remains selectable and accessible beneath cached character canvases. ASCII disables liquid pixel displacement. Appearance, palette and motion choices remain saved locally.

The header and favicon share a custom angular LL monogram. Reusable SVG/PNG assets and size previews are described in [brand assets](docs/brand/README.md).

## Editing

- `src/content/data.ts`: profile, contact destinations, experience, projects, and game clips.
- `src/content/library.ts`: books and music; assets live in `public/books` and `public/music`.
- `src/theme/palettes.ts`: palettes and scene colors.
- `src/three`: interactive project planet, swimming scene, and color ASCII rendering.
- `src/state`: preferences and the persistent audio player.

Both Dynamic and ASCII modes, light/dark appearance, palette selection, motion settings, book dialogs, music playback, and the desktop page deck are retained. Unfilled biography, project, experience, and contact fields intentionally remain placeholders. Gameplay previews need clip files configured in `data.ts`.

The original Figma build helpers are retained under `.figma/` for provenance; local commands use the standalone Vite configuration. No backend or hosting deployment is configured. The existing planning documents are under `docs/`.
