import assert from "node:assert/strict"
import { test } from "node:test"
import * as THREE from "three"
import { createServer } from "vite"

async function fixture(t) {
  const server = await createServer({ server: { middlewareMode: true }, logLevel: "silent" })
  t.after(() => server.close())
  const { createCloisterInk } = await server.ssrLoadModule("/src/three/cloisterInk.ts")
  const calls = [], targets = new Set()
  let destination = null, width = 1280, height = 720
  const renderer = {
    capabilities: { maxSamples: 4 },
    getSize(out) { return out.set(width, height) },
    getDrawingBufferSize(out) { return out.set(width * 1.5, height * 1.5) },
    getRenderTarget() { return destination },
    setRenderTarget(target) { destination = target; if (target) targets.add(target) },
    render(object, camera) {
      calls.push({ object, camera, destination,
        shutter: object.material?.uniforms?.shutter.value,
        previous: object.material?.uniforms?.previousViewProjection.value.clone(),
        currentInverse: object.material?.uniforms?.inverseViewProjection.value.clone(),
      })
    },
  }
  const ink = createCloisterInk(renderer)
  t.after(() => ink.dispose())
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, width / height, .07, 340)
  camera.position.set(0, 1, 5)
  return { ink, scene, camera, calls, targets, renderer,
    resize() { width = 800; height = 600; camera.aspect = width / height; camera.updateProjectionMatrix() },
  }
}

test("motion blur resets at cuts and resize, and frozen frames render without a depth target", async (t) => {
  const f = await fixture(t)
  const frame = { motionBlur: .8, deltaSeconds: 1 / 60, reset: true }
  f.ink.render(f.scene, f.camera, 0, frame)
  assert.equal(f.calls.at(-1).shutter, 0)
  const target = [...f.targets][0]
  assert.ok(target.depthTexture?.isDepthTexture)
  assert.equal(target.resolveDepthBuffer, true)
  let released = 0
  target.addEventListener("dispose", () => released++)
  f.camera.position.x += .1
  f.ink.render(f.scene, f.camera, 0, { ...frame, reset: false })
  assert.ok(f.calls.at(-1).shutter > 0)
  f.camera.position.x += 20
  f.ink.render(f.scene, f.camera, 0, frame)
  assert.equal(f.calls.at(-1).shutter, 0, "hard cut has no old-camera exposure")
  f.resize()
  f.ink.render(f.scene, f.camera, 0, { ...frame, reset: false })
  assert.equal(f.calls.at(-1).shutter, 0, "resizing cannot streak from the old projection")
  const before = f.calls.length
  f.ink.render(f.scene, f.camera, 0, { ...frame, motionBlur: 0 })
  assert.equal(f.calls.length, before + 1)
  assert.equal(f.calls.at(-1).object, f.scene)
  assert.equal(f.calls.at(-1).destination, null)
  assert.equal(released, 2, "resize deallocates once; freeze releases the resized target")
  f.ink.render(f.scene, f.camera, 1)
  const aerial = [...f.targets].at(-1)
  assert.equal(aerial.depthTexture, null)
  assert.equal(aerial.resolveDepthBuffer, false)
  assert.equal(f.calls.at(-1).shutter, 0)
  f.ink.dispose()
  f.ink.dispose()
  assert.equal(released, 2)
})

test("camera shutter length is independent of frame rate and invalid frame times stay sharp", async (t) => {
  const f = await fixture(t)
  const lengths = []
  for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    f.camera.position.x = 0
    f.ink.render(f.scene, f.camera, 0, { motionBlur: 1, deltaSeconds: dt, reset: true })
    f.camera.position.x = 4 * dt
    f.ink.render(f.scene, f.camera, 0, { motionBlur: 1, deltaSeconds: dt, reset: false })
    const pass = f.calls.at(-1)
    const point = new THREE.Vector3(0, 1, -3)
    const old = point.clone().applyMatrix4(pass.previous)
    const current = point.clone().applyMatrix4(pass.currentInverse.clone().invert())
    lengths.push(Math.abs(current.x - old.x) * .5 * pass.shutter)
  }
  assert.ok(lengths.every(value => Math.abs(value - lengths[0]) < 1e-10))
  for (const deltaSeconds of [0, -.01, NaN, Infinity, .5]) {
    f.ink.render(f.scene, f.camera, 0, { motionBlur: 1, deltaSeconds, reset: false })
    assert.equal(f.calls.at(-1).shutter, 0)
  }
})
