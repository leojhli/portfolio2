import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { after, before, test } from "node:test"
import { createServer } from "vite"
import * as THREE from "three"

let server, createChoreography, durations, cuts, loadCloisterRunner, LEAP_START
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, logLevel: "silent" })
  ;({ createChoreography, CLOISTER_SHOT_CUTS: cuts, LEAP_START } = await server.ssrLoadModule("/src/three/cloisterChoreography.ts"))
  ;({ CLOISTER_SEGMENT_DURATIONS: durations } = await server.ssrLoadModule("/src/three/cloisterTimeline.ts"))
  ;({ loadCloisterRunner } = await server.ssrLoadModule("/src/three/cloisterRunner.ts"))
})
after(() => server?.close())
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`)
const snapshot = (pose) => ({
  position: pose.position.toArray(), camera: pose.camera.toArray(), target: pose.target.toArray(),
  yaw: pose.yaw, action: pose.action, actionTime: pose.actionTime, blend: pose.blend && { ...pose.blend },
  fov: pose.fov, framing: pose.framing, roll: pose.roll, bank: pose.bank, lean: pose.lean,
})

test("every chapter freezes mid-action and the following burst resumes exactly that frame", () => {
  for (const aspect of [16 / 9, 390 / 844]) {
    const sample = createChoreography()
    const expected = ["run", "vault", "climb", "leap"]
    for (let segment = 0; segment < 4; segment++) {
      const stop = snapshot(sample(segment, durations[segment], aspect))
      const start = snapshot(sample(segment + 1, 0, aspect))
      assert.equal(stop.action, expected[segment])
      assert.equal(start.action, stop.action)
      for (const key of ["position", "camera", "target"])
        stop[key].forEach((value, i) => near(value, start[key][i]))
      for (const key of ["yaw", "actionTime", "fov", "framing", "roll", "bank", "lean"])
        near(stop[key], start[key])
      assert.deepEqual(stop.blend, start.blend)
      assert.equal(sample(segment, durations[segment] + 100, aspect).motionBlur, 0)
    }
  }
})

test("the edit cuts the lens without cutting the continuous parkour route", () => {
  const sample = createChoreography()
  for (let segment = 0; segment < 4; segment++) {
    assert.ok(cuts[segment].length >= 4)
    for (const cut of cuts[segment].slice(1)) {
      const left = snapshot(sample(segment, cut - 1e-6, 16 / 9))
      const right = snapshot(sample(segment, cut, 16 / 9))
      assert.ok(new THREE.Vector3(...left.camera).distanceTo(new THREE.Vector3(...right.camera)) > .35)
      if (segment === 3 && cut === 3.1) continue // Deliberate roof ellipsis.
      assert.ok(new THREE.Vector3(...left.position).distanceTo(new THREE.Vector3(...right.position)) < .001)
      // A new action starts at zero weight, so its previous clip is still the
      // exact visible pose on the cut frame.
      const visible = right.blend?.weight > .999999
        ? { action: right.blend.action, time: right.blend.time }
        : { action: right.action, time: right.actionTime }
      assert.equal(left.action, visible.action)
      near(left.actionTime, visible.time, .0001)
    }
  }
})

test("fast travel uses calibrated sprint distance and remains deterministic across seeks", () => {
  const sample = createChoreography()
  const start = snapshot(sample(0, 0, 16 / 9))
  const end = snapshot(sample(0, durations[0], 16 / 9))
  const distance = end.position[0] - start.position[0]
  assert.ok(distance / durations[0] > 6.5, "the opening is a fast sprint through the arcade")
  near(end.actionTime - start.actionTime, distance / 8.8, .002)
  const held = snapshot(sample(2, 1.8, 16 / 9))
  sample(4, 4, .46)
  assert.deepEqual(snapshot(sample(2, 1.8, 16 / 9)), held)
  for (let segment = 0; segment < 5; segment++) {
    for (let t = 0; t <= durations[segment]; t += 1 / 60) {
      const pose = sample(segment, t, .46)
      assert.ok([...pose.position, ...pose.camera, ...pose.target, pose.yaw, pose.fov, pose.bank, pose.lean].every(Number.isFinite))
      assert.ok(Math.abs(pose.bank) <= .12 && pose.lean >= 0 && pose.lean <= .045)
    }
  }
})

test("corners remain continuous through stationary route keys instead of snapping the heading", () => {
  const sample = createChoreography()
  for (const segment of [1, 2]) {
    let previous
    for (let time = 0; time <= durations[segment]; time += 1 / 120) {
      const pose = sample(segment, time, 16 / 9)
      if (previous && pose.action === "run" && previous.action === "run") {
        const angle = Math.atan2(Math.sin(pose.yaw - previous.yaw), Math.cos(pose.yaw - previous.yaw))
        assert.ok(Math.abs(angle) < .07, "a corner cannot rotate the torso in one frame")
        if (pose.position.distanceTo(previous.position) < 1e-6)
          assert.ok(Math.abs(angle) < 1e-5, "a stopped path key must keep its heading")
      }
      previous = { action: pose.action, yaw: pose.yaw, position: pose.position.clone() }
    }
  }
})

test("the retimed vault still plants its palm and the mantle follows the authored one-metre rise", async (t) => {
  const bytes = await readFile(new URL("../public/models/cloister/altair.glb", import.meta.url))
  t.mock.method(globalThis, "fetch", async () => new Response(bytes))
  const stage = new THREE.Group()
  const runner = await loadCloisterRunner(stage)
  t.after(() => runner.dispose())
  const sample = createChoreography()
  const pose = sample(1, durations[1], 16 / 9, runner.actionDurations)
  stage.position.copy(pose.position)
  stage.rotation.y = pose.yaw
  runner.sample(pose.action, pose.actionTime, pose.blend)
  const wrist = runner.root.getObjectByName("hand_r").getWorldPosition(new THREE.Vector3())
  const knuckle = runner.root.getObjectByName("middle_01_r").getWorldPosition(new THREE.Vector3())
  near((wrist.y + knuckle.y) * .5, .87, .05)
  near(wrist.z, 8.35, .05)
  const climb = sample(2, durations[2], 16 / 9, runner.actionDurations)
  near(climb.position.y, .45 / .84)
  near(climb.position.x, 10.7 - 1.6 * .45 / .84)
  near(climb.actionTime / runner.actionDurations.climb, .45 / .84)
})

test("the leap freezes above the courtyard, resumes gravity, then cuts before impact to the complete aerial", () => {
  const sample = createChoreography()
  const frozen = snapshot(sample(3, durations[3], 16 / 9))
  near(frozen.actionTime, 1.25)
  near(frozen.position[1], LEAP_START.y + .65 - 4.905 * .65 ** 2)
  const falling = snapshot(sample(4, .4, 16 / 9))
  assert.ok(falling.position[1] < frozen.position[1])
  assert.ok(falling.position[0] < frozen.position[0])
  assert.equal(falling.action, "leap")
  assert.ok(sample(4, .549, 16 / 9).position.y > 1)
  assert.equal(sample(4, .55, 16 / 9).shotId, "4/aerial")
  const aerial = sample(4, durations[4], 390 / 844)
  assert.equal(aerial.aerialProgress, 1)
  assert.ok(aerial.camera.distanceTo(aerial.target) > 100)
  assert.equal(aerial.motionBlur, 0)
})

test("the leap slows in midair while the camera keeps moving, then accelerates into its frozen frame", () => {
  const sample = createChoreography()
  const speedAt = (time) => {
    const before = sample(3, time - .001, 16 / 9).actionTime
    return (sample(3, time + .001, 16 / 9).actionTime - before) / .002
  }
  const launchSpeed = speedAt(3.3)
  const suspendedSpeed = speedAt(4.05)
  const dropSpeed = speedAt(4.6)
  assert.ok(launchSpeed > 1)
  assert.ok(suspendedSpeed > .2 && suspendedSpeed < .5)
  assert.ok(dropSpeed > 1 && dropSpeed > suspendedSpeed * 3)
  const left = snapshot(sample(3, 3.9, 16 / 9))
  const right = snapshot(sample(3, 4.25, 16 / 9))
  const cameraOffset = (pose) => new THREE.Vector3(...pose.camera).sub(new THREE.Vector3(...pose.position))
  assert.ok(cameraOffset(left).distanceTo(cameraOffset(right)) > .2, "the lens moves independently of the slowed body")
  assert.ok(right.actionTime > left.actionTime, "slow motion is not another reading pause")
  let previous = 0
  for (let time = 3.1; time < durations[3]; time += 1 / 120) {
    const current = sample(3, time, 16 / 9).actionTime
    assert.ok(current >= previous && current - previous < .015, "the speed ramp never reverses or jumps ahead")
    previous = current
  }
})
