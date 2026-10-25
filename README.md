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

Run `npm test` for interaction and state-preservation checks (Node 22.22.2+, 24.15+, or 26+). See [interaction effects](docs/interaction-effects.md) for scrolling, signature drawing, local liquid cursor behavior, and verification limits.

The arrival preset is **Ink / Motion On**. Three themes share natural-color photography: Ink (near-black with restrained blue accents), Paper (warm white with cobalt and lavender), and Electric Blue (deep navy with vivid blue/cyan). One saved theme replaces the former appearance/palette combination, with migration for existing preferences.

The page uses native vertical scrolling. Projects and the personal photo gallery travel sideways inside sticky desktop chapters; small screens use stacked layouts. Night-city photography opens the page, followed by an original flowing contour background. Scroll-linked reveals, photo parallax, and a traced handwriting animation provide motion without snapping or wheel interception. Bottom navigation remains centered.

Dynamic mode uses Hanken Grotesk, animated hairline links and a local liquid cursor. ASCII mode literally draws letter shapes from tiny ASCII symbols, alongside character frames, controls, photography, signature and colored scene artwork. Original text remains selectable and accessible beneath cached character canvases. ASCII disables liquid pixel displacement. Presentation, theme and the separate cursor-barrier toggle remain saved locally. Motion stays on.

The header and favicon share a custom angular LL monogram. Reusable SVG/PNG assets and size previews are described in [brand assets](docs/brand/README.md).

At the end of Contact, Tensa Zangetsu opens an optional [BLEACH-inspired 3D world](docs/spirit-world.md), with a Garganta crossing, original slash/tear effects and the supplied Treachery soundtrack. Its four locations connect back to Experience, Projects, About and Contact.

## Editing

- `src/content/data.ts`: profile, contact destinations, experience, projects, and game clips.
- `src/content/library.ts`: books and music; assets live in `public/books` and `public/music`.
- `src/theme/palettes.ts`: palettes and scene colors.
- `src/three`: interactive project planet, swimming scene, and color ASCII rendering.
- `src/state`: preferences and the persistent audio player.

The interactive planet, swimming pool, books, games and persistent music player remain in the Off-screen collection. Unfilled biography, project, experience, and contact fields intentionally remain placeholders. Gameplay previews need clip files configured in `data.ts`.

Public-source analysis with REA informed the scrolling and contour treatment; details and analysis limitations are in [reference motion](docs/reference-motion.md). No reference branding or shader source is shipped.

The original Figma build helpers are retained under `.figma/` for provenance; local commands use the standalone Vite configuration. No backend or hosting deployment is configured. The existing planning documents are under `docs/`.
