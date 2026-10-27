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
    triangles +=
      ((g.index?.count ?? g.attributes.position.count) / 3) *
      (object.isInstancedMesh ? object.count : 1)
    assert.ok([...g.attributes.position.array].every(Number.isFinite))
  })
  assert.ok(meshes < 100, `${meshes} meshes remain after static batching`)
  assert.ok(
    triangles > 150000 && triangles < 225000,
    `${triangles} triangles stay within the detailed city budget`,
  )
  for (const time of [0, 0.016, 2, 600]) world.update(time)
  scene.traverse((object) => {
    assert.ok(object.position.toArray().every(Number.isFinite))
    if (object.isPoints)
      assert.ok(
        [...object.geometry.attributes.position.array].every(Number.isFinite),
      )
  })
  world.dispose()
})
test("first-person spawn and landmark approaches connect through the city streets", () => {
  const scene = new THREE.Scene()
  const world = worldModule.createSpiritWorld(scene)
  const { colliders, walkBounds, spawn, groundY } = world
  assert.equal(groundY, 0.12)
  assert.ok(Math.abs(spawn[1] - groundY - 1.7) < 1e-8)
  assert.ok(colliders.length > 60 && colliders.length < 200)
  for (const bounds of [walkBounds, ...colliders]) {
    assert.ok(Object.values(bounds).every(Number.isFinite))
    assert.ok(bounds.minX < bounds.maxX && bounds.minZ < bounds.maxZ)
  }
  const radius = 0.32
  const canStand = (x, z) =>
    x >= walkBounds.minX + radius &&
    x <= walkBounds.maxX - radius &&
    z >= walkBounds.minZ + radius &&
    z <= walkBounds.maxZ - radius &&
    !colliders.some(
      (b) =>
        x > b.minX - radius &&
        x < b.maxX + radius &&
        z > b.minZ - radius &&
        z < b.maxZ + radius,
    )
  assert.ok(
    canStand(spawn[0], spawn[2]),
    "arrival position does not intersect an obstacle",
  )
  // Occupancy checks cover the halls, tower, pond and original cherry trunk.
  for (const [x, z] of [
    [-10, -2],
    [10, -3],
    [0, -8],
    [8, 8],
    [-8, 8],
  ])
    assert.equal(canStand(x, z), false, `${x}, ${z} is solid`)
  const queue = [[Math.round(spawn[0] * 2), Math.round(spawn[2] * 2)]]
  const visited = new Set([queue[0].join(",")])
  for (let index = 0; index < queue.length; index++) {
    const [x, z] = queue[index]
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = [x + dx, z + dz],
        key = next.join(",")
      if (visited.has(key) || !canStand(next[0] / 2, next[1] / 2)) continue
      visited.add(key)
      queue.push(next)
    }
  }
  for (const [name, x, z] of [
    ["training hall", -10, 2.5],
    ["archive", 10, 2.5],
    ["garden", -6, 10.5],
    ["return gate", 0, 15.5],
    ["west gate", -17, 8],
    ["east gate", 17, 8],
    ["west street", -17, -18],
    ["east street", 17, -18],
    ["rear street", 0, -17],
  ])
    assert.ok(
      visited.has(`${x * 2},${z * 2}`),
      `${name} is reachable from the arrival gate`,
    )
  world.dispose()
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

test("detailed city releases instanced foliage, shared maps and GPU resources exactly once", () => {
  const scene = new THREE.Scene(),
    world = worldModule.createSpiritWorld(scene)
  const resources = new Set(),
    textures = new Set()
  let leaves = 0
  const shaderBase = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  }
  scene.traverse((object) => {
    if (object.geometry) resources.add(object.geometry)
    if (object.isInstancedMesh) {
      resources.add(object)
      leaves += object.count
    }
    for (const material of object.material
      ? Array.isArray(object.material)
        ? object.material
        : [object.material]
      : []) {
      resources.add(material)
      if (material.map) textures.add(material.map)
      const shader = { ...shaderBase, uniforms: {} }
      material.onBeforeCompile(shader, {})
      for (const value of Object.values(shader.uniforms))
        if (value.value?.isTexture) textures.add(value.value)
    }
  })
  assert.ok(leaves > 8000 && leaves < 12000)
  assert.equal(
    textures.size,
    3,
    "surface grain, leaf silhouette and a shared glow map",
  )
  assert.ok(scene.getObjectByName("Atmospheric sky"))
  assert.ok(scene.getObjectByName("Reishi motes"))
  textures.forEach((texture) => resources.add(texture))
  const counts = new Map()
  resources.forEach((resource) => {
    counts.set(resource, 0)
    resource.addEventListener("dispose", () =>
      counts.set(resource, counts.get(resource) + 1),
    )
  })
  world.update(2)
  world.update(NaN)
  world.dispose()
  world.dispose()
  world.update(600)
  assert.equal(scene.children.length, 0)
  for (const [resource, count] of counts)
    assert.equal(
      count,
      1,
      `${resource.name || resource.type} resource must be disposed once`,
    )
})
