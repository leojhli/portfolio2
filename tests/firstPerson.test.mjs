import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"
import { JSDOM } from "jsdom"
import * as THREE from "three"
let server, geometry, FirstPersonController, createDistrictAvatar
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  geometry = await server.ssrLoadModule("/src/three/walkGeometry.ts")
  ;({ FirstPersonController } = await server.ssrLoadModule(
    "/src/three/FirstPersonController.ts",
  ))
  ;({ createDistrictAvatar } = await server.ssrLoadModule(
    "/src/three/DistrictAvatar.ts",
  ))
})
after(async () => server?.close())
const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }
const near = (a, b, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(a - b) <= tolerance,
    `${a} should be within ${tolerance} of ${b}`,
  )
// Pure collision checks use a circle footprint, not only a camera point.
test("walker keeps body clearance at corners, solids and map edges", () => {
  const solid = [{ minX: 0, maxX: 1, minZ: 0, maxZ: 1 }]
  assert.equal(geometry.canStand({ x: -0.25, z: -0.25 }, solid, bounds), true)
  assert.equal(geometry.canStand({ x: -0.2, z: -0.2 }, solid, bounds), false)
  assert.equal(geometry.canStand({ x: 0.5, z: 0.5 }, solid, bounds), false)
  assert.equal(geometry.canStand({ x: 9.68, z: 0 }, [], bounds), true)
  assert.equal(geometry.canStand({ x: 9.69, z: 0 }, [], bounds), false)
  assert.equal(geometry.canStand({ x: NaN, z: 0 }, [], bounds), false)
})
test("large movement cannot tunnel through a thin wall and diagonal motion slides along it", () => {
  const wall = [{ minX: 0, maxX: 0.1, minZ: -8, maxZ: 8 }]
  const crossing = geometry.moveWalker({ x: -5, z: 0 }, 10, 0, wall, bounds)
  near(crossing.x, -0.32, 0.001)
  near(crossing.z, 0)
  assert.equal(geometry.canStand(crossing, wall, bounds), true)
  const sliding = geometry.moveWalker({ x: -2, z: -3 }, 3, 6, wall, bounds)
  near(sliding.x, -0.32, 0.001)
  near(sliding.z, 3)
  assert.equal(geometry.canStand(sliding, wall, bounds), true)
})
test("world bounds stop movement in both directions and invalid displacement is ignored", () => {
  for (const sign of [-1, 1]) {
    const stopped = geometry.moveWalker(
      { x: 0, z: 0 },
      20 * sign,
      20 * sign,
      [],
      bounds,
    )
    near(stopped.x, 9.68 * sign, 0.001)
    near(stopped.z, 9.68 * sign, 0.001)
    assert.equal(geometry.canStand(stopped, [], bounds), true)
  }
  const point = { x: 2, z: 3 }
  assert.deepEqual(geometry.moveWalker(point, NaN, 1, [], bounds), point)
  assert.deepEqual(geometry.moveWalker(point, 0, 0, [], bounds), point)
  assert.deepEqual(
    point,
    { x: 2, z: 3 },
    "movement must not mutate the caller's position",
  )
})
// DOM and pointer-lock methods are explicit doubles. These verify controller
// lifecycle and input, not browser permissions or rendered WebGL behavior.
function fixture() {
  const dom = new JSDOM(
    '<div id="host" tabindex="0"><button id="ui">Menu</button></div><input id="other">',
    { pretendToBeVisual: true },
  )
  const { window } = dom,
    { document } = window
  const prior = new Map()
  for (const [name, value] of Object.entries({
    window,
    document,
    CustomEvent: window.CustomEvent,
  })) {
    prior.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    })
  }
  const host = document.querySelector("#host"),
    ui = document.querySelector("#ui"),
    other = document.querySelector("#other")
  const camera = new THREE.PerspectiveCamera(65)
  const terrain = {
    colliders: [],
    walkBounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
    spawn: [0, 1.82, 12.2],
  }
  const locks = [],
    captures = new Set(),
    registrations = new Map()
  for (const target of [host, document, window]) {
    const listeners = new Map(),
      add = target.addEventListener.bind(target),
      remove = target.removeEventListener.bind(target)
    registrations.set(target, listeners)
    target.addEventListener = (type, listener, options) => {
      const group = listeners.get(type) ?? new Set()
      group.add(listener)
      listeners.set(type, group)
      add(type, listener, options)
    }
    target.removeEventListener = (type, listener, options) => {
      listeners.get(type)?.delete(listener)
      remove(type, listener, options)
    }
  }
  host.setPointerCapture = (id) => captures.add(id)
  host.hasPointerCapture = (id) => captures.has(id)
  host.releasePointerCapture = (id) => captures.delete(id)
  let lock = null,
    exits = 0
  Object.defineProperty(document, "pointerLockElement", {
    get: () => lock,
    configurable: true,
  })
  const setLock = (value) => {
    lock = value
    document.dispatchEvent(new window.Event("pointerlockchange"))
  }
  document.exitPointerLock = () => {
    exits++
    setLock(null)
  }
  const controller = new FirstPersonController(camera, host, terrain, (value) =>
    locks.push(value),
  )
  const key = (type, code, options = {}) => {
    const event = new window.KeyboardEvent(type, {
      code,
      key: code === "Escape" ? "Escape" : code,
      bubbles: true,
      cancelable: true,
      ...options,
    })
    window.dispatchEvent(event)
    return event
  }
  const pointer = (type, x, y, target = host, id = 1) => {
    const event = new window.MouseEvent(type, {
      clientX: x,
      clientY: y,
      bubbles: true,
    })
    Object.defineProperty(event, "pointerId", { value: id })
    target.dispatchEvent(event)
  }
  const advance = (count = 60) => {
    for (let i = 0; i < count; i++) controller.update(1 / 60)
  }
  return {
    window,
    document,
    host,
    ui,
    other,
    camera,
    controller,
    terrain,
    locks,
    captures,
    registrations,
    setLock,
    key,
    pointer,
    advance,
    get exits() {
      return exits
    },
    cleanup() {
      controller.dispose()
      dom.window.close()
      for (const [name, descriptor] of prior) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
        else delete globalThis[name]
      }
    },
  }
}
test("WASD requires scene focus; modifiers and UI typing do not drive the camera", () => {
  const f = fixture()
  try {
    f.controller.activate()
    f.other.focus()
    f.key("keydown", "KeyW")
    f.advance()
    near(f.camera.position.z, 12.2)
    f.host.focus()
    f.key("keydown", "KeyW", { ctrlKey: true })
    f.advance()
    near(f.camera.position.z, 12.2)
    assert.equal(f.key("keydown", "KeyW").defaultPrevented, true)
    f.advance()
    assert.ok(f.camera.position.z < 9)
    near(f.camera.position.y, 1.82)
    f.window.dispatchEvent(new f.window.Event("blur"))
    const stopped = f.camera.position.clone()
    f.advance()
    assert.deepEqual(
      f.camera.position.toArray(),
      stopped.toArray(),
      "tab/window blur clears held input and velocity",
    )
  } finally {
    f.cleanup()
  }
})
test("diagonal movement is normalized, Shift runs faster, and release decelerates to rest", () => {
  const distance = (keys) => {
    const f = fixture()
    try {
      f.controller.activate()
      f.host.focus()
      keys.forEach((code) => f.key("keydown", code))
      f.advance()
      const travelled = Math.hypot(
        f.camera.position.x,
        f.camera.position.z - 12.2,
      )
      keys.forEach((code) => f.key("keyup", code))
      f.advance()
      const stopped = f.camera.position.clone()
      f.advance()
      assert.ok(f.camera.position.distanceTo(stopped) < 0.001)
      return travelled
    } finally {
      f.cleanup()
    }
  }
  const forward = distance(["KeyW"]),
    diagonal = distance(["KeyW", "KeyD"]),
    running = distance(["KeyW", "ShiftLeft"])
  near(forward, diagonal)
  assert.ok(running > forward * 1.6)
})
test("touch movement uses collision and is cleared when the controller is suspended", () => {
  const f = fixture()
  try {
    f.terrain.colliders.push({ minX: -2, maxX: 2, minZ: 8, maxZ: 9 })
    f.controller.activate()
    f.controller.setTouch(0, 1)
    f.advance(180)
    near(f.camera.position.z, 9.32, 0.001)
    const walking = f.camera.position.clone()
    f.controller.suspend()
    f.camera.position.set(25, 18, 33) // an aerial camera may move independently
    f.advance()
    assert.deepEqual(f.camera.position.toArray(), [25, 18, 33])
    f.controller.activate()
    f.advance()
    assert.deepEqual(
      f.camera.position.toArray(),
      walking.toArray(),
      "resume returns to the saved walk position without held touch input",
    )
    f.controller.activate(true)
    assert.deepEqual(f.camera.position.toArray(), f.terrain.spawn)
  } finally {
    f.cleanup()
  }
})
test("pointer-lock denial preserves drag-look; button interactions do not rotate the scene", async () => {
  const f = fixture()
  try {
    f.controller.activate()
    f.host.requestPointerLock = async () => {
      throw new Error("permission denied")
    }
    await assert.rejects(f.controller.capture(), /permission denied/)
    f.pointer("pointerdown", 20, 20, f.ui)
    f.pointer("pointermove", 140, 20)
    f.advance()
    near(f.camera.rotation.y, 0)
    f.pointer("pointerdown", 20, 20)
    f.pointer("pointermove", 120, 60)
    f.pointer("pointerup", 120, 60)
    f.advance()
    assert.ok(f.camera.rotation.y < -0.2)
    assert.ok(f.camera.rotation.x < -0.05)
    assert.equal(f.captures.size, 0)
  } finally {
    f.cleanup()
  }
})
test("Escape releases mouse capture and clears movement without disposing exploration", async () => {
  const f = fixture()
  try {
    f.controller.activate()
    f.host.requestPointerLock = async () => f.setLock(f.host)
    await f.controller.capture()
    assert.equal(f.controller.locked, true)
    f.key("keydown", "KeyW")
    f.advance(10)
    const escape = f.key("keydown", "Escape")
    assert.equal(escape.defaultPrevented, true)
    assert.equal(f.controller.locked, false)
    assert.deepEqual(f.locks, [true, false])
    const stopped = f.camera.position.clone()
    f.advance()
    assert.deepEqual(f.camera.position.toArray(), stopped.toArray())
    f.key("keydown", "KeyA")
    f.advance()
    assert.ok(
      f.camera.position.x < stopped.x,
      "keyboard exploration still works after unlocking",
    )
  } finally {
    f.cleanup()
  }
})
test("a late pointer-lock resolution after disposal releases the lock and listeners stay removed", async () => {
  const f = fixture()
  try {
    let finish
    f.controller.activate()
    f.host.requestPointerLock = () =>
      new Promise((resolve) => {
        finish = () => {
          f.setLock(f.host)
          resolve()
        }
      })
    const pending = f.controller.capture()
    f.controller.dispose()
    const baseline = f.camera.position.clone()
    finish()
    await pending
    assert.equal(f.controller.locked, false)
    assert.equal(f.exits, 1)
    f.key("keydown", "KeyW")
    f.pointer("pointerdown", 0, 0)
    f.pointer("pointermove", 100, 0)
    f.advance()
    assert.deepEqual(f.camera.position.toArray(), baseline.toArray())
    for (const listeners of f.registrations.values()) {
      for (const [type, handlers] of listeners)
        assert.equal(handlers.size, 0, `${type} listener leaked`)
    }
    f.controller.dispose() // repeated teardown is harmless
  } finally {
    f.cleanup()
  }
})
test("suspending mid-drag releases pointer capture and hidden-document changes clear movement", () => {
  const f = fixture()
  try {
    f.controller.activate()
    f.host.focus()
    f.key("keydown", "KeyW")
    f.advance(10)
    f.document.dispatchEvent(new f.window.Event("visibilitychange"))
    const stopped = f.camera.position.clone()
    f.advance()
    assert.deepEqual(f.camera.position.toArray(), stopped.toArray())
    f.pointer("pointerdown", 20, 20)
    assert.equal(f.captures.size, 1)
    f.controller.suspend()
    assert.equal(
      f.captures.size,
      0,
      "suspension must release an in-progress drag capture",
    )
  } finally {
    f.cleanup()
  }
})
test("moving focus from the scene to a menu or text field stops held keyboard movement", () => {
  const f = fixture()
  try {
    f.controller.activate()
    f.host.focus()
    f.key("keydown", "KeyW")
    f.advance(10)
    f.ui.focus()
    const stopped = f.camera.position.clone()
    f.advance()
    assert.deepEqual(
      f.camera.position.toArray(),
      stopped.toArray(),
      "opening or tabbing to UI must clear the old held key",
    )
    f.other.focus()
    f.key("keydown", "KeyD")
    f.advance()
    assert.deepEqual(
      f.camera.position.toArray(),
      stopped.toArray(),
      "typing in UI must not move the scene",
    )
    f.host.focus()
    f.key("keydown", "ArrowRight")
    f.advance()
    assert.ok(f.camera.position.x > stopped.x)
  } finally {
    f.cleanup()
  }
})
test("tabbing or focusing controls releases mouse lock and never leaves movement active", async () => {
  const f = fixture()
  try {
    f.controller.activate()
    f.host.requestPointerLock = async () => f.setLock(f.host)
    await f.controller.capture()
    f.key("keydown", "KeyW")
    f.advance(10)
    f.key("keydown", "Tab", { key: "Tab" })
    assert.equal(f.controller.locked, false)
    f.ui.focus()
    const stopped = f.camera.position.clone()
    f.key("keydown", "KeyW")
    f.advance()
    assert.deepEqual(f.camera.position.toArray(), stopped.toArray())
    await f.controller.capture()
    f.other.focus()
    assert.equal(
      f.controller.locked,
      false,
      "direct focus changes also release capture",
    )
    f.key("keydown", "KeyD")
    f.advance()
    assert.deepEqual(f.camera.position.toArray(), stopped.toArray())
  } finally {
    f.cleanup()
  }
})

test("switching first/third person keeps the player's position and supports continued walking", () => {
  const f = fixture()
  try {
    f.controller.activate()
    f.host.focus()
    f.key("keydown", "KeyW")
    f.advance(30)
    f.key("keyup", "KeyW")
    f.advance(60)
    const before = f.controller.playerPosition
    f.controller.setPerspective("third")
    assert.deepEqual(f.controller.playerPosition.toArray(), before.toArray())
    near(f.camera.position.x - before.x, 0.4)
    near(f.camera.position.z - before.z, 3.2)
    near(f.camera.position.y - before.y, 0.68)
    assert.equal(f.controller.getAvatarPose().visible, true)
    near(f.controller.getAvatarPose().position.y, 0.12)
    const copy = f.controller.playerPosition
    copy.set(60, 60, 60)
    assert.deepEqual(f.controller.playerPosition.toArray(), before.toArray())
    f.key("keydown", "KeyW")
    f.advance(60)
    assert.ok(f.controller.playerPosition.z < before.z - 3)
    assert.ok(f.controller.getAvatarPose().speed > 3.4)
    assert.equal(f.controller.getAvatarPose().moving, true)
    const thirdPosition = f.controller.playerPosition
    f.controller.setPerspective("first")
    assert.deepEqual(f.camera.position.toArray(), thirdPosition.toArray())
    assert.deepEqual(
      f.controller.playerPosition.toArray(),
      thirdPosition.toArray(),
    )
    assert.equal(f.controller.getAvatarPose().visible, false)
    f.key("keyup", "KeyW")
    f.advance(90)
    assert.equal(f.controller.getAvatarPose().moving, false)
  } finally {
    f.cleanup()
  }
})

test("a third-person camera folds before a wall and never eases through it while turning", () => {
  const f = fixture()
  try {
    const wall = { minX: -3, maxX: 3, minZ: 13, maxZ: 14 }
    f.terrain.colliders.push(wall)
    f.controller.setPerspective("third")
    f.controller.activate()
    assert.ok(f.camera.position.z <= 12.8)
    assert.ok(f.camera.position.z > f.controller.playerPosition.z)
    assert.equal(
      f.controller.getAvatarPose().visible,
      false,
      "a near camera must not show the inside of the head",
    )
    f.pointer("pointerdown", 0, 0)
    for (let turn = 1; turn <= 9; turn++) {
      f.pointer("pointermove", turn * 150, 20)
      for (let frame = 0; frame < 18; frame++) {
        f.controller.update(1 / 60)
        const anchor = f.controller.playerPosition
        for (let sample = 1; sample <= 20; sample++) {
          const point = anchor.clone().lerp(f.camera.position, sample / 20)
          assert.equal(
            geometry.canStand(point, [wall], f.terrain.walkBounds, 0.19),
            true,
            "both the camera and its sight line need clearance while orbiting an obstruction",
          )
        }
      }
    }
    f.pointer("pointerup", 1350, 20)
    near(f.controller.playerPosition.z, 12.2)
    assert.equal(f.controller.getAvatarPose().visible, true)
  } finally {
    f.cleanup()
  }
})

test("third-person follow stays inside world bounds and avatar feet stop at solid walls", () => {
  const f = fixture()
  try {
    f.terrain.walkBounds.maxZ = 13
    f.terrain.colliders.push({ minX: -2, maxX: 2, minZ: 8, maxZ: 9 })
    f.controller.setPerspective("third")
    f.controller.activate()
    assert.ok(f.camera.position.z <= 12.8)
    f.controller.setTouch(0, 1)
    f.advance(180)
    near(f.controller.playerPosition.z, 9.32, 0.001)
    assert.equal(f.controller.getAvatarPose().moving, false)
    assert.equal(f.controller.getAvatarPose().speed, 0)
    near(f.controller.getAvatarPose().position.z, 9.32, 0.001)
    assert.ok(f.camera.position.z > f.controller.playerPosition.z + 3)
    assert.ok(f.camera.position.z <= 12.8)
  } finally {
    f.cleanup()
  }
})

test("suspending third person saves the walker rather than the trailing camera", () => {
  const f = fixture()
  try {
    f.controller.setPerspective("third")
    f.controller.activate()
    f.controller.setTouch(0.5, 1)
    f.advance()
    const player = f.controller.playerPosition
    f.controller.suspend()
    f.camera.position.set(25, 18, 33)
    f.advance()
    assert.deepEqual(f.controller.playerPosition.toArray(), player.toArray())
    assert.equal(f.controller.getAvatarPose().speed, 0)
    f.controller.activate()
    f.advance()
    assert.deepEqual(f.controller.playerPosition.toArray(), player.toArray())
    near(f.camera.position.z, player.z + 3.2)
    f.controller.setPerspective("first")
    assert.deepEqual(f.camera.position.toArray(), player.toArray())
    f.controller.activate(true)
    assert.deepEqual(f.controller.playerPosition.toArray(), f.terrain.spawn)
  } finally {
    f.cleanup()
  }
})

test("the original courier is human-scale, animates articulated joints and disposes each owned resource once", () => {
  const avatar = createDistrictAvatar()
  const scene = new THREE.Scene()
  scene.add(avatar.root)
  const box = new THREE.Box3().setFromObject(avatar.root)
  assert.ok(box.min.y >= -0.03)
  assert.ok(box.max.y > 1.7 && box.max.y < 1.85)
  const resources = new Map()
  let meshes = 0
  avatar.root.traverse((object) => {
    if (!object.isMesh) return
    meshes++
    for (const resource of [object.geometry, object.material]) {
      if (resources.has(resource)) continue
      resources.set(resource, 0)
      resource.addEventListener("dispose", () =>
        resources.set(resource, resources.get(resource) + 1),
      )
    }
  })
  assert.ok(
    meshes < 60,
    "static details should be batched within the animated joints",
  )
  const pose = {
    position: new THREE.Vector3(4, 0.12, -8),
    heading: Math.PI / 3,
    speed: 3.5,
    moving: true,
    visible: true,
  }
  for (let i = 0; i < 60; i++) avatar.update(pose, 1 / 60)
  assert.deepEqual(avatar.root.position.toArray(), pose.position.toArray())
  near(avatar.root.rotation.y, pose.heading)
  assert.equal(avatar.root.visible, true)
  const left = avatar.root.getObjectByName("courier-leg-0")
  const right = avatar.root.getObjectByName("courier-leg-1")
  assert.ok(Math.abs(left.rotation.x) > 0.2)
  near(left.rotation.x, -right.rotation.x)
  assert.ok(
    avatar.root.getObjectByName("courier-arm-0").rotation.x * left.rotation.x <
      0,
  )
  for (let i = 0; i < 90; i++)
    avatar.update({ ...pose, moving: false, speed: 0 }, 1 / 60)
  near(left.rotation.x, 0, 0.001)
  avatar.update({ ...pose, moving: false, speed: 0, visible: false }, 1 / 60)
  assert.equal(avatar.root.visible, false)
  avatar.dispose()
  avatar.dispose()
  assert.equal(avatar.root.parent, null)
  for (const count of resources.values()) assert.equal(count, 1)
})
