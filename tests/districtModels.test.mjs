import assert from "node:assert/strict"
import { before, after, test } from "node:test"
import { createServer } from "vite"
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
let server, loadDistrictModels
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  ;({ loadDistrictModels } = await server.ssrLoadModule(
    "/src/three/districtModels.ts",
  ))
})
after(async () => server?.close())
function model() {
  const geometry = new THREE.BoxGeometry(2, 4, 2)
  const texture = new THREE.Texture()
  const material = new THREE.MeshStandardMaterial({ map: texture })
  const scene = new THREE.Group()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(1, 2, -1)
  scene.add(mesh)
  const counts = [0, 0, 0]
  ;[geometry, material, texture].forEach((resource, i) =>
    resource.addEventListener("dispose", () => counts[i]++),
  )
  return { gltf: { scene, animations: [] }, counts }
}
test("late model responses after exit release resources without attaching or notifying", async () => {
  const original = GLTFLoader.prototype.loadAsync
  const pending = []
  const root = new THREE.Group()
  const events = []
  GLTFLoader.prototype.loadAsync = () =>
    new Promise((resolve) => pending.push(resolve))
  try {
    const models = loadDistrictModels(root, (event) => events.push(event))
    assert.equal(pending.length, 4)
    models.dispose()
    const sources = pending.map((resolve) => {
      const asset = model()
      resolve(asset.gltf)
      return asset
    })
    await models.ready
    assert.equal(root.children.length, 0)
    assert.equal(events.length, 0)
    sources.forEach(({ counts }) => assert.deepEqual(counts, [1, 1, 1]))
    models.dispose()
  } finally {
    GLTFLoader.prototype.loadAsync = original
  }
})
test("loaded copies share instanced geometry and partial network failure leaves usable detail", async () => {
  const original = GLTFLoader.prototype.loadAsync
  const sources = [],
    events = []
  const root = new THREE.Group()
  GLTFLoader.prototype.loadAsync = async (url) => {
    if (url.includes("industrial-ac")) throw new Error("offline")
    const asset = model()
    sources.push(asset)
    return asset.gltf
  }
  try {
    const models = loadDistrictModels(root, (event) => events.push(event))
    await models.ready
    assert.equal(events.at(-1).loaded, 3)
    assert.deepEqual(events.at(-1).failed, ["industrial-ac"])
    const batches = []
    root.traverse((object) => {
      if (object.isInstancedMesh) batches.push(object)
    })
    assert.deepEqual(batches.map((batch) => batch.count).sort(), [2, 6])
    assert.ok(root.children.length > 0)
    let disposedBatches = 0
    batches.forEach((batch) =>
      batch.addEventListener("dispose", () => disposedBatches++),
    )
    models.update(0.016)
    models.dispose()
    models.dispose()
    assert.equal(root.children.length, 0)
    assert.equal(disposedBatches, 2)
    sources.forEach(({ counts }) => assert.deepEqual(counts, [1, 1, 1]))
  } finally {
    GLTFLoader.prototype.loadAsync = original
  }
})
