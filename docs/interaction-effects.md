# Interaction effects

The current implementation is the design reference. This work preserves the horizontal desktop deck, stacked compact layout, curated palette picker, project planet, pool, colored 3D ASCII scenes, existing content, books and music. The October 20 plan is historical; its proposed layout and controls do not override the current site.

## Behavior

- Cursor movement breaks nearby visual samples into colored fragments within about 100px. They travel outward and reconstruct in about 350ms. Touch users get click ripples without hover dependence. Focused controls and selected text are excluded.
- Clicks send a 900ms pixel/character wave across the viewport. Visual fragments react as it passes; decorative spring elements translate by at most 3px. Navigation clicks use the section transition instead of stacking a separate click effect.
- Desktop page turns retain the current wheel/trackpad threshold, keyboard, swipe and anchor navigation. A single 1s scatter/swirl/assemble sequence samples the outgoing section and targets the incoming section's actual text and visual positions. Headings settle first. The track begins moving immediately. Later navigation replaces the active sequence.
- Smaller screens keep normal vertical scrolling with a short one-time reveal. Explicit section links can run the assembly effect. Direct hash loads and browser history show the destination immediately.
- Presentation changes morph the current panel, or the open book dialog, in about 560ms. Project detail selections assemble in about 460ms; book details assemble on opening and disperse for about 240ms before closing. Media providers remain mounted.
- ASCII effects use colored character fragments. They never rewrite semantic text, including 李嘉和, book titles, player status, or live regions.
- Motion-off/reduced-motion bypass decorative work. Escape, resizing, hidden tabs, text selection and renderer failures release effects. Desktop wheel momentum does not queue transitions; a fresh gesture can settle the current turn. Manual scrolling cancels an active compact-layout transition after its initial programmatic scroll.

## Rendering and limits

`src/effects/coordinator.ts` connects one optional renderer to navigation and components. `renderer.ts` owns a single on-demand animation-frame loop, bounded particle pools, animation cleanup, and the pointer-events-none canvas. Header/footer navigation stays above the overlay. Open dialogs temporarily host the canvas so effects remain visible in the browser's dialog top layer.

`snapshot.ts` builds bounded silhouettes from DOM character positions, fills, outlines, SVG paths, images and canvases. Stages redraw synchronously when sampled, retaining their current 3D/ASCII appearance. This is not a browser screenshot renderer: complex CSS gradients, shadows, background-image artwork and some SVG details stay in the underlying DOM and are not reproduced exactly by every particle. Cursor cover cells approximate the local background. DOM text and controls remain readable and operable underneath; only inert heading/visual leaves soften briefly during assembly.

Particle count is capped at 1,100 on fine pointers and 480 on coarse pointers; cursor dust is capped at 360. DPR is capped at 1.5. Visual snapshots are cached briefly and taken on interactions, not on every frame. Idle effects schedule no animation frames. No new production dependency was added.

## Verification

Run `npm test` for deterministic geometry tests, renderer cancellation/resource tests, rapid-click regression tests, and React/jsdom checks covering rapid horizontal navigation, history, mode/theme changes, continued audio playback, reduced motion, and book dialog reopening/focus return. Tests use explicit canvas/layout doubles; they do not validate real pixel appearance or GPU performance. Run `npm run build` for TypeScript and the production bundle.

Visual tuning in a real browser, touch hardware checks, Safari SVG-filter behavior and GPU frame-time profiling remain manual checks. No computer-use automation is required for the automated tests.
