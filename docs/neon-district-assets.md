# Night district — model provenance and integration

Verified **2026-10-28**. Four models are bundled in `public/models/neon-district/` (15,394,084 bytes total; approximately 14.68 MiB). All are **Creative Commons Attribution 4.0**, permitting redistribution and modification with attribution.

The live credit page is `/models/neon-district/credits.html`. The adjacent `manifest.json` records the authors, exact Sketchfab UIDs, source URLs, authorized public dataset download URLs, file sizes, SHA-256 hashes, bounds, and placement suggestions.

## Acquisition and license verification

Sketchfab's official download API returned HTTP 401 without account credentials. No login, cookies, browser data, viewer resources, or private download endpoints were accessed. The files instead came from the **Allen Institute for AI's public Objaverse dataset**, using its `object-paths.json.gz` mapping from the exact Sketchfab UID to the GLB.

For every model, the current public `https://api.sketchfab.com/v3/models/{uid}` metadata reports `CC Attribution`, with `https://creativecommons.org/licenses/by/4.0/`. Each downloaded GLB independently embeds the same author, Sketchfab source UID, title, and CC-BY-4.0 license in `asset.extras`. This checks both the source license and the redistributed file's identity.

The GLBs remain byte-for-byte as downloaded. Geometry, textures, source transforms, and fan animation are preserved. Scene integration adds scale, placement, lighting, and any runtime material changes. No paid or noncommercial-only models are included.

## Curated models

| File | Source / author | Use | Geometry | File size |
| --- | --- | --- | ---: | ---: |
| `asia-building.glb` | [Asia Building](https://sketchfab.com/3d-models/asia-building-a3f45195b01f48ff9f687d3ceac52b82) — [Solarliu](https://sketchfab.com/jacky15621419) | Taiwanese apartment/shop block; balconies, air conditioners, awnings, roof equipment, weathered concrete | 14,336 triangles; 53 meshes | 3,029,860 bytes |
| `industrial-ac.glb` | [Industrial Air Conditioner](https://sketchfab.com/3d-models/industrial-air-conditioner-82797367c2b94fb1981e556577a3c898) — [HusarL](https://sketchfab.com/HusarL) | Service alley equipment, animated fans | 1,500 triangles; 2 skinned meshes | 4,541,916 bytes |
| `chinese-lantern.glb` | [Old Chinese Lantern](https://sketchfab.com/3d-models/old-chinese-lantern-lowpoly-for-free-download-73b1e60901e6494fb0cb39affca6f850) — [Scritta](https://sketchfab.com/scritta) | One restrained, warm paper light at the tea room | 976 triangles; 1 mesh | 1,058,168 bytes |
| `courier-scooter.glb` | [Cyberpunk Scooter](https://sketchfab.com/3d-models/cyberpunk-scooter-1381b799cab24733b0871d40c106232c) — [Berk Gedik](https://sketchfab.com/berkgedik) | Courier scene detail with battery, cabling, lights, suspension, and worn deck | 65,414 triangles; 1 mesh | 6,764,140 bytes |

The original 2025 building pack and Hong Kong street candidates were not in this public dataset. They were not acquired or used. This shortlist provides a Chinese architectural anchor and detailed everyday objects while leaving the district's composition, signs, routes, and atmosphere original.

## Bounds, scale, and rendering notes

Bounds were measured using Three.js `GLTFLoader` and `Box3.setFromObject`, with all original root transforms applied. Coordinates below are **X / Y / Z**; all four are **Y up**. The authors do not formally encode a front direction. Final yaw needs scene inspection; no guessed facade orientation is recorded as verified.

| Model | Minimum | Size | Suggested scale / placement |
| --- | --- | --- | --- |
| Asia Building | `-81.347 / -0.000008 / -79.430` | `168.829 / 175.074 / 159.634` | Uniform scale ≈ `0.10` gives a 17.5 m high, 16.9 m wide six-storey block. Center X/Z before positioning. Squeezing width to 8 m also reduces the height to 8.3 m; do not accidentally treat this as a narrow facade. |
| Industrial AC | `-0.423 / -0.239 / -0.192` | `0.847 / 0.455 / 0.339` | Scale ≈ `1.80` gives a 1.53 m wide, 0.82 m high two-fan condenser. Ground or wall placement needs the source Y offset accounted for. |
| Chinese Lantern | `-36.333 / 4.326 / -35.918` | `72.289 / 130.424 / 73.404` | Scale ≈ `0.00728` gives 0.95 m overall height. Use a single lantern as an accent. |
| Courier Scooter | `-0.446 / -0.919 / -1.000` | `0.892 / 1.838 / 2.000` | Scale ≈ `0.653` gives 1.2 m overall height and 1.31 m length. Its long axis is Z. Center and lift by the scaled minimum Y so the wheels touch the ground. |

- The building has **five 1024² color atlases**, but 53 material entries in the source. Many differ only in name and can be deduplicated at runtime; preserve mesh transforms before any merge.
- The air conditioner's **4.958-second** animation is `Armature|ArmatureAction`. It uses a skeleton. Clone it with `SkeletonUtils.clone`, then create an `AnimationMixer` if independent animation is needed. A plain recursive `Object3D.clone` does not safely clone skeleton binding.
- The scooter has four 1024² maps including normal and emissive detail. Limit it to a few focal placements; it contains most of the imported triangle count.
- The lantern uses alpha and `KHR_materials_transmission`. Its thin paper may be more predictable and cheaper as a tuned translucent/emissive material in this scene. Credit that as a runtime material adjustment; keep the source GLB unchanged.
- All images are embedded PNG/JPEG at 1024² or smaller. No WebP extension, external texture fetch, Draco decoder, or Meshopt decoder is required.
- Asset loading should be lazy with the optional world; keep the main portfolio's initial load independent of these models. Dispose cloned materials and mixers on teardown while managing shared source geometry/textures deliberately.

## Verification performed

- Checked exact Sketchfab source IDs and current CC-BY-4.0 license metadata.
- Checked matching embedded source/author/license information in every GLB.
- Parsed each GLB with Three.js; inspected node, mesh, material, animation, and texture inventory.
- Measured transformed bounds and indexed triangle counts; checked 1024² texture dimensions and generated file hashes.
- Inspected the original publicly available model thumbnails for visual fit.

These are source/model checks, **not browser visual verification** of the final assembled district. Confirm final orientation, ground contact, shadowing, transparent materials, and fan animation in the integrated renderer.
