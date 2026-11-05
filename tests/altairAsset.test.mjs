import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { test } from "node:test"
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

test("the Altaïr adaptation retains all source triangles and has usable weights throughout every clip", async () => {
  const directory = new URL("../public/models/cloister/", import.meta.url)
  const manifest = JSON.parse(await readFile(new URL("altair-provenance.json", directory), "utf8"))
  const bytes = await readFile(new URL(manifest.file, directory))
  const license = await readFile(new URL("LICENSE-ALTAIR.txt", directory), "utf8")
  assert.ok(license.includes(manifest.source) && license.includes(manifest.author))
  assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.sha256)
  assert.ok(bytes.length < 2_000_000)
  const { scene, animations } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "",
  )
  const meshes = []
  scene.traverse((node) => { if (node.isMesh) meshes.push(node) })
  assert.equal(meshes.length, 14)
  assert.equal(meshes.reduce((total, mesh) => total + mesh.geometry.index.count / 3, 0), 23590)
  assert.deepEqual(animations.map((clip) => clip.name), manifest.clips)
  for (const mesh of meshes) {
    assert.ok(mesh.isSkinnedMesh)
    assert.equal(mesh.material.color.getHex(), 0)
    assert.equal(mesh.material.map, null)
    const { skinIndex, skinWeight } = mesh.geometry.attributes
    for (let i = 0; i < skinWeight.count; i++) {
      let total = 0
      for (let k = 0; k < 4; k++) {
        const weight = skinWeight.array[i * 4 + k]
        assert.ok(Number.isFinite(weight) && weight >= 0)
        assert.ok(skinIndex.array[i * 4 + k] < mesh.skeleton.bones.length)
        total += weight
      }
      assert.ok(Math.abs(total - 1) < 1e-6)
    }
  }
  const mixer = new THREE.AnimationMixer(scene)
  const point = new THREE.Vector3()
  for (const clip of animations) {
    const action = mixer.clipAction(clip).play()
    action.paused = true
    for (const fraction of [0, .25, .5, .75, .99]) {
      action.time = clip.duration * fraction
      mixer.update(0)
      scene.updateMatrixWorld(true)
      for (const mesh of meshes) {
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld)
          assert.ok(point.toArray().every(Number.isFinite), `${clip.name}: invalid skinned vertex`)
          assert.ok(point.length() < 5, `${clip.name}: detached geometry`)
        }
      }
    }
    action.stop()
  }
  mixer.uncacheRoot(scene)
})
