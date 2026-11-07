import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import * as THREE from "three"
import { createServer } from "vite"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

test("the Leap of Faith opens both arms, closes the boots, and dives forward without changing the bind pose", async (t) => {
  const server = await createServer({ server: { middlewareMode: true }, logLevel: "silent" })
  t.after(() => server.close())
  const { createLeapClip, LEAP_FREEZE_TIME } = await server.ssrLoadModule("/src/three/cloisterLeap.ts")
  const { loadCloisterRunner } = await server.ssrLoadModule("/src/three/cloisterRunner.ts")
  const bytes = await readFile(new URL("../public/models/cloister/altair.glb", import.meta.url))
  const { scene, animations } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "",
  )
  const before = []
  scene.traverse((node) => { if (node.isBone) before.push([node, node.position.clone(), node.quaternion.clone()]) })
  const clip = createLeapClip(scene, animations)
  assert.equal(clip.name, "leap")
  assert.equal(clip.duration, 2.4)
  for (const [node, position, quaternion] of before) {
    assert.ok(node.position.equals(position) && node.quaternion.equals(quaternion), "baking must not mutate the loaded rig")
  }
  t.mock.method(globalThis, "fetch", async () => new Response(bytes))
  const actor = await loadCloisterRunner(new THREE.Group())
  t.after(() => actor.dispose())
  const joint = (name) => actor.root.getObjectByName(name).getWorldPosition(new THREE.Vector3())
  actor.sample("leap", LEAP_FREEZE_TIME)
  const left = joint("hand_l"), right = joint("hand_r"), head = joint("Head"), hip = joint("pelvis")
  assert.ok(left.distanceTo(right) > 1.2, "the two arms form a wide recognizable silhouette")
  assert.ok(Math.abs(left.y - right.y) < .025, "the arms spread symmetrically")
  assert.ok(joint("ball_l").distanceTo(joint("ball_r")) < .22, "boots stay close during the dive")
  assert.ok(head.z < hip.z - .5, "the torso leans forward into flight instead of floating upright")
  assert.ok(Math.abs(head.y - hip.y) < .1, "the frozen silhouette is nearly prone")

  actor.sample("run", .2)
  actor.sample("vault", .4, { action: "leap", time: .5, weight: .3 })
  actor.sample("leap", LEAP_FREEZE_TIME)
  assert.ok(joint("hand_l").distanceTo(left) < 1e-6, "seeking restores the identical frozen pose after another action")
  actor.sample("leap", 2.3)
  assert.ok(joint("Head").y < joint("pelvis").y - .45, "the open flight tips into a headfirst dive")
  for (const time of [0, .1, .18, .25, .35, .45, .5]) {
    actor.sample("leap", time)
    assert.ok(Math.abs(joint("ball_l").y - .0235) < .04, "left boot remains on the ledge during anticipation")
    assert.ok(Math.abs(joint("ball_r").y - .0235) < .04, "right boot remains on the ledge during anticipation")
  }

  const point = new THREE.Vector3()
  for (const time of [0, .18, .35, .6, LEAP_FREEZE_TIME, 1.7, 2.4]) {
    actor.sample("leap", time)
    actor.root.updateMatrixWorld(true)
    actor.root.traverse((mesh) => {
      if (!mesh.isSkinnedMesh || mesh.name.endsWith(" / contour")) return
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld)
        assert.ok(point.toArray().every(Number.isFinite) && point.length() < 4, "all character parts remain attached during flight")
      }
    })
  }
})
