import * as THREE from "three"
import type { SceneColors } from "../theme/palettes"
import type { Stage } from "./stage"

const L = 3.2,
  W = 1.7,
  RIM = 0.32,
  LANES = 4
const laneZ = (j: number) => -W / 2 + ((j + 0.5) * W) / LANES

/** Pick the swatch that reads most like water (closest hue to blue-cyan), falling back to the first vivid. */
function waterOf(c: SceneColors) {
  const hsl = { h: 0, s: 0, l: 0 }
  let best = c.vivid[0],
    score = Infinity
  for (const v of c.vivid) {
    new THREE.Color(v).getHSL(hsl)
    const dh = Math.min(Math.abs(hsl.h - 0.53), 1 - Math.abs(hsl.h - 0.53))
    const sc = dh + (hsl.s < 0.25 ? 0.4 : 0)
    if (sc < score) {
      score = sc
      best = v
    }
  }
  return best
}

/**
 * A low-poly 25m pool: wave-displaced water, lane ropes and backstroke flags in
 * palette colours, starting blocks, a freestyle swimmer doing lengths, and a
 * coach on deck. With motion off the clock stays at 0, which is a calm still.
 */
export function createPool(stage: Stage, colors: SceneColors) {
  const { scene, camera } = stage
  camera.fov = 30
  // Framed so both pool ends stay in view at the card's 4:3-ish aspect.
  camera.position.set(3.9, 3.05, 4.15)
  camera.lookAt(0, -0.2, 0)
  camera.updateProjectionMatrix()

  const std = (o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8, ...o })
  const M = {
    water: std({
      transparent: true,
      opacity: 0.86,
      roughness: 0.25,
      metalness: 0.1,
    }),
    floor: std(),
    wall: std(),
    deck: std(),
    dark: std(),
    light: std(),
    accent: std(),
    v2: std(),
    v3: std(),
    skin: std(),
    foam: std({ roughness: 1 }),
  }
  const swatchMats = colors.swatches.map(() => std())

  scene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 1.1)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xffffff, 1.7)
  sun.position.set(2, 4, 3)
  scene.add(sun)

  const box = (
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = scene,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }

  // Deck rim and basin.
  box(L + RIM * 2, 0.12, RIM, M.deck, 0, 0.02, W / 2 + RIM / 2)
  box(L + RIM * 2, 0.12, RIM, M.deck, 0, 0.02, -W / 2 - RIM / 2)
  box(RIM, 0.12, W, M.deck, L / 2 + RIM / 2, 0.02, 0)
  box(RIM, 0.12, W, M.deck, -L / 2 - RIM / 2, 0.02, 0)
  box(L, 0.02, W, M.floor, 0, -0.33, 0)
  box(L, 0.36, 0.02, M.wall, 0, -0.15, W / 2)
  box(L, 0.36, 0.02, M.wall, 0, -0.15, -W / 2)
  box(0.02, 0.36, W, M.wall, L / 2, -0.15, 0)
  box(0.02, 0.36, W, M.wall, -L / 2, -0.15, 0)
  for (let j = 0; j < LANES; j++) {
    box(L * 0.84, 0.006, 0.045, M.dark, 0, -0.318, laneZ(j))
    for (const s of [-1, 1])
      box(0.045, 0.006, 0.2, M.dark, s * L * 0.42, -0.318, laneZ(j))
    // Starting block.
    box(0.16, 0.12, 0.2, M.dark, -L / 2 - RIM * 0.45, 0.13, laneZ(j))
    const top = box(
      0.2,
      0.03,
      0.24,
      j % 2 ? M.accent : M.light,
      -L / 2 - RIM * 0.45,
      0.205,
      laneZ(j),
    )
    top.rotation.z = -0.14
  }

  // Water: non-indexed so flat shading gives faceted waves; normals come from the shader.
  const wg = new THREE.PlaneGeometry(L - 0.02, W - 0.02, 44, 22).toNonIndexed()
  wg.rotateX(-Math.PI / 2)
  const wp = wg.attributes.position as THREE.BufferAttribute
  const base = Float32Array.from(wp.array as Float32Array)
  const water = new THREE.Mesh(wg, M.water)
  water.position.y = -0.03
  scene.add(water)

  // Lane ropes.
  const floatGeo = new THREE.SphereGeometry(0.022, 8, 5)
  const ropes: THREE.Mesh[] = []
  for (let k = 1; k < LANES; k++) {
    const z = -W / 2 + (k * W) / LANES
    const n = 30
    for (let i = 0; i < n; i++) {
      const end = i < 4 || i >= n - 4
      const m = new THREE.Mesh(
        floatGeo,
        end ? M.accent : i % 2 ? M.light : M.v2,
      )
      m.position.set(-L / 2 + 0.05 + (i / (n - 1)) * (L - 0.1), 0, z)
      m.scale.x = 1.5
      scene.add(m)
      ropes.push(m)
    }
  }

  // Backstroke flags in all five swatches.
  const postGeo = new THREE.CylinderGeometry(0.008, 0.01, 0.5, 6)
  const flagGeo = new THREE.ConeGeometry(0.03, 0.07, 3)
  for (const sx of [-1, 1]) {
    const x = sx * (L / 2 - 0.34)
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, M.dark)
      post.position.set(x, 0.3, sz * (W / 2 + RIM * 0.55))
      scene.add(post)
    }
    const span = W + RIM * 1.1
    const n = 13
    for (let i = 0; i < n; i++) {
      const f = new THREE.Mesh(flagGeo, swatchMats[i % swatchMats.length])
      f.position.set(x, 0.5, -span / 2 + (i / (n - 1)) * span)
      f.rotation.x = Math.PI
      scene.add(f)
    }
    box(0.004, 0.004, span, M.dark, x, 0.54, 0)
  }

  // Swimmer (freestyle).
  const swimmer = new THREE.Group()
  const cap = (r: number, len: number, m: THREE.Material) =>
    new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), m)
  const body = cap(0.042, 0.2, M.dark)
  body.rotation.z = Math.PI / 2
  swimmer.add(body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), M.accent)
  head.position.set(0.17, 0.012, 0)
  swimmer.add(head)
  box(0.02, 0.014, 0.07, M.light, 0.208, 0.02, 0, swimmer)
  const arms = [0, 1].map((k) => {
    const pivot = new THREE.Group()
    pivot.position.set(0.1, 0.01, k ? 0.055 : -0.055)
    const a = cap(0.015, 0.12, M.skin)
    a.position.y = -0.08
    pivot.add(a)
    swimmer.add(pivot)
    return pivot
  })
  const legs = [0, 1].map((k) => {
    const pivot = new THREE.Group()
    pivot.position.set(-0.1, 0, k ? 0.025 : -0.025)
    const g = cap(0.017, 0.13, M.skin)
    g.rotation.z = Math.PI / 2
    g.position.x = -0.08
    pivot.add(g)
    swimmer.add(pivot)
    return pivot
  })
  const foamGeo = new THREE.IcosahedronGeometry(0.022, 0)
  const foam = [0, 1, 2, 3].map((k) => {
    const m = new THREE.Mesh(foamGeo, M.foam)
    m.position.set(-0.27 - k * 0.04, 0.02, (k % 2 ? 1 : -1) * 0.02)
    swimmer.add(m)
    return m
  })
  scene.add(swimmer)
  const lane = laneZ(1)

  // Coach on the far deck, facing the pool (and the camera).
  const coach = new THREE.Group()
  for (const s of [-1, 1]) {
    const leg = cap(0.02, 0.12, M.dark)
    leg.position.set(0, 0.1, s * 0.03)
    coach.add(leg)
  }
  const torso = cap(0.055, 0.1, M.v3)
  torso.position.y = 0.27
  coach.add(torso)
  const ch = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), M.skin)
  ch.position.y = 0.4
  coach.add(ch)
  const visor = box(0.06, 0.012, 0.11, M.accent, 0.03, 0.43, 0, coach)
  visor.rotation.z = -0.1
  const board = box(0.012, 0.09, 0.07, M.light, 0.06, 0.24, 0.07, coach)
  board.rotation.z = 0.2
  const waveArm = new THREE.Group()
  waveArm.position.set(0, 0.33, -0.065)
  const wa = cap(0.015, 0.11, M.skin)
  wa.position.y = 0.07
  waveArm.add(wa)
  coach.add(waveArm)
  coach.position.set(0.9, 0.08, -W / 2 - RIM / 2)
  coach.rotation.y = -Math.PI / 2 + 0.35
  scene.add(coach)

  let sx = 0
  const wave = (x: number, z: number, t: number) =>
    0.016 * Math.sin(x * 3.1 + t * 1.7) +
    0.011 * Math.sin(z * 5.2 - t * 1.25 + x * 1.3) +
    0.03 *
      Math.exp(-((x - sx) ** 2 * 14 + (z - lane) ** 2 * 60)) *
      Math.sin(t * 7 - x * 9)

  const setColors = (c: SceneColors) => {
    const w = waterOf(c)
    M.water.color.set(w)
    M.floor.color.set(w).lerp(new THREE.Color(c.light), 0.55)
    M.wall.color.set(w).lerp(new THREE.Color(c.light), 0.3)
    M.deck.color.set(c.light)
    M.dark.color.set(c.dark)
    M.light.color.set(c.light).lerp(new THREE.Color("#ffffff"), 0.2)
    M.accent.color.set(c.vivid[0])
    M.v2.color.set(c.vivid[1])
    M.v3.color.set(c.vivid[2])
    M.skin.color.set(c.light).lerp(new THREE.Color(c.vivid[2]), 0.35)
    M.foam.color.set("#ffffff")
    hemi.groundColor.set(c.dark)
    c.swatches.forEach((s, i) => swatchMats[i]?.color.set(s))
    stage.invalidate()
  }
  setColors(colors)

  stage.onFrame = (_dt, t) => {
    // Lengths: ~8s per length, a quick turn at each wall. Offset so the still frame is mid-pool.
    const s = (t * 0.12 + 0.3) % 2
    const fwd = s < 1
    const u = fwd ? s : s - 1
    const reach = L / 2 - 0.42
    sx = fwd ? -reach + u * reach * 2 : reach - u * reach * 2
    const turn = Math.min(1, Math.min(u, 1 - u) * 16)
    swimmer.position.set(sx, wave(sx, lane, t) - 0.01, lane)
    swimmer.rotation.y = fwd ? 0 : Math.PI
    swimmer.rotation.z = (1 - turn) * 0.5
    const stroke = t * 5
    swimmer.rotation.x = Math.sin(stroke) * 0.28
    arms[0].rotation.z = stroke
    arms[1].rotation.z = stroke + Math.PI
    legs[0].rotation.z = Math.sin(t * 14) * 0.3
    legs[1].rotation.z = -Math.sin(t * 14) * 0.3
    foam.forEach((f, k) =>
      f.scale.setScalar(0.6 + 0.5 * Math.abs(Math.sin(t * 9 + k))),
    )
    // Rest hangs down; every few seconds the coach raises the arm and waves.
    const raise = Math.max(0, Math.sin(t * 0.9))
    waveArm.rotation.x =
      -Math.PI + 0.15 + raise * (Math.PI - 0.45) + Math.sin(t * 9) * 0.2 * raise

    for (let i = 0; i < wp.count; i++) {
      const x = base[i * 3],
        z = base[i * 3 + 2]
      wp.setY(i, wave(x, z, t))
    }
    wp.needsUpdate = true
    for (const r of ropes)
      r.position.y = wave(r.position.x, r.position.z, t) - 0.02
  }

  return { setColors, dispose() {} }
}
