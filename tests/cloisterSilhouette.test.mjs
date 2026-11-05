import assert from "node:assert/strict"
import { test } from "node:test"
import * as THREE from "three"
import { createServer } from "vite"

test("the silhouette follows skinning and morphs, keeps the interior black, and releases only owned resources", async (t) => {
  const server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  t.after(() => server.close())
  const { applyCloisterSilhouette, CLOISTER_INK } = await server.ssrLoadModule(
    "/src/three/cloisterSilhouette.ts",
  )
  const geometry = new THREE.BoxGeometry(.4, 1.5, .3)
  const positions = geometry.getAttribute("position")
  const count = positions.count
  const indices = new Uint16Array(count * 4)
  const weights = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    indices[i * 4] = positions.getY(i) > 0 ? 1 : 0
    weights[i * 4] = 1
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4))
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4))
  geometry.morphTargetsRelative = true
  geometry.morphAttributes.position = [
    new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(.03), 3),
  ]
  const originalMaterial = new THREE.MeshBasicMaterial({ color: "#ed9a70", vertexColors: true })
  const mesh = new THREE.SkinnedMesh(geometry, originalMaterial)
  const hip = new THREE.Bone()
  const chest = new THREE.Bone()
  chest.position.y = .4
  hip.add(chest)
  mesh.add(hip)
  const skeleton = new THREE.Skeleton([hip, chest])
  mesh.bind(skeleton)
  mesh.morphTargetInfluences[0] = .6
  const group = new THREE.Group()
  group.add(mesh)
  const silhouette = applyCloisterSilhouette(group)
  t.after(() => silhouette.dispose())
  const hull = mesh.children.find(child => child.isSkinnedMesh)
  assert.ok(hull)
  assert.equal(mesh.material.color.getHex(), 0x000000)
  assert.equal(mesh.material.vertexColors, false)
  assert.equal(mesh.material.depthWrite, true)
  assert.equal(hull.material.color.getHexString(), CLOISTER_INK.slice(1))
  assert.equal(hull.material.side, THREE.BackSide)
  assert.equal(hull.skeleton, skeleton)
  assert.equal(hull.morphTargetInfluences, mesh.morphTargetInfluences)
  assert.ok(hull.renderOrder > mesh.renderOrder)

  group.position.set(12, 1, -9)
  group.rotation.y = .8
  mesh.scale.set(.9, 1.1, .9)
  chest.rotation.z = .4
  group.updateMatrixWorld(true)
  skeleton.update()
  assert.deepEqual(hull.matrixWorld.elements, mesh.matrixWorld.elements)
  for (let i = 0; i < count; i++) {
    const bodyPoint = new THREE.Vector3()
    const outlinePoint = new THREE.Vector3()
    mesh.getVertexPosition(i, bodyPoint)
    hull.getVertexPosition(i, outlinePoint)
    assert.ok(bodyPoint.distanceTo(outlinePoint) < 1e-9)
  }

  let sourceDisposals = 0
  geometry.addEventListener("dispose", () => sourceDisposals++)
  originalMaterial.addEventListener("dispose", () => sourceDisposals++)
  skeleton.addEventListener?.("dispose", () => sourceDisposals++)
  let contourDisposals = 0
  mesh.material.addEventListener("dispose", () => contourDisposals++)
  hull.material.addEventListener("dispose", () => contourDisposals++)
  silhouette.dispose()
  silhouette.dispose()
  assert.equal(mesh.material, originalMaterial)
  assert.equal(mesh.geometry, geometry)
  assert.equal(hull.parent, null)
  assert.equal(sourceDisposals, 0)
  assert.equal(contourDisposals, 2)
})

test("missing normals are generated on a temporary copy without altering the supplied asset", async (t) => {
  const server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  t.after(() => server.close())
  const { applyCloisterSilhouette } = await server.ssrLoadModule(
    "/src/three/cloisterSilhouette.ts",
  )
  const geometry = new THREE.BoxGeometry()
  geometry.deleteAttribute("normal")
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
  const silhouette = applyCloisterSilhouette(mesh)
  const copy = mesh.geometry
  assert.notEqual(copy, geometry)
  assert.ok(copy.getAttribute("normal"))
  assert.equal(geometry.getAttribute("normal"), undefined)
  let disposed = 0
  copy.addEventListener("dispose", () => disposed++)
  silhouette.dispose()
  silhouette.dispose()
  assert.equal(mesh.geometry, geometry)
  assert.equal(disposed, 1)
})
