import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server, liquid
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  liquid = await server.ssrLoadModule("/src/effects/liquidGeometry.ts")
})
after(async () => server?.close())

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected}`,
  )

test("the cursor has a stable circular barrier and a strictly local influence", () => {
  const pointer = { x: 240, y: 180 }
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 17) {
    for (let radius = 0; radius <= liquid.LIQUID_INFLUENCE; radius += 2) {
      const home = {
        x: pointer.x + Math.cos(angle) * radius,
        y: pointer.y + Math.sin(angle) * radius,
      }
      const target = liquid.liquidTarget(home, pointer)
      assert.ok(Number.isFinite(target.x) && Number.isFinite(target.y))
      assert.ok(distance(target, pointer) >= liquid.LIQUID_RADIUS - 1e-8)
      assert.ok(distance(target, pointer) >= radius - 1e-8)
    }
  }
  for (const x of [104, 105, 500, -104, -105, -500]) {
    const home = { x, y: 0 }
    assert.deepEqual(liquid.liquidTarget(home, { x: 0, y: 0 }), home)
  }
  const home = { x: 12, y: 20 }
  assert.deepEqual(liquid.liquidTarget(home, null), home)
  assert.deepEqual(liquid.liquidTarget(home, pointer, 0), home)
})

test("the exact centre is finite, deterministic and has no time-based pulse", () => {
  const home = { x: 12, y: 20 },
    pointer = { ...home },
    target = liquid.liquidTarget(home, pointer)
  assert.deepEqual(target, { x: 60, y: 20 })
  for (let frame = 0; frame < 500; frame++)
    assert.deepEqual(liquid.liquidTarget(home, pointer), target)
  assert.deepEqual(
    liquid.liquidTarget(home, { ...pointer, vx: NaN, vy: Infinity }),
    target,
  )
})

test("pointer travel adds bounded tangent flow without pulling pixels into the barrier", () => {
  const home = { x: 24, y: 0 },
    still = liquid.liquidTarget(home, { x: 0, y: 0 }),
    flowing = liquid.liquidTarget(home, { x: 0, y: 0, vx: 0, vy: 700 }),
    capped = liquid.liquidTarget(home, { x: 0, y: 0, vx: 0, vy: 70000 })
  assert.equal(flowing.x, still.x)
  assert.ok(flowing.y > 0 && flowing.y <= 12)
  assert.ok(distance(flowing, { x: 0, y: 0 }) >= liquid.LIQUID_RADIUS)
  assert.ok(capped.y <= 12)
  assert.deepEqual(
    liquid.liquidTarget({ x: 104, y: 0 }, { x: 0, y: 0, vx: 1e6, vy: 1e6 }),
    { x: 104, y: 0 },
  )
})

test("critical damping follows the same trajectory at 30, 60 and 120 fps", () => {
  const target = { x: 48, y: -20 },
    initial = { x: 0, y: 0, vx: 0, vy: 0 },
    results = []
  for (const fps of [30, 60, 120]) {
    let particle = { ...initial }
    for (let frame = 0; frame < fps / 5; frame++)
      particle = liquid.stepLiquid(particle, target, 1 / fps)
    results.push(particle)
  }
  for (const particle of results.slice(1))
    for (const key of ["x", "y", "vx", "vy"])
      near(particle[key], results[0][key])
  const singleStep = liquid.stepLiquid(initial, target, 0.2)
  for (const key of ["x", "y", "vx", "vy"])
    near(results[0][key], singleStep[key])
})

test("a held pointer settles without oscillation and release returns exactly home", () => {
  const home = { x: 10, y: -10 },
    target = liquid.liquidTarget(home, { x: 0, y: 0 })
  let particle = { ...home, vx: 0, vy: 0 },
    lastDistance = Infinity
  for (let frame = 0; frame < 240; frame++) {
    particle = liquid.stepLiquid(particle, target, 1 / 60)
    const remaining = distance(particle, target)
    assert.ok(remaining <= lastDistance + 1e-8)
    assert.ok(particle.x <= target.x + 1e-8)
    assert.ok(particle.y >= target.y - 1e-8)
    lastDistance = remaining
  }
  assert.deepEqual(particle, { ...target, vx: 0, vy: 0 })
  for (let frame = 0; frame < 240; frame++)
    particle = liquid.stepLiquid(particle, home, 1 / 60)
  assert.deepEqual(particle, { ...home, vx: 0, vy: 0 })
  assert.deepEqual(liquid.stepLiquid(particle, home, 1 / 60), particle)
})

test("invalid or paused frame durations preserve finite state", () => {
  const particle = { x: 10, y: -10, vx: 5, vy: 12 },
    target = { x: 100, y: 80 }
  for (const dt of [0, -1, NaN, Infinity])
    assert.deepEqual(liquid.stepLiquid(particle, target, dt), particle)
  assert.deepEqual(liquid.stepLiquid(particle, target, 30), {
    ...target,
    vx: 0,
    vy: 0,
  })
  assert.deepEqual(particle, { x: 10, y: -10, vx: 5, vy: 12 })
})

test("circle collisions retain tangent velocity and remove inward velocity", () => {
  const pointer = { x: 0, y: 0 },
    particle = { x: 12, y: 0, vx: -40, vy: 15 }
  assert.deepEqual(liquid.constrainLiquid(particle, pointer), {
    x: 48,
    y: 0,
    vx: 0,
    vy: 15,
  })
  assert.deepEqual(liquid.constrainLiquid({ ...particle, vx: 40 }, pointer), {
    x: 48,
    y: 0,
    vx: 40,
    vy: 15,
  })
  assert.deepEqual(liquid.constrainLiquid(particle, null), particle)
  assert.deepEqual(liquid.constrainLiquid(particle, pointer, 0), particle)
  assert.deepEqual(
    liquid.constrainLiquid({ x: 0, y: 0, vx: -4, vy: 3 }, pointer),
    {
      x: 48,
      y: 0,
      vx: 0,
      vy: 3,
    },
  )
})

test("a pointer crossing a home point cannot drag spring particles through its circle", () => {
  const home = { x: 0, y: 0 }
  let particle = { ...home, vx: 0, vy: 0 }
  for (let x = -140; x <= 140; x += 2) {
    const pointer = { x, y: 0, vx: 120, vy: 0 },
      target = liquid.liquidTarget(home, pointer)
    particle = liquid.constrainLiquid(
      liquid.stepLiquid(particle, target, 1 / 60),
      pointer,
    )
    assert.ok(Object.values(particle).every(Number.isFinite))
    assert.ok(distance(particle, pointer) >= liquid.LIQUID_RADIUS - 1e-8)
  }
  for (let frame = 0; frame < 240; frame++)
    particle = liquid.stepLiquid(particle, home, 1 / 60)
  assert.deepEqual(particle, { ...home, vx: 0, vy: 0 })
})

test("optional output buffers reuse objects and remain safe when inputs alias them", () => {
  const home = { x: 12, y: 8 },
    pointer = { x: 0, y: 0, vx: 30, vy: 90 },
    expectedTarget = liquid.liquidTarget(home, pointer),
    targetBuffer = { x: 999, y: 999 }
  assert.equal(
    liquid.liquidTarget(home, pointer, 48, 104, targetBuffer),
    targetBuffer,
  )
  assert.deepEqual(targetBuffer, expectedTarget)
  const aliasedHome = { ...home }
  assert.equal(
    liquid.liquidTarget(aliasedHome, pointer, 48, 104, aliasedHome),
    aliasedHome,
  )
  assert.deepEqual(aliasedHome, expectedTarget)
  assert.deepEqual(home, { x: 12, y: 8 })
  assert.notEqual(liquid.liquidTarget(home, null), home)

  const initial = { x: 3, y: -4, vx: 5, vy: 12 },
    expectedStep = liquid.stepLiquid(initial, expectedTarget, 1 / 60),
    stateBuffer = { ...initial }
  assert.equal(
    liquid.stepLiquid(stateBuffer, expectedTarget, 1 / 60, 22, stateBuffer),
    stateBuffer,
  )
  assert.deepEqual(stateBuffer, expectedStep)
  assert.deepEqual(initial, { x: 3, y: -4, vx: 5, vy: 12 })
  assert.equal(
    liquid.stepLiquid(stateBuffer, expectedTarget, 0, 22, stateBuffer),
    stateBuffer,
  )
  assert.deepEqual(stateBuffer, expectedStep)
  assert.notEqual(liquid.stepLiquid(initial, expectedTarget, 0), initial)

  const colliding = { x: 12, y: 0, vx: -40, vy: 15 },
    expectedCollision = liquid.constrainLiquid(colliding, pointer)
  assert.equal(
    liquid.constrainLiquid(colliding, pointer, 48, colliding),
    colliding,
  )
  assert.deepEqual(colliding, expectedCollision)
  assert.equal(
    liquid.constrainLiquid(colliding, null, 48, colliding),
    colliding,
  )
  assert.deepEqual(colliding, expectedCollision)
  assert.notEqual(liquid.constrainLiquid(colliding, null), colliding)
})
