import * as THREE from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"

/** A handcrafted, low-poly fan-art courtyard; no downloaded models or textures. */
export function createSpiritWorld(scene: THREE.Scene) {
  scene.background = new THREE.Color("#101631")
  scene.fog = new THREE.FogExp2("#202e51", 0.012)
  scene.add(new THREE.HemisphereLight(0xa9cbff, 0x53416d, 1.05))
  const moonlight = new THREE.DirectionalLight(0xffe1b5, 3.6)
  moonlight.position.set(-12, 25, 10)
  moonlight.castShadow = true
  moonlight.shadow.mapSize.set(1024, 1024)
  Object.assign(moonlight.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 })
  moonlight.shadow.bias = -0.001
  moonlight.shadow.normalBias = 0.06
  scene.add(moonlight)
  const rim = new THREE.DirectionalLight(0x72aaff, 2.2)
  rim.position.set(14, 12, -18)
  scene.add(rim)
  for (const [x, z] of [[-10, -2], [10, -3], [0, 14]]) {
    const lanternLight = new THREE.PointLight(0xffad54, 24, 15, 1.6)
    lanternLight.position.set(x, 3, z)
    scene.add(lanternLight)
  }
  const root = new THREE.Group()
  root.name = "Seireitei-inspired courtyard"
  scene.add(root)
  const mat = (color: string, emissive?: string) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.78,
      emissive: emissive ?? "#000000",
      emissiveIntensity: emissive ? 0.8 : 0,
    })
  const white = mat("#e8dfc6"),
    stone = mat("#566b96"),
    roofMat = mat("#137f89"),
    dark = mat("#07101a"),
    trim = mat("#e4b77b"),
    glow = mat("#fff1cc", "#ffd58c"),
    pink = mat("#f58fbf"),
    black = mat("#10121d")
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    parent: THREE.Object3D = root,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    m.position.set(x, y, z)
    parent.add(m)
    return m
  }
  const roof = (
    w: number,
    d: number,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = root,
  ) => {
    const shape = new THREE.Shape()
    shape.moveTo(-w / 2, -0.12)
    shape.quadraticCurveTo(-w * 0.22, -0.1, 0, w * 0.19)
    shape.quadraticCurveTo(w * 0.22, -0.1, w / 2, -0.12)
    shape.lineTo(w / 2, 0.08)
    shape.quadraticCurveTo(w * 0.23, 0.18, 0, w * 0.22)
    shape.quadraticCurveTo(-w * 0.23, 0.18, -w / 2, 0.08)
    shape.closePath()
    const m = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: d,
        bevelEnabled: false,
        curveSegments: 8,
      }),
      roofMat,
    )
    m.position.set(x, y, z - d / 2)
    parent.add(m)
    box(w, 0.13, 0.16, x, y, z + d / 2, trim, parent)
    for (let i = 0; i < 7; i++)
      box(
        0.045,
        0.045,
        d,
        x - w * 0.4 + (i * w * 0.8) / 6,
        y + 0.13,
        z,
        stone,
        parent,
      )
  }
  const hall = (x: number, z: number, w: number, d: number, name: string) => {
    const g = new THREE.Group()
    g.name = name
    root.add(g)
    box(w + 1, 0.45, d + 1, x, 0.25, z, stone, g)
    box(w, 3, d, x, 1.9, z, white, g)
    box(w - 0.5, 2, 0.08, x, 1.6, z + d / 2 + 0.05, dark, g)
    for (let i = 0; i < 5; i++)
      box(
        0.1,
        2.5,
        0.14,
        x - w * 0.4 + i * w * 0.2,
        1.8,
        z + d / 2 + 0.12,
        trim,
        g,
      )
    roof(w + 1.6, d + 1.1, x, 3.5, z, g)
    return g
  }
  box(33, 1.2, 33, 0, -0.65, 0, stone)
  box(31, 0.12, 31, 0, 0, 0, white)
  box(34, 0.7, 34, 0, -1.6, 0, dark)
  // A causeway across the void, with irregular floating stone below.
  box(5, 0.45, 18, 0, -0.15, 23, stone)
  for (let i = 0; i < 15; i++) {
    box(5, 0.06, 0.04, 0, 0.1, 15 + i * 1.15, dark)
    const shard = new THREE.Mesh(
      new THREE.ConeGeometry(1.3 + (i % 3) * 0.4, 4 + (i % 4), 4),
      dark,
    )
    shard.rotation.z = Math.PI
    shard.position.set(
      Math.sin(i * 2.4) * 13,
      -3 - (i % 3),
      Math.cos(i * 2.4) * 13,
    )
    root.add(shard)
  }
  for (let i = -7; i <= 7; i++) {
    box(0.025, 0.02, 30, i * 2, 0.09, 0, stone)
    box(30, 0.02, 0.025, 0, 0.09, i * 2, stone)
  }
  // Perimeter walls and the tall central roof line.
  box(0.5, 3.4, 30, -15, 1.7, 0, white)
  box(0.5, 3.4, 30, 15, 1.7, 0, white)
  box(30, 3.4, 0.5, 0, 1.7, -15, white)
  box(0.8, 0.25, 30, -15, 3.5, 0, roofMat)
  box(0.8, 0.25, 30, 15, 3.5, 0, roofMat)
  box(30, 0.25, 0.8, 0, 3.5, -15, roofMat)
  hall(-10, -2, 6, 6, "Training hall")
  hall(10, -3, 6, 7, "Archive")
  for (let tier = 0; tier < 4; tier++) {
    const w = 8 - tier * 1.4,
      y = 0.7 + tier * 2.5
    box(w, 2, w * 0.75, 0, y + 1, -8, white)
    roof(w + 1.8, w * 0.75 + 1.5, 0, y + 2, -8)
    for (const side of [-1, 1])
      box(0.16, 1.8, 0.18, side * (w / 2 - 0.2), y + 1, -8 + w * 0.375, trim)
    box(w * 0.55, 0.9, 0.05, 0, y + 1, -8 + w * 0.375 + 0.04, dark)
  }
  box(0.16, 3, 0.16, 0, 12, -8, trim)
  // Return gate: two slender pillars beneath an arched tile roof.
  for (const x of [-3.4, 3.4]) {
    box(0.65, 5, 0.65, x, 2.5, 14, white)
    box(1, 0.3, 1, x, 0.15, 14, stone)
  }
  box(8, 0.5, 0.65, 0, 4.7, 14, dark)
  roof(9, 2.4, 0, 5.2, 14)
  // Reflecting pool and stepping stones.
  box(7, 0.15, 7, 8, 0.12, 8, stone)
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 6.5),
    new THREE.MeshStandardMaterial({
      color: 0x2b7890,
      metalness: 0.7,
      roughness: 0.18,
      emissive: 0x0b293a,
      emissiveIntensity: 0.45,
    }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.set(8, 0.22, 8)
  root.add(water)
  for (let i = 0; i < 4; i++)
    box(1.3, 0.18, 0.6, 6 + i * 0.8, 0.28, 6 + i, white)
  // Cherry tree and a restrained ring of falling petals around Byakuya.
  const tree = new THREE.Group()
  tree.position.set(-8, 0, 8)
  root.add(tree)
  const trunk = box(0.4, 4, 0.45, 0, 2, 0, dark, tree)
  trunk.rotation.z = 0.1
  for (let i = 0; i < 7; i++) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), pink)
    crown.scale.set(1.2, 0.5, 1)
    crown.position.set(
      Math.sin(i * 2.2) * 1.6,
      3.8 + (i % 3) * 0.45,
      Math.cos(i * 2.2) * 1.4,
    )
    tree.add(crown)
  }
  // Distant roof silhouettes reinforce the impression of a city beyond the walls.
  for (let i = 0; i < 14; i++) {
    const x = (i - 6.5) * 4.2,
      z = -22 - (i % 3) * 5,
      h = 2 + ((i * 7) % 5)
    box(3, h, 4, x, h / 2, z, stone)
    roof(4, 5, x, h, z)
  }
  const characters: THREE.Group[] = []
  const character = (
    name: string,
    x: number,
    z: number,
    hairColor: string,
    captain = false,
    scale = 1,
  ) => {
    const g = new THREE.Group()
    g.name = name
    g.position.set(x, 0.15, z)
    g.scale.setScalar(scale)
    root.add(g)
    characters.push(g)
    const hair = mat(hairColor),
      skin = mat("#e0c3ab")
    const robe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.53, 1.25, 6),
      black,
    )
    robe.position.y = 0.85
    g.add(robe)
    box(0.58, 0.65, 0.35, 0, 1.55, 0, black, g)
    for (const side of [-1, 1]) {
      const arm = box(0.24, 0.8, 0.3, side * 0.37, 1.4, 0, black, g)
      arm.rotation.z = side * 0.18
      box(0.18, 0.12, 0.4, side * 0.2, 0.15, 0.12, dark, g)
      const collar = box(0.07, 0.43, 0.04, side * 0.1, 1.65, 0.2, white, g)
      collar.rotation.z = side * 0.45
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), skin)
    head.position.y = 2.07
    g.add(head)
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
      hair,
    )
    cap.position.y = 2.1
    g.add(cap)
    if (name === "Ichigo")
      for (let i = 0; i < 7; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 4), hair)
        spike.position.set(
          Math.sin(i * 1.7) * 0.19,
          2.3,
          Math.cos(i * 1.7) * 0.19,
        )
        spike.rotation.z = Math.sin(i) * 0.5
        g.add(spike)
      }
    if (name === "Rukia") box(0.45, 0.35, 0.28, 0, 1.96, -0.1, hair, g)
    if (captain) {
      box(0.8, 1.3, 0.14, 0, 1.15, -0.25, white, g)
      box(0.2, 0.55, 0.16, 0.15, 1.68, 0.24, white, g)
      box(0.12, 0.16, 0.16, 0, 2.28, 0.2, trim, g)
    }
    box(0.045, 1.8, 0.07, 0.6, 1.5, 0.15, dark, g)
    box(0.26, 0.055, 0.16, 0.6, 0.75, 0.15, trim, g)
    return g
  }
  character("Ichigo", -3.2, 6, "#d16b27", false, 1.25)
  character("Rukia", 7, 1, "#11131e", false, 1.05)
  character("Byakuya", -6, 9, "#131725", true, 1.25)
  const lanterns: THREE.Mesh[] = []
  for (const x of [-4.5, 4.5])
    for (const z of [-3, 3, 9]) {
      box(0.2, 1.5, 0.2, x, 0.75, z, dark)
      const light = box(0.55, 0.65, 0.55, x, 1.75, z, glow)
      lanterns.push(light)
      roof(0.8, 0.8, x, 2.12, z)
    }
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(3, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xd4e9fa, fog: false }),
  )
  moon.position.set(-14, 19, -24)
  scene.add(moon)
  const starPositions = new Float32Array(240 * 3)
  const petalPositions = new Float32Array(80 * 3)
  // Deterministic positions make screenshots and resource tests repeatable.
  for (let i = 0; i < 240; i++) {
    starPositions[i * 3] = Math.sin(i * 97.1) * 45
    starPositions[i * 3 + 1] = 8 + (i % 31)
    starPositions[i * 3 + 2] = Math.cos(i * 33.3) * 45
  }
  const particleGeometry = new THREE.BufferGeometry()
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(starPositions, 3),
  )
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0x9edbff,
      size: 0.06,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
  )
  scene.add(particles)
  const petalGeometry = new THREE.BufferGeometry()
  petalGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(petalPositions, 3),
  )
  const petals = new THREE.Points(
    petalGeometry,
    new THREE.PointsMaterial({
      color: 0xffb1d7,
      size: 0.1,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  )
  root.add(petals)
  // Batch static buildings by material; moving characters and water stay separate.
  root.updateMatrixWorld(true)
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const originals: THREE.Mesh[] = []
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object === water) return
    let parent: THREE.Object3D | null = object
    while (parent) {
      if (characters.includes(parent as THREE.Group)) return
      parent = parent.parent
    }
    if (Array.isArray(object.material)) return
    const geometry = object.geometry.index
      ? object.geometry.toNonIndexed()
      : object.geometry.clone()
    geometry.applyMatrix4(object.matrixWorld)
    const group = batches.get(object.material) ?? []
    group.push(geometry)
    batches.set(object.material, group)
    originals.push(object)
  })
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries)
    if (merged) root.add(new THREE.Mesh(merged, material))
    geometries.forEach((geometry) => geometry.dispose())
  }
  originals.forEach((mesh) => {
    mesh.removeFromParent()
    mesh.geometry.dispose()
  })
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  return {
    characters,
    update(time: number) {
      particles.rotation.y = time * 0.006
      for (let i = 0; i < 80; i++) {
        const a = i * 2.4 + time * 0.15,
          r = 1.5 + (i % 13) * 0.22
        petalPositions[i * 3] = -7 + Math.sin(a) * r
        petalPositions[i * 3 + 1] =
          0.5 + ((((i * 0.37 - time * 0.25) % 5) + 5) % 5)
        petalPositions[i * 3 + 2] = 8 + Math.cos(a) * r
      }
      petalGeometry.attributes.position.needsUpdate = true
      characters.forEach((g, i) => {
        g.rotation.y = Math.sin(time * 0.2 + i) * 0.045
      })
      water.position.y = 0.22 + Math.sin(time * 0.8) * 0.015
    },
  }
}

