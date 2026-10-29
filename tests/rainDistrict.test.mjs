import assert from "node:assert/strict"
import { before, after, test } from "node:test"
import { createServer } from "vite"
import * as THREE from "three"

let server, createRainDistrict, walking, playDistrictAmbience
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  ;({ createRainDistrict } = await server.ssrLoadModule(
    "/src/three/RainDistrict.ts",
  ))
  walking = await server.ssrLoadModule("/src/three/walkGeometry.ts")
  ;({ playDistrictAmbience } = await server.ssrLoadModule(
    "/src/effects/districtAmbience.ts",
  ))
})
after(async () => server?.close())

const localWorld = (reflections = false) => {
  const scene = new THREE.Scene()
  const world = createRainDistrict(scene, { assets: false, reflections })
  return { scene, world }
}

test("Rain District spawn connects to usable approaches for every terminal", async () => {
  const { world } = localWorld()
  try {
    await world.ready
    const { spawn, groundY, colliders, walkBounds, interactables } = world
    assert.ok(
      Math.abs(spawn[1] - groundY - 1.7) < 1e-8,
      "the camera and avatar share the walking surface",
    )
    assert.equal(interactables.length, 4)
    assert.equal(
      new Set(interactables.map((terminal) => terminal.name)).size,
      4,
    )
    assert.ok(colliders.length >= 12 && colliders.length < 100)
    for (const rect of [walkBounds, ...colliders]) {
      assert.ok(Object.values(rect).every(Number.isFinite))
      assert.ok(rect.minX < rect.maxX && rect.minZ < rect.maxZ)
    }
    const start = { x: spawn[0], z: spawn[2] }
    assert.equal(walking.canStand(start, colliders, walkBounds), true)
    assert.equal(
      walking.canStand({ x: 0, z: 0 }, colliders, walkBounds),
      false,
      "the rain collector has a physical footprint",
    )

    // Each BFS edge is checked with the real swept walker, not point occupancy only.
    const step = 0.5
    const queue = [{ x: 0, z: 0 }]
    const visited = new Set(["0,0"])
    const toWorld = (point) => ({
      x: start.x + point.x * step,
      z: start.z + point.z * step,
    })
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index]
      const point = toWorld(current)
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const next = { x: current.x + dx, z: current.z + dz }
        const key = `${next.x},${next.z}`
        if (visited.has(key)) continue
        const destination = toWorld(next)
        if (!walking.canStand(destination, colliders, walkBounds)) continue
        const moved = walking.moveWalker(
          point,
          dx * step,
          dz * step,
          colliders,
          walkBounds,
        )
        if (
          Math.hypot(moved.x - destination.x, moved.z - destination.z) > 0.00001
        )
          continue
        visited.add(key)
        queue.push(next)
      }
    }
    assert.ok(
      queue.length > 1000,
      "exploration has connected street space beyond the arrival point",
    )
    const reached = queue.map(toWorld)
    for (const terminal of interactables) {
      const target = { x: terminal.position.x, z: terminal.position.z }
      assert.equal(
        walking.canStand(target, colliders, walkBounds),
        false,
        `${terminal.name} is a solid object`,
      )
      assert.ok(
        reached.some(
          (point) =>
            Math.abs(point.x) < Math.abs(target.x) &&
            Math.hypot(point.x - target.x, point.z - target.z) < 1.25,
        ),
        `${terminal.name} has a reachable street-facing interaction approach`,
      )
    }
    assert.ok(
      reached.some((point) => point.z < -28),
      "the back end of the lane is reachable around the collector",
    )
  } finally {
    world.dispose()
  }
})

test("the procedural district stays within a batched geometry budget and animation remains finite", () => {
  const { scene, world } = localWorld()
  try {
    let meshes = 0,
      triangles = 0
    scene.traverse((object) => {
      if (!object.isMesh) return
      meshes++
      const geometry = object.geometry
      triangles +=
        ((geometry.index?.count ?? geometry.attributes.position.count) / 3) *
        (object.isInstancedMesh ? object.count : 1)
      for (const attribute of Object.values(geometry.attributes))
        assert.ok(
          attribute.array.every(Number.isFinite),
          `${object.name || object.type} geometry is finite`,
        )
    })
    assert.ok(
      meshes > 10 && meshes < 90,
      `${meshes} drawables should remain batched`,
    )
    assert.ok(
      triangles > 10000 && triangles < 90000,
      `${triangles} procedural triangles leave room for imported models`,
    )
    const rain = scene.getObjectByName("Rain threads")
    const tram = scene.getObjectByName("Last night tram")
    assert.ok(rain?.isLineSegments)
    assert.ok(tram?.isGroup)
    assert.ok(scene.getObjectByName("Rain loom / 天圆地方"))
    assert.equal(
      scene.getObjectByName("Rain-slick street reflection"),
      undefined,
    )
    const rainBuffer = rain.geometry.attributes.position.array
    assert.ok(rainBuffer.length >= 6000 && rainBuffer.length <= 18000)
    world.update(0)
    const tramStart = tram.position.clone()
    for (const time of [0.016, 2, 600, 1e6]) world.update(time)
    assert.ok(tram.position.distanceTo(tramStart) > 0.1)
    const valid = tram.position.clone()
    const validRainTime = rain.material.uniforms.time.value
    world.update(NaN)
    world.update(Infinity)
    assert.deepEqual(tram.position.toArray(), valid.toArray())
    assert.equal(rain.material.uniforms.time.value, validRainTime)
    assert.equal(
      rain.geometry.attributes.position.array,
      rainBuffer,
      "GPU rain reuses its particle buffer",
    )
    scene.updateMatrixWorld(true)
    scene.traverse((object) => {
      assert.ok(object.matrixWorld.elements.every(Number.isFinite))
      if (object.isInstancedMesh)
        assert.ok(
          object.instanceMatrix.array.every(Number.isFinite),
          `${object.name} instance transforms remain finite`,
        )
      for (const uniform of Object.values(object.material?.uniforms ?? {})) {
        if (typeof uniform.value === "number")
          assert.ok(Number.isFinite(uniform.value))
      }
    })
  } finally {
    world.dispose()
  }
})

for (const reflections of [false, true]) {
  test(`district teardown releases shared textures and GPU resources once (reflections ${
    reflections ? "on" : "off"
  })`, () => {
    const { scene, world } = localWorld(reflections)
    const resources = new Set()
    const reflection = scene.getObjectByName("Rain-slick street reflection")
    if (reflections) {
      assert.ok(reflection?.isReflector)
      const target = reflection.getRenderTarget()
      assert.ok(target.width <= 1024 && target.height <= 1024)
      resources.add(target)
      // Its attachment is released by WebGLRenderTarget.dispose, not Texture.dispose.
    } else assert.equal(reflection, undefined)
    const shaderBase = {
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    }
    scene.traverse((object) => {
      if (object.geometry) resources.add(object.geometry)
      if (object.isInstancedMesh) resources.add(object)
      for (const material of object.material
        ? Array.isArray(object.material)
          ? object.material
          : [object.material]
        : []) {
        resources.add(material)
        if (material.map) resources.add(material.map)
        const shader = { ...shaderBase, uniforms: {} }
        material.onBeforeCompile(shader, {})
        for (const uniform of Object.values(shader.uniforms))
          if (uniform.value?.isTexture) resources.add(uniform.value)
      }
    })
    assert.ok(
      [...resources].some((resource) => resource.isDataTexture),
      "surface grain is tracked with the visible materials",
    )
    const counts = new Map()
    for (const resource of resources) {
      counts.set(resource, 0)
      resource.addEventListener("dispose", () =>
        counts.set(resource, counts.get(resource) + 1),
      )
    }
    world.update(2)
    if (reflection) assert.ok(reflection.material.uniforms.time.value > 0)
    const tram = scene.getObjectByName("Last night tram")
    const position = tram.position.clone()
    world.dispose()
    world.dispose()
    world.update(200)
    assert.equal(scene.children.length, 0)
    assert.deepEqual(
      tram.position.toArray(),
      position.toArray(),
      "disposed animation is inert",
    )
    for (const [resource, count] of counts)
      assert.equal(
        count,
        1,
        `${resource.name || resource.type || "render target"} should release exactly once`,
      )
  })
}

function audioFixture({ denyResume = false, failAfter = Infinity } = {}) {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "AudioContext")
  const contexts = [],
    gains = [],
    sources = [],
    buffers = []
  const param = () => ({
    value: 0,
    events: [],
    setValueAtTime(value, time) {
      this.value = value
      this.events.push({ value, time })
    },
    linearRampToValueAtTime(value, time) {
      this.value = value
      this.events.push({ value, time })
    },
  })
  const node = () => ({
    connections: [],
    connect(next) {
      this.connections.push(next)
      return next
    },
  })
  const source = () => {
    const result = {
      ...node(),
      frequency: param(),
      starts: 0,
      stops: 0,
      start() {
        this.starts++
      },
      stop() {
        this.stops++
      },
    }
    sources.push(result)
    return result
  }
  globalThis.AudioContext = class {
    currentTime = 10
    sampleRate = 1000
    state = "suspended"
    destination = node()
    closes = 0
    constructor() {
      contexts.push(this)
    }
    async resume() {
      if (denyResume) throw new Error("audio is unavailable")
      this.state = "running"
    }
    async close() {
      this.closes++
      this.state = "closed"
    }
    createGain() {
      const result = { ...node(), gain: param() }
      gains.push(result)
      return result
    }
    createBuffer(channels, length, sampleRate) {
      const values = new Float32Array(length)
      const result = {
        channels,
        length,
        sampleRate,
        values,
        getChannelData: () => values,
      }
      buffers.push(result)
      return result
    }
    createBufferSource() {
      return source()
    }
    createOscillator() {
      if (sources.length >= failAfter) throw new Error("audio device failed")
      return source()
    }
    createBiquadFilter() {
      return { ...node(), frequency: param(), Q: param() }
    }
  }
  return {
    contexts,
    gains,
    sources,
    buffers,
    restore() {
      if (prior) Object.defineProperty(globalThis, "AudioContext", prior)
      else delete globalThis.AudioContext
    },
  }
}

test("district ambience fades in at bounded gain and closes all running sources once", () => {
  const f = audioFixture()
  try {
    const stop = playDistrictAmbience()
    assert.equal(f.contexts.length, 1)
    assert.equal(f.sources.length, 3)
    assert.ok(f.sources.every((source) => source.starts === 1))
    assert.equal(f.sources[0].loop, true)
    assert.equal(f.buffers.length, 1)
    assert.ok(
      f.buffers[0].values.every(
        (value) => Number.isFinite(value) && value >= -1 && value <= 1,
      ),
    )
    assert.ok(
      f.buffers[0].length <= f.buffers[0].sampleRate * 5,
      "rain uses a short looping buffer",
    )
    assert.ok(
      f.gains.every((gain) => gain.gain.value >= 0 && gain.gain.value <= 0.35),
    )
    const fade = f.gains[0].gain.events
    assert.equal(fade[0].value, 0)
    assert.ok(fade[1].value > 0 && fade[1].time > fade[0].time)
    assert.ok(fade[1].time - fade[0].time >= 0.5)
    const combinedPeak =
      f.gains[0].gain.value *
      f.gains.slice(1).reduce((sum, gain) => sum + gain.gain.value, 0)
    assert.ok(
      combinedPeak < 0.15,
      "combined full-scale oscillators and rain cannot clip the master",
    )
    stop()
    stop()
    assert.equal(f.contexts[0].closes, 1)
    assert.equal(f.contexts[0].state, "closed")
    assert.ok(f.sources.every((source) => source.stops === 1))
  } finally {
    f.restore()
  }
})

test("audio denial and partial construction failure clean up without escaping into the page", async () => {
  for (const options of [{ denyResume: true }, { failAfter: 1 }]) {
    const f = audioFixture(options)
    try {
      const stop = playDistrictAmbience()
      await Promise.resolve()
      await Promise.resolve()
      stop()
      assert.equal(f.contexts[0].closes, 1)
      assert.ok(f.sources.every((source) => source.stops === 1))
    } finally {
      f.restore()
    }
  }
  const prior = Object.getOwnPropertyDescriptor(globalThis, "AudioContext")
  try {
    delete globalThis.AudioContext
    const stop = playDistrictAmbience()
    assert.doesNotThrow(() => {
      stop()
      stop()
    })
  } finally {
    if (prior) Object.defineProperty(globalThis, "AudioContext", prior)
  }
})
