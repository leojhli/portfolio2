import assert from "node:assert/strict"
import { before, after, test } from "node:test"
import { createServer } from "vite"
import { JSDOM } from "jsdom"
let server, entranceModule, scrollModule, textModule
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  entranceModule = await server.ssrLoadModule("/src/effects/entrances.ts")
  scrollModule = await server.ssrLoadModule("/src/effects/scrollGeometry.ts")
  textModule = await server.ssrLoadModule("/src/effects/asciiText.ts")
})
after(async () => server?.close())

test("scroll damping is continuous and consistent at 60Hz and 120Hz", () => {
  const simulate = (hz) => {
    let position = 0
    for (let i = 0; i < hz / 2; i++)
      position = scrollModule.scrollStep(position, 1375, 1 / hz)
    return position
  }
  assert.ok(Math.abs(simulate(60) - simulate(120)) < 0.2)
  assert.equal(scrollModule.clampScroll(-10, 300), 0)
  assert.equal(scrollModule.clampScroll(500, 300), 300)
  assert.equal(scrollModule.clampScroll(NaN, 300), 0)
  const partial = scrollModule.scrollStep(0, 180, 1 / 60)
  assert.ok(
    partial > 0 && partial < 180,
    "input moves part of the document, never a whole-page jump",
  )
})

test("depth follows scroll position with bounded opposing layers and exact center alignment", () => {
  assert.equal(scrollModule.depthOffset(1, 1280, 1280, 0.075), 0)
  assert.ok(scrollModule.depthOffset(0, 180, 1280, 0.075) > 0)
  assert.ok(scrollModule.depthOffset(0, 180, 1280, -0.03) < 0)
  for (const position of [-1000, 0, 123, 1500, 8000])
    assert.ok(Math.abs(scrollModule.depthOffset(3, position, 1280, 0.2)) <= 54)
})

test("literal ASCII text glyphs come only from printable ASCII marks", () => {
  assert.equal(textModule.asciiTextGlyph(0), " ")
  assert.equal(textModule.asciiTextGlyph(NaN), " ")
  assert.equal(textModule.asciiTextGlyph(255), "@")
  const marks = new Set()
  for (let alpha = 0; alpha <= 255; alpha++) {
    const glyph = textModule.asciiTextGlyph(alpha)
    assert.match(glyph, /^[ .:+*#@]$/)
    marks.add(glyph)
  }
  assert.ok(marks.size >= 6)
})

test("scroll reveals settle fully, stagger, and reverse continuously without overshoot", () => {
  for (let order = 0; order <= 6; order++) {
    assert.deepEqual(scrollModule.scrollReveal(0, order, true), {
      opacity: 1,
      y: 0,
      scale: 1,
    })
    let previous = 0
    for (let step = 100; step >= 0; step--) {
      const state = scrollModule.scrollReveal(step / 100, order, true)
      assert.ok(state.opacity >= previous && state.opacity <= 1)
      assert.ok(state.y >= 0 && state.y <= 64)
      assert.ok(state.scale >= 0.945 && state.scale <= 1)
      previous = state.opacity
    }
  }
  const early = scrollModule.scrollReveal(0.6, 0, true)
  const late = scrollModule.scrollReveal(0.6, 3, true)
  assert.ok(early.opacity > late.opacity)
  assert.ok(early.y < late.y)
  assert.equal(scrollModule.scrollReveal(-0.6, 0, true).opacity, early.opacity)
  assert.ok(scrollModule.scrollReveal(-0.6, 0, true).y < 0)
  assert.equal(scrollModule.scrollReveal(0.6, 0, false).scale, 1)
  const a = scrollModule.scrollReveal(0.5, 2, true)
  const b = scrollModule.scrollReveal(0.5001, 2, true)
  assert.ok(Math.abs(a.y - b.y) < 0.02, "small scroll changes never jump")
})

function entranceFixture() {
  const dom = new JSDOM(
    "<!doctype html><section><div data-reveal><h2>Heading</h2><p data-reveal>Nested</p></div><div data-reveal><button>Content</button></div></section>",
  )
  globalThis.document = dom.window.document
  document.documentElement.dataset.motion = "on"
  const calls = []
  dom.window.HTMLElement.prototype.animate = function (keyframes, options) {
    const call = { el: this, keyframes, options, cancelled: false }
    calls.push(call)
    return {
      cancel() {
        call.cancelled = true
      },
    }
  }
  return { dom, root: document.querySelector("section"), calls }
}

test("entrances animate each visual group once, stagger gently, and use only compositor properties", () => {
  const f = entranceFixture()
  try {
    const stop = entranceModule.animateEntrance(f.root, {
      delay: 420,
      direction: 1,
    })
    assert.equal(f.calls.length, 2, "nested groups do not compound animations")
    for (const [i, call] of f.calls.entries()) {
      assert.equal(call.options.delay, 420 + i * 32)
      assert.equal(call.options.duration, 620)
      assert.equal(
        call.options.fill,
        "backwards",
        "finished groups return to ordinary live HTML",
      )
      assert.equal(call.options.easing, "cubic-bezier(0.16,1,0.3,1)")
      assert.ok(
        call.keyframes.every((frame) =>
          Object.keys(frame).every((key) =>
            ["opacity", "transform"].includes(key),
          ),
        ),
      )
    }
    assert.equal(f.root.querySelector("button").getAttribute("tabindex"), null)
    f.root
      .querySelector("button")
      .dispatchEvent(new f.dom.window.Event("focusin", { bubbles: true }))
    assert.ok(
      f.calls.every((call) => call.cancelled),
      "keyboard focus reveals the group immediately",
    )
    stop()
  } finally {
    f.dom.window.close()
  }
})

test("entrances respect motion off and cancellation without mutating content or layout styles", () => {
  const f = entranceFixture()
  try {
    const before = f.root.innerHTML
    const stop = entranceModule.animateEntrance(f.root)
    stop()
    assert.ok(f.calls.every((call) => call.cancelled))
    assert.equal(f.root.innerHTML, before)
    document.documentElement.dataset.motion = "off"
    entranceModule.animateEntrance(f.root)()
    assert.equal(f.calls.length, 2)
  } finally {
    f.dom.window.close()
  }
})

test("ASCII entrances fade native character groups without translating, scaling or pixelating them", () => {
  const f = entranceFixture()
  try {
    document.documentElement.dataset.mode = "ascii"
    const stop = entranceModule.animateEntrance(f.root)
    assert.ok(f.calls.length > 0)
    assert.ok(
      f.calls.every((call) =>
        call.keyframes.every((frame) =>
          Object.keys(frame).every((key) => key === "opacity"),
        ),
      ),
    )
    stop()
  } finally {
    f.dom.window.close()
  }
})
