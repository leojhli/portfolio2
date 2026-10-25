import assert from "node:assert/strict"
import { before, after, test } from "node:test"
import { createServer } from "vite"
import * as THREE from "three"
let server, worldModule, soundModule
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  worldModule = await server.ssrLoadModule("/src/three/spiritWorld.ts")
  soundModule = await server.ssrLoadModule("/src/effects/gargantaSound.ts")
})
after(async () => server?.close())

test("courtyard retains named characters, bounded batched geometry and finite animation", () => {
  const scene = new THREE.Scene(),
    world = worldModule.createSpiritWorld(scene)
  assert.deepEqual(
    world.characters.map((c) => c.name),
    ["Ichigo", "Rukia", "Byakuya"],
  )
  let meshes = 0,
    triangles = 0
  scene.traverse((object) => {
    if (!object.isMesh) return
    meshes++
    const g = object.geometry
    triangles += (g.index?.count ?? g.attributes.position.count) / 3
    assert.ok([...g.attributes.position.array].every(Number.isFinite))
  })
  assert.ok(meshes < 100, `${meshes} meshes remain after static batching`)
  assert.ok(triangles > 1000 && triangles < 20000)
  for (const time of [0, 0.016, 2, 600]) world.update(time)
  scene.traverse((object) => {
    assert.ok(object.position.toArray().every(Number.isFinite))
    if (object.isPoints)
      assert.ok(
        [...object.geometry.attributes.position.array].every(Number.isFinite),
      )
    object.geometry?.dispose()
    if (Array.isArray(object.material))
      object.material.forEach((m) => m.dispose())
    else object.material?.dispose()
  })
})

test("Garganta slash, tear and crossing are staggered, bounded and cancellable", () => {
  const prior = globalThis.AudioContext,
    priorWindow = globalThis.window,
    sources = []
  let closed = false
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  })
  const source = () => {
    const node = {
      connect() {},
      start(t) {
        this.startAt = t
      },
      stop(t) {
        this.stopAt = t
      },
      frequency: param(),
    }
    sources.push(node)
    return node
  }
  globalThis.window = { setTimeout }
  globalThis.AudioContext = class {
    currentTime = 10
    sampleRate = 1000
    state = "running"
    destination = {}
    async resume() {}
    async close() {
      closed = true
      this.state = "closed"
    }
    createBuffer() {
      return {
        getChannelData() {
          return new Float32Array(2000)
        },
      }
    }
    createBufferSource() {
      return source()
    }
    createOscillator() {
      return source()
    }
    createGain() {
      return { gain: param(), connect() {} }
    }
    createBiquadFilter() {
      return { frequency: param(), Q: param(), connect() {} }
    }
  }
  try {
    const stop = soundModule.playGargantaSound()
    assert.equal(sources.length, 4)
    assert.ok(
      sources[0].startAt < sources[1].startAt &&
        sources[1].startAt < sources[2].startAt,
    )
    assert.ok(sources.every((s) => s.stopAt > s.startAt && s.stopAt <= 12.5))
    stop()
    assert.equal(closed, true)
    assert.ok(sources.every((s) => s.stopAt === undefined))
  } finally {
    globalThis.AudioContext = prior
    globalThis.window = priorWindow
  }
})
