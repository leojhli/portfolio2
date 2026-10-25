# Reference motion investigation

Investigated 2026-10-24 using REA 6.7.0 and inert public asset inspection. No browser, computer use, target JavaScript execution, or live frame-pacing observation was performed.

## Target and evidence

- Reference: https://landonorris.com/
- Shipped bundle: https://assets.itsoffbrand.io/lando/dev-js/lando-by-OFF+BRAND.js
- Bundle SHA-256: `85d4469e14d9e5aa19f716aa13f562fa7f250169eb63272dea140bdd21677e47` (1,457,237 bytes).
- REA `inspect-artifact` completed through its portable safe artifact provider: `ev_37f2d30b94cfa398d53f75af4a9e5d8d2904a4eb403361391b93c4cf6f88b411`. Nested inventory evidence: `ev_be77e9a56847120a5656db261578576712a848401a7e251436d6387327a5dd00`.
- REA `analyze-javascript-application` produced partial inventory evidence `ev_b4da8455f51d70edceb2f697b9da04c3c8dad75062a80db79f055347ad0d74a3`, but its isolated syntax-analysis worker refused Windows ARM64: `REA Windows native controls require a Windows x64 host.` Both available Node runtimes were ARM64. No unsupported worker bypass or unrelated runtime installation was attempted.
- Raw bundle and complete local CLI records are retained in ignored `.tmp-rea-reference/`. They are investigation artifacts, not shipped website dependencies.

The behavior findings below come from direct inspection of the identified bundle bytes. REA establishes artifact identity and inventory; it did not successfully reconstruct the AST or observe execution. Minified identifiers and line numbers are local to this exact digest.

## Background: organic contour bands

**Observed in source:** `pX` (line 5268) constructs a full-screen noise render target. It samples three-dimensional simplex noise, using a slower noise sample to warp both spatial coordinates before another sample. It multiplies the resulting scalar by a detail value, takes the fractional portion, and thresholds that value into alternating bands.

`yX` (line 4855) renders the page background from this field. In outline mode it compares each binary band value with four neighboring samples and colors the boundaries. This produces a flowing contour/topographic field rather than a tiled Damascus image. The authored defaults are scale 1, speed 0.1, distortion scale 1, distortion intensity 0.5, detail 3, and outline enabled. The foreground/background colors are interpolated between section-defined color pairs during scrolling.

**Portfolio adaptation:** an original, restrained contour implementation with theme-derived colors, slow movement, a static fallback, and an ASCII character representation. Preserve this visual mechanism without importing the reference's renderer, branded assets, helmet model, or shaders wholesale. Real device performance and final visual equivalence remain unverified by this static investigation.

## Mixed scroll and image depth

**Observed in source:** `qp` (line 5643) measures horizontal track width and maps section progress to a negative translation equal to track width minus viewport width. GSAP ScrollTrigger drives a linear track tween with scrub 1, invalidated on resize. Each photograph receives a smaller local translation spanning approximately four rem as its card crosses the viewport. Initialization is gated at a desktop width of 992 pixels.

`Gp` (line 5643) adds line reveals: clipped text opens while an accent-colored cover contracts. The source uses 0.6-second reveal/cover durations and 0.15-second line staggering. This is distinct from blurring or replacing the whole page.

**Portfolio adaptation:** native vertical document flow, measured sticky horizontal chapters, a single scroll coordinator, modest local image parallax, and transform/opacity-based reveals. Stack chapters on small screens or with Motion Off. Avoid transferring the reference's wheel/scroll smoothing dependencies.

## Signature writing

**Observed in source:** `vb` (line 91) loads the `signature` Rive artboard from `signature.riv`. The `signature_scroll` state machine receives a numeric `scroll` input from 0 to 1000 via `oM`; its ScrollTrigger configuration uses scrub 0.5 and pauses at the ends. The separate `signature_play` state machine is started once when its trigger reaches roughly the lower 80% of the viewport, via `BB`.

**Unknown:** the Rive file's internal pen path order and exact stroke geometry were not decoded. The script establishes two playback modes, not the underlying hand-drawn artwork.

**Portfolio adaptation:** trace the user's own signature and reveal its original ink using stroke masks. Hero progress controls the writing; Contact triggers one timed replay. Completed static ink is the reduced-motion fallback. Do not substitute a rectangular wipe or an unrelated handwriting font.

## Verification boundary

Background mechanism, scrolling mapping, and signature control wiring are established by public source inspection. REA's AST analysis is explicitly incomplete on this host. No claim is made about runtime execution, frame rate, hardware compatibility, or a visual screenshot comparison. Those limits do not prevent an original implementation of the identified behavior.
