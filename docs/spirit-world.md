# Beyond the boundary

An optional BLEACH fan-art chapter at the bottom of Contact. The portfolio remains directly usable without entering it.

## Entrance

The trigger is an original vector silhouette of the black Tensa Zangetsu Bankai katana, with its narrow blade, wrapped handle, guard and chain. Selecting it opens a native modal dialog, locks the underlying document at its current position and tears apart a jagged black Garganta. A sword slash, low tearing noise, bass swell and crossing rush are synthesized locally with Web Audio. Skip entrance, Replay crossing, Portal FX and Return controls remain available.

The supplied `Bleach_-_Treachery_(mp3.pm).mp3` is copied to `public/music/spirit-world/treachery.mp3`. It loads only when entering; there is no site-load autoplay. The ordinary music player pauses, retains its track/time, and resumes only if it was playing before entry. Portal music has a separate play/pause control. Exit stops the portal track and effects. The global interface-sound preference determines whether the initial portal effects play.

## The world

This is a handcrafted, stylized Seireitei-inspired courtyard, not a canonical scene reconstruction or production-quality anime character model set. It has a central tiered tower, tile-roofed white halls, perimeter walls, a floating causeway, moon, reflecting pool, lanterns, a cherry tree, drifting spirit particles and pink petals. Ichigo, Rukia and Byakuya are original low-poly figures. Static architecture is batched by material to reduce draw calls. No remote models, textures or copyrighted sound-effect clips are downloaded at runtime.

Drag to orbit, pinch/scroll to zoom, or focus the scene and use arrows and +/- keys. Location buttons smoothly reposition the camera. Clicking the character figures selects their locations. Whole courtyard resets the camera, including after manual orbiting. All location content also works when WebGL is unavailable. ASCII mode renders the scene through the existing character rasterizer.

| Place | Portfolio section | Content direction |
|---|---|---|
| Training hall / Ichigo | Experience | Milestones, responsibilities and lessons learned |
| Archive / Rukia | Projects | Actual project writeups, experiments, demos and source links |
| Moonlit garden / Byakuya | About | Swimming, coaching, music, books and interests |
| Return gate | Contact | Existing contact links and a way back to the main page |

The location panels reuse existing portfolio content. Unfilled profile/project fields remain placeholders rather than fabricated accomplishments.

## Good next additions

Keep the main portfolio as the fast, accessible route; let this be an optional discovery. The strongest next addition would be a real project case study in each archive slot. A small collectible spirit-butterfly trail could reward exploration without blocking content. More detailed licensed or user-supplied character models could replace the stylized figures later. Avoid adding combat, multiple huge maps or a second independent content system before this small world is polished on actual devices.

## Verification

Automated checks cover bounded finite scene geometry and animation, batched mesh count, portal sound timing/cancellation, no autoplay, soundtrack handoff/reentry, fallback locations, returning to a portfolio chapter and Escape/focus restoration. A native offscreen GLES proof renders exported scene geometry for inspection; it approximates material lighting and is not a browser screenshot. Production TypeScript/Vite build and the existing suite are run. Browser layout, real audio listening and device frame pacing remain unverified under the no-computer-use preference.
