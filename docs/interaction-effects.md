# Interaction effects

The current implementation is the design reference. This work preserves the horizontal desktop deck, stacked compact layout, curated palette picker, project planet, pool, colored 3D ASCII scenes, existing content, books and music. The October 20 plan is historical; its proposed layout and controls do not override the current site.

## Behavior

- Cursor proximity affects ordinary text, metadata, links, buttons, surfaces, images, icons and 3D stages throughout the visible page, including navigation. Within about 140px, elements move by up to 6px (3px for controls) and receive real 2px SVG pixelation. Within 100px they also shed fine colored fragments. Effects settle when movement stops or the pointer moves away. A quiet ambient pixel field and background parallax also respond over empty space. Selected text and actively edited fields are excluded; text stays semantic/selectable. Touch users get click ripples without hover dependence.
- Clicks send a 900ms pixel/character wave across the viewport. Visual fragments react as it passes; decorative spring elements translate by at most 3px. Navigation clicks use the section transition instead of stacking a separate click effect.
- Desktop page turns retain the current wheel/trackpad threshold, keyboard, swipe and anchor navigation. During the 1s scatter/swirl/assemble sequence, the entire deck, header and status/footer layer receive real pixelation together. Particle snapshots cover the full viewport background, content and navigation; destination samples align to the incoming section. The horizontal track begins moving immediately. Later navigation replaces the active sequence, and cancellation removes every temporary filter.
- Smaller screens keep normal vertical scrolling with a short one-time reveal. Explicit section links can run the assembly effect. Direct hash loads and browser history show the destination immediately.
- Presentation changes morph the full viewport, or the open book dialog, in about 560ms. Project detail selections assemble in about 460ms; book details assemble on opening and disperse for about 240ms before closing. Media providers remain mounted.
- ASCII effects use colored character fragments. They never rewrite semantic text, including 李嘉和, book titles, player status, or live regions.
- Motion Off bypasses decorative work, and Motion System follows reduced-motion preferences. The requested default is Motion On. Escape, resizing, hidden tabs, text selection and renderer failures release effects. Desktop wheel momentum does not queue transitions; a fresh gesture can settle the current turn. Manual scrolling cancels an active compact-layout transition after its initial programmatic scroll.

## Arrival preset

The default is Dark + Candy Shop + Motion On, including the CSS colors before JavaScript hydrates. Appearance, palette and motion choices now use the `pf.v2.*` preference namespace: older saved settings no longer hide the requested new preset, while choices made afterwards remain remembered. The existing Dynamic/ASCII preference is retained.

## Rendering and limits

`src/effects/coordinator.ts` connects one optional renderer to navigation and components. `renderer.ts` owns a single on-demand animation-frame loop, bounded particle pools, proximity-style restoration, screen-filter cleanup, and the pointer-events-none canvas. The overlay can paint over navigation while all controls remain clickable. Open dialogs temporarily host the canvas so effects remain visible in the browser's dialog top layer. Screen pixelation applies to fixed layers individually so the deck keeps its viewport containing block.

`snapshot.ts` builds bounded silhouettes from DOM character positions, fills, outlines, SVG paths, images and canvases. Its viewport mode includes the page background and fixed navigation alongside the current/destination panel. Stages redraw synchronously when sampled, retaining their current 3D/ASCII appearance. This is not a browser screenshot renderer: complex CSS gradients, shadows, background-image artwork and some SVG details are not reproduced exactly by every particle; the live DOM receives native SVG pixelation, which includes those visual details. Cursor cover cells approximate the local background. Original styles are restored after effects, and media providers stay mounted.

Dynamic breakup uses a fixed 2px sampling grid with approximately 1–2px fragments, rather than enlarging fragments when a particle limit is reached. Transitions scale with viewport area (about 32,400 particles at 1440×900), capped at 36,000 on fine pointers and 12,000 on coarse pointers; cursor dust is capped at 10,000. Reservoir sampling bounds memory without reducing pixel resolution. ASCII keeps smaller 7px glyphs and a separate 6,500-fragment cap to avoid overcrowding. DPR is capped at 2 for sharper small pixels. Visual snapshots are cached briefly and taken on interactions, not on every frame. Idle effects schedule no animation frames. No new production dependency was added.

## Verification

Run `npm test` for deterministic geometry tests, renderer cancellation/resource tests, rapid-click regression tests, and React/jsdom checks covering rapid horizontal navigation, history, mode/theme changes, continued audio playback, reduced motion, and book dialog reopening/focus return. Tests use explicit canvas/layout doubles; they do not validate real pixel appearance or GPU performance. Run `npm run build` for TypeScript and the production bundle.

Visual tuning in a real browser, touch hardware checks, Safari SVG-filter behavior and GPU frame-time profiling remain manual checks. No computer-use automation is required for the automated tests.
