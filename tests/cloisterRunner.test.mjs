import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import * as THREE from "three"
import { createServer } from "vite"

test("the shipped runner can seek and blend real poses, with a planted hand on the vault rail", async (t) => {
  const server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  t.after(() => server.close())
  const { loadCloisterRunner } = await server.ssrLoadModule(
    "/src/three/cloisterRunner.ts",
  )
  const bytes = await readFile(
    new URL("../public/models/cloister/altair.glb", import.meta.url),
  )
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, "/models/cloister/altair.glb")
    return new Response(bytes)
  })
  const stage = new THREE.Group()
  const actor = await loadCloisterRunner(stage)
  t.after(() => actor.dispose())
  const joint = (name) =>
    actor.root.getObjectByName(name).getWorldPosition(new THREE.Vector3())
  actor.sample("run", 0.13)
  const foot = joint("ball_l")
  actor.sample("run", 0.45)
  assert.ok(
    joint("ball_l").distanceTo(foot) > 0.4,
    "the stride must move the foot",
  )
  actor.sample("idle", 0.75, { action: "climb", time: 0.22, weight: 0.7 })
  actor.sample("run", 0.13)
  assert.ok(
    joint("ball_l").distanceTo(foot) < 1e-6,
    "seeking must restore the same pose after a blend",
  )

  for (const t of [0.35, 0.4, 0.45, 0.5]) {
    actor.root.position.set(0, 0.3 * Math.sin(Math.PI * t), (0.5 - t) * 1.8)
    actor.sample("vault", t)
    const wrist = joint("hand_r")
    const knuckle = joint("middle_01_r")
    assert.ok(
      Math.abs((wrist.y + knuckle.y) * 0.5 - 0.87) < 0.05,
      "palm meets the rail top",
    )
    assert.ok(
      Math.abs(wrist.z) < 0.05,
      "planted wrist stays at the rail along the route",
    )
    assert.ok(
      Math.min(joint("ball_l").y, joint("ball_r").y) > 0.94,
      "feet clear the rail",
    )
  }
  actor.dispose()
  assert.equal(stage.children.length, 0)
})
