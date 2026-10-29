import * as THREE from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import type { WalkRect } from "./walkGeometry"

/** Original residents, planted terraces and small social places beside the night lane. */
export function createDistrictLife(parent: THREE.Group) {
  const root = new THREE.Group()
  root.name = "Neighborhood / cafés, gardens and residents"
  parent.add(root)
  const colliders: WalkRect[] = []
  const solid = (x: number, z: number, w = 0.7, d = w) =>
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    })
  const matte = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
  })
  const satin = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.3,
    metalness: 0.55,
  })
  const foliage = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.75,
    side: THREE.DoubleSide,
  })
  const warm = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#ffd4a1").multiplyScalar(1.8),
    toneMapped: false,
  })
  const mint = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#82ffe2").multiplyScalar(1.7),
    toneMapped: false,
  })
  const materials: THREE.Material[] = [matte, satin, foliage, warm, mint]
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const ownedGeometry = new Set<THREE.BufferGeometry>()
  const instances: THREE.InstancedMesh[] = []
  const residents: Array<{
    mesh: THREE.InstancedMesh
    positions: Array<[number, number, number]>
  }> = []
  const transform = new THREE.Object3D()
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    color: string,
    x: number,
    y: number,
    z: number,
    rotation = new THREE.Euler(),
    scale = new THREE.Vector3(1, 1, 1),
    target = buckets,
  ) => {
    transform.position.set(x, y, z)
    transform.rotation.copy(rotation)
    transform.scale.copy(scale)
    transform.updateMatrix()
    geometry.applyMatrix4(transform.matrix)
    const rgb = new THREE.Color(color).toArray()
    const colors = new Float32Array(geometry.attributes.position.count * 3)
    for (let i = 0; i < colors.length; i += 3) colors.set(rgb, i)
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    const parts = target.get(material) ?? []
    parts.push(geometry)
    target.set(material, parts)
  }
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    mat: THREE.Material = matte,
  ) => add(new THREE.BoxGeometry(w, h, d), mat, color, x, y, z)
  const cylinder = (
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number,
    color: string,
    mat: THREE.Material = matte,
    taper = 1,
  ) =>
    add(
      new THREE.CylinderGeometry(radius, radius * taper, height, 12),
      mat,
      color,
      x,
      y,
      z,
    )
  const sphere = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: string,
    mat: THREE.Material = matte,
  ) =>
    add(
      new THREE.SphereGeometry(1, 8, 5),
      mat,
      color,
      x,
      y,
      z,
      new THREE.Euler(),
      new THREE.Vector3(sx, sy, sz),
    )
  const rod = (
    a: number[],
    b: number[],
    radius: number,
    color: string,
    mat: THREE.Material = satin,
  ) => {
    const start = new THREE.Vector3().fromArray(a),
      end = new THREE.Vector3().fromArray(b)
    const midpoint = start.clone().add(end).multiplyScalar(0.5)
    const rotation = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        end.clone().sub(start).normalize(),
      ),
    )
    add(
      new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 6),
      mat,
      color,
      midpoint.x,
      midpoint.y,
      midpoint.z,
      rotation,
    )
  }

  // Ceramic planters have illuminated bases, branching stems and individually folded leaves.
  for (const [index, [x, z]] of [
    [-5.65, 23.5],
    [5.65, 23.5],
    [-5.65, 7],
    [5.65, 6],
    [5.65, -9],
    [-5.65, -11.5],
  ].entries()) {
    cylinder(x, 0.4, z, 0.34, 0.54, "#e1ddd0", matte, 0.82)
    cylinder(x, 0.17, z, 0.285, 0.035, "#ffffff", mint)
    cylinder(x, 0.675, z, 0.305, 0.018, "#45493b")
    solid(x, z)
    for (let stem = 0; stem < 5; stem++) {
      const angle = stem * 2.4 + index
      const tx = x + Math.cos(angle) * 0.17,
        tz = z + Math.sin(angle) * 0.17
      const height = 1.02 + (stem % 3) * 0.19
      rod([x, 0.65, z], [tx, height, tz], 0.012, "#45694c", foliage)
      for (let leaf = 0; leaf < 4; leaf++) {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(
            [
              0, 0, 0, -0.085, 0.09, 0.15, 0, 0.1, 0.37, 0.085, 0.09, 0.15, 0,
              0.12, 0.15,
            ],
            3,
          ),
        )
        geometry.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4])
        geometry.computeVertexNormals()
        geometry.setAttribute(
          "uv",
          new THREE.Float32BufferAttribute(
            [0.5, 0, 0, 0.5, 0.5, 1, 1, 0.5, 0.5, 0.5],
            2,
          ),
        )
        add(
          geometry,
          foliage,
          leaf % 2 ? "#65a776" : "#367f65",
          tx,
          0.8 + (leaf * (height - 0.8)) / 4,
          tz,
          new THREE.Euler(0, angle + leaf * 2.3, (leaf % 2 ? 1 : -1) * 0.18),
        )
      }
    }
  }

  const teaPositions: Array<[number, number, number]> = [
    [-4.65, 0.94, 11.18],
    [-4.65, 0.94, 11.82],
  ]
  for (const [x, z] of [
    [5.15, 3],
    [-5.35, -14],
  ]) {
    cylinder(x, 0.85, z, 0.49, 0.08, "#c58f62")
    cylinder(x, 0.5, z, 0.07, 0.64, "#bcc4c3", satin)
    cylinder(x, 0.16, z, 0.28, 0.06, "#bcc4c3", satin)
    solid(x, z, 1)
    for (const offset of [-1, 1]) {
      const zz = z + offset
      box(x, 0.44, zz, 0.5, 0.09, 0.5, "#e3aa84")
      box(x, 0.68, zz + offset * 0.23, 0.48, 0.48, 0.07, "#e3aa84")
      for (const sx of [-0.18, 0.18])
        rod(
          [x + sx, 0.16, zz - 0.17],
          [x + sx, 0.42, zz + 0.17],
          0.027,
          "#a6c0bb",
        )
      solid(x, zz, 0.68)
      cylinder(x + 0.16, 0.94, z + offset * 0.22, 0.065, 0.09, "#e9e3d9")
      cylinder(x + 0.16, 0.988, z + offset * 0.22, 0.051, 0.004, "#a46931")
      teaPositions.push([x + 0.16, 1.02, z + offset * 0.22])
    }
    cylinder(x - 0.18, 1, z, 0.06, 0.19, "#fff4db")
    sphere(x - 0.18, 1.13, z, 0.11, 0.075, 0.11, "#ffffff", warm)
  }

  // Human faces, shaped coats, bent knees, hands and shoes remain readable at street scale.
  const person = (seated: boolean, coat: string) => {
    const parts = new Map<THREE.Material, THREE.BufferGeometry[]>()
    const oval = (
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      color: string,
    ) =>
      add(
        new THREE.SphereGeometry(1, 8, 5),
        matte,
        color,
        x,
        y,
        z,
        new THREE.Euler(),
        new THREE.Vector3(sx, sy, sz),
        parts,
      )
    const block = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: string,
    ) =>
      add(
        new THREE.BoxGeometry(w, h, d),
        matte,
        color,
        x,
        y,
        z,
        new THREE.Euler(),
        new THREE.Vector3(1, 1, 1),
        parts,
      )
    const limb = (
      from: number[],
      to: number[],
      radius: number,
      color: string,
    ) => {
      const a = new THREE.Vector3().fromArray(from),
        b = new THREE.Vector3().fromArray(to),
        centre = a.clone().add(b).multiplyScalar(0.5)
      const rotation = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          b.clone().sub(a).normalize(),
        ),
      )
      add(
        new THREE.CylinderGeometry(radius * 0.86, radius, a.distanceTo(b), 7),
        matte,
        color,
        centre.x,
        centre.y,
        centre.z,
        rotation,
        new THREE.Vector3(1, 1, 1),
        parts,
      )
    }
    const hip = seated ? 0.42 : 0.89,
      neck = hip + 0.54,
      head = neck + 0.145
    const skin = "#c99677",
      hair = "#24272e",
      trousers = "#35434f"
    add(
      new THREE.CylinderGeometry(0.2, 0.17, 0.45, 10),
      matte,
      coat,
      0,
      hip + 0.29,
      0,
      new THREE.Euler(),
      new THREE.Vector3(1, 1, 0.7),
      parts,
    )
    oval(0, hip + 0.49, 0, 0.21, 0.08, 0.135, coat)
    oval(0, hip, 0, 0.18, 0.1, 0.12, trousers)
    limb([0, neck - 0.05, 0], [0, neck + 0.04, 0], 0.055, skin)
    oval(0, head, 0.008, 0.105, 0.14, 0.1, skin)
    oval(0, head + 0.075, -0.015, 0.109, 0.079, 0.102, hair)
    oval(0, head, -0.067, 0.104, 0.115, 0.04, hair)
    oval(0, head - 0.01, 0.105, 0.016, 0.022, 0.018, skin)
    for (const side of [-1, 1]) {
      block(side * 0.038, head + 0.02, 0.1, 0.027, 0.009, 0.008, hair)
      oval(side * 0.105, head, 0, 0.019, 0.03, 0.02, skin)
      const kneeZ = seated ? 0.34 : side * 0.02
      limb(
        [side * 0.1, hip, 0],
        [side * 0.13, seated ? 0.4 : 0.48, kneeZ],
        0.084,
        trousers,
      )
      limb(
        [side * 0.13, seated ? 0.4 : 0.48, kneeZ],
        [side * 0.13, 0.1, kneeZ + 0.06],
        0.065,
        trousers,
      )
      oval(side * 0.13, 0.055, kneeZ + 0.12, 0.085, 0.055, 0.14, "#dbd6c9")
      const elbow = [side * 0.25, hip + 0.25, 0.09]
      const hand = [
        side * 0.16,
        hip + (seated ? 0.3 : 0.13),
        seated ? 0.34 : 0.22,
      ]
      limb([side * 0.2, hip + 0.47, 0], elbow, 0.068, coat)
      limb(elbow, hand, 0.057, coat)
      oval(hand[0], hand[1], hand[2], 0.045, 0.046, 0.06, skin)
    }
    block(0, hip + 0.28, 0.142, 0.013, 0.43, 0.008, "#abb7b6")
    block(-0.1, hip + 0.37, 0.144, 0.085, 0.08, 0.012, "#e5d5ba")
    block(-0.1, hip + 0.39, 0.153, 0.065, 0.013, 0.009, "#8de6d8")
    const geometries = parts.get(matte)!
    const merged = mergeGeometries(geometries, false)!
    geometries.forEach((geometry) => geometry.dispose())
    ownedGeometry.add(merged)
    return merged
  }
  for (const [index, config] of [
    {
      coat: "#dabf98",
      seated: true,
      poses: [
        [-4.8, 10.4, 0],
        [-4.8, 12.6, Math.PI],
      ],
    },
    {
      coat: "#508a8a",
      seated: true,
      poses: [
        [5.15, 2, 0],
        [5.15, 4, Math.PI],
      ],
    },
    {
      coat: "#b56f67",
      seated: true,
      poses: [
        [-5.35, -15, 0],
        [-5.35, -13, Math.PI],
      ],
    },
    {
      coat: "#8c89ad",
      seated: false,
      poses: [
        [5.2, -5.6, 0.12],
        [5.2, -4.3, Math.PI + 0.1],
      ],
    },
  ].entries()) {
    const mesh = new THREE.InstancedMesh(
      person(config.seated, config.coat),
      matte,
      2,
    )
    mesh.name = `Neighborhood residents / ${
      config.seated ? "tea guests" : "conversation"
    } ${index + 1}`
    mesh.castShadow = mesh.receiveShadow = true
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    const positions = config.poses as Array<[number, number, number]>
    residents.push({ mesh, positions })
    instances.push(mesh)
    root.add(mesh)
    if (!config.seated) positions.forEach(([x, z]) => solid(x, z, 0.65))
  }
  for (const [material, geometries] of buckets) {
    const merged = mergeGeometries(geometries, false)!
    geometries.forEach((geometry) => geometry.dispose())
    ownedGeometry.add(merged)
    const mesh = new THREE.Mesh(merged, material)
    mesh.name = "Neighborhood furniture and planting"
    mesh.castShadow = !(material as THREE.MeshBasicMaterial).isMeshBasicMaterial
    mesh.receiveShadow = true
    root.add(mesh)
  }

  // Shared GPU steam makes the tea feel hot with a tiny particle buffer and no texture.
  const steamGeometry = new THREE.BufferGeometry()
  const steamPositions = new Float32Array(teaPositions.length * 6 * 3)
  const phases = new Float32Array(teaPositions.length * 6)
  for (let i = 0; i < phases.length; i++) {
    steamPositions.set(teaPositions[Math.floor(i / 6)], i * 3)
    phases[i] = (i % 6) / 6 + Math.floor(i / 6) * 0.083
  }
  steamGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(steamPositions, 3),
  )
  steamGeometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1))
  ownedGeometry.add(steamGeometry)
  const steamMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `attribute float phase; uniform float time; varying float opacity;
      void main(){float age=fract(phase+time*.24);vec3 p=position;p.y+=age*.55;p.x+=sin(age*7.+phase*9.)*age*.055;
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((3.+age*8.)*10./max(1.,-mv.z),1.,18.);opacity=sin(age*3.14159)*.15;}`,
    fragmentShader: `varying float opacity;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(1.,.9,.78,opacity*pow(max(0.,1.-r),2.));}`,
  })
  materials.push(steamMaterial)
  const steam = new THREE.Points(steamGeometry, steamMaterial)
  steam.name = "Tea steam"
  steam.frustumCulled = false
  root.add(steam)
  let disposed = false
  const update = (time: number) => {
    if (disposed || !Number.isFinite(time)) return
    const t = time % 1000
    for (const [group, { mesh, positions }] of residents.entries()) {
      positions.forEach(([x, z, yaw], index) => {
        const phase = group * 1.7 + index * 2.3
        transform.position.set(x, 0.12, z)
        transform.rotation.set(0, yaw + Math.sin(t * 0.32 + phase) * 0.025, 0)
        transform.scale.set(1, 1 + Math.sin(t * 1.25 + phase) * 0.0035, 1)
        transform.updateMatrix()
        mesh.setMatrixAt(index, transform.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
    steamMaterial.uniforms.time.value = t
  }
  update(0)
  return {
    root,
    colliders,
    update,
    dispose() {
      if (disposed) return
      disposed = true
      root.removeFromParent()
      instances.forEach((mesh) => mesh.dispose())
      ownedGeometry.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      root.clear()
    },
  }
}
