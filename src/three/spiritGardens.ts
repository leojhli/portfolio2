import * as THREE from "three"

/** Thousands of individual leaves, using one shared cutout map and two draw calls. */
export function createSpiritGardens(root: THREE.Group, wood: THREE.Material) {
  const size = 64,
    bytes = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const t = (y + 0.5) / size,
        u = ((x + 0.5) / size - 0.5) * 2
      const edge =
        Math.pow(Math.sin(Math.PI * t), 0.8) * (0.85 + 0.06 * Math.sin(t * 65))
      const vein = Math.abs(u - 0.025 * Math.sin(t * 7)) < 0.035 ? 0.86 : 1
      const shade = (0.86 + 0.14 * Math.sin(t * Math.PI)) * vein
      const at = (y * size + x) * 4
      bytes[at] = bytes[at + 1] = bytes[at + 2] = Math.round(shade * 255)
      bytes[at + 3] = Math.abs(u) < edge ? 255 : 0
    }
  const texture = new THREE.DataTexture(bytes, size, size)
  texture.name = "Procedural leaf silhouette and veins"
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: texture,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.9,
    alphaToCoverage: true,
  })
  material.name = "Individual sakura leaves and garden foliage"
  const time = { value: 0 }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.gardenTime = time
    shader.vertexShader = "uniform float gardenTime;\n" + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float phase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
        transformed.x += sin(gardenTime * 1.25 + phase) * 0.038;
        transformed.z += cos(gardenTime * 0.95 + phase) * 0.027;
      #endif`,
    )
  }
  material.customProgramCacheKey = () => "spirit-leaves-v1"
  const transforms: THREE.Matrix4[] = [],
    colors: THREE.Color[] = []
  const groundTransforms: THREE.Matrix4[] = [],
    groundColors: THREE.Color[] = []
  const dummy = new THREE.Object3D()
  const rand = (i: number) => {
    const n = Math.sin(i * 127.1 + 311.7) * 43758.5453
    return n - Math.floor(n)
  }
  const branch = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    r1: number,
    r2: number,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r2, r1, a.distanceTo(b), 7, 1),
      wood,
    )
    mesh.position.copy(a).add(b).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    )
    root.add(mesh)
  }
  const leaf = (
    position: THREE.Vector3,
    scale: number,
    color: THREE.Color,
    seed: number,
    ground = false,
  ) => {
    dummy.position.copy(position)
    dummy.rotation.set(
      ground ? -Math.PI / 2 : rand(seed + 1) * Math.PI,
      rand(seed + 2) * Math.PI * 2,
      rand(seed + 3) * Math.PI,
    )
    dummy.scale.set(scale * (0.7 + rand(seed + 4) * 0.4), scale, scale)
    dummy.updateMatrix()
    ;(ground ? groundTransforms : transforms).push(dummy.matrix.clone())
    ;(ground ? groundColors : colors).push(color)
  }
  const treeAt = (x: number, z: number, scale = 1, blossom = true) => {
    const origin = new THREE.Vector3(x, 0.12, z)
    const point = (a: number, b: number, c: number) =>
      new THREE.Vector3(a, b, c).multiplyScalar(scale).add(origin)
    branch(point(0, 0, 0), point(0.12, 2.6, 0), 0.23 * scale, 0.13 * scale)
    for (let b = 0; b < 8; b++) {
      const angle = b * 2.399,
        length = 1.3 + rand(b + x * 11) * 0.8
      const elbow = point(
        Math.sin(angle) * length * 0.55,
        2.7 + (b % 3) * 0.25,
        Math.cos(angle) * length * 0.55,
      )
      const tip = point(
        Math.sin(angle) * length,
        3.25 + (b % 3) * 0.4,
        Math.cos(angle) * length,
      )
      branch(
        point(0.1, 1.7 + (b % 3) * 0.25, 0),
        elbow,
        0.11 * scale,
        0.065 * scale,
      )
      branch(elbow, tip, 0.065 * scale, 0.018 * scale)
      for (let twig = 0; twig < 3; twig++) {
        const fork = tip
          .clone()
          .add(
            new THREE.Vector3(
              Math.sin(angle + twig * 1.5) * 0.55,
              0.25 + twig * 0.08,
              Math.cos(angle + twig * 1.5) * 0.55,
            ).multiplyScalar(scale),
          )
        branch(elbow, fork, 0.033 * scale, 0.007 * scale)
      }
      for (let n = 0; n < 150; n++) {
        const seed = n + b * 170 + (x + 35) * 901 + z * 17
        const angle2 = rand(seed) * Math.PI * 2,
          r = Math.sqrt(rand(seed + 17)) * 0.98 * scale
        const pos = tip
          .clone()
          .add(
            new THREE.Vector3(
              Math.cos(angle2) * r,
              (rand(seed + 34) - 0.4) * 0.9 * scale,
              Math.sin(angle2) * r,
            ),
          )
        const c = new THREE.Color().setHSL(
          blossom
            ? 0.94 + rand(seed + 7) * 0.035
            : 0.34 + rand(seed + 7) * 0.07,
          blossom ? 0.25 + rand(seed + 8) * 0.2 : 0.25,
          blossom ? 0.6 + rand(seed + 9) * 0.3 : 0.19 + rand(seed + 9) * 0.22,
        )
        leaf(pos, (blossom ? 0.19 : 0.23) * scale, c, seed)
      }
    }
    for (let i = 0; i < 120; i++) {
      const seed = i + (x + 40) * 281 + z * 61,
        angle = rand(seed) * Math.PI * 2,
        r = Math.sqrt(rand(seed + 9)) * 2.4
      const pos = new THREE.Vector3(
        x + Math.cos(angle) * r,
        0.205 + rand(seed + 2) * 0.012,
        z + Math.sin(angle) * r,
      )
      const c = new THREE.Color(blossom ? "#dbacc7" : "#64816d")
      leaf(pos, 0.07 + rand(seed + 12) * 0.08, c, seed, true)
    }
  }
  const finish = () => {
    const meshes: THREE.InstancedMesh[] = []
    for (const [matrices, tint, name] of [
      [transforms, colors, "Canopy leaves"],
      [groundTransforms, groundColors, "Fallen petals"],
    ] as const) {
      const mesh = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(1, 0.7),
        material,
        matrices.length,
      )
      mesh.name = name
      matrices.forEach((m, i) => {
        mesh.setMatrixAt(i, m)
        mesh.setColorAt(i, tint[i])
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
      mesh.castShadow = name === "Canopy leaves"
      mesh.receiveShadow = true
      root.add(mesh)
      meshes.push(mesh)
    }
    return meshes
  }
  return {
    treeAt,
    finish,
    texture,
    update(seconds: number) {
      time.value = seconds
    },
  }
}
