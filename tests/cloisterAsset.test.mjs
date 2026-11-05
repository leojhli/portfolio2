import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { test } from "node:test"
import { Box3, Vector3 } from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js"

const assets = new URL("../public/models/cloister/", import.meta.url)

test("the shipping cloister decodes with the runtime Three loader and preserves the source drawing", async () => {
  const manifest = JSON.parse(await readFile(new URL("cloister-manifest.json", assets), "utf8"))
  const bytes = await readFile(new URL(manifest.file, assets))
  const license = await readFile(new URL("LICENSE-CLOISTER.txt", assets), "utf8")
  assert.ok(license.includes(manifest.source) && license.includes(manifest.author) && license.includes(manifest.license))
  assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.sha256)
  assert.ok(bytes.length < 8_000_000, "the single initial environment request should fit the transfer budget")

  const { scene, animations } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")
  const meshes = []
  scene.traverse(node => { if (node.isMesh) meshes.push(node) })
  assert.equal(meshes.length, 47)
  assert.equal(meshes.reduce((sum, mesh) => sum + mesh.geometry.index.count / 3, 0), 1_264_188)
  assert.equal(animations.length, 0)
  assert.equal(manifest.omittedTriangles, 2, "only the invisible source plane should be omitted")
  // A valid index count alone cannot detect triangles whose thin strokes were
  // flattened into a point or line by quantization. Check the decoded lattice.
  let collapsed = 0
  for (const { geometry } of meshes) {
    const { array, stride } = geometry.attributes.position.data
    const indices = geometry.index.array
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * stride, b = indices[i + 1] * stride, c = indices[i + 2] * stride
      const ux = array[b] - array[a], uy = array[b + 1] - array[a + 1], uz = array[b + 2] - array[a + 2]
      const vx = array[c] - array[a], vy = array[c + 1] - array[a + 1], vz = array[c + 2] - array[a + 2]
      if (uy * vz === uz * vy && uz * vx === ux * vz && ux * vy === uy * vx) collapsed++
    }
  }
  assert.equal(collapsed, 0)

  const point = new Vector3()
  for (const sample of manifest.sourceSamples) {
    const mesh = meshes[sample.mesh]
    // These original source coordinates precede the root's Z-up to Y-up rotation.
    point.fromBufferAttribute(mesh.geometry.attributes.position, sample.vertex)
      .multiply(mesh.scale).add(mesh.position)
    assert.ok(point.toArray().every((v, i) => Math.abs(v - sample.position[i]) < 0.0012))
  }
  const bounds = new Box3().setFromObject(scene)
  assert.ok(bounds.min.distanceTo(new Vector3(-23.31034, -0.05773, -15.75470)) < 0.001)
  assert.ok(bounds.max.distanceTo(new Vector3(24.87954, 18.25527, 27.71504)) < 0.001)
})
