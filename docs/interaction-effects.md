# Interaction effects

The current implementation is the design reference. Preserve the horizontal desktop deck, stacked compact layout, project planet, pool, colored 3D ASCII scenes, content, books and persistent music. Historical build plans do not override the current site.

## Cursor behavior

In Dynamic mode, the cursor is a local circular obstacle in a dense pixel field. Its 48px barrier repels pixels within a 104px neighborhood. Only that portion of the rendered content changes: headings, cards, navigation and page backgrounds are never translated as whole elements by proximity. The former background parallax, timed particle emissions and expanding click ripples have been removed. Ordinary hover colors, focus indicators and control behavior remain. ASCII mode disables the pixel field entirely.

The field has persistent 2px source cells. Critically damped motion moves them away from the cursor; collision handling and tangent waypoints steer travel around the barrier. A resting cursor keeps the pixels displaced without pulsing. Movement and release resume smoothly even after a long idle. Leaving the window restores the original positions. Once settled, the image stays visible without scheduling more animation frames. Touch interaction does not require the decorative hover effect.

The pointer canvas has no hit area and never rewrites semantic text. Selected text, active editing and pointer drags release the effect. Escape, scrolling, resizing, hidden tabs, presentation/font changes and renderer disposal clear cached pixels. Controls and media remain mounted and usable.

## Other transitions

- Desktop page turns retain wheel/trackpad thresholds, keyboard, swipe and anchor navigation. In Dynamic mode, a 720ms liquid transition covers background, content, header and status/footer. Each of the six adjacent page boundaries has a distinct pattern: a lateral spill, merging pools, opposing currents, a vertical pour, a central seam opening, and an outgoing pocket draining away. Backward navigation mirrors the pattern and reverses its flow. Skipped sections use the lower page boundary's pattern; presentation changes cycle the same family.
- A persistent WebGL surface draws the continuous liquid field in **one GPU triangle per frame**, sampling two textures. Displacement bends both pages near their shared edges; cells stay at a fixed 2px instead of popping between raster resolutions. Only a narrow antialiased interface mixes colors. There are no per-frame image copies, DOM captures, texture uploads, canvas resizes or thousands of CPU strip draws. The local 2D canvas is hidden and left untouched while the GPU surface is active; 3D scenes pause their drawing during the covered page turn. Fill work is capped at 2.4 million pixels. The incoming frame is complete by 80% (576ms), after the deck's 560ms compositor slide; the overlay remains opaque through 86% before a single clean handoff. New navigation replaces the active effect; cancellation clears it immediately.
- Compact screens keep ordinary vertical scrolling. Explicit section links can use the screen transition; direct hashes and browser history show the destination immediately.
- Dynamic presentation changes morph the viewport in about 560ms. Project details and book opening use native compositor entrances; book closure fades and settles over 180ms. These controls no longer capture and scatter thousands of particles. Media stays mounted throughout.
- Entrances use a shared 620ms deceleration with small offsets and a capped 32ms stagger. Visual groups animate once, avoiding nested transforms. The first page, compact scroll reveals, popovers and header/footer have coordinated appearances. Button presses compress slightly; shelf spines lift on direct hover. Keyboard focus reveals a group immediately. Navigation settles its live DOM beneath the liquid cover before handoff, avoiding a second fade or delayed text. Progress uses a transform rather than animating layout width. Theme changes no longer overwrite every element's transition property.
- The top/bottom bar divider rules and full-width palette strip are removed. Experience, Projects, About and Contact are centered as one bottom-navigation group; page count and scroll hint remain at the edges.
- Motion Off bypasses effects and entrances; System follows reduced-motion preferences. Motion On remains the requested default.

## ASCII presentation

ASCII is a separate presentation of the same portfolio, with the same pages, media, controls and horizontal/compact layouts. All interface text uses Geist Mono. Icons and the LL logo become literal characters; frames are made from `+`, `-` and `|`, and sliders use character tracks over accessible native range inputs. The normal CSS fills, curves, shadows, SVG icons and image output are suppressed. Palette samples are colored digits. The Chinese name remains available to assistive technology and appears as `LI JIA HE` in the character-only presentation.

Existing 3D scenes and video render through the colored character rasterizer; the CD player has its character disc and the non-WebGL pool fallback is character artwork. Character frames resize with their visual groups and are cleaned up when leaving ASCII mode. They are decorative, have no pointer hit area and are hidden from assistive technology.

ASCII navigation uses the native horizontal slide with sparse character traces; it does not capture viewport bitmaps or use the liquid surface. Pointer movement never starts pixel displacement. ASCII entrances fade native text groups without translating or scaling them. Motion Off disables these transitions while retaining character rendering and all native controls.

## Typography and curated themes

Dynamic mode uses **Hanken Grotesk** throughout, verified from [Sofia Bodnar's public font declarations](https://sofiabodnar.com/). This includes the hero name, headings, body text, navigation, controls, metadata and labels. Body text uses the reference's lighter 300 weight and headings use 400. Chinese characters use the existing sans fallback. ASCII mode uses Geist Mono throughout.

Text links use a faint one-pixel baseline with a current-color line that grows from left to right on hover or keyboard focus over 350ms. Section navigation uses the same hairline treatment, with active sections underlined. Contact and project links are plain text instead of raised pills. The liquid overlay exposes these thin feedback lines so the native CSS animation stays visible while nearby pixels move. Motion Off makes these state changes instant. Link hit targets remain at least 44px high, and focus indicators remain visible.

Four restrained palettes lead the theme picker. They adapt the design language of portfolios actually listed in the Waterloo webrings:

- **Graphite**: near-black, gray and soft white, inspired by [Kelvin Zhang](https://www.kelvinzhang.ca/) and [Anthony Wang](https://anthonywang.dev/).
- **Slate**: slate neutrals with one indigo accent, inspired by [Alex Zhu](https://probablyalex.com/).
- **Sage**: green-gray and cream, drawing from [George Shao's portfolio](https://shao.zip/), [Aaron Ye's green/cream palette](https://aaronye.dev/) and the dark green/cream treatment on [Will Harris's portfolio](https://willharris.ca/).
- **Paper**: warm paper, ink and a muted oxblood accent, also drawing from Will Harris's paper/red palette.

All four work in light and dark appearance. The original twenty colorful palettes are also available in a separate Colorful group, and the full picker scrolls within the viewport. Borders, shadows, background texture and ghost numerals are quieter. The arrival preset is **Dark + Graphite + Motion On**, including CSS before hydration. Appearance and motion still use `pf.v2.*`; palette choices now use `pf.v3.palette`. Only legacy minimal choices migrate from v2, so a previously saved Candy Shop choice does not override the new minimal default. New explicit colorful choices are remembered normally. The existing Dynamic/ASCII preference is retained.

## Rendering and limits

`coordinator.ts` connects one optional renderer. `renderer.ts` owns one on-demand animation loop, local capture caching, explicit transitions and cleanup. Open dialogs temporarily host the canvas so it remains visible in the dialog top layer. No filter or transform is added to the deck's containing block.

`snapshot.ts` captures text, fills, outlines, SVG paths, images and canvases, including page texture and fixed navigation. Full-viewport captures measure text runs instead of forcing a layout measurement for every character, with a glyph fallback for words that wrap. Local captures retain exact character positioning and are bounded to a 272×272px region on stable 64px tiles; a complete 2px grid fits its 20,000-sample budget without reservoir omissions. The liquid field admits only nearby cells and holds at most 24,000 while old neighborhoods settle. Source identities stay stable. Covers mask only displaced source cells, before all moved cells are drawn. Captures are refreshed on neighborhood entry or content/presentation invalidation, never every animation frame. Loaded fonts invalidate stale text geometry. Three.js stages redraw when captured.

The rasterizer approximates complex shadows, CSS background artwork and some SVG details. Local masks use the page background beneath the displaced liquid; moving regions can expose small background gaps as the cells spread. A held neighborhood is a cached sample, so moving video/3D details resume live when the effect clears. Media itself keeps running.

`liquidGeometry.ts` provides deterministic displacement, exact critically damped integration and barrier collision constraints. `liquid.ts` manages persistent cells, circle steering and rest detection, reusing particle vectors and its drawing buffer to avoid per-pixel allocation during animation. Fresh captures can update cell colors without resetting their motion. No periodic phase or random emission drives cursor motion. Local canvas DPR is capped at 2.

`screenSurface.ts` owns one WebGL context, shader program and fullscreen triangle, reusing them across navigation. Each turn owns two textures, released on completion/cancellation; initialization, shader, upload and context-loss failures leave the destination usable. The optional fallback in `screen.ts` uses two cached 2px mosaics and at most 96 bands, with bounded edge samples. `screenGeometry.ts` supplies the six deterministic masks for this fallback. No new production dependency was added.

## Verification

`npm test` covers local field geometry, frame-rate stability, stationary hold, barrier crossing, long-idle wake, release, source masks, memory bounds, cursor locality without DOM movement, click behavior, selection/editing/hidden-tab cleanup, clipped capture density, distinct liquid masks and reverse flow, bounded source advection, full-screen coverage, buffer failures, palette contrast/default CSS parity, and React navigation/media/dialog state preservation. GPU doubles verify one draw per frame, fixed resources, texture failure cleanup and context-loss recovery. Additional tests cover grouped entrances, keyboard interruption, ASCII-only controls/frames, character transitions without pixel work, mode cleanup and text-run capture measurements.

The GPU shader was also compiled and linked directly with ANGLE in an offscreen EGL pbuffer, without a browser or computer use. Thirty frames across all six variants verified opaque coverage and exact outgoing/incoming endpoints. This checks real shader execution; it does not certify browser frame pacing, final DOM appearance or a particular device's frame rate.

`npm run build` checks TypeScript and creates the production bundle. Real browser visual tuning, touch hardware and GPU profiling remain manual checks. No computer-use automation is used.
