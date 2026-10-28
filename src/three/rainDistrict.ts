import * as THREE from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import { Reflector } from "three/addons/objects/Reflector.js"
import { createDistrictMaterials } from "./districtMaterials"
import { loadDistrictModels, type DistrictAssetStatus } from "./districtModels"
import type { WalkRect } from "./walkGeometry"

type Options = {
  assets?: boolean
  reflections?: boolean
  onAssets?: (status: DistrictAssetStatus) => void
}

/** An original Chinese night lane: repair shops, a listening archive and a rain loom. */
export function createRainDistrict(scene: THREE.Scene, options: Options = {}) {
  const groundY = 0.12
  const spawn: [number, number, number] = [0, groundY + 1.7, 27]
  const walkBounds: WalkRect = { minX: -24, maxX: 24, minZ: -32, maxZ: 32 }
  const colliders: WalkRect[] = []
  const solid = (x: number, z: number, width: number, depth: number) => {
    colliders.push({
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
    })
  }
  scene.background = new THREE.Color("#071217")
  scene.fog = new THREE.FogExp2("#10282b", 0.021)
  scene.add(new THREE.HemisphereLight("#9ec8d6", "#172423", 1.25))
  const moon = new THREE.DirectionalLight("#b2d1e1", 1.7)
  moon.position.set(-18, 34, 12)
  moon.castShadow = true
  moon.shadow.mapSize.set(2048, 2048)
  Object.assign(moon.shadow.camera, {
    left: -29,
    right: 29,
    top: 34,
    bottom: -34,
    near: 1,
    far: 100,
  })
  moon.shadow.bias = -0.0003
  moon.shadow.normalBias = 0.035
  scene.add(moon)
  const root = new THREE.Group()
  root.name = "Rain District / 雨巷"
  scene.add(root)
  const palette = createDistrictMaterials()
  const ownedMaterials = new Set<THREE.Material>()
  const ownedTextures = new Set<THREE.Texture>()
  const glow = (color: string, power = 1) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(power),
      toneMapped: false,
    })
    ownedMaterials.add(mat)
    return mat
  }
  const jade = glow("#83e7cd", 2.2),
    amber = glow("#edb971", 1.15),
    coral = glow("#e28b73", 1.05)
  const glass = new THREE.MeshStandardMaterial({
    color: "#1d4949",
    metalness: 0.55,
    roughness: 0.22,
    emissive: "#24403a",
    emissiveIntensity: 0.25,
  })
  ownedMaterials.add(glass)
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    parent: THREE.Object3D = root,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z)
    mesh.castShadow = !(mat as THREE.MeshBasicMaterial).isMeshBasicMaterial
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  const rod = (
    a: number[],
    b: number[],
    radius: number,
    mat: THREE.Material,
    parent: THREE.Object3D = root,
  ) => {
    const start = new THREE.Vector3().fromArray(a),
      end = new THREE.Vector3().fromArray(b)
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 7),
      mat,
    )
    mesh.position.copy(start).add(end).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.sub(start).normalize(),
    )
    parent.add(mesh)
    return mesh
  }
  const lamp = (
    x: number,
    y: number,
    z: number,
    color: string,
    intensity = 24,
    distance = 13,
  ) => {
    const light = new THREE.PointLight(color, intensity, distance, 2)
    light.position.set(x, y, z)
    scene.add(light)
    return light
  }
  box(0, -0.08, 0, 60, 0.4, 76, palette.stone)
  // Broken paving joints and brass drainage channels survive beneath the reflections.
  for (let z = -33; z < 34; z += 1.7) {
    box(0, groundY + 0.004, z, 12.8, 0.009, 0.025, palette.black)
    for (const x of [-4, -2, 0, 2, 4])
      box(
        x + (Math.round(z) % 2 ? 0.3 : 0),
        groundY + 0.003,
        z + 0.82,
        0.016,
        0.008,
        1.6,
        palette.black,
      )
  }
  for (const side of [-1, 1]) {
    box(side * 5.9, groundY + 0.02, 0, 0.16, 0.035, 66, palette.metal)
    for (let z = -32; z < 32; z += 0.27)
      box(side * 5.9, groundY + 0.04, z, 0.2, 0.015, 0.035, palette.black)
    for (const z of [-21, -3, 15]) {
      solid(side * 13.5, z, 14, 15)
      // Infill is always present; the authored, textured shophouses rise behind it.
      box(side * 10, 3.1, z, 6, 6, 14.7, palette.plaster)
      box(side * 6.95, 0.53, z, 0.22, 0.82, 14.8, palette.stone)
      for (let bay = -1; bay <= 1; bay++) {
        const zz = z + bay * 4.6
        box(side * 6.88, 1.9, zz, 0.09, 2.2, 3.6, glass)
        for (const end of [-1, 1])
          box(side * 6.76, 1.9, zz + end * 1.8, 0.16, 2.7, 0.16, palette.wood)
        box(side * 6.76, 3.28, zz, 0.16, 0.18, 3.75, palette.wood)
        // A few warm occupied rooms, never a wall of luminous windows.
        box(side * 6.8, 4.65, zz, 0.1, 1.3, 2.6, bay === 0 ? amber : glass)
        for (let divider = -1; divider <= 1; divider++)
          box(
            side * 6.65,
            4.65,
            zz + divider * 0.8,
            0.18,
            1.45,
            0.045,
            palette.dark,
          )
        box(side * 6.4, 3.6, zz, 1.2, 0.09, 4, palette.roof)
        box(side * 5.85, 3.52, zz, 0.04, 0.04, 3.2, bay === -1 ? coral : jade)
        // Ground-level shutters, pipework, sills, menus and crates give scale at eye level.
        if (bay === 1)
          for (let slat = 0; slat < 15; slat++)
            box(
              side * 6.68,
              0.55 + slat * 0.16,
              zz,
              0.08,
              0.1,
              3.45,
              palette.roofEdge,
            )
        rod(
          [side * 6.55, 0.2, zz + 2],
          [side * 6.55, 6.8, zz + 2],
          0.055,
          palette.metal,
        )
        box(side * 6.32, 0.4, zz - 1.6, 0.65, 0.55, 0.7, palette.wood)
      }
      // Setbacks above the shopfronts catch moonlight and make a layered skyline.
      box(side * 13.5, 15.5, z, 11.3, 1, 12.8, palette.dark)
      for (let mast = 0; mast < 3; mast++) {
        rod(
          [side * (10 + mast * 2), 16, z],
          [side * (10 + mast * 2), 18.2, z],
          0.035,
          palette.metal,
        )
        rod(
          [side * (10 + mast * 2) - 0.6, 17.6, z],
          [side * (10 + mast * 2) + 0.6, 17.6, z],
          0.025,
          palette.metal,
        )
      }
    }
    // Distant office towers are deliberately quiet, with irregular illuminated rooms.
    for (let i = 0; i < 8; i++) {
      const z = -48 + i * 13,
        h = 24 + ((i * 7) % 19),
        x = side * (31 + (i % 3) * 5)
      box(x, h / 2, z, 8, h, 10, palette.roof)
      for (let floor = 1; floor < h / 2.8; floor++)
        for (let col = -1; col <= 1; col++) {
          if ((floor * 7 + col + i * 3) % 5 > 1) continue
          box(
            x - side * 4.05,
            floor * 2.8,
            z + col * 2.3,
            0.02,
            0.7,
            1.25,
            (floor + i) % 4 ? amber : jade,
          )
        }
    }
  }
  // Low practical lighting: warm workshops on one side, cool archive light on the other.
  for (const [x, z, color] of [
    [-5.4, -7, "#ffc48b"],
    [5.4, -15, "#7de5d5"],
    [-5.4, 9, "#f6b18a"],
    [5.4, 19, "#8ccddd"],
  ] as const)
    lamp(x, 3.1, z, color, 43, 15)
  lamp(0, 7, 0, "#70ddc4", 100, 24)
  lamp(0, 6, 25, "#a7cfe0", 30, 18)

  // An overhead tram ribbon crosses the lane, with a slow, self-contained night service.
  for (const z of [-25.5, -23.8])
    rod([-35, 9.1, z], [35, 9.1, z + 8], 0.17, palette.metal)
  for (const x of [-25, -10, 10, 25]) {
    rod(
      [x, 0, -24 + ((x + 35) * 8) / 70],
      [x, 9, -24 + ((x + 35) * 8) / 70],
      0.2,
      palette.dark,
    )
    solid(x, -24 + ((x + 35) * 8) / 70, 0.5, 0.5)
  }
  const tram = new THREE.Group()
  tram.name = "Last night tram"
  root.add(tram)
  box(0, 0, 0, 7.8, 1.5, 1.8, palette.roofEdge, tram)
  for (let x = -3; x < 3.5; x += 1.2)
    box(x, 0.18, 0.91, 0.9, 0.66, 0.02, amber, tram)
  box(0, -0.69, 0.93, 7.6, 0.035, 0.025, jade, tram)

  // Catenary utility wires, individually sagging, run above the pedestrian space.
  for (let wire = 0; wire < 7; wire++) {
    const z = -26 + wire * 8.4
    const points = Array.from({ length: 25 }, (_, i) => {
      const u = i / 24
      return new THREE.Vector3(
        -7 + u * 14,
        7.8 - Math.sin(u * Math.PI) * (0.7 + (wire % 3) * 0.2),
        z + Math.sin(u * 3) * 1.5,
      )
    })
    const cable = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        24,
        0.025,
        5,
        false,
      ),
      palette.black,
    )
    root.add(cable)
  }

  // Rain loom: a bronze square holding a luminous circle, with fine suspended water threads.
  const loom = new THREE.Group()
  loom.name = "Rain loom / 天圆地方"
  loom.position.set(0, 7.4, 0)
  loom.rotation.z = Math.PI / 4
  root.add(loom)
  for (const side of [-1, 1]) {
    box(side * 2.6, 0, 0, 0.09, 5.25, 0.15, palette.metal, loom)
    box(0, side * 2.6, 0, 5.25, 0.09, 0.15, palette.metal, loom)
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.68, 0.045, 8, 100),
    jade,
  )
  loom.add(ring)
  for (let i = 0; i < 43; i++) {
    const x = -2.7 + i * 0.128
    const y = 7.1 + Math.sqrt(Math.max(0, 8 - x * x))
    rod(
      [x, y, 0],
      [x, 4.5 + Math.sin(i * 1.7) * 0.65, 0],
      0.009,
      i % 5 ? glass : jade,
    )
  }
  for (const x of [-2.6, 2.6])
    rod([x, 10, 0], [x * 2.6, 14.5, 0], 0.018, palette.metal)
  const collector = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.8, 0.3, 64),
    palette.stone,
  )
  collector.position.set(0, 0.25, 0)
  root.add(collector)
  solid(0, 0, 3.5, 3.5)
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.47, 64), glass)
  water.rotation.x = -Math.PI / 2
  water.position.set(0, 0.41, 0)
  root.add(water)

  // Lettering atlas is original typography, rasterized with the system Chinese font.
  const atlas = new THREE.Texture()
  atlas.colorSpace = THREE.SRGBColorSpace
  atlas.anisotropy = 4
  ownedTextures.add(atlas)
  let disposed = false
  if (options.assets !== false)
    new THREE.ImageLoader().load(
      "/models/neon-district/signs/atlas.png",
      (image) => {
        if (disposed) return
        atlas.image = image
        atlas.needsUpdate = true
      },
      undefined,
      () => {},
    )
  const lettering = new THREE.MeshBasicMaterial({
    map: atlas,
    toneMapped: false,
  })
  ownedMaterials.add(lettering)
  function sign(
    index: number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    turn: number,
    parent: THREE.Object3D = root,
  ) {
    const geometry = new THREE.PlaneGeometry(w, h)
    const uv = geometry.attributes.uv
    for (let j = 0; j < uv.count; j++)
      uv.setXY(
        j,
        (uv.getX(j) + (index % 2)) / 2,
        (uv.getY(j) + 3 - Math.floor(index / 2)) / 4,
      )
    const mesh = new THREE.Mesh(geometry, lettering)
    mesh.position.set(x, y, z)
    mesh.rotation.y = turn
    parent.add(mesh)
    return mesh
  }
  sign(0, 0, 6.2, -28, 4.5, 3.6, 0)
  for (const [side, z, index] of [
    [-1, -20, 7],
    [1, -10, 2],
    [-1, 3, 3],
    [1, 22, 4],
    [-1, 18, 6],
  ] as const) {
    sign(
      index,
      side * 5.65,
      5.1,
      z,
      1.7,
      2.7,
      side < 0 ? Math.PI / 2 - 0.25 : -Math.PI / 2 + 0.25,
    )
    rod([side * 6.9, 6.5, z], [side * 5.65, 6.5, z], 0.035, palette.metal)
  }
  const interactables: THREE.Group[] = []
  for (const [i, spec] of ([
    [-5.6, -7],
    [5.6, -15],
    [-5.6, 9],
    [5.2, 19],
  ] as const).entries()) {
    const [x, z] = spec
    const terminal = new THREE.Group()
    terminal.name = [
      "Dispatch Workshop",
      "Signal Archive",
      "After-hours Tea House",
      "Last Tram",
    ][i]
    terminal.position.set(x, groundY, z)
    root.add(terminal)
    box(0, 0.8, 0, 0.32, 1.6, 0.5, palette.metal, terminal)
    box(0, 1.7, 0, 0.45, 0.65, 0.65, palette.dark, terminal)
    const side = Math.sign(x)
    sign(
      i + 1,
      -side * 0.235,
      1.7,
      0,
      0.58,
      0.58,
      (-side * Math.PI) / 2,
      terminal,
    )
    box(0, 2.06, 0, 0.46, 0.025, 0.68, i % 2 ? jade : amber, terminal)
    interactables.push(terminal)
    solid(x, z, 0.5, 0.7)
  }
  // Scooter footprints correspond to the imported models.
  solid(-4.7, -9.8, 1.25, 2)
  solid(4.5, 15.1, 1.3, 2)

  // Tiny lived-in places along the lane: a radio bench and an after-hours tea counter.
  box(-5.95, 0.85, -5.1, 1.05, 0.12, 2.2, palette.wood)
  for (const z of [-5.95, -4.25])
    box(-5.95, 0.47, z, 0.12, 0.75, 0.12, palette.metal)
  for (let i = 0; i < 4; i++) {
    const z = -5.8 + i * 0.45
    box(-5.95, 1.12, z, 0.5, 0.42, 0.33, palette.wood)
    box(-5.69, 1.16, z, 0.018, 0.15, 0.24, jade)
    rod([-5.9, 1.3, z], [-5.78, 1.8, z + 0.08], 0.009, palette.metal)
    for (const zz of [-0.08, 0.08]) {
      const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12),
        palette.metal,
      )
      dial.rotation.z = Math.PI / 2
      dial.position.set(-5.68, 1, z + zz)
      root.add(dial)
    }
  }
  solid(-5.95, -5.1, 1.05, 2.2)
  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.58, 0.08, 32),
    palette.wood,
  )
  table.position.set(-4.8, 0.85, 11.5)
  root.add(table)
  rod([-4.8, 0.18, 11.5], [-4.8, 0.84, 11.5], 0.07, palette.metal)
  solid(-4.8, 11.5, 1.25, 1.25)
  const kettle = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    palette.metal,
  )
  kettle.position.set(-4.8, 1.02, 11.5)
  root.add(kettle)
  rod([-4.8, 1.01, 11.5], [-4.56, 1.09, 11.5], 0.035, palette.metal)
  for (const z of [11.18, 11.82]) {
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.04, 0.065, 16),
      palette.glow,
    )
    cup.position.set(-4.65, 0.93, z)
    root.add(cup)
  }
  for (const z of [10.4, 12.6]) {
    box(-4.8, 0.43, z, 0.48, 0.08, 0.44, palette.wood)
    box(-5, 0.73, z, 0.06, 0.52, 0.46, palette.wood)
    for (const side of [-1, 1])
      rod(
        [-4.8 + side * 0.18, 0.16, z - 0.16],
        [-4.8 - side * 0.18, 0.42, z + 0.16],
        0.025,
        palette.metal,
      )
    solid(-4.8, z, 0.55, 0.55)
  }
  // A bench of tape reels belongs to the listening archive, not a generic advertising wall.
  box(6.1, 1.3, -17.3, 0.6, 2.4, 1.9, palette.dark)
  for (const y of [0.6, 1.3, 2]) {
    box(5.76, y, -17.3, 0.1, 0.04, 1.8, palette.metal)
    for (const z of [-17.9, -17.3, -16.7]) {
      const reel = new THREE.Mesh(
        new THREE.TorusGeometry(0.19, 0.028, 6, 20),
        palette.metal,
      )
      reel.rotation.y = Math.PI / 2
      reel.position.set(5.75, y + 0.23, z)
      root.add(reel)
      rod([5.73, y + 0.23, z - 0.17], [5.73, y + 0.23, z + 0.17], 0.012, jade)
    }
  }
  solid(6.1, -17.3, 0.7, 1.9)

  // Batch the authored static construction by material. Keep animated and interactive roots separate.
  const batches = new Map<THREE.Material, THREE.Mesh[]>()
  for (const child of [...root.children]) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material))
      continue
    const meshes = batches.get(child.material) ?? []
    meshes.push(child)
    batches.set(child.material, meshes)
  }
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue
    const geometries = meshes.map((mesh) => {
      mesh.updateMatrix()
      return mesh.geometry.clone().applyMatrix4(mesh.matrix)
    })
    const merged = mergeGeometries(geometries, false)
    geometries.forEach((g) => g.dispose())
    if (!merged) continue
    meshes.forEach((mesh) => {
      root.remove(mesh)
      mesh.geometry.dispose()
    })
    const mesh = new THREE.Mesh(merged, material)
    mesh.name = `District architecture / ${material.name || material.type}`
    mesh.castShadow = !(material as THREE.MeshBasicMaterial).isMeshBasicMaterial
    mesh.receiveShadow = true
    root.add(mesh)
  }

  // Actual planar reflection, softened and broken into puddles instead of a perfect mirror.
  let reflection: Reflector | undefined
  if (options.reflections !== false) {
    reflection = new Reflector(new THREE.PlaneGeometry(12.7, 66), {
      textureWidth: 768,
      textureHeight: 768,
      multisample: 0,
      clipBias: 0.003,
      shader: {
        uniforms: {
          color: { value: new THREE.Color("#152b2e") },
          tDiffuse: { value: null },
          textureMatrix: { value: new THREE.Matrix4() },
          time: { value: 0 },
        },
        vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec2 vGround;
          void main(){vUv=textureMatrix*vec4(position,1.);vGround=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 color; uniform float time; varying vec4 vUv; varying vec2 vGround;
          void main(){
            vec2 uv=vUv.xy/vUv.w;
            float n=sin(vGround.x*2.1+sin(vGround.y*.7))*sin(vGround.y*1.6+vGround.x*.3);
            vec2 ripple=vec2(sin(vGround.y*19.+time*2.),cos(vGround.x*17.+time*1.4))*.00065;
            vec3 reflected=texture2D(tDiffuse,uv+ripple).rgb*.4;
            reflected+=texture2D(tDiffuse,uv+ripple+vec2(.0015,0.)).rgb*.15;
            reflected+=texture2D(tDiffuse,uv+ripple-vec2(.0015,0.)).rgb*.15;
            reflected+=texture2D(tDiffuse,uv+ripple+vec2(0.,.0015)).rgb*.15;
            reflected+=texture2D(tDiffuse,uv+ripple-vec2(0.,.0015)).rgb*.15;
            float wet=smoothstep(-.5,.65,n)*.3+.18;
            gl_FragColor=vec4(mix(color*.3,reflected,wet),1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      },
    })
    reflection.name = "Rain-slick street reflection"
    reflection.rotation.x = -Math.PI / 2
    reflection.position.y = groundY + 0.002
    root.add(reflection)
  }
  // GPU rain: no per-frame buffer allocation and no thousands of individual draw calls.
  const rainCount = 1800
  const rainGeometry = new THREE.BufferGeometry()
  const rainPositions = new Float32Array(rainCount * 6)
  const rainEnds = new Float32Array(rainCount * 2)
  let seed = 311
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < rainCount; i++) {
    const x = (random() - 0.5) * 42,
      y = random() * 20,
      z = (random() - 0.5) * 68
    rainPositions.set([x, y, z, x, y, z], i * 6)
    rainEnds[i * 2 + 1] = 1
  }
  rainGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(rainPositions, 3),
  )
  rainGeometry.setAttribute("end", new THREE.BufferAttribute(rainEnds, 1))
  const rainMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `uniform float time; attribute float end; varying float fade; void main(){vec3 p=position;p.y=mod(position.y-time*7.,20.)+.2;p+=vec3(.018,.28,.025)*end;vec4 mv=modelViewMatrix*vec4(p,1.);fade=clamp(1.-length(mv.xyz)/44.,0.,1.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying float fade;void main(){gl_FragColor=vec4(.55,.77,.78,fade*.22);}`,
  })
  ownedMaterials.add(rainMaterial)
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial)
  rain.name = "Rain threads"
  rain.frustumCulled = false
  root.add(rain)
  const models =
    options.assets === false
      ? undefined
      : loadDistrictModels(root, options.onAssets)
  let previous = 0
  return {
    root,
    spawn,
    groundY,
    colliders,
    walkBounds,
    interactables,
    ready: models?.ready ?? Promise.resolve(),
    update(seconds: number) {
      if (disposed || !Number.isFinite(seconds)) return
      const dt = Math.max(0, Math.min(0.05, seconds - previous))
      previous = seconds
      models?.update(dt)
      rainMaterial.uniforms.time.value = seconds % 1000
      if (reflection)
        (reflection.material as THREE.ShaderMaterial).uniforms.time.value =
          seconds % 1000
      const x = ((seconds * 2.4 + 17) % 86) - 43
      tram.position.set(x, 10.1, -24.65 + ((x + 35) * 8) / 70)
      tram.rotation.y = -Math.atan2(8, 70)
      ring.rotation.z = seconds * 0.018
    },
    dispose() {
      if (disposed) return
      disposed = true
      models?.dispose()
      const geometry = new Set<THREE.BufferGeometry>()
      const materials = new Set<THREE.Material>()
      root.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) geometry.add(mesh.geometry)
        if (mesh.material && object !== reflection)
          (Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          ).forEach((m) => materials.add(m))
      })
      reflection?.dispose()
      geometry.forEach((g) => g.dispose())
      // The palette owns its shared grain map and its materials.
      const paletteMaterials = new Set<THREE.Material>(
        Object.values(palette)
          .flat()
          .filter((m) => m instanceof THREE.Material),
      )
      materials.forEach((m) => {
        if (!paletteMaterials.has(m)) m.dispose()
      })
      ownedMaterials.forEach((m) => {
        if (!materials.has(m)) m.dispose()
      })
      ownedTextures.forEach((t) => t.dispose())
      palette.dispose()
      moon.shadow.dispose()
      scene.clear()
    },
  }
}
