import * as THREE from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"

type ArchitectureMaterials = {
  plaster: THREE.Material
  stone: THREE.Material
  roof: THREE.Material
  wood: THREE.Material
  metal: THREE.Material
  glow: THREE.Material
  dark: THREE.Material
}

/** Original spirit-city architecture; no third-party meshes or bitmap assets. */
export function addSpiritArchitecture(
  root: THREE.Group,
  solid: (x: number, z: number, w: number, d: number) => void,
  materials: ArchitectureMaterials,
) {
  const { plaster, stone, roof, wood, metal, glow, dark } = materials
  const detail = new THREE.Group()
  detail.name = "Spirit city / architectural details"
  root.add(detail)
  const moving: THREE.Object3D[] = []
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = detail,
  ) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    parent: THREE.Object3D = detail,
  ) => add(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent)
  const cylinder = (
    top: number,
    bottom: number,
    h: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    sides = 16,
    parent: THREE.Object3D = detail,
  ) =>
    add(
      new THREE.CylinderGeometry(top, bottom, h, sides),
      material,
      x,
      y,
      z,
      parent,
    )
  const beam = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    radius: number,
    material: THREE.Material,
    parent: THREE.Object3D = detail,
  ) => {
    const mesh = cylinder(
      radius,
      radius,
      a.distanceTo(b),
      0,
      0,
      0,
      material,
      8,
      parent,
    )
    mesh.position.copy(a).add(b).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    )
    return mesh
  }
  const ring = (
    radius: number,
    thickness: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    parent: THREE.Object3D = detail,
    segments = 32,
  ) => {
    const mesh = add(
      new THREE.TorusGeometry(radius, thickness, 5, segments),
      material,
      x,
      y,
      z,
      parent,
    )
    mesh.rotation.x = Math.PI / 2
    return mesh
  }

  // A tall, white prison/fortress silhouette and a massive enclosing city wall
  // give the otherwise intimate neighborhood the scale of a spirit capital.
  const tower = new THREE.Group()
  tower.name = "Distant white fortress"
  tower.position.set(21, 0, -49)
  detail.add(tower)
  cylinder(7.6, 9, 3.4, 0, 1.4, 0, stone, 48, tower)
  cylinder(5.6, 7, 29, 0, 17, 0, plaster, 64, tower)
  for (let level = 0; level < 8; level++) {
    const y = 4 + level * 3.6,
      radius = 7 - ((y - 2.5) / 29) * 1.4
    ring(radius + 0.05, 0.1, 0, y, 0, stone, tower, 64)
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8 + (level % 2) * 0.09
      const slit = box(
        0.16,
        1.12,
        0.04,
        Math.sin(angle) * (radius + 0.04),
        y + 1.35,
        Math.cos(angle) * (radius + 0.04),
        dark,
        tower,
      )
      slit.rotation.y = angle
      if (i % 4 === 0 && level % 2 === 0) {
        const seam = box(
          0.045,
          2.9,
          0.06,
          Math.sin(angle + 0.18) * radius,
          y + 1.4,
          Math.cos(angle + 0.18) * radius,
          stone,
          tower,
        )
        seam.rotation.y = angle + 0.18
      }
    }
  }
  cylinder(6.2, 6.2, 0.45, 0, 31.6, 0, stone, 64, tower)
  cylinder(5.4, 5.4, 1.8, 0, 32.4, 0, plaster, 64, tower)
  ring(5.5, 0.16, 0, 33.35, 0, metal, tower, 64)
  cylinder(5.8, 6.4, 0.45, 0, 33.55, 0, roof, 64, tower)
  cylinder(3.6, 4.2, 4.6, 0, 35.9, 0, plaster, 48, tower)
  cylinder(4.25, 4.25, 0.25, 0, 38.3, 0, dark, 48, tower)
  cylinder(4.5, 4.5, 0.18, 0, 38.52, 0, metal, 48, tower)
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI) / 12
    const merlon = box(
      0.48,
      0.8,
      0.48,
      Math.sin(angle) * 5.85,
      32.15,
      Math.cos(angle) * 5.85,
      plaster,
      tower,
    )
    merlon.rotation.y = angle
  }
  // A narrow enclosed bridge ends at the base of the fortress.
  box(3, 1.3, 17, 21, 7.7, -36, plaster)
  box(3.5, 0.25, 17.5, 21, 8.5, -36, roof)
  for (let i = 0; i < 7; i++) box(3.2, 0.2, 0.18, 21, 7, -29 + i * 2.2, stone)
  for (let segment = 0; segment < 20; segment++) {
    const angle = (Math.PI * segment) / 19
    const x = Math.cos(angle) * 53,
      z = -41 - Math.sin(angle) * 26
    const wall = box(9.3, 8, 2.5, x, 4, z, plaster)
    wall.rotation.y = Math.atan2(26 * Math.cos(angle), -53 * Math.sin(angle))
    const cap = box(9.7, 0.4, 3, x, 8.15, z, roof)
    cap.rotation.y = wall.rotation.y
    const foot = box(9.5, 1.5, 3.1, x, 0.7, z, stone)
    foot.rotation.y = wall.rotation.y
    for (const side of [-1, 1]) {
      const px = x + Math.cos(wall.rotation.y) * side * 3.8
      const pz = z - Math.sin(wall.rotation.y) * side * 3.8
      box(0.65, 8.6, 0.65, px, 4.25, pz, stone)
    }
  }

  // A weathered elevated landmark rather than another repeated house silhouette.
  const cliff = new THREE.Group()
  cliff.name = "High spirit platform"
  cliff.position.set(-29, 0, -50)
  detail.add(cliff)
  for (let layer = 0; layer < 5; layer++) {
    const geometry = new THREE.CylinderGeometry(
      7.8 - layer * 0.38,
      8.5 - layer * 0.38,
      4.8,
      13,
      2,
    )
    const p = geometry.attributes.position
    for (let i = 0; i < p.count; i++) {
      const angle = Math.atan2(p.getZ(i), p.getX(i))
      const n =
        1 +
        Math.sin(angle * 5 + layer * 1.8) * 0.055 +
        Math.cos(angle * 9) * 0.035
      p.setX(i, p.getX(i) * n)
      p.setZ(i, p.getZ(i) * n)
    }
    geometry.computeVertexNormals()
    add(geometry, layer % 2 ? dark : stone, 0, layer * 4.1 + 1.5, 0, cliff)
  }
  cylinder(6.4, 6.7, 0.7, 0, 20.45, 0, stone, 13, cliff)
  box(9.4, 0.25, 7, 0, 20.9, 0, wood, cliff)
  for (let i = 0; i < 25; i++)
    box(0.025, 0.012, 7, -4.6 + i * 0.38, 21.04, 0, dark, cliff)
  for (const x of [-2.8, 2.8]) {
    cylinder(0.24, 0.3, 8.5, x, 25.1, 0, dark, 12, cliff)
    cylinder(0.28, 0.28, 0.25, x, 23.8, 0, metal, 12, cliff)
    cylinder(0.28, 0.28, 0.25, x, 28.7, 0, metal, 12, cliff)
  }
  beam(
    new THREE.Vector3(-4.4, 28.5, 0),
    new THREE.Vector3(4.4, 28.5, 0),
    0.22,
    wood,
    cliff,
  )
  beam(
    new THREE.Vector3(-3.2, 29.55, 0),
    new THREE.Vector3(3.2, 29.55, 0),
    0.13,
    metal,
    cliff,
  )
  for (let i = 0; i < 16; i++) {
    const y = 3 + i * 0.95
    const angle = 0.3 + i * 0.12
    const step = box(
      2.3,
      0.25,
      0.65,
      Math.sin(angle) * 8.05,
      y,
      Math.cos(angle) * 8.05,
      stone,
      cliff,
    )
    step.rotation.y = angle
  }

  // Close-range details: drainage channels, iron grilles and inset paving emblems.
  for (const x of [-5.75, 5.75]) {
    box(0.34, 0.018, 25, x, 0.127, -1, dark)
    for (let z = -13; z <= 11; z += 0.48) {
      box(0.36, 0.035, 0.055, x, 0.147, z, metal)
    }
    for (const side of [-1, 1])
      box(0.045, 0.04, 25.1, x + side * 0.2, 0.145, -1, stone)
  }
  ring(1.7, 0.025, 0, 0.143, 5.1, stone, detail, 64)
  ring(1.55, 0.014, 0, 0.144, 5.1, metal, detail, 64)
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    const spoke = box(
      0.025,
      0.018,
      0.42,
      Math.sin(a) * 1.2,
      0.146,
      5.1 + Math.cos(a) * 1.2,
      metal,
    )
    spoke.rotation.y = a
  }
  // Hinges, collars and layered brackets enrich the already existing arrival gate.
  for (const x of [-3.4, 3.4]) {
    for (const y of [0.62, 1.3, 3.9]) box(0.73, 0.15, 0.73, x, y, 14, metal)
    for (let y = 0.6; y < 4; y += 0.6) {
      add(new THREE.SphereGeometry(0.055, 6, 4), metal, x - 0.22, y, 14.36)
      add(new THREE.SphereGeometry(0.055, 6, 4), metal, x + 0.22, y, 14.36)
    }
    for (let i = 0; i < 4; i++)
      box(0.35 + i * 0.2, 0.12, 0.85, x, 4.18 + i * 0.13, 14, wood)
    const handle = ring(0.19, 0.035, x, 2, 14.4, metal)
    handle.rotation.x = 0
  }
  const ropePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.35, 4.15, 14.5),
    new THREE.Vector3(-1.8, 3.8, 14.55),
    new THREE.Vector3(0, 3.68, 14.55),
    new THREE.Vector3(1.8, 3.8, 14.55),
    new THREE.Vector3(3.35, 4.15, 14.5),
  ])
  add(new THREE.TubeGeometry(ropePath, 36, 0.065, 6, false), wood, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    const x = -2.4 + i * 0.8,
      y = 3.69 + Math.abs(x) * 0.095
    const paper = new THREE.Shape()
    paper.moveTo(-0.12, 0)
    paper.lineTo(0.13, 0)
    paper.lineTo(0.13, -0.18)
    paper.lineTo(0.3, -0.18)
    paper.lineTo(0.3, -0.34)
    paper.lineTo(0.12, -0.34)
    paper.lineTo(0.12, -0.5)
    paper.lineTo(-0.06, -0.5)
    paper.lineTo(-0.06, -0.31)
    paper.lineTo(0.1, -0.31)
    paper.lineTo(0.1, -0.16)
    paper.lineTo(-0.12, -0.16)
    paper.closePath()
    add(
      new THREE.ExtrudeGeometry(paper, { depth: 0.012, bevelEnabled: false }),
      plaster,
      x,
      y,
      14.59,
    )
  }

  const stoneLantern = (x: number, z: number) => {
    box(0.95, 0.18, 0.95, x, 0.21, z, stone)
    cylinder(0.22, 0.32, 0.85, x, 0.72, z, stone, 8)
    cylinder(0.53, 0.35, 0.18, x, 1.22, z, stone, 8)
    box(0.65, 0.56, 0.65, x, 1.57, z, glow)
    for (const dx of [-0.3, 0.3])
      for (const dz of [-0.3, 0.3])
        box(0.1, 0.68, 0.1, x + dx, 1.59, z + dz, stone)
    cylinder(0.11, 0.77, 0.36, x, 2.05, z, roof, 8)
    cylinder(0.14, 0.22, 0.15, x, 2.32, z, stone, 8)
    add(new THREE.SphereGeometry(0.12, 8, 5), stone, x, 2.48, z)
    solid(x, z, 1, 1)
  }
  stoneLantern(-12.2, 11.8)
  stoneLantern(12.8, 12.7)
  stoneLantern(-12.8, -10)
  stoneLantern(12.8, -10)

  // Bamboo spout and a small stone ritual basin near the garden, outside the path.
  const basinX = -11.2,
    basinZ = 8.7
  cylinder(0.52, 0.62, 0.55, basinX, 0.4, basinZ, stone, 12)
  cylinder(0.4, 0.4, 0.035, basinX, 0.69, basinZ, dark, 16)
  ring(0.46, 0.09, basinX, 0.68, basinZ, stone, detail, 16)
  beam(
    new THREE.Vector3(basinX - 0.55, 0.2, basinZ - 0.15),
    new THREE.Vector3(basinX - 0.55, 1.65, basinZ - 0.15),
    0.09,
    wood,
  )
  beam(
    new THREE.Vector3(basinX - 0.7, 1.5, basinZ - 0.15),
    new THREE.Vector3(basinX + 0.12, 1.22, basinZ - 0.15),
    0.085,
    wood,
  )
  for (let i = 0; i < 5; i++)
    cylinder(
      0.095,
      0.095,
      0.045,
      basinX - 0.55,
      0.38 + i * 0.24,
      basinZ - 0.15,
      metal,
      8,
    )
  solid(basinX, basinZ, 1.25, 1.25)
  for (const side of [-1, 1]) {
    // Small timber training racks sit against the fronts of the side halls.
    const x = side * 12.1,
      z = side < 0 ? 1.9 : 1.4
    for (const dx of [-0.6, 0.6]) {
      box(0.12, 1.4, 0.12, x + dx, 0.85, z, wood)
      box(0.3, 0.12, 0.65, x + dx, 0.2, z, dark)
    }
    for (const y of [0.7, 1.4]) box(1.5, 0.12, 0.12, x, y, z, wood)
    for (let i = 0; i < 4; i++) {
      const staff = cylinder(
        0.032,
        0.032,
        1.85,
        x - 0.43 + i * 0.28,
        1.15,
        z + 0.08,
        dark,
        8,
      )
      staff.rotation.z = -0.05 + i * 0.03
      box(0.18, 0.04, 0.09, x - 0.43 + i * 0.28, 1.65, z + 0.08, metal)
    }
    solid(x, z, 1.5, 0.72)
  }

  // Cloth carries original geometric crests and numerals; it is not an extracted insignia.
  const cloth = new THREE.MeshStandardMaterial({
    color: "#ece5cf",
    roughness: 0.98,
    side: THREE.DoubleSide,
  })
  const ink = new THREE.MeshStandardMaterial({
    color: "#182b4c",
    roughness: 0.94,
    side: THREE.DoubleSide,
  })
  const bannerData: Array<{
    mesh: THREE.Mesh
    base: Float32Array
    phase: number
  }> = []
  const digitSegments: Record<string, string> = {
    "0": "abcedf",
    "1": "bc",
    "3": "abcdg",
    "6": "acdefg",
  }
  const segments: Record<string, [number, number, number, number]> = {
    a: [0, 0.23, 0.2, 0.035],
    b: [0.1, 0.12, 0.035, 0.2],
    c: [0.1, -0.12, 0.035, 0.2],
    d: [0, -0.23, 0.2, 0.035],
    e: [-0.1, -0.12, 0.035, 0.2],
    f: [-0.1, 0.12, 0.035, 0.2],
    g: [0, 0, 0.2, 0.035],
  }
  const banner = (
    x: number,
    z: number,
    number: string,
    angle: number,
    phase: number,
  ) => {
    const g = new THREE.Group()
    g.name = `Division banner ${number}`
    g.position.set(x, 3.7, z)
    g.rotation.y = angle
    detail.add(g)
    moving.push(g)
    const sheet = new THREE.PlaneGeometry(0.84, 1.9, 10, 22)
    sheet.translate(0, -0.95, 0)
    add(sheet, cloth, 0, 0, 0, g)
    const crest = new THREE.Shape()
    crest.moveTo(0, -0.25)
    crest.lineTo(0.23, -0.49)
    crest.lineTo(0, -0.73)
    crest.lineTo(-0.23, -0.49)
    crest.closePath()
    const hole = new THREE.Path()
    hole.moveTo(0, -0.32)
    hole.lineTo(-0.16, -0.49)
    hole.lineTo(0, -0.66)
    hole.lineTo(0.16, -0.49)
    hole.closePath()
    crest.holes.push(hole)
    add(new THREE.ShapeGeometry(crest), ink, 0, 0, 0.008, g)
    for (const edge of [-1, 1])
      add(
        new THREE.PlaneGeometry(0.025, 1.9, 1, 22),
        ink,
        edge * 0.38,
        -0.95,
        0.008,
        g,
      )
    number.split("").forEach((digit, index) => {
      for (const segment of digitSegments[digit] ?? "") {
        const [sx, sy, w, h] = segments[segment]
        add(
          new THREE.PlaneGeometry(w, h, 1, 3),
          ink,
          sx + (index - 0.5) * 0.31,
          sy - 1.2,
          0.008,
          g,
        )
      }
    })
    // Merge the ink on each cloth locally so four banners cost only eight draws.
    g.updateMatrixWorld(true)
    for (const material of [cloth, ink]) {
      const pieces: THREE.BufferGeometry[] = [],
        originals: THREE.Mesh[] = []
      for (const child of [...g.children]) {
        if (!(child instanceof THREE.Mesh) || child.material !== material)
          continue
        const geometry = child.geometry.index
          ? child.geometry.toNonIndexed()
          : child.geometry.clone()
        geometry.applyMatrix4(child.matrix)
        pieces.push(geometry)
        originals.push(child)
      }
      const geometry = mergeGeometries(pieces)
      if (geometry) {
        const mesh = new THREE.Mesh(geometry, material)
        g.add(mesh)
        bannerData.push({
          mesh,
          base: new Float32Array(geometry.attributes.position.array),
          phase,
        })
      }
      for (const geometry of pieces) geometry.dispose()
      for (const mesh of originals) {
        mesh.geometry.dispose()
        mesh.removeFromParent()
      }
    }
    const pole = new THREE.Group()
    pole.position.set(x, 0, z)
    pole.rotation.y = angle
    detail.add(pole)
    cylinder(0.055, 0.055, 3.7, -0.57, 1.95, 0, wood, 8, pole)
    box(1.1, 0.07, 0.07, -0.07, 3.72, 0, metal, pole)
    cylinder(0.17, 0.22, 0.15, -0.57, 0.22, 0, stone, 8, pole)
    solid(x - Math.cos(angle) * 0.57, z + Math.sin(angle) * 0.57, 0.42, 0.42)
  }
  banner(-6.2, -3.4, "01", 0, 0)
  banner(6.2, -3.4, "13", 0, 1.2)
  banner(-14.2, 11.4, "06", Math.PI / 2, 2.4)
  banner(14.2, 11.4, "03", -Math.PI / 2, 3.6)

  return {
    moving,
    update(time: number) {
      for (const { mesh, base, phase } of bannerData) {
        const position = mesh.geometry.attributes.position
        for (let i = 0; i < position.count; i++) {
          const x = base[i * 3],
            y = base[i * 3 + 1],
            z = base[i * 3 + 2]
          const release = Math.min(1, Math.max(0, -y / 1.9))
          position.setZ(
            i,
            z +
              Math.sin(time * 1.35 + x * 4 - y * 2.1 + phase) * release * 0.085,
          )
        }
        position.needsUpdate = true
        mesh.geometry.computeVertexNormals()
      }
    },
  }
}
