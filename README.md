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

Run `npm test` for the asset, animation and navigation checks (Node 22.22.2+, 24.15+, or 26+).

The homepage follows a hooded runner through the hand-drawn cloister of Santes Creus. The camera pauses at Experience, Projects, About and Contact. Continue plays the next shot. The final pullback opens an aerial view with drag, pinch, scroll and keyboard controls. Visitors can select a chapter at any time. Reduced motion opens the reading view immediately, with an option to play the film.

## Editing

- `src/components/CinematicPortfolio.tsx` and `src/cinematic.css` contain the chapter layout and controls.
- `src/content/data.ts` and `src/content/library.ts` contain the profile, work, books, music and games.
- `src/three/cloisterChoreography.ts` contains the runner route, measured stone contacts, shot timing and camera moves.
- `public/models/cloister/credits.html` credits the drawing by Rubén González Candial / Giravolt and the Quaternius runner sources. The distributable models and the stills live alongside the credits.
- The GitHub repository is linked to the existing Vercel project for `www.leoli.dev`. Historical design notes and the earlier page are retained under `docs/` and `src/components/Page.tsx`.
