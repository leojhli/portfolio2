# 3D world reference study

Investigated 2026-10-26 using public page text, REA artifact inspection, and bounded static inspection of a previously downloaded public script. No browser automation, computer use, remote script execution, screenshot comparison, or live frame-rate measurement was performed.

## Reference selection and acquisition limits

The requested starting point was the [Awwwards 3D collection](https://www.awwwards.com/websites/3d/). Its direct fetch timed out. Indexed Awwwards listings identify [Bruno Simon Portfolio](https://www.awwwards.com/sites/bruno-simon-portfolio) and [Lusion v3](https://www.awwwards.com/sites/lusion-v3); the live sites are [Bruno Simon](https://bruno-simon.com/) and [Lusion](https://lusion.co/). A listing's historical award does not establish that today's live version is the version that won it.

Public text from the live Bruno Simon and Lusion sites was readable through the web tool. The sandbox could not resolve hosts for artifact downloads. Automatic approval review then declined to execute an escalated download because the account usage limit prevented review, explicitly without judging the action unsafe. No retry through another download mechanism was made. Consequently, **no new Bruno Simon or Lusion bundle was acquired or analyzed with REA**.

The existing Lando Norris public bundle from the earlier authorized investigation was available locally and was re-inspected with REA. It supplies useful material, instancing, and rendering-budget evidence, but is not represented as a replacement analysis of the two new sites.

## Bruno Simon: a navigable world with explicit affordances

**Observed in primary page text:** the portfolio documents movement, camera input, interaction, a map, quality settings, and an unstuck/respawn action. It identifies Three.js, Rapier, and Howler. The live page links the author's [folio-2025 repository](https://github.com/brunosimon/folio-2025).

**Observed in the author's repository documentation:** input and simulation precede camera updates; lighting and environmental effects follow; instanced object groups precede final rendering. The asset pipeline compresses model textures for GPU use and UI imagery to WebP. This is documentation evidence, not independent observation of the shipped program.

**Adaptation:** make exploring understandable immediately. Provide an explicit enter/look action, visible movement hints, Escape to release the pointer, touch controls, and a reliable return-to-spawn action. Keep navigation logic independent from decorative effects so that lowering visual cost does not change movement or collision behavior. Organize the scene around memorable destinations and usable streets.

## Lusion: interaction and atmosphere as a reference direction

**Observed in primary page text:** Lusion presents immersive brand worlds, interactive experiences, 3D work, motion, and game design. The site includes explicit sound controls. This supports selecting it as an art-direction reference. It does **not** establish its shader implementation, texture resolution, triangle counts, lighting setup, interaction latency, or frame rate.

**Adaptation:** give the Seireitei scene a clear visual hierarchy: foreground street detail, mid-distance architecture, a recognizable central landmark, and atmospheric distance. Make nearby lanterns, banners, gardens, and flowing water feel alive through small local animations. These are original design choices, not claims that Lusion uses those mechanisms.

## REA evidence: cached Lando Norris shipped artifact

- Original public source: [Lando Norris](https://landonorris.com/).
- Captured script: [lando-by-OFF+BRAND.js](https://assets.itsoffbrand.io/lando/dev-js/lando-by-OFF+BRAND.js).
- Local artifact: `.tmp-rea-reference/lando.js`, 1,457,237 bytes.
- SHA-256 verified by both REA `open_binary` and `Get-FileHash`: `85d4469e14d9e5aa19f716aa13f562fa7f250169eb63272dea140bdd21677e47`.
- REA inspection parent: `ev_7f08e13358964d697e692c71ba56e42f797b7cee9d73d58bfa919eeacb9b51cf`.
- REA summary evidence: `ev_abd69516007b0c283962742430a3274384eef80cf0a98bdc124ddd699f6d37e3`.
- Inventory evidence: `ev_be77e9a56847120a5656db261578576712a848401a7e251436d6387327a5dd00`.
- Inventory graph SHA-256: `9e1ac47f63a6242d5dd8ddf88becde3200e7227f38284e5c838c5770265d995f`.
- Current summary retained in ignored `.tmp-rea-world/cached-lando-rea-summary.json`; prior full inspection remains in `.tmp-rea-reference/artifact-evidence.json`.

REA established one verified JavaScript artifact and no inventory integrity contradictions. It explicitly does not establish execution or application semantics. The earlier AST attempt on this same digest failed because the native analysis worker requires Windows x64, while this host is Windows ARM64; that unchanged failure was not repeated. See [the original investigation](reference-motion.md).

The following are bounded direct readings of the identified script, not AST-derived claims. Locations are zero-based UTF-16 character offsets in PowerShell's decoded string, **not byte offsets**:

| Location | Observed application code | Original adaptation |
| --- | --- | --- |
| Around 1,196,793 | Resize configuration caps pixel ratio at 1.25 above 768px width and 2 on smaller widths. | Cap scene resolution rather than rendering at unrestricted device DPR. |
| 1,049,044 | Lens-flare geometry is instanced; transforms and a random attribute are supplied per instance. | Batch repeated architecture and decorative geometry. |
| 1,157,796 | Materials reference separate normal, roughness, metallic, and environment inputs. | Differentiate plaster, stone, timber, roof tile, water, and metal through material response. |
| 1,117,118 | One scene creates a composer with a bloom pass and its own render target. | Keep glow selective and budgeted; avoid washing every surface with bloom. |
| 1,151,997 and 1,164,066 | Scroll callbacks change scene `isRendering` flags near viewport boundaries. | Suspend the detached world when closed or the document is hidden. Flags alone do not prove the full runtime render path. |

## First-person implementation guidance

The official [Three.js PointerLockControls documentation](https://threejs.org/docs/pages/PointerLockControls.html) describes mouse capture, lock/unlock events, pitch limits, and horizontal movement relative to the camera. Pointer locking only supplies looking/movement helpers; collision, mobile controls, focus handling, and a safe spawn must be implemented separately.

For this portfolio, maintain an eye-height camera, finite walk bounds, a collision radius, and a small-step collision resolver. Normalize diagonal input. Stop movement on blur and release capture before interacting with overlay controls. Offer a touch movement pad and drag-to-look fallback. Keep Escape and the exit button predictable.

## Scene decisions and validation boundary

Use layered roofs, eaves, ridge caps, gates, timber brackets, lattice windows, stone foundations, paving, canals, lanterns, and vegetation to improve detail at walking distance. Reuse geometry and materials for repeated elements. Prefer one principal shadow-casting light, a cool ambient contribution, restrained emissive windows/lanterns, and distance fog. A warm/cool lighting contrast is an original art-direction choice, not a recovered reference setting.

Automated geometry, movement, collision, resize, lifecycle, and build checks can verify contracts without computer use. They cannot establish visual equivalence, real GPU smoothness, texture quality on devices, or the feel of walking. Those remain browser visual/runtime verification tasks and should not be reported as completed by this static study.
