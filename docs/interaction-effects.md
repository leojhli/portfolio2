# Interaction effects

The current implementation is the design reference. Preserve the continuous horizontal desktop document, stacked compact layout, project planet, pool, colored ASCII scenes, content, books and persistent music. Historical build plans do not override the current site.

## Continuous scrolling and depth

Desktop uses a native horizontal overflow container with no scroll snapping, page thresholds, full-screen transitions, track translations or wheel lockouts. Any position between sections is a valid resting position. Horizontal trackpad/touch scrolling retains the browser's native momentum. Vertical wheel input is converted to proportional horizontal distance, with one on-demand, time-based damping loop when motion is enabled. There is no accumulating page-turn threshold.

Nested vertical panels, shelves, inputs, dialogs and stage gestures keep their native interaction. Arrow keys scroll short distances; Page Up/Down and Space scroll most of a viewport; Home/End go to the ends. Section anchors move through the same document. Direct hashes and browser history position immediately. Resizing preserves the fractional position. The active section follows the viewport center; progress follows actual scroll position. Experience, Projects, About and Contact stay centered at the bottom, with page count and scroll hint at the sides.

Visual wrappers carry small depth values: portrait, planet, pool, music/books, game preview and background numerals. Their independent CSS translate follows scroll position, bounded to 54px. Text and hit targets stay in their original layout. Motion Off clears depth motion and wheel damping. Compact layouts retain ordinary vertical scrolling.

Desktop visual groups reveal continuously with scroll distance: staggered opacity and upward settling for text/cards, with a larger lift and subtle scale for artwork. Outgoing groups drift upward; reversing scroll reverses the choreography. The settled center stays fully opaque and aligned. Only opacity, translate and scale change; no blur, timers or layout reads are used per group during scrolling. Focused groups become fully visible immediately. Compact layouts keep their once-observed native entrances. Popovers and header/footer have coordinated appearances, button presses compress slightly, and shelf spines lift on direct hover. Entrances use opacity/transform instead of animated layout dimensions. Keyboard focus reveals a group immediately. Media remains mounted. The previous GPU liquid surface, mosaic transitions and character page-transition overlays have been deleted.

## Literal ASCII rendering

ASCII mode renders the **shapes of the letters themselves from ASCII marks**, using ` .:+*#@`. It is not just a monospace font. `asciiText.ts` measures original text runs, samples their silhouettes onto a small character grid, and draws the resulting marks into local cached canvases. Headings, paragraphs, navigation, button labels, metadata and other live interface text all use this path. Chinese glyphs retain their original shapes with a denser grid.

The original DOM strings stay in place for selection, copying, search and screen readers. A successfully prepared character canvas replaces only the visible ink; failed canvas rendering leaves the original ink readable. Output is decorative and has no pointer hit area. Text updates, element resizing, font loading and palette changes refresh the appropriate caches. Off-screen work is deferred, and creation is split into small batches. Ordinary scrolling moves these cached canvases with the document instead of recapturing text every frame.

Icons and the LL logo use characters; frames use `+`, `-` and `|`; sliders use character tracks over accessible native range inputs. Normal CSS fills, curves, shadows, SVG icons and image output are suppressed. Existing 3D scenes and video render through the colored character rasterizer, the CD player has its character disc, and the pool has a character fallback when WebGL is unavailable. Character frames resize with their groups.

ASCII mode has no liquid pointer displacement or page-transition overlay. It shares the continuous horizontal document and scroll-linked artwork depth. ASCII groups share the scroll-linked fades, with reveal lift and scale disabled to keep character shapes steady. Leaving ASCII removes every decorative text/frame canvas and restores the ordinary interface.

## Local cursor behavior

Dynamic mode retains the local circular obstacle in a dense pixel field. Its 48px barrier repels pixels within a 104px neighborhood. Only that portion changes; cursor proximity never translates headings, cards, navigation or backgrounds as whole elements. There are no timed emissions, expanding click ripples or whole-screen cursor pulses.

The field has persistent 2px source cells. Critically damped motion and tangent waypoints steer them around the barrier. A resting cursor holds the field without pulsing or scheduling unnecessary frames. Leaving restores the original positions. Selected text, editing and pointer drags release the effect. Scrolling, Escape, resizing, hidden tabs, presentation changes and disposal clear stale samples. Touch does not require decorative hover behavior.

Local captures are bounded to a 272x272px region on stable 64px tiles. A 2px grid fits its 20,000-sample budget, and the field holds at most 24,000 cells while old neighborhoods settle. Cover masks affect only source cells. The single canvas has no hit area and never rewrites semantic text.

## Controls, appearance and media

Project details and book opening use native entrances; book closure fades over 180ms. No interaction scatters thousands of particles. Open dialogs temporarily host the optional cursor canvas so it remains in the top layer. All listeners, animation frames, text caches and observers are released on cleanup.

Dynamic mode uses Hanken Grotesk for the hero, headings, body and controls, as verified from [Sofia Bodnar's public font declarations](https://sofiabodnar.com/). ASCII samples the same real text layout using a monospace source and draws its character art with Geist Mono. Text links retain their animated hairlines in Dynamic mode. Header/footer divider rules and the full-width palette strip are removed.

The default remains **Dark + Graphite + Motion On**. Graphite, Slate, Sage and Paper lead the picker, followed by the original twenty colorful palettes. New explicit palette choices remain saved in `pf.v3.palette`; appearance and motion use `pf.v2.*`. Dynamic/ASCII is remembered. Motion Off bypasses decorative animation, and System follows reduced-motion preferences.

## Rendering and verification limits

The cursor rasterizer approximates complex shadows, CSS artwork and some SVG details. A held cursor neighborhood is a cached sample, so live video/3D details resume when it clears. ASCII text uses tiny marks for body copy and larger visible character patterns in headings; its underlying real text remains available for selection and accessibility. Native focus outlines remain available in both modes.

`npm test` checks scroll-distance continuity, damping at different frame rates, depth bounds, native keyboard/anchor/history navigation, inner scrolling, literal ASCII glyph draws, cache reuse, original text preservation, text updates/cleanup, cursor geometry/lifecycle, contrast/preferences, media and dialogs. Canvas/layout use explicit doubles. A standalone character-rendering proof can inspect the ASCII silhouettes without a browser.

`npm run build` checks TypeScript and creates the production bundle. Browser appearance, real device frame pacing and touch hardware remain manual checks. No computer-use automation is used, and no production dependency was added.
