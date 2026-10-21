import * as THREE from "three"
import type { SceneColors } from "../theme/palettes"
import type { Landmark } from "../content/data"
import type { Stage } from "./stage"

type LandmarkKind = Landmark

/* ---------- deterministic noise ---------- */
const hash = (x: number, y: number, z: number) => {
  let h =
    Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const sm = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function noise(x: number, y: number, z: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z)
  const u = sm(x - xi),
    v = sm(y - yi),
    w = sm(z - zi)
  const c = (i: number, j: number, k: number) => hash(xi + i, yi + j, zi + k)
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  )
}
const fbm = (p: THREE.Vector3) => {
  const x = p.x * 1.7 + 11.3,
    y = p.y * 1.7 + 4.1,
    z = p.z * 1.7 + 7.7
  return (
    noise(x, y, z) * 0.55 +
    noise(x * 2.1, y * 2.1, z * 2.1) * 0.3 +
    noise(x * 4.3, y * 4.3, z * 4.3) * 0.15
  )
}
const rng = (seed: number) => () => (
  (seed = (seed + 0x6d2b79f5) | 0), hash(seed, seed >>> 7, 3)
)

/* ---------- layout ---------- */
const SEA = 0.5
const SPOTS: Array<[number, number]> = [
  [0.3, 0.15],
  [-0.2, 2.25],
  [0.55, 4.1],
  [-0.5, 5.3],
  [0.05, 1.2],
  [0.75, 3.05],
]
const dirOf = (i: number) => {
  let lat: number, lon: number
  if (i < SPOTS.length) [lat, lon] = SPOTS[i]
  else {
    lat = Math.asin(1 - (2 * (i + 0.5)) / (i + 2))
    lon = i * 2.39996
  }
  return new THREE.Vector3(
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.cos(lon),
  )
}
const radiusOf = (h: number) => (h < SEA ? 1 : 1 + (h - SEA) * 0.42)

type Mats = Record<"accent" | "light" | "dark" | "v1" | "v2" | "v3" | "tree" | "cloud", THREE.MeshStandardMaterial> & {
  dish: THREE.MeshStandardMaterial
  glow: THREE.MeshBasicMaterial
  beam: THREE.MeshBasicMaterial
  marker: THREE.MeshBasicMaterial
  halo: THREE.MeshBasicMaterial
  orbit: THREE.MeshBasicMaterial
  stars: THREE.PointsMaterial
}

function add(
  g: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  g.add(m)
  return m
}

function build(kind: LandmarkKind, M: Mats) {
  const g = new THREE.Group()
  const C = THREE.CylinderGeometry
  if (kind === "lighthouse") {
    add(g, new C(0.075, 0.085, 0.03, 8), M.dark, 0, 0.015)
    add(g, new C(0.032, 0.048, 0.22, 10), M.light, 0, 0.14)
    add(g, new C(0.042, 0.046, 0.035, 10), M.accent, 0, 0.09)
    add(g, new C(0.036, 0.04, 0.035, 10), M.accent, 0, 0.18)
    add(g, new C(0.05, 0.05, 0.012, 10), M.dark, 0, 0.256)
    add(g, new C(0.026, 0.026, 0.04, 10), M.glow, 0, 0.282)
    add(g, new THREE.ConeGeometry(0.04, 0.05, 10), M.accent, 0, 0.327)
    const beam = new THREE.Group()
    beam.position.y = 0.282
    const cone = add(
      beam,
      new THREE.ConeGeometry(0.06, 0.5, 16, 1, true),
      M.beam,
      0.25,
    )
    cone.rotation.z = Math.PI / 2
    g.add(beam)
    g.userData.spin = beam
    g.userData.speed = 1.6
  } else if (kind === "observatory") {
    add(g, new C(0.09, 0.1, 0.025, 12), M.dark, 0, 0.0125)
    add(g, new C(0.066, 0.066, 0.075, 12), M.light, 0, 0.062)
    const head = new THREE.Group()
    head.position.y = 0.1
    add(
      head,
      new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      M.v3,
    )
    const slit = add(
      head,
      new THREE.BoxGeometry(0.024, 0.075, 0.02),
      M.dark,
      0,
      0.035,
      0.055,
    )
    slit.rotation.x = -0.65
    const scope = new THREE.Group()
    scope.position.y = 0.02
    scope.rotation.x = 0.85
    add(scope, new C(0.012, 0.017, 0.12, 8), M.accent, 0, 0.07)
    head.add(scope)
    g.add(head)
    g.userData.spin = head
    g.userData.speed = 0.35
  } else if (kind === "rocket") {
    add(g, new C(0.085, 0.095, 0.02, 10), M.dark, 0, 0.01)
    add(g, new THREE.BoxGeometry(0.016, 0.3, 0.016), M.dark, 0.065, 0.16)
    add(g, new THREE.BoxGeometry(0.04, 0.008, 0.008), M.dark, 0.045, 0.23)
    add(g, new C(0.028, 0.032, 0.17, 12), M.light, 0, 0.135)
    add(g, new C(0.0295, 0.0295, 0.02, 12), M.v3, 0, 0.19)
    add(g, new THREE.SphereGeometry(0.011, 8, 6), M.accent, 0, 0.165, 0.028)
    add(g, new THREE.ConeGeometry(0.028, 0.07, 12), M.accent, 0, 0.255)
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3
      const fin = add(
        g,
        new THREE.BoxGeometry(0.006, 0.055, 0.035),
        M.accent,
        Math.sin(a) * 0.036,
        0.075,
        Math.cos(a) * 0.036,
      )
      fin.rotation.y = a
    }
    const flame = add(
      g,
      new THREE.ConeGeometry(0.018, 0.05, 8),
      M.glow,
      0,
      0.03,
    )
    flame.rotation.x = Math.PI
    g.userData.flame = flame
  } else if (kind === "windmill") {
    add(g, new C(0.055, 0.065, 0.02, 6), M.dark, 0, 0.01)
    add(g, new C(0.024, 0.046, 0.19, 6), M.light, 0, 0.115)
    add(g, new THREE.BoxGeometry(0.018, 0.032, 0.01), M.dark, 0, 0.04, 0.04)
    add(g, new THREE.ConeGeometry(0.037, 0.05, 6), M.accent, 0, 0.235)
    const hub = new THREE.Group()
    hub.position.set(0, 0.2, 0.04)
    add(hub, new THREE.SphereGeometry(0.012, 8, 6), M.dark)
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group()
      arm.rotation.z = (k * Math.PI) / 2
      add(
        arm,
        new THREE.BoxGeometry(0.02, 0.11, 0.004),
        k % 2 ? M.v3 : M.v1,
        0,
        0.062,
      )
      hub.add(arm)
    }
    g.add(hub)
    g.userData.blades = hub
  } else {
    add(g, new THREE.BoxGeometry(0.1, 0.03, 0.1), M.dark, 0, 0.015)
    add(g, new C(0.01, 0.014, 0.1, 6), M.dark, 0, 0.08)
    const head = new THREE.Group()
    head.position.y = 0.13
    const dish = add(
      head,
      new THREE.SphereGeometry(0.075, 14, 6, 0, Math.PI * 2, 0, 1.0),
      M.dish,
      0,
      0.055,
      0,
    )
    dish.rotation.x = Math.PI - 0.9
    const arm = add(head, new C(0.003, 0.003, 0.075, 4), M.dark, 0, 0.04, 0.03)
    arm.rotation.x = -0.9
    add(head, new THREE.SphereGeometry(0.011, 8, 6), M.accent, 0, 0.065, 0.06)
    g.add(head)
    g.userData.spin = head
    g.userData.speed = 0.5
  }
  return g
}

export type PlanetApi = {
  setColors(c: SceneColors): void
  select(i: number, focus: boolean): void
  /** Emphasise a landmark without moving (e.g. while its list item is hovered). */
  highlight(i: number): void
  setLabels(els: Array<HTMLElement | null>): void
  dispose(): void
}

/**
 * Low-poly planet: displaced icosphere coloured by height band, one landmark per
 * project (sitting on a guaranteed plateau), trees, clouds, a moon, and stars.
 * Drag to spin (with inertia); hover/click landmarks via raycasting.
 */
export function createPlanet(
  stage: Stage,
  host: HTMLElement,
  kinds: LandmarkKind[],
  colors: SceneColors,
  cb: {
    onHover(i: number): void
    onSelect(i: number): void
  },
): PlanetApi {
  const { scene, camera } = stage
  // Far enough back that the moon's orbit (r = 1.5) stays inside the frame.
  camera.position.set(0, 0.35, 5.9)
  camera.lookAt(0, 0, 0)

  const std = (o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({
      flatShading: true,
      roughness: 0.85,
      metalness: 0,
      ...o,
    })
  const M: Mats = {
    accent: std(),
    light: std(),
    dark: std(),
    v1: std(),
    v2: std(),
    v3: std(),
    tree: std(),
    cloud: std({ roughness: 1 }),
    dish: std({ side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial(),
    beam: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    marker: new THREE.MeshBasicMaterial(),
    halo: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
      depthWrite: false,
    }),
    orbit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3 }),
    stars: new THREE.PointsMaterial({
      size: 0.035,
      transparent: true,
      opacity: 0.7,
    }),
  }

  scene.add(new THREE.AmbientLight(0xffffff, 0.35))
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1.2)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xffffff, 1.9)
  sun.position.set(-3, 2.5, 4)
  scene.add(sun)

  const world = new THREE.Group()
  world.rotation.x = 0.18
  scene.add(world)

  const dirs = kinds.map((_, i) => dirOf(i))
  const height = (p: THREE.Vector3) => {
    let h = fbm(p)
    for (const d of dirs) {
      const k = Math.exp(-(1 - p.dot(d)) * 45)
      h = h * (1 - k) + 0.62 * k
    }
    return h
  }

  /* planet */
  const geo = new THREE.IcosahedronGeometry(1, 6)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const p = new THREE.Vector3()
  const hs = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).normalize()
    hs[i] = height(p)
    p.multiplyScalar(radiusOf(hs[i]))
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  const faces = pos.count / 3
  const band = new Uint8Array(faces)
  for (let f = 0; f < faces; f++) {
    const h = (hs[f * 3] + hs[f * 3 + 1] + hs[f * 3 + 2]) / 3
    band[f] =
      h < SEA - 0.07
        ? 0
        : h < SEA
          ? 1
          : h < SEA + 0.035
            ? 2
            : h < SEA + 0.17
              ? 3
              : h < SEA + 0.25
                ? 4
                : 5
  }
  const col = new Float32Array(pos.count * 3)
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3))
  geo.computeVertexNormals()
  const planet = new THREE.Mesh(
    geo,
    std({ vertexColors: true, roughness: 0.9 }),
  )
  world.add(planet)

  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.16, 40, 20), M.halo)
  scene.add(halo)

  /* landmarks */
  const Y = new THREE.Vector3(0, 1, 0)
  const landmarks = kinds.map((k, i) => {
    const g = build(k, M)
    const d = dirs[i]
    g.position.copy(d).multiplyScalar(radiusOf(height(d)) - 0.01)
    g.quaternion.setFromUnitVectors(Y, d)
    g.userData.index = i
    world.add(g)
    return g
  })

  /* trees */
  const r = rng(7)
  const trunkGeo = new THREE.CylinderGeometry(0.006, 0.008, 0.03, 5)
  const crownGeo = new THREE.ConeGeometry(0.024, 0.065, 6)
  let placed = 0
  for (let tries = 0; tries < 900 && placed < 46; tries++) {
    const d = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1)
    if (d.lengthSq() < 0.01) continue
    d.normalize()
    const h = height(d)
    if (h < SEA + 0.04 || h > SEA + 0.2 || dirs.some((x) => x.dot(d) > 0.975))
      continue
    const t = new THREE.Group()
    add(t, trunkGeo, M.dark, 0, 0.015)
    add(t, crownGeo, M.tree, 0, 0.058)
    t.position.copy(d).multiplyScalar(radiusOf(h) - 0.005)
    t.quaternion.setFromUnitVectors(Y, d)
    t.scale.setScalar(0.8 + r() * 0.6)
    world.add(t)
    placed++
  }

  /* clouds */
  const clouds = new THREE.Group()
  world.add(clouds)
  const puff = new THREE.IcosahedronGeometry(1, 0)
  for (let c = 0; c < 7; c++) {
    const d = new THREE.Vector3(
      r() * 2 - 1,
      (r() * 2 - 1) * 0.6,
      r() * 2 - 1,
    ).normalize()
    const cl = new THREE.Group()
    for (let k = 0; k < 3; k++) {
      const s = 0.045 + r() * 0.035
      const m = add(cl, puff, M.cloud, (k - 1) * 0.06, r() * 0.02, r() * 0.03)
      m.scale.setScalar(s)
    }
    cl.position.copy(d).multiplyScalar(1.3)
    cl.quaternion.setFromUnitVectors(Y, d)
    clouds.add(cl)
  }

  /* moon + orbit */
  const orbit = new THREE.Group()
  orbit.rotation.set(0.42, 0, -0.22)
  scene.add(orbit)
  const ring = add(orbit, new THREE.TorusGeometry(1.5, 0.0035, 4, 160), M.orbit)
  ring.rotation.x = Math.PI / 2
  const moon = add(orbit, new THREE.IcosahedronGeometry(0.11, 1), M.v3, 1.5)

  /* stars */
  const starGeo = new THREE.BufferGeometry()
  const sp = new Float32Array(240 * 3)
  for (let i = 0; i < 240; i++) {
    const d = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1)
      .normalize()
      .multiplyScalar(7 + r() * 4)
    if (d.z > 2) d.z = -d.z
    sp.set([d.x, d.y, d.z], i * 3)
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3))
  scene.add(new THREE.Points(starGeo, M.stars))

  /* selection marker */
  const marker = new THREE.Group()
  const pulse = add(
    marker,
    new THREE.TorusGeometry(0.12, 0.009, 6, 40),
    M.marker,
  )
  pulse.rotation.x = Math.PI / 2
  const pin = add(
    marker,
    new THREE.OctahedronGeometry(0.035, 0),
    M.marker,
    0,
    0.45,
  )
  pin.scale.y = 1.6
  world.add(marker)

  /* colours */
  const setColors = (c: SceneColors) => {
    const [a, b, d] = c.vivid
    M.accent.color.set(a)
    M.v1.color.set(a)
    M.v2.color.set(b)
    M.v3.color.set(d)
    M.light.color.set(c.light)
    M.dish.color.set(c.light)
    M.dark.color.set(c.dark)
    M.tree.color.set(b).lerp(new THREE.Color(c.dark), 0.35)
    M.cloud.color.set(c.light).lerp(new THREE.Color("#ffffff"), 0.5)
    M.glow.color.set(d).lerp(new THREE.Color("#ffffff"), 0.35)
    M.beam.color.set(d).lerp(new THREE.Color("#ffffff"), 0.5)
    M.marker.color.set(c.fg)
    M.halo.color.set(a)
    M.orbit.color.set(c.fg)
    M.stars.color.set(c.fg)
    hemi.groundColor.set(c.dark)
    const water = new THREE.Color(a)
    const deep = water.clone().lerp(new THREE.Color(c.dark), 0.3)
    const land = new THREE.Color(b)
    const shore = new THREE.Color(c.light).lerp(land, 0.35)
    const high = new THREE.Color(d)
    const peak = new THREE.Color(c.light)
    const tones = [deep, water, shore, land, high, peak]
    for (let f = 0; f < faces; f++) {
      const t = tones[band[f]]
      for (let k = 0; k < 3; k++) col.set([t.r, t.g, t.b], (f * 3 + k) * 3)
    }
    geo.attributes.color.needsUpdate = true
    stage.invalidate()
  }
  setColors(colors)

  /* interaction */
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  let hovered = -1,
    selected = -1,
    hint = -1
  let pressed = false,
    dragging = false,
    px = 0,
    py = 0,
    sx = 0,
    sy = 0
  let vx = 0,
    vy = 0,
    lastInteract = -1e9,
    focusing = false
  const target = new THREE.Quaternion()
  const qa = new THREE.Quaternion(),
    qb = new THREE.Quaternion()
  const X = new THREE.Vector3(1, 0, 0)

  const pick = (e: PointerEvent) => {
    const rect = host.getBoundingClientRect()
    ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObjects([planet, ...landmarks], true)[0]
    let o: THREE.Object3D | null = hit?.object ?? null
    while (o && o.userData.index === undefined) o = o.parent
    return o ? o.userData.index as number : -1
  }
  const setHover = (i: number) => {
    if (i === hovered) return
    hovered = i
    host.style.cursor = i >= 0 ? "pointer" : ""
    cb.onHover(i)
    stage.invalidate()
  }
  const rotate = (dx: number, dy: number) => {
    world.quaternion
      .premultiply(qa.setFromAxisAngle(Y, dx))
      .premultiply(qb.setFromAxisAngle(X, dy))
    stage.invalidate()
  }
  const now = () => performance.now()
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    pressed = true
    dragging = false
    px = sx = e.clientX
    py = sy = e.clientY
    vx = vy = 0
  }
  const onMove = (e: PointerEvent) => {
    if (!pressed) return setHover(pick(e))
    const dx = e.clientX - px,
      dy = e.clientY - py
    px = e.clientX
    py = e.clientY
    if (!dragging && Math.hypot(e.clientX - sx, e.clientY - sy) > 5) {
      dragging = true
      focusing = false
      host.setPointerCapture?.(e.pointerId)
    }
    if (!dragging) return
    // Touch only rotates horizontally so vertical swipes still scroll the page.
    const k = 0.0075
    const ry = e.pointerType === "touch" ? 0 : dy * k
    rotate(dx * k, ry)
    vx = dx * k
    vy = ry
    lastInteract = now()
  }
  const onUp = (e: PointerEvent) => {
    if (!pressed) return
    pressed = false
    if (!dragging) {
      const i = pick(e)
      if (i >= 0) cb.onSelect(i)
    }
    dragging = false
    lastInteract = now()
  }
  const onCancel = () => {
    pressed = false
    dragging = false
  }
  const onLeave = () => {
    if (!pressed) setHover(-1)
  }
  host.addEventListener("pointerdown", onDown)
  host.addEventListener("pointermove", onMove)
  host.addEventListener("pointerup", onUp)
  host.addEventListener("pointercancel", onCancel)
  host.addEventListener("pointerleave", onLeave)

  let labels: Array<HTMLElement | null> = []
  const tmp = new THREE.Vector3(),
    nrm = new THREE.Vector3(),
    camDir = new THREE.Vector3()

  stage.onFrame = (dt, t) => {
    const motion = stage.opts.motion
    const ease = (rate: number) => (motion ? 1 - Math.exp(-dt * rate) : 1)
    if (focusing) {
      world.quaternion.slerp(target, ease(4.5))
      if (world.quaternion.angleTo(target) < 0.002) focusing = false
      else stage.invalidate()
    } else if (motion && !pressed) {
      if (Math.abs(vx) + Math.abs(vy) > 1e-5) {
        rotate(vx, vy)
        const f = Math.exp(-dt * 3.5)
        vx *= f
        vy *= f
      } else if (now() - lastInteract > 4000 && hovered < 0) rotate(dt * 0.1, 0)
    }
    if (motion) {
      clouds.rotation.y = t * 0.03
      orbit.rotation.y = t * 0.12
      moon.rotation.y = t * 0.4
      for (const g of landmarks) {
        const u = g.userData
        if (u.spin) u.spin.rotation.y = t * u.speed
        if (u.blades) u.blades.rotation.z = t * 2.2
        if (u.flame)
          u.flame.scale.y =
            0.8 + Math.sin(t * 22) * 0.25 + Math.sin(t * 9) * 0.1
      }
    }
    landmarks.forEach((g, i) => {
      const s = i === hovered || i === hint ? 1.32 : i === selected ? 1.16 : 1
      g.scale.setScalar(lerp(g.scale.x, s, ease(14)))
      if (Math.abs(g.scale.x - s) > 0.002) stage.invalidate()
    })
    if (selected >= 0) {
      const g = landmarks[selected]
      marker.visible = true
      marker.position.copy(g.position)
      marker.quaternion.copy(g.quaternion)
      pin.position.y = 0.45 + (motion ? Math.sin(t * 3) * 0.025 : 0)
      pin.rotation.y = t * 1.5
      pulse.scale.setScalar(motion ? 1 + ((t * 0.8) % 1) * 0.5 : 1.2)
    } else marker.visible = false

    // Project DOM labels; hide the ones on the far side.
    if (!labels.length || !stage.w) return
    camDir.copy(camera.position).normalize()
    world.updateMatrixWorld()
    landmarks.forEach((g, i) => {
      const el = labels[i]
      if (!el) return
      nrm.copy(dirs[i]).applyQuaternion(world.quaternion)
      const facing = nrm.dot(camDir)
      tmp.set(0, 0.4, 0)
      g.localToWorld(tmp).project(camera)
      const x = ((tmp.x + 1) / 2) * stage.w,
        y = ((1 - tmp.y) / 2) * stage.h
      const o = Math.max(0, Math.min(1, (facing - 0.1) / 0.2))
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`
      el.style.opacity = String(o)
      el.style.visibility = o < 0.05 ? "hidden" : "visible"
      el.style.zIndex = String(Math.round(facing * 100) + 100)
    })
  }

  return {
    setColors,
    select(i, focus) {
      selected = i
      stage.invalidate()
      if (!focus || i < 0) return
      const d = dirs[i]
      const lat = Math.asin(d.y),
        lon = Math.atan2(d.x, d.z)
      target
        .setFromAxisAngle(X, lat - 0.32)
        .multiply(qa.setFromAxisAngle(Y, -lon))
      focusing = true
      vx = vy = 0
      lastInteract = now()
    },
    highlight(i) {
      hint = i
      stage.invalidate()
    },
    setLabels(els) {
      labels = els
      stage.invalidate()
    },
    dispose() {
      host.removeEventListener("pointerdown", onDown)
      host.removeEventListener("pointermove", onMove)
      host.removeEventListener("pointerup", onUp)
      host.removeEventListener("pointercancel", onCancel)
      host.removeEventListener("pointerleave", onLeave)
    },
  }
}
