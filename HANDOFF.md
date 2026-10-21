# Portfolio handoff notes

## Local export

The Figma Make source is now in this folder as `portfolio2`. Run `npm run dev`; `npm run build` checks TypeScript and creates `dist/`. The Vite configuration and HTML metadata no longer depend on Figma. The source design and supplied books/music are retained. Dynamic book spines fit their available column at intermediate widths; ASCII shelves scroll within their column. See README.md for local setup.

The original notes below describe the prototype; subsequent Figma versions added the 3D planet/pool, colored ASCII scenes, expanded palettes, and media listed in `src/content/library.ts`. The earlier missing-asset and not-built lists are historical.

- **Content:** edit `src/content/data.ts`. All `[bracketed]` values are placeholders. Add `href` to contacts, `repoUrl`/`liveUrl` to projects, `src` to tracks (files in `public/`), `url` to games. Missing values show honest "not yet linked / unavailable / Audio coming soon" states.
- **Themes:** `src/theme/palettes.ts` — Paper, Ink, Tide, Dusk plus contrast-validated local shuffle (24 attempts, then Tide/Dusk). Tokens are exposed as Tailwind colors (`bg`, `surface`, `fg`, `muted`, `line`, `accent`, `on-accent`, `focus`, `fx`).
- **Preferences:** `src/state/preferences.tsx` (localStorage, safe when unavailable). Appearance follows the device until the visitor picks Light/Dark.
- **Audio:** `src/state/audio.tsx` — one `Audio` instance above the page tree; it only starts after a user click.
- **Approximated effect:** pixel dissolution is an *approximation* (`src/effects/EffectsLayer.tsx`). A `pointer-events: none` canvas masks 8 px cells over `[data-fx]` visuals and draws drifting fragments, which fade over about 350 ms. It does not rasterize the DOM. Click ripples last about 900 ms; `[data-spring]` decorative elements move by at most 3 px. All of this is off when motion is off or reduced.
- **Layout:** on screens at least 1024 x 700 px, each section is a full-screen page in a deck (`src/components/Deck.tsx`). Wheel/trackpad input builds up pull (shown in the status bar); past a threshold the deck turns one page. Arrow/Page/Space/Home/End keys, swipes, nav links and tabbing also turn pages. With motion on, a grid-aligned pixel wipe sweeps across (`src/effects/pager.ts`) and `[data-reveal]` elements pixelate in through SVG filters (`PixelFilters` in `ui.tsx`); in ASCII mode their text brute-forces through random glyphs instead. Smaller screens stack vertically and use the same build-in on scroll.
- **Fonts:** Geist and Geist Mono from Google Fonts (the same family as martinsit.ca), with Noto Sans SC as the Chinese fallback.
- **Game logos:** League of Legends, Valorant and Roblox use the official marks from Simple Icons (CC0 icon data; the trademarks belong to their owners). Rocket League, Minecraft, Geometry Dash, Clash Royale and Brawl Stars still use stand-in symbols. To use official logos, put the files in `public/logos/` and set `logo` in `data.ts`. Poker and Chess have no official brand mark.
- **Missing assets:** portrait/video, project visuals, audio, book covers and five game logos.
- **Needs browser verification:** SVG pixel filters on HTML elements in Safari, page-turn threshold feel with mouse wheels vs trackpad momentum, focus-follow when tabbing, Safari `<dialog>` focus return, how the ripple feels on touch devices, how scroll anchoring behaves on mode switch with slow font loading, and contrast of shuffled palettes against the colour-mixed book spines.
- **Not built:** VideoToAscii/WebGL media, backend, contact form and deployment.
- **Books & music:** carried over from github.com/leojhli/portfolio into `src/content/library.ts`; covers in `public/books/`, MP3s and album art in `public/music/` (~96 MB). The player advances to the next track when one ends.
