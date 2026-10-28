# Handoff to the next chat — portfolio2 / Rain District

The latest requested direction is implemented in the local portfolio. Continue from this checkout, not an old build plan. The user asked for this handoff after the work was finished.

## Current request and decisions

The user scrapped the Bleach world and wants a distinctive, predominantly **Chinese cyberpunk environment**, with dark lighting, neon, first- and third-person exploration, and good models from Sketchfab. The implementation is **Rain District / 雨巷**: an inhabited after-hours lane rather than an anime location. The user values visual quality and smoothness, dislikes generic results, and prefers autonomous implementation without repeated confirmation.

**Do not use computer use or browser automation.** The user's existing preference still applies. No browser or headless-browser visual verification was performed in this pass. Do not present native graphics proofs or jsdom tests as browser verification.

Workspace: `C:\Users\aweso\OneDrive\Desktop\Personal Projects\Port`

Repository: `https://github.com/leojhli/portfolio2.git`, branch `main`. The prior baseline was `9722f76`. Use `git log -1` and `git status` to identify the final handoff commit and any subsequent user edits.

## What is implemented

- A jade-and-copper transit ticket at the end of Contact opens the optional district with a 700ms arrival fade. The old sword, Bleach city/characters, portal sound and Treachery MP3 were removed.
- Six authored Taiwanese shophouse blocks, worn shopfronts, Chinese signage, drainage channels, awnings, utility wires, a moving overhead night tram, rooftop antennas and a quiet distant skyline.
- A suspended bronze square / jade circle **rain loom** and rain collector form the central landmark. Nearby radio-repair workbenches, a tea table and stools, archive tape reels, scooters and an animated condenser installation add street-level detail.
- Dark neutral surfaces, jade neon, warm amber interiors and small coral accents. Actual softened planar street reflections, HDR bloom, fog, GPU rain and textured weathering. The single paper lantern is tuned for warm emission rather than costly glass transmission.
- First/third-person switching preserves player position. Third person uses an original articulated night courier with a coat, sling bag, restrained jade details and walking animation. The chase camera folds in around walls/bounds.
- WASD/arrows move, Shift runs, dragging looks, optional Capture Mouse locks the pointer, E/click interacts with nearby terminals. Touch has a directional pad and drag-look. Escape unlocks first; a subsequent Escape returns to the portfolio. Reset View returns to spawn.
- Four always-accessible destination buttons open the existing portfolio content: Dispatch Workshop → Experience; Signal Archive → Projects; After-hours Tea House → About; Last Tram → Contact. These work without WebGL too.
- Original synthesized rain/ventilation ambience, with a separate toggle that respects the global sound preference on arrival. Portfolio music pauses without losing track/time and resumes only if it was already playing. No borrowed soundtrack remains.
- Literal ASCII rendering remains available through the shared Stage raster. Loading failures leave authored architecture and accessible destination buttons usable.

## Main implementation files

| File | Responsibility |
| --- | --- |
| `src/components/Garganta.tsx` | District ticket, native dialog, entry/exit, ambient audio and music handoff, location panels. Name retained for compatibility; visible content is Rain District. |
| `src/content/spiritWorld.ts` | Four destination records and coordinates. Historical filename retained. |
| `src/three/RainDistrictView.tsx` | React/Three integration, camera modes, interaction picking, label projection, bloom composer, ASCII and context-loss fallback. |
| `src/three/rainDistrict.ts` | Original architecture, lighting, terrain/colliders, rain, reflection, tram, loom and street furniture. |
| `src/three/districtModels.ts` | Lazy GLB loading, normalized placement, static instancing, skeleton-safe clones, animation mixers, late-response cleanup. |
| `src/three/districtMaterials.ts` | Shared 256px weathering atlas and world-space PBR surface shaders. |
| `src/three/FirstPersonController.ts` | Independent player position, movement/collision, input lifecycle, first/third camera and chase-camera collision. |
| `src/three/DistrictAvatar.ts` | Original courier geometry, articulated walk animation, joint batching and disposal. |
| `src/three/stage.ts` | Shared renderer lifecycle; new optional `renderOverride` supports post-processing before ASCII sampling. |
| `src/effects/districtAmbience.ts` | Original rain and low rail/ventilation hum, gesture-triggered with idempotent cleanup. |
| `src/spirit.css`, `src/firstPerson.css` | District dialog, ticket, controls, mobile layouts and accessible focus styles. |
| `scripts/generate-district-signs.py` | Regenerates the original Chinese sign atlas using Pillow and installed Windows fonts. Not a runtime dependency. |

The `.garganta` dialog class and `document.documentElement.dataset.spiritWorld` remain compatibility hooks for the global effects/background coordinator. They are not a live Bleach feature. Do not rename these without tracing their consumers.

## Model provenance and budgets

Four actual CC BY 4.0 Sketchfab models are bundled in `public/models/neon-district/`. Total source download size is **15,394,084 bytes**. All embedded textures are 1024px or smaller and require no external compression decoder. Raw GLBs are unchanged; runtime scale, placement, instancing and lantern material tuning are original modifications.

1. Solarliu — **Asia Building**, 14,336 triangles, 53 source meshes.
2. HusarL — **Industrial Air Conditioner**, 1,500 triangles, two skinned meshes, 4.958-second fan animation.
3. Scritta — **Old Chinese Lantern**, 976 triangles.
4. Berk Gedik — **Cyberpunk Scooter**, 65,414 triangles.

The official unauthenticated Sketchfab download endpoint required authentication. Exact licensed copies were acquired through the public AllenAI Objaverse dataset, matching source UID, author and license; nothing was ripped from a viewer. Full Sketchfab links, mirror URLs, licenses, SHA256 hashes, geometry bounds and author credits are in `public/models/neon-district/manifest.json`. A user-facing `credits.html` is linked inside the world. See `docs/neon-district-assets.md` for detailed notes.

GLBs load only after entering the optional district. Six buildings and two scooters use GPU instancing rather than separate per-copy draw calls. AC rigs use `SkeletonUtils.clone` and separate mixers. The core plus real imported models measured about 252k triangles and 113 mesh objects before the final small street-furniture additions, excluding the third-person avatar and extra reflection/shadow passes. This is a geometry budget, **not an FPS measurement**. Renderer pixel ratio is capped at 1.35; reflections use a 768px render target. The shared Three bundle still triggers Vite's >500kB chunk-size advisory.

## World coordinates and behavior

- Ground Y = `0.12`; player eye offset = `1.7m`; spawn `[0, 1.82, 27]`.
- Walk bounds: X `[-24,24]`, Z `[-32,32]`. Side/rear streets connect around conservative solid building footprints. Buildings are scenery, not enterable interiors.
- Terminal X/Z: workshop `[-5.6,-7]`; archive `[5.6,-15]`; tea house `[-5.6,9]`; tram `[5.2,19]`.
- Building centres: X `±13.4`, Z `-21,-3,15`, normalized height `14.3m`, turned toward the lane. The source has an approximately square footprint, not a narrow facade.
- Closing a location panel resumes at the same player position. Reset View intentionally returns to spawn. Pointer lock is optional, with drag-look fallback and cleanup for late lock resolution.
- Model teardown disposes shared geometries/materials/textures once, skeletons, mixers, instance buffers and late responses. Reflection/composer targets and avatar resources also have explicit teardown.

## Validation completed

- `npm.cmd test`: **89 tests passed** after replacing obsolete Bleach tests and adding district coverage.
- `npm.cmd run build`: TypeScript and production bundle passed. Existing large shared-Three chunk advisory remains.
- Real GLB parsing checks: hashes/source/license matching, embedded image sizes, finite geometry/indices, transformed bounds and animation tracks.
- Controller checks: wall clearance, tunnelling prevention, normalized movement, first/third continuity, chase-camera collision, pointer-lock denial/late resolution, blur/suspension and avatar cleanup.
- District checks: real collision-based route search to all four terminals, bounded geometry, finite GPU-animation state, repeated teardown with/without reflections, failed/late model loads, instancing and audio failure recovery.
- React/jsdom checks: entry/skip/automatic arrival, every fallback destination, navigation/focus, muted ambience/toggling, exit/unmount cleanup and music time/playback restoration. Existing themes, scrolling, books, ASCII, signature and player tests remain passing.
- Native EGL/GLES 3: **12 complete Three shader programs compiled and linked**, including rain, puddle reflection, eight surface finishes and two instanced variants.
- Native offscreen geometry proofs included the real imported geometry and were inspected for street composition and model placement using approximate lighting. They omit final texture/PBR/post-processing fidelity. Temporary proof scripts/images are ignored under `.tmp-neon/` and depend on local ANGLE libraries; they are not CI/browser tests.

During testing, a mistaken DOM-node equality assertion tried to print a large jsdom/React tree and exhausted the worker heap. It was corrected to assert identity with a concise message and the intended focus behavior: following a portfolio link focuses its destination chapter; Return/Escape focuses the transit ticket. The complete suite then passed.

## Remaining verification limits / useful next refinements

The requested implementation is complete; **actual browser appearance, touch hardware, audio balance and real-device frame rate are not visually/perceptually verified**. Do not claim otherwise. If the user later authorizes a visual review, prioritize dusk exposure/neon bloom, reflected puddles, sign readability, source-model textures/front orientation, mobile controls, fan animation and first/third-person transitions. A low-end quality setting could reduce reflection size, shadow resolution and rain count if measured performance warrants it.

The scene is a bounded original district, not a fully enterable open-world game. It has a procedural courier rather than a downloaded animated character. Current signs are intentionally Chinese and restrained; avoid turning the lane into a generic wall of saturated advertisements or adding anime references again.

## Preserve the portfolio outside this feature

Keep the vertical story with sticky sideways Projects/gallery, native scrolling, Ink/Paper/Electric Blue themes, natural photos, transparent header, centered bottom navigation, the user's exact red/cyan/pure-white 李 logo, signature and sequential handwritten English/Chinese names, optional local cursor barrier, motion preference behavior, literal ASCII mode, book covers/dialogs, and bottom-right spinning music player. Do not resurrect superseded build plans.

Run `npm.cmd run dev` for Vite (`http://127.0.0.1:5173`). Dependencies are already installed; pnpm is optional. If 5173 is occupied, check the existing server instead of killing unrelated processes. Read the local AGENTS.md and `docs/interaction-effects.md` before making further changes.
