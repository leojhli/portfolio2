# Interaction effects

The current design uses a vertical story with sticky sideways Projects and photo-gallery chapters. It preserves the interactive planet, pool, books, games, colored ASCII scenes and persistent music player. Historical horizontal-only plans no longer describe the layout.

## Native scrolling and depth

`Deck.tsx` is the single scroll coordinator. Native document scrolling drives measured sideways track translations inside CSS sticky frames. Each horizontal chapter has viewport height plus its travel distance. There is no wheel interception, scroll snapping or page-switch transition. At widths below 1024px or heights below 700px, tracks become stacked content.

Scroll updates are coalesced into one animation frame. Track travel clamps at both boundaries and reverses directly with scrolling. Text and artwork groups use opacity and small translations; photos receive bounded horizontal parallax. Layout reads happen during measurement, not for every reveal on every frame. Resizing preserves the reading chapter and fractional progress. Font and content sizing changes refresh geometry.

Native anchors and history navigate to chapter positions. Focusing a control in an offscreen horizontal card brings it into view. Focused reveal groups become fully visible. Experience, Projects, About and Contact navigation stays centered at the bottom. Interactive collection chapters map to About. Media remains mounted across navigation and preference changes.

The page scrollbar is a translucent overlay, so it reserves no gutter and photography extends to the viewport edge. It supports pointer dragging, track clicks, arrow keys, Page Up/Down, Space, Home and End. Its accessible scrollbar value follows native document scrolling. The native scrollbar is hidden only while the overlay is mounted; cleanup restores it. Nested content keeps its own native scrolling.

## Photography, contours and signature

Supplied photographs are optimized into 640px and 1280px WebP variants. The night city opens the story; the fairground portrait is offset in the hero, and school, hallway and fairground photographs form the personal gallery. Photography retains its natural colors in every theme.

The original contour shader uses domain-warped noise to form flowing bands with antialiased boundaries. It follows the mechanism established by public-source investigation of the reference, without importing its shaders or branding. Drawing-buffer width is capped at 1400px. Hidden tabs and the fully covered hero pause continuous background work. A static SVG contour field remains available without WebGL; ASCII uses a character field. See [reference investigation](reference-motion.md) for evidence and limitations.

The supplied signature silhouette is preserved through an alpha mask. Traced centerline paths reveal the actual ink in writing order, including the final dot. The hero signature is fully hidden at zero scroll, including round stroke caps. Scroll controls the drawing and reverses it when scrolling back. Contact draws once on entry, pauses while hidden/offscreen, and retains completion across theme or presentation changes. ASCII reveals character samples in pen order.

## Literal ASCII rendering

ASCII mode renders the shapes of the letters themselves from ASCII marks, using ` .:+*#@`. It is not just a monospace font. `asciiText.ts` measures original text runs, samples their silhouettes onto a character grid, and draws cached canvases. Chinese glyphs retain their shapes with a denser grid.

Original DOM strings remain selectable, searchable and accessible to screen readers. Failed text-canvas rendering leaves ordinary text readable. Output has no pointer hit area. Text changes, resizing, font loading and theme changes refresh caches. Offscreen work is deferred and creation is batched. Scrolling moves cached text with the document instead of recapturing it every frame.

Icons and the LL logo use characters; frames use `+`, `-` and `|`; radio controls and sliders have character indicators over accessible native controls. Photographs, signature, project art, 3D scenes and video use character representations. CSS curves, shadows and ordinary SVG/image ink are suppressed. Focus outlines remain available.

ASCII has no liquid pointer displacement. It shares native scrolling and sideways chapters, with reveal lift and scale disabled so glyphs remain steady. Leaving ASCII cleans up its text/frame canvases and observers.

## Local cursor behavior

Dynamic mode has a separate Cursor On/Off toggle for the local circular obstacle in a dense pixel field. Turning it off clears displacement without stopping scrolling, signature, scene or dialog animations. ASCII disables this control and always omits the barrier. Its 48px barrier repels pixels within a 104px neighborhood. Only the local area changes; proximity never translates headings, cards or the whole background. There are no timed emissions, expanding click ripples or whole-screen cursor pulses.

Persistent 2px source cells use critically damped motion and tangent waypoints around the barrier. A resting pointer holds the field without pulsing. Leaving restores original positions. Selection, editing and pointer drags release the effect. Scroll, Escape, resize, hidden tabs, presentation changes and disposal clear stale samples. Touch does not require decorative hover.

Captures are bounded to 272x272px regions on stable 64px tiles. A 2px grid fits the 20,000-sample budget; the field holds at most 24,000 cells while previous neighborhoods settle. Cover masks affect only source cells. The canvas never intercepts pointer input or rewrites semantic text.

## Themes, controls and media

Hanken Grotesk is used throughout Dynamic mode. ASCII samples text shapes and draws its character art with Geist Mono. Text links retain animated hairlines. Header/footer separator rules remain absent.

Exactly three themes are available: Ink (default, near-black and subtle ice-blue/periwinkle), Paper (warm white, cobalt/sky/lavender), and Electric Blue (navy-black with stronger blue/cyan/indigo). Both minimal themes retain color. A single `pf.v4.theme` choice replaces separate appearance/palette selections. Legacy light preferences migrate to Paper, dark minimal choices to Ink, and colorful dark choices to Electric Blue. Valid new choices take precedence.

Presentation remains in `pf.mode`; the cursor-barrier preference is saved in `pf.cursorBarrier` and defaults to on. Motion is always on, as requested; legacy motion preferences are ignored and the motion picker has been removed. Blocked storage falls back to in-memory state.

Books, project details and media retain their existing interactions. Music does not autoplay and remains mounted while moving through chapters, changing themes or toggling presentation. All observers, listeners, animation frames and GPU resources are released during cleanup.

Interface sounds are original synthesized cues: a louder dry triangle-wave click on page content, a short square-wave typing tick, and a rising sine tone for buttons, links and interactive objects. Hover has its own quieter cue. Printable keys and deletion keys trigger typing; modifier shortcuts and button activation keys do not double-trigger. The Sound toggle stores `pf.sound`; it starts on, but no audio context is created before a user clicks. Hover cues are throttled, simultaneous voices are bounded, and muting stops pending tones. Media controls use the same activation cue and the music player remains independent. Public script inspection of [Justin Wu](https://www.justinzwu.com/) identified click/select/deselect/menu cues, while [Justin Lam](https://www.justinhylam.com/about) uses tap/modern-click/hover cues. Those interaction categories informed the implementation; no third-party sound assets are bundled.

## Rain District exploration

The optional destination is now Rain District / 雨巷, an original Chinese cyberpunk lane. A transit ticket at the end of Contact opens the world with a short fade. The previous Bleach environment, sword, portal audio, characters, and Treachery file have been removed. Compatibility-only CSS/dataset names (`garganta`, `spiritWorld`) still coordinate the global effects layer.

`RainDistrictView.tsx` connects the existing Stage renderer to first/third-person exploration, an articulated courier avatar, post-processing bloom and literal ASCII output. WASD/arrows walk, Shift runs, drag looks, and optional mouse capture is explicit. E/click interacts with nearby terminals; four persistent location buttons expose portfolio content independently of WebGL. Camera changes preserve the walker position and the chase camera shortens around obstacles. Touch has a directional pad and drag-look. Escape unlocks before exiting. Reset returns to the arrival point.

`rainDistrict.ts` composes a Chinese shophouse lane, repaired storefronts, radio workbench, tea table, archive reels, drainage channels, overhead utility wires, tram service and a suspended bronze-square/jade-circle rain loom. Lighting uses a dark neutral base, jade signage, amber interiors and a little coral. Planar reflections are broken into puddles. Rain runs on the GPU; animated imported condenser fans and the tram use the shared frame loop.

`districtModels.ts` loads four licensed Sketchfab GLBs only after entry. Six shophouses and two scooters share instanced geometry; eight condenser units retain their rigged fan animation. A single lantern uses warm emissive paper instead of glass transmission. Sources, authors, licenses, hashes and original transforms are in `public/models/neon-district/manifest.json`; a credits page is linked from the world. The 15.4 MB source assets have embedded textures no larger than 1024px. See [asset notes](neon-district-assets.md).

The district has a bounded 48m × 64m walkable area. Solid building footprints, the rain collector, terminals, scooters and street furniture block walking. All four terminals have verified routes from spawn. The camera and walker are separate, with circle-vs-footprint movement, small collision steps and damped input. Closing panels restores the walker, and switching views never teleports it.

`districtAmbience.ts` synthesizes rain and ventilation hum after entry. Global sound-off is respected on arrival and the ambience has its own toggle. The existing portfolio player is suspended without losing its position; only previously playing music resumes after exit. There is no replacement song or borrowed soundtrack.

All world geometry, textures, reflection targets, mixers, skeletons, instance buffers, post-processing buffers and listeners have explicit cleanup. Late asset responses after exit are disposed without attaching or updating React state. Unavailable assets leave the authored architecture navigable, and unavailable WebGL leaves all portfolio destinations usable.

`tests/districtModels.test.mjs` checks asynchronous load failure/late cleanup and instancing. `tests/rainAssets.test.mjs` parses real GLBs and verifies their attribution, hashes, bounds, indices, clips and embedded texture budget. `tests/rainDistrict.test.mjs` checks routes, finite animation, geometry budgets, resource cleanup and ambience. First-person tests also cover third-person continuity and collision. React/jsdom covers entry, fallback destinations, sound and media restoration.

Native EGL/GLES validation compiled and linked 12 complete shader programs: eight surface finishes, two instanced variants, rain and reflection. Offscreen geometry renders included the real imported geometry and confirmed the street composition and model placement with approximate lighting. They do not reproduce the final texture/PBR/post-processing appearance or certify browser frame rate. No computer use or browser automation was performed.

## Verification limits

`npm test` covers rail boundaries and reversal, native input, anchors/history, offscreen focus, responsive chapter preservation, signature progress, theme migration/contrast, ASCII glyph drawing and cleanup, cursor geometry/lifecycle, media continuity and dialogs. React/jsdom uses explicit canvas and layout doubles; it does not certify rendered appearance or hardware frame pacing.

`npm run build` checks TypeScript and generates production output. Native offscreen GLES compilation and two-frame rendering validate the contour shader independently of a browser. The traced signature mask was rendered for inspection. Browser layout, touch hardware and real-device smoothness remain unverified: no computer use or browser automation was performed. No production dependency was added.
