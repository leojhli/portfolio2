# Personal Portfolio — Product and Build Plan

Status: planning reference. No website implementation has started.
Last updated: October 20, 2026.

## Purpose

Build a personal portfolio that looks minimal and familiar at first glance, then reveals playful interaction as visitors explore. It should communicate professional experience and projects while showing personality through swimming, coaching, books, music and games.

The companion `figma-frontend-brief.md` is a standalone prompt for building the frontend in Figma Make. This document preserves the overall direction and engineering roadmap for future work.

## Confirmed direction

- A normal, readable portfolio at rest. Avoid a game-world layout, dashboard appearance or heavy pixel-art styling by default.
- Two presentation modes: **Dynamic** and **ASCII**. Both show the same content and preserve navigation and functionality.
- Dynamic mode: cursor proximity causes localized pixel dissolution and reconstruction; clicking sends a ripple across the page.
- Full animation direction: section navigation can scatter the outgoing visuals into pixels, swirl them across the viewport and assemble the destination's elements in real time. Carry this visual language into component reveals and mode changes.
- Elements respond with bounded motion but stay anchored. Links must remain easy to target; no draggable or throwable layout.
- ASCII mode transforms the interface and artwork where readable, while preserving actual text and using normal visuals whenever ASCII becomes unclear.
- Include the Chinese name **李嘉和**, preferably beside the display name in the introduction.
- Missing personal details will be filled in later. Do not invent biography, achievements, employers or project facts.

## Appearance controls

Keep presentation, appearance, palette and motion independent:

| Control | Behavior |
| --- | --- |
| Dynamic / ASCII | Changes the visual presentation without replacing content. |
| Light / Dark | First visit follows the device preference; an explicit choice overrides it. |
| Shuffle colors | Generates and applies a palette only after a visitor requests it. |
| Reset colors | Returns to the fixed default palette for the current light/dark appearance. |
| Motion | Offers system, on and off settings; defaults to system and respects reduced motion. |

Never randomize colors on arrival. Every new visitor gets the same fixed palette for their device's light/dark appearance. Remember explicit appearance choices, mode and palettes locally when storage is available; gracefully use in-memory state otherwise. Follow changes to device appearance until the visitor makes an explicit choice.

Maintain separate palette selections for light and dark so changing appearance always produces a suitable background and readable text. Do not reload the page when a control changes.

### Color generation

Random color schemes are viable without a backend or external API. Generate harmonious candidates locally, map them to semantic tokens, and validate their actual text/background and control/background pairs before applying them. Try a bounded number of candidates; use a curated fallback if none passes.

Use four curated palettes as guaranteed fallbacks: Paper (light neutral), Ink (dark neutral), Tide (light blue/teal) and Dusk (dark violet). Paper and Ink are the first-visit defaults. Figma should define and verify the exact token values. Keep default body text neutral and reserve accents for emphasis, controls and effects.

Use [Coolors](https://coolors.co/) as a design aid, not a required runtime integration. Do not assume it provides a suitable public API.

## Content and information architecture

Build a single scrolling page with section anchors and the following order. Primary navigation can emphasize Experience, Projects, About and Contact; personal widgets remain discoverable further down the page.

### 1. Introduction and contact shortcuts

- `[Display name]` with **李嘉和** beside or below it.
- `[Short introduction]` and an optional portrait/video placeholder.
- LinkedIn, GitHub, résumé and email.
- Compact appearance controls, clearly discoverable without dominating the introduction.

### 2. Experience

Editable entries with role, organization, dates and concise achievement bullets. Use clearly marked placeholders until real details arrive. Include swim coaching as experience once dates and details are supplied; the personal section can expand on the story.

### 3. Projects

Cards with title, summary, technologies, optional visual, repository link and optional live link. Do not fabricate accomplishments or destinations. Missing actions should be omitted or explicitly unavailable.

### 4. Beyond the screen

Include three short pieces: swimming career, swim coaching and a fun fact. Safe starter copy can say “Swimming has been a big part of my life, and I've also worked as a swim coach.” Leave specifics as `[Swimming story]`, `[Coaching details]` and `[Fun fact]`. Never invent teams, awards, times, qualifications or dates.

### 5. Listening — CD player

Use a compact tactile CD player with disc artwork, track title/artist, play/pause, previous/next, progress, seek and volume. Spin the disc only during playback and when motion is permitted. Audio begins only after user interaction.

Initially use supplied playable assets and a local track list. Until assets are supplied, display “Audio coming soon” and disable transport controls rather than pretending music is playing. Include loading, playing, paused, ended, unavailable and error states. A single-track list disables previous/next. Presentation and theme changes preserve the current track and position.

Streaming services and authentication are later integrations; a visual player alone does not provide streaming playback.

### 6. Bookshelf

Show book spines/covers that open an accessible detail dialog with title, author, reading status and optional personal note. Use editable placeholder books until the actual list is supplied. Ensure titles remain available when covers fail or cannot be rendered legibly in ASCII.

### 7. “hmu if u want to play”

Show logos or recognizable symbols for all ten entries:

- League of Legends
- Valorant
- Roblox
- Rocket League
- Minecraft
- Geometry Dash
- Clash Royale
- Brawl Stars
- Poker
- Chess

Show the name on hover, keyboard focus and tap. Every symbol also needs an accessible name. These are informational interests unless profile links are supplied; do not invent handles or destinations. Use recognizable temporary symbols with labels if suitable logo assets are unavailable.

#### Game highlight clips

Hovering over a game symbol should preview a short selection of my best clips for that game. Use a compact preview panel beside the symbols on desktop, with a stable size so playback does not shift the page. Start after a short hover intent delay to avoid loading clips while the cursor simply passes across the row. Keyboard focus exposes the same preview; tapping selects a game and reveals its preview on touch devices. Provide a visible play/pause control and an explicit close action for touch previews.

- In Dynamic mode, show the original clip. In ASCII mode, render the same clip as ASCII using the optional media renderer. Mode changes preserve the selected game and clip position where possible.
- Keep previews muted and looping by default, with only one game preview playing at a time. Never interrupt the CD player's audio. Stop playback when the preview closes, leaves view or the tab becomes hidden; release inactive media/rendering resources.
- With reduced motion or motion-off, show a static poster and require an explicit play action. Handle blocked autoplay with the same play control.
- Use lazy-loaded, short, appropriately sized supplied clips. Add optional highlight media/poster entries to each game's local content data; do not invent clips or profile destinations. A game without a clip still shows its name normally.
- While an ASCII renderer loads, show a static ASCII poster or a readable placeholder. If ASCII conversion is unavailable or illegible, follow the site's readability rule: use a normal poster with an explicit option to play the original clip, rather than silently autoplaying a non-ASCII video in ASCII mode.
- Provide a short text description for each highlight so the moment is understandable without the video. Verify preview placement, cancellation during rapid hovering and rendering performance on mobile.

### 8. Contact and footer

Repeat LinkedIn, GitHub, résumé and email. Use an email link rather than a contact form initially. Missing links and résumé files must have honest placeholder states.

## Interaction and rendering design

### Dynamic mode

Keep semantic HTML content and hit areas stable. Use a separate decorative rendering layer for localized dissolution; any visual fragments must reconstruct quickly when the cursor moves away. Avoid treating every letter as an independent physics object.

Start with a cursor radius around 100 CSS pixels, a brief reconstruction period around 350 ms, and a roughly 900 ms click ripple. Tune during visual QA. Bound element response to approximately 3 px translation and subtle rotation. Effects must not obscure essential copy for sustained periods.

A click emits a wave from its page position. Decorative elements and nearby surfaces can respond as the wave travels. The overlay must not intercept pointer events, change layout, delay link activation or break text selection. Disable displacement and dissolution for a focused control or an actively selected text region.

On touch devices, keep tap ripples but omit cursor proximity behavior. Reduced-motion/off mode uses static focus and press feedback. Pause decorative rendering in hidden tabs and offscreen regions. Cap particle density and pixel ratio, and reduce effects when performance is poor.

### Full animation system and section transitions

Treat animation as a coordinated part of the final experience, beyond individual hover effects. The signature transition is **scatter → swirl → assemble**: pixels lift from outgoing visuals, follow curved swirling paths, then settle into the headings, cards and artwork of the destination section. The destination should visibly form on screen rather than appear behind an unrelated loading animation.

- **Trigger:** activate the full transition when a visitor explicitly selects a different section in the navigation. Preserve the single scrolling page and section anchors; this does not require a separate route or page for every section. Normal scrolling stays natural and uses only subtle reveals, without repeated full-screen swirls or scroll hijacking.
- **Choreography:** use an initial target of 800–1,200 ms total, with overlapping scatter, travel and assembly phases. Resolve the destination heading first, then its main content, then secondary details. Keep navigation visible and stable throughout. Tune timing during implementation rather than enforcing a long cinematic delay.
- **Real-time rendering:** animate a bounded pool of pixel fragments toward target positions derived from the destination's layout and visual silhouettes. Sample representative areas of text, cards and artwork; do not create a DOM element for every pixel. Use a decorative Canvas/WebGL layer and hand off cleanly to the actual HTML elements as assembly completes. Any temporary visual masking must preserve semantic content and must not leave invisible interactive targets.
- **Navigation behavior:** begin anchor navigation immediately and coordinate the effect with movement to the destination; do not block navigation until the animation finishes. Preserve URL hashes, deep links and browser back/forward behavior. Direct page loads with a hash reveal their destination immediately. Skip full transitions when the selected section is already active.
- **Interruptions:** the latest section selection wins. Cancel or retarget existing particles without queuing transitions. Manual scrolling, Escape, a hidden tab or a rendering failure should stop the effect and reveal normal content immediately. Transfer keyboard focus to the destination heading after keyboard-initiated section navigation, while keeping the navigation controls available during the effect.
- **Interaction priority:** use one animation coordinator so section transitions, click ripples and cursor dissolution do not compete. A section-navigation click uses its ripple as the start of the transition; suppress secondary decorative effects while assembly runs. Preserve audio playback and component state throughout.
- **ASCII equivalent:** use moving character fragments that swirl into character borders, artwork and readable headings. Keep actual text, especially 李嘉和, intact in the final rendered interface. Simplify the effect if a character-based version is unclear.
- **Fallbacks:** motion-off/reduced-motion settings show the destination immediately with static feedback. On constrained devices, use fewer particles or a brief simple reveal. Navigation and content never depend on the particle renderer succeeding.

Extend the same motion language to book details assembling on open and dispersing on close, project cards revealing in a short stagger, and Dynamic/ASCII changes morphing through pixels or character fragments. Keep these component transitions shorter than section navigation, interruptible and compatible with focus management. Music playback remains user-controlled. Initial arrival stays quiet: show the normal portfolio promptly rather than putting a mandatory cinematic intro in front of it.

This is the full-build animation target. Prototype approximations must be identified in handoff notes. The companion Figma brief remains the initial frontend brief; this expanded animation specification belongs to the later graphics implementation phase unless explicitly brought forward.

### ASCII mode

Use monospace typography, character borders, character-based decorative ripples and ASCII versions of portraits, CD art and bookshelf details. This is an interface treatment, not a screenshot of the whole website rendered into characters.

Keep headings, paragraphs and actions as real, selectable HTML text. Preserve **李嘉和** as Unicode with a compatible Chinese fallback font. A normal icon or image is allowed whenever the ASCII substitute is ambiguous. Do not shrink character art until it becomes unreadable; simplify or replace it on mobile.

Evaluate [VideoToAscii](https://github.com/leojhli/VideoToAscii) for optional portrait/video artwork. Its documented React/WebGL2 renderer handles media, not whole-page interface conversion. Lazy-load it, provide a static fallback, honor motion settings, and verify actual target browsers and mobile devices before relying on it. Check license terms before copying source.

## Engineering approach and future backend

### Frontend foundation

- Default stack: React, TypeScript and Vite. Keep styling token-based and avoid a mandatory graphics dependency for basic page use.
- One shared content source and component structure for both modes; do not create two separately maintained portfolios.
- Semantic tokens: background, surface, primary text, muted text, border, accent, on-accent, focus and decorative effects.
- Keep content, preferences, music playback and decorative effects as separate concerns. Theme/mode changes must not remount the audio player.
- Use local typed data initially, accessed through replaceable content/media adapters. Content groups are profile/contact, experience, projects, books and tracks.
- Initial data access is local; no HTTP API, database, login or admin UI is required for the frontend phase.

### Backend later, only as needed

1. **Content editing:** choose a CMS or authenticated admin workflow when updating local content becomes inconvenient. Preserve the frontend content interfaces.
2. **Media storage:** introduce object storage/CDN for portrait video, book covers, résumé and audio when needed. Keep source assets separate from generated ASCII output.
3. **Music integrations:** choose a provider and intended behavior first—metadata, embeds, previews or authorized playback. Keep credentials server-side where required; expose only the minimum normalized information to the frontend.
4. **Optional additions:** consider contact forms or privacy-conscious analytics only if explicitly requested later. They are not prerequisites for this portfolio.

No backend provider, database schema, public API endpoints or deployment platform is selected yet. Choose these when a concrete server feature needs them, rather than building unused infrastructure now.

## Delivery phases

1. **Current:** create these two documents only. Do not scaffold or implement the website.
2. **Frontend prototype, when requested:** use the Figma Make brief to create the responsive layout, editable mock data, controls and feasible interaction prototypes.
3. **Graphics refinement:** implement and profile the full animation system: cursor dissolution, travelling ripples, scatter/swirl/assemble section navigation, component reveals, mode morphs and optional ASCII media. Document prototype approximations and validate interruption, accessibility and performance fallbacks.
4. **Real content:** replace placeholders and supply media, résumé, destinations and personal stories.
5. **Backend and publication:** select integrations only after requirements are known; verify the finished site before deploying.

## Acceptance and verification

- First visit: Dynamic mode, device light/dark preference and matching fixed palette; no surprise random colors or audio.
- Responsive checks around 390, 768 and 1440 px, plus a 320 px narrow-width check. No accidental horizontal scrolling or obscured controls.
- Every section and contact action remains understandable in both modes. Chinese text renders correctly.
- Cursor effects never move hit areas, obstruct clicks, block scrolling or interfere with selection. Keyboard and touch users can reach equivalent information.
- Section navigation visibly swirls pixels into the destination elements, then resolves to crisp HTML without duplicated content, blank frames or leftover overlays. Test rapid repeated section selections, manual-scroll interruption, Escape, resizing mid-transition, hash links and browser back/forward.
- Full transitions preserve music and component state, keep navigation operable and reveal content immediately if motion is disabled or rendering fails. Ordinary scrolling never triggers a mandatory full-screen transition.
- Mode changes preserve scroll position, keyboard focus where practical, book dialog state, current track and playback position.
- Theme generation applies only palettes meeting WCAG AA contrast targets; test the token pairs actually used, including focus and disabled states. A failed generation restores a valid fallback.
- Reduced motion and explicit motion-off disable decorative movement, including spinning discs and moving ASCII media.
- Audio handles loading/failure honestly, remains silent until initiated, and does not restart on appearance changes.
- Test missing links, missing/broken covers, empty book/track lists, blocked storage and unavailable WebGL.
- Game highlights match the selected game and presentation mode. Test rapid hover changes, keyboard focus, touch selection, missing clips, blocked autoplay and ASCII fallback; only one preview plays and the CD player's audio remains uninterrupted.
- Verify current Chrome/Edge, Firefox, Safari and an actual iOS/Android device before production release; do not infer compatibility from desktop appearance alone.

## Content needed later

- Display name, introduction, portrait or short video.
- LinkedIn, GitHub, email and résumé PDF.
- Experience entries and project details/assets/links.
- Swimming and coaching story, dates and any achievements the owner wants to share.
- Fun fact.
- Books, reading status, covers and optional notes.
- Track list, artwork and audio assets suitable for hosting, or a chosen listening integration.
- Optional gaming profile links/handles.
- Best gameplay clips by game, with short descriptions and optional poster images.

## Reference status

- [heyamit.dev](https://www.heyamit.dev/): inspiration for the user-described pixel dissolution. Direct inspection was unavailable during planning; verify its actual behavior later.
- [leojhli/portfolio](https://github.com/leojhli/portfolio): requested music/bookshelf inspiration. Repository inspection was unavailable during planning; do not claim its implementation has been verified.
- [VideoToAscii](https://github.com/leojhli/VideoToAscii): README inspected; documents a reusable React/TypeScript WebGL2 media renderer. Integration, licensing and target-device validation remain future work.
- [Coolors](https://coolors.co/): palette exploration reference; no runtime dependency is planned.
