# Interaction effects

The current design uses a vertical story with sticky sideways Projects and photo-gallery chapters. It preserves the interactive planet, pool, books, games, colored ASCII scenes and persistent music player. Historical horizontal-only plans no longer describe the layout.

## Native scrolling and depth

`Deck.tsx` is the single scroll coordinator. Native document scrolling drives measured sideways track translations inside CSS sticky frames. Each horizontal chapter has viewport height plus its travel distance. There is no wheel interception, scroll snapping or page-switch transition. At widths below 1024px or heights below 700px, tracks become stacked content.

Scroll updates are coalesced into one animation frame. Track travel clamps at both boundaries and reverses directly with scrolling. Text and artwork groups use opacity and small translations; photos receive bounded horizontal parallax. Layout reads happen during measurement, not for every reveal on every frame. Resizing preserves the reading chapter and fractional progress. Font and content sizing changes refresh geometry.

Native anchors and history navigate to chapter positions. Focusing a control in an offscreen horizontal card brings it into view. Focused reveal groups become fully visible. Experience, Projects, About and Contact navigation stays centered at the bottom. Interactive collection chapters map to About. Media remains mounted across navigation and preference changes.

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

## Verification limits

`npm test` covers rail boundaries and reversal, native input, anchors/history, offscreen focus, responsive chapter preservation, signature progress, theme migration/contrast, ASCII glyph drawing and cleanup, cursor geometry/lifecycle, media continuity and dialogs. React/jsdom uses explicit canvas and layout doubles; it does not certify rendered appearance or hardware frame pacing.

`npm run build` checks TypeScript and generates production output. Native offscreen GLES compilation and two-frame rendering validate the contour shader independently of a browser. The traced signature mask was rendered for inspection. Browser layout, touch hardware and real-device smoothness remain unverified: no computer use or browser automation was performed. No production dependency was added.
