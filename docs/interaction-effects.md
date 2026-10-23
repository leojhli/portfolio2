# Interaction effects

The current implementation is the design reference. Preserve the horizontal desktop deck, stacked compact layout, project planet, pool, colored 3D ASCII scenes, content, books and persistent music. Historical build plans do not override the current site.

## Cursor behavior

The cursor is a local circular obstacle in a dense pixel field. Its 48px barrier repels pixels within a 104px neighborhood. Only that portion of the rendered content changes: headings, cards, navigation and page backgrounds are never translated as whole elements. The former proximity translations, background parallax, timed particle emissions and expanding click ripples have been removed. Ordinary hover colors, focus indicators and control behavior remain.

The field has persistent 2px source cells. Critically damped motion moves them away from the cursor; collision handling and tangent waypoints steer travel around the barrier. A resting cursor keeps the pixels displaced without pulsing. Movement and release resume smoothly even after a long idle. Leaving the window restores the original positions. Once settled, the image stays visible without scheduling more animation frames. Touch interaction does not require the decorative hover effect.

The pointer canvas has no hit area and never rewrites semantic text. Selected text, active editing and pointer drags release the effect. Escape, scrolling, resizing, hidden tabs, presentation/font changes and renderer disposal clear cached pixels. Controls and media remain mounted and usable.

## Other transitions

- Desktop page turns retain wheel/trackpad thresholds, keyboard, swipe and anchor navigation. A 900ms liquid pixel transition covers background, content, header and status/footer. Each of the six adjacent page boundaries has a distinct pattern: a lateral spill, merging pools, opposing currents, a vertical pour, a central seam opening, and an outgoing pocket draining away. Backward navigation mirrors the pattern and reverses its flow. Skipped sections use the lower page boundary's pattern; presentation changes cycle the same family.
- Continuous masks reveal incoming pixels while source sampling bends both pages near their shared edges. Destination strips stay fixed and opaque, preventing gaps; the rest of each page stays still. Nearest-neighbor cells change from 2px to 4px and back, without blur or blended page images. The first frame paints before the track moves. Incoming content is fully revealed by 80% (720ms), after the track's 700ms slide, and the overlay stays opaque through 86% before fading one settled incoming image to live content. New navigation replaces the active effect; cancellation clears it immediately.
- Compact screens keep ordinary vertical scrolling. Explicit section links can use the screen transition; direct hashes and browser history show the destination immediately.
- Presentation mode changes morph the viewport, or an open book dialog, in about 560ms. Project selections and book opening assemble in about 460ms; book closure disperses for about 240ms. These explicit transitions are separate from cursor motion.
- ASCII uses tiny colored character cells and retains real semantic text, including 李嘉和. Motion Off bypasses effects; System follows reduced-motion preferences. Motion On remains the requested default.

## Typography and curated themes

The interface uses **Hanken Grotesk** throughout, verified from [Sofia Bodnar's public font declarations](https://sofiabodnar.com/). This includes the hero name, headings, body text, navigation, controls, metadata and labels. Body text uses the reference's lighter 300 weight and headings use 400. Chinese characters use the existing sans fallback; Geist Mono is reserved for fixed-width ASCII artwork and character rendering.

Text links use a faint one-pixel baseline with a current-color line that grows from left to right on hover or keyboard focus over 350ms. Section navigation uses the same hairline treatment, with active sections underlined. Contact and project links are plain text instead of raised pills. The liquid overlay exposes these thin feedback lines so the native CSS animation stays visible while nearby pixels move. Motion Off makes these state changes instant. Link hit targets remain at least 44px high, and focus indicators remain visible.

Four restrained palettes lead the theme picker. They adapt the design language of portfolios actually listed in the Waterloo webrings:

- **Graphite**: near-black, gray and soft white, inspired by [Kelvin Zhang](https://www.kelvinzhang.ca/) and [Anthony Wang](https://anthonywang.dev/).
- **Slate**: slate neutrals with one indigo accent, inspired by [Alex Zhu](https://probablyalex.com/).
- **Sage**: green-gray and cream, drawing from [George Shao's portfolio](https://shao.zip/), [Aaron Ye's green/cream palette](https://aaronye.dev/) and the dark green/cream treatment on [Will Harris's portfolio](https://willharris.ca/).
- **Paper**: warm paper, ink and a muted oxblood accent, also drawing from Will Harris's paper/red palette.

All four work in light and dark appearance. The original twenty colorful palettes are also available in a separate Colorful group, and the full picker scrolls within the viewport. Borders, shadows, background texture and ghost numerals are quieter. The arrival preset is **Dark + Graphite + Motion On**, including CSS before hydration. Appearance and motion still use `pf.v2.*`; palette choices now use `pf.v3.palette`. Only legacy minimal choices migrate from v2, so a previously saved Candy Shop choice does not override the new minimal default. New explicit colorful choices are remembered normally. The existing Dynamic/ASCII preference is retained.

## Rendering and limits

`coordinator.ts` connects one optional renderer. `renderer.ts` owns one on-demand animation loop, local capture caching, explicit transitions and cleanup. Open dialogs temporarily host the canvas so it remains visible in the dialog top layer. No filter or transform is added to the deck's containing block.

`snapshot.ts` captures character positions, fills, outlines, SVG paths, images and canvases, including page texture and fixed navigation. Local captures are bounded to a 272×272px region on stable 64px tiles; a complete 2px grid fits its 20,000-sample budget without reservoir omissions. The liquid field admits only nearby cells and holds at most 24,000 while old neighborhoods settle. Source identities stay stable. Covers mask only displaced source cells, before all moved cells are drawn. Captures are refreshed on neighborhood entry or content/presentation invalidation, never every animation frame. Loaded fonts invalidate stale text geometry. Three.js stages redraw when captured.

The rasterizer approximates complex shadows, CSS background artwork and some SVG details. Local masks use the page background beneath the displaced liquid; moving regions can expose small background gaps as the cells spread. A held neighborhood is a cached sample, so moving video/3D details resume live when the effect clears. Media itself keeps running.

`liquidGeometry.ts` provides deterministic displacement, exact critically damped integration and barrier collision constraints. `liquid.ts` manages persistent cells, circle steering and rest detection, reusing particle vectors and its drawing buffer to avoid per-pixel allocation during animation. Fresh captures can update cell colors without resetting their motion. No periodic phase or random emission drives cursor motion. Local assembly pools retain 36,000/12,000 fine/coarse-pointer caps, with a 6,500 ASCII cap. DPR is capped at 2.

`screenGeometry.ts` supplies six deterministic liquid masks with reusable interval storage. `screen.ts` caches six nearest-neighbor mosaic buffers (outgoing/incoming at 2px, 3px and 4px). It samples at most 320 horizontal bands, or vertical bands for the pour, and bends source colors only in narrow zones around each front. Sampling stays inside each raster. It allocates no buffers or DOM captures per frame and releases all buffers on completion/cancellation or partial allocation failure. No new production dependency was added.

## Verification

`npm test` covers local field geometry, frame-rate stability, stationary hold, barrier crossing, long-idle wake, release, source masks, memory bounds, cursor locality without DOM movement, click behavior, selection/editing/hidden-tab cleanup, clipped capture density, distinct liquid masks and reverse flow, bounded source advection, full-screen coverage, buffer failures, palette contrast/default CSS parity, and React navigation/media/dialog state preservation. Canvas and layout use explicit doubles; these tests do not certify browser appearance or GPU frame times. Synthetic source images can also be rendered through the actual transition blits to inspect liquid masks and opaque coverage without computer use.

`npm run build` checks TypeScript and creates the production bundle. Real browser visual tuning, touch hardware and GPU profiling remain manual checks. No computer-use automation is used.
