import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server, liquid
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  liquid = await server.ssrLoadModule("/src/effects/liquid.ts")
})
after(async () => server?.close())

const cover = "#222"
const ink = "#eee"
const sample = (x, y, size = 2, alpha = 1) => ({
  x,
  y,
  size,
  alpha,
  rank: 1,
  color: ink,
})

function context() {
  const calls = [],
    stack = []
  return {
    calls,
    fillStyle: "",
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    save() {
      stack.push([this.fillStyle, this.globalAlpha, this.imageSmoothingEnabled])
    },
    restore() {
      ;[this.fillStyle, this.globalAlpha, this.imageSmoothingEnabled] =
        stack.pop()
    },
    fillRect(x, y, width, height) {
      assert.ok([x, y, width, height].every(Number.isFinite))
      calls.push({
        x,
        y,
        width,
        height,
        color: this.fillStyle,
        alpha: this.globalAlpha,
      })
    },
    fillText(text, x, y) {
      assert.ok([x, y].every(Number.isFinite))
      calls.push({ text, x, y, color: this.fillStyle, alpha: this.globalAlpha })
    },
  }
}

test("the field admits only occupied cells within the pointer's local influence", () => {
  const field = liquid.createLiquidField(),
    ctx = context()
  field.add([sample(0, 0)], cover, 0)
  assert.equal(field.size(), 0)
  field.setPointer({ x: 0, y: 0 }, 0)
  field.add(
    [
      sample(0, 0),
      sample(30, 0),
      sample(104, 0),
      sample(500, 20),
      sample(NaN, 0),
      sample(0, 0, 0),
      sample(0, 2, 2, 0),
    ],
    cover,
    0,
  )
  assert.equal(field.size(), 2)
  assert.equal(field.paint(ctx, 0), true)
  assert.equal(ctx.calls.length, 0)
  assert.equal(field.paint(ctx, 2000), false)
  assert.equal(ctx.calls.filter((call) => call.color === cover).length, 2)
  assert.ok(ctx.calls.every((call) => call.width === 2 && call.height === 2))
  assert.deepEqual(
    ctx.calls.filter((call) => call.color === cover).map(({ x, y }) => [x, y]),
    [
      [-1, -1],
      [29, -1],
    ],
  )
})

test("held pixels remain displaced without pulsing or continuous RAF work", () => {
  const field = liquid.createLiquidField(),
    ctx = context()
  field.setPointer({ x: 0, y: 0 }, 0)
  field.add([sample(0, 0), sample(20, 20)], cover, 0)
  field.paint(ctx, 0)
  assert.equal(field.paint(ctx, 2000), false)
  const first = ctx.calls.splice(0)
  assert.equal(field.size(), 2)
  for (const now of [3000, 10000, 100000]) {
    assert.equal(field.paint(ctx, now), false)
    assert.deepEqual(ctx.calls.splice(0), first)
  }
  // Resampling at the same source identities never resets or recolors them.
  field.add(
    [sample(0, 0), { ...sample(20, 20), color: "#f00" }],
    "#f00",
    100001,
  )
  assert.equal(field.paint(ctx, 100001), false)
  assert.deepEqual(ctx.calls.splice(0), first)
})

test("engagement ramps gradually and masks only original occupied cells before drawing pixels", () => {
  const field = liquid.createLiquidField(),
    ctx = context()
  field.setPointer({ x: 0, y: 0 }, 0)
  field.add([sample(0, 0), sample(2, 0), sample(0, 2, 2, 0.5)], cover, 0)
  field.paint(ctx, 0)
  assert.equal(field.paint(ctx, 30), true)
  const first = ctx.calls.splice(0).filter((call) => call.color === ink)
  assert.ok(first.some((call) => call.x > 0 && call.x < 20))
  assert.equal(field.paint(ctx, 2000), false)
  const calls = ctx.calls.splice(0)
  assert.deepEqual(
    calls.slice(0, 3).map((call) => call.color),
    [cover, cover, cover],
  )
  assert.deepEqual(
    calls.slice(3).map((call) => call.color),
    [ink, ink, ink],
  )
  assert.deepEqual(
    calls.slice(3).map((call) => call.alpha),
    [1, 1, 0.5],
  )
  assert.ok(
    calls
      .slice(0, 3)
      .every(
        (call) => call.width === 2 && call.height === 2 && call.alpha === 1,
      ),
  )
  for (const call of calls.slice(3))
    assert.ok(Math.hypot(call.x + 1, call.y + 1) >= 47.6)
})

test("leaving restores the exact source positions, culls cells, and stops scheduling", () => {
  const field = liquid.createLiquidField(),
    ctx = context()
  field.setPointer({ x: 0, y: 0 }, 0)
  field.add([sample(0, 0), sample(20, 20)], cover, 0)
  field.paint(ctx, 0)
  field.paint(ctx, 2000)
  field.setPointer(null, 2000)
  assert.equal(field.paint(ctx, 2016), true)
  for (let now = 2032; now < 5000; now += 16) {
    ctx.calls.length = 0
    field.paint(ctx, now)
  }
  assert.equal(field.size(), 0)
  ctx.calls.length = 0
  assert.equal(field.paint(ctx, 5000), false)
  assert.equal(ctx.calls.length, 0)
})

test("a fast pointer crossing remains finite and supports tiny colored ASCII", () => {
  const field = liquid.createLiquidField(),
    ctx = context()
  field.setPointer({ x: -100, y: 0 }, 0)
  field.add([sample(0, 0)], cover, 0)
  field.paint(ctx, 0)
  for (let now = 16; now <= 1600; now += 16) {
    field.setPointer({ x: now < 800 ? now / 4 - 100 : 0, y: 0 }, now)
    field.paint(ctx, now, true)
  }
  assert.ok(
    ctx.calls.some(
      (call) => typeof call.text === "string" && call.color === ink,
    ),
  )
  assert.ok(
    ctx.calls.every(
      (call) => Number.isFinite(call.x) && Number.isFinite(call.y),
    ),
  )
  field.clear()
  assert.equal(field.size(), 0)
  assert.equal(field.paint(ctx, 2000), false)
})

test("source identity is stable and the field has a fixed memory bound", () => {
  const field = liquid.createLiquidField(),
    samples = []
  field.setPointer({ x: 0, y: 0 }, 0)
  for (let y = -103; y <= 103; y++)
    for (let x = -103; x <= 103; x++) samples.push(sample(x, y, 1))
  field.add(samples, cover, 0)
  assert.equal(field.size(), liquid.LIQUID_CAPACITY)
  field.add(samples, cover, 100)
  assert.equal(field.size(), liquid.LIQUID_CAPACITY)
  field.clear()
  assert.equal(field.size(), 0)
})

test("a source travels around the circle to its target after the pointer crosses it", () => {
  const field = liquid.createLiquidField(),
    ctx = context()
  field.setPointer({ x: 0, y: 0 }, 0)
  field.add([sample(0, 0)], cover, 0)
  field.paint(ctx, 0)
  assert.equal(field.paint(ctx, 2000), false)
  field.setPointer({ x: 20, y: 0 }, 2016)
  let moving = true
  for (let now = 2016; now < 6000; now += 16) {
    ctx.calls.length = 0
    moving = field.paint(ctx, now)
  }
  assert.equal(moving, false)
  assert.equal(field.size(), 1)
  const pixel = ctx.calls.find((call) => call.color === ink)
  assert.ok(
    pixel.x + 1 < 20 - 48,
    "the pixel reaches the far side instead of pinning on the near side",
  )
  assert.ok(Math.hypot(pixel.x + 1 - 20, pixel.y + 1) >= 47.6)
})

test("moving after a long idle resumes smoothly instead of integrating idle time", () => {
  const field = liquid.createLiquidField(),
    ctx = context()
  field.setPointer({ x: 0, y: 0 }, 0)
  field.add([sample(0, 0)], cover, 0)
  field.paint(ctx, 0)
  assert.equal(field.paint(ctx, 2000), false)
  ctx.calls.length = 0
  field.setPointer({ x: 80, y: 0 }, 60000)
  assert.equal(field.paint(ctx, 60016), true)
  const pixel = ctx.calls.find((call) => call.color === ink)
  assert.ok(
    pixel.x + 1 > 40 && pixel.x + 1 < 65,
    "the first resumed frame stays close to the previously held pixel",
  )
  assert.equal(field.size(), 1)
})

test("leaving after a long idle still springs home over subsequent frames", () => {
  const field = liquid.createLiquidField(),
    ctx = context()
  field.setPointer({ x: 0, y: 0 }, 0)
  field.add([sample(0, 0)], cover, 0)
  field.paint(ctx, 0)
  assert.equal(field.paint(ctx, 2000), false)
  ctx.calls.length = 0
  field.setPointer(null, 60000)
  assert.equal(field.paint(ctx, 60016), true)
  assert.equal(field.size(), 1)
  const pixel = ctx.calls.find((call) => call.color === ink)
  assert.ok(pixel.x + 1 > 40 && pixel.x + 1 < 48)
  for (let now = 60032; now < 63000; now += 16) field.paint(ctx, now)
  assert.equal(field.size(), 0)
  assert.equal(field.paint(ctx, 63000), false)
})

test("an explicit source refresh updates colors and alpha without resetting the held field", () => {
  const field = liquid.createLiquidField(),
    ctx = context()
  field.setPointer({ x: 0, y: 0 }, 0)
  field.add([sample(0, 0)], cover, 0)
  field.paint(ctx, 0)
  assert.equal(field.paint(ctx, 2000), false)
  const original = ctx.calls.splice(0),
    newInk = "#f0f",
    newCover = "#123"
  // Subpixel recapture variation shares the same cell identity. Its original
  // source position, engagement time and physical state must remain unchanged.
  field.add(
    [{ ...sample(0.2, 0.1, 2, 0.4), color: newInk }],
    newCover,
    2001,
    true,
  )
  assert.equal(field.paint(ctx, 2001), false)
  assert.equal(field.size(), 1)
  assert.deepEqual(ctx.calls, [
    { ...original[0], color: newCover },
    { ...original[1], color: newInk, alpha: 0.4 },
  ])
  ctx.calls.length = 0
  field.add([{ ...sample(0, 0, 2, 0), color: newInk }], newCover, 2002, true)
  assert.equal(field.paint(ctx, 2002), false)
  assert.equal(ctx.calls[1].alpha, 0)
})
