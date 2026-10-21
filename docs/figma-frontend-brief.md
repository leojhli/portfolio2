# Figma Make Brief — Minimal Portfolio with Dynamic and ASCII Modes

Status: ready to paste into Figma Make when frontend work is requested.
Last updated: October 20, 2026.

The prompt below is self-contained. Build the frontend only, with editable placeholder content and local state. Backend services and publication are later work.

---

## Build goal

Create a responsive personal portfolio that looks like a clean, normal portfolio when first opened. Its playful personality emerges when the visitor moves their cursor or clicks. Keep the layout readable, restrained and professional, with music, books, swimming and gaming interests adding personal character.

Build a working React and TypeScript frontend. Prefer Vite if a project setup choice is available. Do not add a database, login, server API, contact-form service, streaming integration or deployment workflow.

## Visual direction

- Quiet, typography-led layout with generous whitespace, fine dividers and restrained accent colors.
- No game-world scene, dashboard aesthetic, giant rounded bento grid or excessive decoration.
- A readable sans-serif for Dynamic mode, monospace for metadata and ASCII mode, and a compatible Chinese fallback font.
- Display **[Display name]** with **李嘉和** in the hero. Keep the Chinese characters intact in every presentation mode.
- Use a centered content area around 1,080 px wide, with a two-column arrangement only where it improves reading. Mobile uses one column.
- Base spacing on an 8 px rhythm. Aim for approximately 16 px body copy, comfortable line height, and 44 px touch targets.
- Give the CD player and bookshelf a tactile appearance without making the whole portfolio skeuomorphic.

## Independent appearance controls

Provide a compact, clearly labeled control group near the top:

1. **Dynamic / ASCII** presentation switch.
2. **Light / Dark** appearance switch.
3. **Shuffle colors** button.
4. **Reset colors** action.
5. **Motion: System / On / Off**, which can live in a compact settings popover.

Dynamic mode is the initial mode. First visit follows the device's light/dark preference and uses a fixed default palette for that appearance. Never shuffle automatically. Follow device appearance changes until the visitor makes an explicit appearance choice.

Remember explicit mode, appearance, motion and palette choices locally. If storage is unavailable, the interface still works for the current visit. Maintain separate selected palettes for light and dark. Switching settings must not reload the page or reset scroll position.

Create semantic color variables for background, surface, primary text, muted text, borders, accent, on-accent, focus and effects. Establish four curated themes: **Paper** (default light neutral), **Ink** (default dark neutral), **Tide** (light blue/teal) and **Dusk** (dark violet). Define exact colors and check the real foreground/background pairs for WCAG AA contrast.

Shuffle should generate harmonious colors locally, validate contrast and apply only valid candidates. After a bounded number of failed attempts, use a curated theme suitable for the current light/dark appearance. It must work without an API. Reset restores Paper or Ink for the current appearance. Theme changes can use a brief transition, but respect motion-off/reduced-motion settings.

## Page structure and copy

Use a single scrolling page in this order. Provide simple section anchors for Experience, Projects, About and Contact. Personal widgets appear naturally within the page, not in a separate application shell.

### Introduction

- `[Display name]` and **李嘉和**.
- `[Short introduction — replace with actual bio]`.
- Optional portrait/video placeholder; make its missing-asset state intentional.
- Contact shortcuts: LinkedIn, GitHub, résumé and email.

### Experience

Show two clearly marked placeholder entries. Each has `[Role]`, `[Organization]`, `[Dates]` and concise placeholder achievement text. Do not invent employers or outcomes. Leave room for swim coaching once actual details are supplied.

### Projects

Show three editable placeholder cards with `[Project title]`, `[Summary]`, `[Technologies]`, optional visual and repository/live actions. Avoid fabricated URLs or claims. Missing actions should be omitted or visibly unavailable, never linked to unrelated pages.

### Beyond the screen

Include swimming, coaching and a fun fact. Safe starter copy:

> Swimming has been a big part of my life, and I've also worked as a swim coach.

Follow with clearly marked `[Swimming story]`, `[Coaching details]` and `[Fun fact]`. Do not invent teams, qualifications, dates, awards or race times.

### Listening — CD player

Build a compact CD player with disc artwork, title, artist, play/pause, previous/next, progress/seek and volume. The disc rotates only during actual playback when motion is allowed.

Use a configurable local track list. Start audio only after user action. If no playable audio is supplied, show **Audio coming soon** and disable transport controls. Do not simulate playback progress or claim a streaming connection.

Design loading, paused, playing, ended, unavailable and error states. Disable previous/next for a one-track list. Keep one audio instance so mode, palette and appearance changes preserve track, playback state and position.

### Bookshelf

Display five editable placeholder books as spines or covers. Every book opens a detail dialog with `[Title]`, `[Author]`, `[Reading status]` and optional `[Personal note]`. Use clearly labeled placeholders rather than invented reading history.

The dialog must support keyboard focus, Escape to close, a visible close button and focus return to the triggering book. Keep titles available if covers fail. On mobile, use wrapping rows or an accessible horizontally scrollable shelf with an obvious affordance.

### “hmu if u want to play”

Show recognizable logos/symbols for all of these interests:

| Interest | Label shown on hover, focus or tap |
| --- | --- |
| League of Legends | League of Legends |
| Valorant | Valorant |
| Roblox | Roblox |
| Rocket League | Rocket League |
| Minecraft | Minecraft |
| Geometry Dash | Geometry Dash |
| Clash Royale | Clash Royale |
| Brawl Stars | Brawl Stars |
| Poker | Poker |
| Chess | Chess |

Each symbol needs an accessible name. Keep tooltips readable and dismissible on touch. These are informational unless actual profile URLs are supplied. If a suitable logo is unavailable, use a clear temporary symbol and label rather than a misleading logo or fabricated link.

#### Gameplay highlight previews

Include a preview panel for short clips of my best moments in each game. Hovering a symbol after a brief intent delay selects that game's highlight; keyboard focus provides the same access, and tapping selects it on mobile. Keep the game name visible alongside the preview. Use a stable panel size on desktop and an inline panel on mobile so previews do not cover navigation or jump around. Include play/pause and a close action for touch previews.

In Dynamic mode, play the original clip. In ASCII mode, play an ASCII rendering of that same clip. Preserve the selected game and playback position when changing modes where feasible. The optional VideoToAscii renderer can support this; if full conversion is deferred, show a clearly labeled static ASCII placeholder and document the missing implementation.

Clips are muted, looping and lazy-loaded, with only one preview playing at a time. Stop them when dismissed, offscreen or in a hidden tab. Never interrupt music from the CD player. Reduced-motion/motion-off settings show a poster until explicitly played; blocked autoplay also exposes the play control.

Keep optional clip sources, poster images and short descriptions in editable per-game data. No actual clips have been supplied yet: use an honest placeholder preview, never fabricated highlights or fake playback. Games without clips still show their normal name tooltip. If runtime ASCII rendering fails, show a static ASCII poster or readable placeholder and offer explicit playback of the original; do not silently autoplay normal video in ASCII mode.

### Contact and footer

Repeat LinkedIn, GitHub, résumé and email. Use configured external URLs, a résumé asset and a mail link when supplied. Until then, show honest unavailable states. Do not create a contact form or invent addresses.

## Dynamic mode interaction

The resting page must look normal and remain stable. On pointer movement, nearby visuals dissolve briefly into pixels and reconstruct when the pointer moves away. Begin with a radius around 100 CSS pixels and reconstruction around 350 ms, then tune for clarity.

Clicking creates a ripple originating at the click location and travelling across the page over roughly 900 ms. Surfaces and decorative elements may respond with bounded spring motion, around 3 px maximum translation and only subtle rotation.

Keep real semantic text, links and hit areas stationary. Use a non-interactive decorative layer for the effects. Do not turn the whole page into a canvas, move targets away from the cursor, delay navigation or prevent text selection. Avoid dissolution on focused controls and actively selected text.

If full pixel dissolution cannot be implemented within Figma Make, create a modest pixel-overlay approximation and document it explicitly in the handoff notes. Do not present a normal hover animation as completed pixel dissolution.

On touchscreens, use tap ripples without hover dependence. Respect reduced motion by default; motion-off disables ripple movement, dissolution, spring movement, disc rotation and animated ASCII media. Use static focus/press feedback instead. Pause effects in hidden tabs and reduce rendering work offscreen. Limit particle density so basic interactions stay responsive.

## ASCII mode interaction and visuals

Transform the interface into an ASCII-inspired presentation using real monospace text, character borders, ASCII artwork and character-based ripple decoration. Adapt the CD player, bookshelf, portrait and symbols where they remain recognizable.

Do not rasterize the entire page into an image or canvas. Text must remain selectable, links functional and controls keyboard accessible. Use normal icons or images whenever ASCII conversion is ambiguous. Keep **李嘉和** as normal Unicode text with a suitable font fallback.

Simplify or replace detailed character artwork on small screens; do not shrink it into illegibility. Both modes must retain the same content, hierarchy, book dialogs and music functionality. Switching modes preserves scroll position, current track and playback position.

The optional [VideoToAscii](https://github.com/leojhli/VideoToAscii) renderer can later support media artwork. It is not necessary for an initial ASCII interface. Use a static ASCII placeholder if no media is supplied, and preserve a normal/static fallback for missing WebGL support. Check licensing before source reuse.

## Responsive behavior and accessibility

- Design desktop at 1440 px, tablet around 768 px and mobile around 390 px. Verify a 320 px width as well.
- Collapse into one column, wrap links and game symbols, and prevent accidental page-wide horizontal scrolling.
- Keep controls discoverable without a floating panel that covers content on mobile.
- Include semantic headings, visible keyboard focus, accessible names, touch alternatives to hover and a skip-to-content link.
- Keep text/background and component contrast at WCAG AA targets across every applied palette.
- Make all essential content usable without decorative rendering, audio or persistent storage.
- Avoid visual movement or layout shifts that make controls difficult to use.

## Implementation organization

Use reusable components and a shared content model rather than separate Dynamic and ASCII page trees. Suggested areas: introduction/contact, experience, projects, personal story, music player, bookshelf/details, game symbols and appearance controls.

Keep editable local mock data together for profile/contact, experience, projects, books and tracks. Mark placeholders visibly and clearly in data. Keep content access behind simple replaceable adapters for future CMS/API work, but do not build speculative endpoints or schemas now.

Separate preferences, audio playback and decorative effects. Lazy-load optional rendering code and media. Do not remount the player when settings change.

## Required output and acceptance

Deliver a working frontend with reusable components, editable mock content, semantic theme tokens and short setup/handoff notes. Include representative desktop/mobile views for both presentation modes, light and dark examples, and key component states. A static frame illustrates effects; the running prototype should demonstrate implemented interactions.

Confirm all of the following:

- Initial mode is Dynamic; device preference selects the fixed light/dark default; no automatic palette shuffle or audio.
- Every requested section and all ten gaming interests are present.
- 李嘉和 renders correctly in both modes.
- Settings work and preserve reading position and music state.
- Pointer effects do not intercept clicks, prevent selection or change layout.
- Keyboard and touch users can access the information shown on hover.
- Game highlight previews follow the selected game and Dynamic/ASCII mode, support keyboard/touch access, remain muted and respect motion preferences. Missing clips have honest placeholders and do not interrupt the music player.
- Book dialogs open, close and restore focus correctly.
- Missing media and destinations have honest unavailable states.
- No fake playback, fake profile links, invented biography or made-up achievements.
- Layouts remain usable at mobile, tablet and desktop sizes, including reduced-motion mode.
- Notes identify approximated effects, missing assets and any browser behavior still needing verification.

## References and verification limits

- [heyamit.dev](https://www.heyamit.dev/): reference for the user's described pixel dissolution behavior. It could not be inspected during planning. Use the written interaction requirements above if unavailable.
- [leojhli/portfolio](https://github.com/leojhli/portfolio): requested CD/music and bookshelf inspiration. It could not be inspected during planning. Treat it as inspiration, not a verified implementation specification.
- [VideoToAscii](https://github.com/leojhli/VideoToAscii): its README describes reusable React/TypeScript WebGL2 media conversion. It does not by itself convert a whole website interface.
- [Coolors](https://coolors.co/): palette exploration aid. The frontend must not require access to a Coolors API.

Use references for inspiration rather than copying another person's identity, content or entire layout. Backend services, final personal content, streaming integration, production graphics refinement and publication remain later work.
