# Leo Li monogram

Two interlocking, forward-cut Ls use broad stems and sharp diagonal ends. The compact original mark uses straight edges and works in a single color without gradients or fine detail.

- `src/components/Logo.tsx`: inline header mark; inherits the active palette's foreground color, including light/dark and ASCII presentation.
- `public/logo.svg`: transparent vector master in dark ink.
- `public/logo.png`: transparent 512px-wide PNG export.
- `public/favicon.svg`: the same mark in ice blue on a near-black tile for browser tabs.
- `docs/brand/logo-preview.png`: light/dark study with 16, 24, 32 and 44px size checks, rendered directly from SVG.

The header keeps an accessible home-link target. The mark is decorative to screen readers. Geometry uses a 48×40 viewBox; add clear space around the exported mark when placing it on a tile.
