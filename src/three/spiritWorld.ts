import * as THREE from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import { createSpiritMaterials } from "./spiritMaterials"
import { addSpiritArchitecture } from "./spiritArchitecture"
import { createSpiritCharacters } from "./spiritCharacters"
import { createSpiritGardens } from "./spiritGardens"
import { createSpiritAtmosphere } from "./spiritAtmosphere"
export type WorldObstacle = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}
/** An original walkable spirit-city. Geometry, foliage and water are procedural. */
export function createSpiritWorld(scene: THREE.Scene) {
  const groundY = 0.12
  const spawn: [number, number, number] = [0, 1.82, 12.2]
  const walkBounds: WorldObstacle = { minX: -28, maxX: 28, minZ: -28, maxZ: 27 }
  const colliders: WorldObstacle[] = []
  const solid = (x: number, z: number, w: number, d: number) =>
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    })
  scene.background = new THREE.Color("#131c38")
  scene.fog = new THREE.FogExp2("#46516c", 0.0075)
  scene.add(new THREE.HemisphereLight(0xaec8f4, 0x49445e, 0.95))
  const moonlight = new THREE.DirectionalLight(0xd8e6ff, 2.4)
  moonlight.position.set(-16, 28, 14)
  moonlight.castShadow = true
  moonlight.shadow.mapSize.set(2048, 2048)
  Object.assign(moonlight.shadow.camera, {
    left: -34,
    right: 34,
    top: 34,
    bottom: -34,
    near: 1,
    far: 100,
  })
  moonlight.shadow.bias = -0.0004
  moonlight.shadow.normalBias = 0.045
  scene.add(moonlight)
  const rim = new THREE.DirectionalLight(0x739bdc, 1.3)
  rim.position.set(16, 12, -22)
  scene.add(rim)
  const lanternLights: THREE.PointLight[] = []
  for (const [x, z] of [
    [-10, 2],
    [10, 1],
    [0, 14],
    [-21, 9],
    [21, 9],
  ]) {
    const light = new THREE.PointLight(0xffb75e, 28, 14, 1.7)
    light.position.set(x, 2.5, z)
    scene.add(light)
    lanternLights.push(light)
  }
  const root = new THREE.Group()
  root.name = "Seireitei-inspired courtyard"
  scene.add(root)
  const surfaces = createSpiritMaterials()
  const {
    plaster: white,
    stone,
    roof: roofMat,
    roofEdge,
    dark,
    wood,
    metal: trim,
    glow,
    palePink,
    grass,
    black,
  } = surfaces
  const pavers = surfaces.pavers
  const gardens = createSpiritGardens(root, wood)
  const atmosphere = createSpiritAtmosphere(scene)
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
  const cylinder = (
    radius: number,
    height: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    parent: THREE.Object3D = root,
    sides = 8,
  ) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, sides),
      material,
    )
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
    detail = true,
  ) => {
    const profile = (px: number) => {
      const u = THREE.MathUtils.clamp(Math.abs(px) / (w / 2), 0, 1)
      return w * 0.2 * Math.pow(1 - u, 1.65) + 0.1 * Math.pow(u, 8)
    }
    const shape = new THREE.Shape()
    for (let j = 0; j <= 24; j++) {
      const px = -w / 2 + (w * j) / 24
      if (!j) shape.moveTo(px, profile(px))
      else shape.lineTo(px, profile(px))
    }
    for (let j = 24; j >= 0; j--) {
      const px = -w / 2 + (w * j) / 24
      shape.lineTo(px, profile(px) - 0.13)
    }
    shape.closePath()
    const m = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }),
      roofMat,
    )
    m.position.set(x, y, z - d / 2)
    parent.add(m)
    for (const side of [-1, 1]) {
      box(0.14, 0.2, d + 0.18, x + (side * w) / 2, y, z, dark, parent)
      box(0.11, 0.07, d + 0.22, x + (side * w) / 2, y + 0.12, z, trim, parent)
    }
    const ridge = cylinder(
      0.105,
      d + 0.32,
      x,
      y + w * 0.2 + 0.04,
      z,
      roofEdge,
      parent,
    )
    ridge.rotation.x = Math.PI / 2
    if (!detail) return
    // Individual raised tile channels follow the curved roof, not a flat decal.
    for (let zi = -d / 2; zi <= d / 2 + 0.01; zi += 0.42) {
      const points: THREE.Vector3[] = []
      for (let j = 0; j <= 16; j++) {
        const px = -w / 2 + (w * j) / 16
        points.push(new THREE.Vector3(px, profile(px) + 0.025, 0))
      }
      const rib = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points),
          16,
          0.035,
          3,
          false,
        ),
        roofEdge,
      )
      rib.position.set(x, y, z + zi)
      parent.add(rib)
    }
    for (const side of [-1, 1])
      for (let row = 1; row < 5; row++) {
        const px = (side * w * row) / 10
        box(0.035, 0.035, d, x + px, y + profile(px) + 0.03, z, dark, parent)
      }
    for (const end of [-1, 1]) {
      const finial = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.48, 6), trim)
      finial.position.set(x, y + w * 0.2 + 0.24, z + end * (d / 2 - 0.1))
      parent.add(finial)
    }
  }
  const shoji = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    parent: THREE.Object3D = root,
    side = false,
  ) => {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.rotation.y = side ? Math.PI / 2 : 0
    parent.add(g)
    box(w, h, 0.08, 0, 0, 0, glow, g)
    for (let i = 0; i <= 4; i++)
      box(0.045, h + 0.06, 0.1, -w / 2 + (w * i) / 4, 0, 0.05, wood, g)
    for (let i = 0; i <= 5; i++)
      box(w + 0.05, 0.045, 0.1, 0, -h / 2 + (h * i) / 5, 0.05, wood, g)
  }
  const hall = (
    x: number,
    z: number,
    w: number,
    d: number,
    name: string,
    detail = true,
  ) => {
    const g = new THREE.Group()
    g.name = name
    root.add(g)
    solid(x, z, w + 0.8, d + 0.8)
    box(w + 0.7, 0.3, d + 0.7, x, 0.22, z, stone, g)
    box(w, 3.3, d, x, 1.95, z, white, g)
    box(w + 0.8, 0.16, d + 0.8, x, 0.45, z, wood, g)
    for (const side of [-1, 1]) {
      box(w + 0.4, 0.18, 0.18, x, 1.01, z + (side * d) / 2, wood, g)
      box(w + 0.4, 0.2, 0.18, x, 3.35, z + (side * d) / 2, wood, g)
      box(0.18, 2.9, d + 0.2, x + (side * w) / 2, 1.95, z, wood, g)
      // Side panels remain visible when walking down the alley.
      shoji(x + side * (w / 2 + 0.02), 2.08, z, d * 0.45, 1.7, g, true)
      for (let post = 0; post <= 4; post++)
        box(
          0.16,
          3,
          0.22,
          x - w / 2 + (w * post) / 4,
          1.95,
          z + side * (d / 2 + 0.12),
          wood,
          g,
        )
    }
    for (const side of [-1, 1])
      shoji(x + side * w * 0.25, 2.05, z + d / 2 + 0.02, w * 0.36, 1.85, g)
    box(w * 0.34, 0.15, 0.6, x, 0.25, z + d / 2 + 0.46, stone, g)
    solid(x, z + d / 2 + 0.25, w * 0.36, 0.9)
    if (detail) {
      for (let i = 0; i < 12; i++)
        box(
          w * 0.96,
          0.018,
          0.18,
          x,
          0.55 + i * 0.035,
          z + d / 2 + 0.02,
          trim,
          g,
        )
      for (const side of [-1, 1]) {
        cylinder(
          0.13,
          3.35,
          x + side * (w / 2 + 0.3),
          2,
          z + d / 2 + 0.3,
          dark,
          g,
        )
        for (let bracket = 0; bracket < 3; bracket++)
          box(
            0.3 + bracket * 0.14,
            0.09,
            0.6,
            x + side * w * 0.42,
            3.14 + bracket * 0.12,
            z + d / 2 + 0.15,
            trim,
            g,
          )
      }
      // Timber lintel and hanging indigo cloth above the center doorway.
      box(w * 0.42, 0.09, 0.12, x, 2.86, z + d / 2 + 0.17, trim, g)
      for (let panel = -1; panel <= 1; panel++)
        box(
          w * 0.12,
          0.52,
          0.035,
          x + panel * w * 0.13,
          2.56,
          z + d / 2 + 0.2,
          roofMat,
          g,
        )
    }
    roof(w + 1.3, d + 1.25, x, 3.6, z, g, detail)
    return g
  }
  // A continuous paved district rather than a camera-only floating diorama.
  box(60, 1.2, 60, 0, -0.6, 0, stone)
  box(59, 0.12, 59, 0, 0, 0, dark)
  box(61, 0.45, 61, 0, -1.4, 0, black)
  const pave = (x: number, z: number, width: number, depth: number) => {
    for (let row = 0; row < depth; row++)
      for (let column = 0; column < width / 2; column++) {
        const px = x - width / 2 + column * 2 + 1
        const pz = z - depth / 2 + row + 0.5
        // Leave a real opening underneath the pond rather than paving over it.
        if (px >= 4 && px <= 12 && pz >= 4 && pz <= 12) continue
        box(
          1.94,
          0.07,
          0.94,
          px,
          0.085,
          pz,
          pavers[(row * 7 + column * 3 + Math.floor(x + 90)) % 3],
        )
      }
  }
  pave(0, 0, 30, 30)
  pave(-22, 0, 14, 56)
  pave(22, 0, 14, 56)
  pave(0, -22, 30, 14)
  pave(0, 21, 30, 12)
  const wall = (x: number, z: number, length: number, sideways = false) => {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.rotation.y = sideways ? Math.PI / 2 : 0
    root.add(g)
    solid(x, z, sideways ? 0.7 : length, sideways ? length : 0.7)
    box(length, 2.8, 0.5, 0, 1.5, 0, white, g)
    box(length + 0.1, 0.42, 0.64, 0, 0.3, 0, stone, g)
    box(length + 0.3, 0.16, 0.92, 0, 3.04, 0, roofMat, g)
    for (let column = -length / 2; column <= length / 2; column += 2) {
      box(0.17, 2.7, 0.58, column, 1.55, 0, wood, g)
      for (const side of [-1, 1]) {
        box(1.94, 0.24, 0.025, column + 0.92, 0.43, side * 0.33, pavers[1], g)
        box(1.94, 0.24, 0.025, column + 0.05, 0.16, side * 0.33, pavers[2], g)
      }
    }
    for (let i = -length / 2; i <= length / 2; i += 0.34) {
      const cap = cylinder(0.075, 0.96, i, 3.13, 0, roofEdge, g, 5)
      cap.rotation.x = Math.PI / 2
    }
  }
  // Side openings at z=5Ã¢â‚¬Â¦11 lead into the east and west streets.
  for (const side of [-1, 1]) {
    wall(side * 15, -5, 20, true)
    wall(side * 15, 13, 4, true)
    wall(side * 29, 0, 58, true)
    for (const z of [5, 11]) {
      box(0.7, 3.6, 0.7, side * 15, 1.8, z, wood)
      solid(side * 15, z, 0.7, 0.7)
    }
    const gate = new THREE.Group()
    gate.position.set(side * 15, 0, 8)
    gate.rotation.y = Math.PI / 2
    root.add(gate)
    roof(7.4, 2.2, 0, 3.7, 0, gate)
  }
  wall(0, -15, 30)
  wall(0, -29, 58)
  hall(-10, -2, 6, 6, "Training hall")
  hall(10, -3, 6, 7, "Archive")
  // The tower is visible down the main avenue from the arrival gate.
  solid(0, -8, 9, 7.5)
  box(9, 0.7, 7.5, 0, 0.4, -8, stone)
  for (let tier = 0; tier < 4; tier++) {
    const w = 8 - tier * 1.4,
      y = 0.7 + tier * 2.6,
      d = w * 0.75
    box(w, 2, d, 0, y + 1, -8, white)
    roof(w + 1.8, d + 1.5, 0, y + 2.1, -8)
    for (const side of [-1, 1]) {
      box(0.18, 1.95, d + 0.18, side * (w / 2 - 0.12), y + 1, -8, wood)
      shoji(side * w * 0.22, y + 1.1, -8 + d / 2 + 0.04, w * 0.28, 1.08)
      shoji(side * (w / 2 + 0.02), y + 1.1, -8, d * 0.55, 1.08, root, true)
    }
    box(w + 0.2, 0.14, 0.18, 0, y + 0.2, -8 + d / 2, trim)
    if (tier > 0) {
      box(w + 0.55, 0.1, d + 0.55, 0, y + 0.03, -8, dark)
      for (let i = 0; i <= 8; i++)
        box(
          0.045,
          0.6,
          0.06,
          -w / 2 + (w * i) / 8,
          y + 0.3,
          -8 + d / 2 + 0.2,
          trim,
        )
      box(w + 0.2, 0.07, 0.07, 0, y + 0.6, -8 + d / 2 + 0.2, trim)
    }
  }
  cylinder(0.08, 2, 0, 12.8, -8, trim)
  for (let i = 0; i < 4; i++) {
    const finial = new THREE.Mesh(
      new THREE.TorusGeometry(0.25 - i * 0.035, 0.04, 4, 12),
      trim,
    )
    finial.rotation.x = Math.PI / 2
    finial.position.set(0, 12.2 + i * 0.34, -8)
    root.add(finial)
  }
  for (const x of [-3.4, 3.4]) {
    box(0.65, 5, 0.65, x, 2.5, 14, white)
    box(1, 0.3, 1, x, 0.15, 14, stone)
    box(0.72, 0.18, 0.72, x, 1.2, 14, dark)
    solid(x, 14, 1, 1)
  }
  box(8, 0.5, 0.65, 0, 4.7, 14, wood)
  box(4, 0.45, 0.1, 0, 4.25, 14.4, roofMat)
  roof(9, 2.4, 0, 5.2, 14)
  // Complete neighboring buildings make the side streets worth exploring.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++)
      hall(
        side * 23.1,
        -20 + row * 9,
        7,
        5.8,
        `${side < 0 ? "West" : "East"} district ${row + 1}`,
        row === 2,
      )
    hall(
      side * 22.5,
      20.5,
      7.5,
      6,
      `${side < 0 ? "West" : "East"} tea house`,
      true,
    )
  }
  for (const x of [-9, 0, 9]) hall(x, -23, 6.8, 6, "Northern residence", false)
  // A deeper city silhouette and mountain belt sit beyond the navigable district.
  for (let i = 0; i < 28; i++) {
    const x = ((i % 14) - 6.5) * 6.5,
      z = -36 - Math.floor(i / 14) * 10,
      h = 3 + ((i * 7) % 5)
    box(4.8, h, 5.4, x, h / 2, z, i % 3 ? stone : white)
    roof(5.6, 6, x, h, z, root, false)
    for (let j = -1; j <= 1; j++)
      box(0.6, 0.8, 0.05, x + j * 1.1, h - 1, z + 2.72, glow)
  }
  for (let i = 0; i < 12; i++) {
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(9 + (i % 4), 12 + ((i * 7) % 13), 5),
      dark,
    )
    mountain.position.set(-65 + i * 12, 3, -65 - (i % 3) * 5)
    mountain.rotation.y = i * 2.1
    root.add(mountain)
  }
  // A recessed koi pond, with a stone rim and gently undulating water normals.
  solid(8, 8, 7.4, 7.4)
  box(8, 0.04, 8, 8, 0.065, 8, stone)
  for (const side of [-1, 1]) {
    box(7.6, 0.3, 0.3, 8, 0.25, 8 + side * 3.6, white)
    box(0.3, 0.3, 7, 8 + side * 3.6, 0.25, 8, white)
  }
  const waterGeometry = new THREE.PlaneGeometry(6.9, 6.9, 24, 24)
  const water = new THREE.Mesh(
    waterGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x399eae,
      metalness: 0.45,
      roughness: 0.22,
      transparent: true,
      opacity: 0.8,
      emissive: 0x123e53,
      emissiveIntensity: 0.35,
    }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.set(8, 0.22, 8)
  root.add(water)
  const koi: THREE.Group[] = []
  for (let i = 0; i < 4; i++) {
    const fish = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 5),
      i % 2 ? trim : palePink,
    )
    body.scale.set(0.65, 0.35, 2.5)
    fish.add(body)
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 3), white)
    tail.rotation.x = Math.PI / 2
    tail.position.z = -0.32
    fish.add(tail)
    root.add(fish)
    koi.push(fish)
  }
  const treeAt = (x: number, z: number, scale = 1, blossom = true) => {
    solid(x, z, scale * 1.05, scale * 1.05)
    gardens.treeAt(x, z, scale, blossom)
  }
  for (const [x, z, scale] of [
    [-8, 8, 1.1],
    [-23, 11, 0.9],
    [23, 11, 0.85],
    [-8, 21, 1],
    [9, 22, 0.95],
  ]) {
    box(5.2, 0.11, 4.6, x, 0.14, z, grass)
    for (let i = 0; i < 6; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.15, 0),
        stone,
      )
      rock.scale.y = 0.6
      rock.position.set(
        x + Math.sin(i * 2.4) * 2.1,
        0.35,
        z + Math.cos(i * 2.4) * 1.8,
      )
      root.add(rock)
      solid(rock.position.x, rock.position.z, 0.65, 0.65)
    }
    treeAt(x, z, scale)
  }
  for (const side of [-1, 1]) {
    treeAt(side * 13, -12, 0.8, false)
    // Low garden benches and stone lantern plinths.
    box(3.3, 0.2, 0.7, side * 9, 0.7, 13, wood)
    solid(side * 9, 13, 3.3, 0.7)
    for (const dx of [-1.2, 1.2])
      box(0.22, 0.5, 0.55, side * 9 + dx, 0.4, 13, stone)
  }
  const cast = createSpiritCharacters(root)
  const characters = cast.characters
  characters.forEach((character) =>
    solid(character.position.x, character.position.z, 0.75, 0.75),
  )
  for (const x of [-4.5, 4.5, -17, 17])
    for (const z of [-3, 3, 12]) {
      box(0.65, 0.2, 0.65, x, 0.2, z, stone)
      box(0.2, 1.5, 0.2, x, 0.9, z, dark)
      box(0.55, 0.65, 0.55, x, 1.85, z, glow)
      for (const dx of [-0.24, 0.24])
        for (const dz of [-0.24, 0.24])
          box(0.045, 0.7, 0.045, x + dx, 1.85, z + dz, wood)
      roof(0.8, 0.8, x, 2.22, z, root, false)
      solid(x, z, 0.7, 0.7)
    }
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(3, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xd4e9fa, fog: false }),
  )
  moon.position.set(-20, 25, -42)
  scene.add(moon)
  const starPositions = new Float32Array(240 * 3)
  const petalPositions = new Float32Array(80 * 3)
  // Deterministic positions make screenshots and resource tests repeatable.
  for (let i = 0; i < 240; i++) {
    starPositions[i * 3] = Math.sin(i * 97.1) * 65
    starPositions[i * 3 + 1] = 8 + (i % 31)
    starPositions[i * 3 + 2] = Math.cos(i * 33.3) * 65
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
  // Batch by material after composing architecture. Characters keep their named
  // root for raycasting and idle motion, but their individual parts are batched too.
  const architecture = addSpiritArchitecture(root, solid, {
    plaster: white,
    stone,
    roof: roofMat,
    wood,
    metal: trim,
    glow,
    dark,
  })
  const foliage = gardens.finish()
  root.updateMatrixWorld(true)
  const movingRoots = new Set<THREE.Object3D>([
    water,
    ...characters,
    ...koi,
    ...foliage,
    ...architecture.moving,
  ])
  const batch = (
    container: THREE.Object3D,
    exclusions?: Set<THREE.Object3D>,
  ) => {
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>()
    const originals: THREE.Mesh[] = []
    const inverse = container.matrixWorld.clone().invert()
    container.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      let ancestor: THREE.Object3D | null = object
      while (ancestor && ancestor !== container) {
        if (exclusions?.has(ancestor)) return
        ancestor = ancestor.parent
      }
      if (Array.isArray(object.material)) return
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone()
      geometry.applyMatrix4(
        new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld),
      )
      const group = batches.get(object.material) ?? []
      group.push(geometry)
      batches.set(object.material, group)
      originals.push(object)
    })
    for (const [material, geometries] of batches) {
      const merged = mergeGeometries(geometries)
      if (merged) {
        merged.computeBoundingSphere()
        const mesh = new THREE.Mesh(merged, material)
        mesh.name = `${container.name || "City"} / material batch`
        container.add(mesh)
      }
      geometries.forEach((geometry) => geometry.dispose())
    }
    originals.forEach((mesh) => {
      mesh.removeFromParent()
      mesh.geometry.dispose()
    })
  }
  batch(root, movingRoots)
  characters.forEach((character) => batch(character))
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  const ownedMaterials = new Set<THREE.Material>(
    Object.values(surfaces)
      .flat()
      .filter(
        (value): value is THREE.MeshStandardMaterial =>
          value instanceof THREE.Material,
      ),
  )
  let disposed = false
  return {
    characters,
    colliders,
    walkBounds,
    spawn,
    groundY,
    dispose() {
      if (disposed) return
      disposed = true
      const geometries = new Set<THREE.BufferGeometry>()
      const materials = new Set<THREE.Material>()
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (object instanceof THREE.InstancedMesh) object.dispose()
        if (mesh.geometry) geometries.add(mesh.geometry)
        if (mesh.material)
          (Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          ).forEach((material) => materials.add(material))
        if (
          object instanceof THREE.DirectionalLight ||
          object instanceof THREE.PointLight ||
          object instanceof THREE.SpotLight
        )
          (object as THREE.DirectionalLight).shadow.dispose()
      })
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => {
        if (!ownedMaterials.has(material)) material.dispose()
      })
      surfaces.dispose()
      gardens.texture.dispose()
      atmosphere.textures.forEach((texture) => texture.dispose())
      scene.clear()
    },
    update(time: number) {
      if (disposed || !Number.isFinite(time)) return
      architecture.update(time)
      gardens.update(time)
      atmosphere.update(time)
      cast.update(time)
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
      koi.forEach((fish, i) => {
        const angle = time * (0.14 + i * 0.025) + i * 1.7
        fish.position.set(
          8 + Math.cos(angle) * (1.5 + i * 0.3),
          0.17,
          8 + Math.sin(angle) * (1.3 + i * 0.25),
        )
        fish.rotation.y = -angle
      })
      const position = waterGeometry.attributes.position
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i),
          y = position.getY(i)
        position.setZ(
          i,
          Math.sin(x * 2.8 + time * 1.2) *
            Math.cos(y * 2.1 + time * 0.7) *
            0.017,
        )
      }
      position.needsUpdate = true
      waterGeometry.computeVertexNormals()
      lanternLights.forEach((light, i) => {
        light.intensity = 28 + Math.sin(time * 1.7 + i * 2) * 0.7
      })
    },
  }
}
