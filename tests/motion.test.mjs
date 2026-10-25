import assert from "node:assert/strict"
import { before, after, test } from "node:test"
import { createServer } from "vite"
import { JSDOM } from "jsdom"
let server,
  entranceModule,
  scrollModule,
  textModule,
  signatureModule,
  contourModule,
  soundsModule
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  entranceModule = await server.ssrLoadModule("/src/effects/entrances.ts")
  scrollModule = await server.ssrLoadModule("/src/effects/scrollGeometry.ts")
  textModule = await server.ssrLoadModule("/src/effects/asciiText.ts")
  signatureModule = await server.ssrLoadModule("/src/effects/signature.ts")
  contourModule = await server.ssrLoadModule("/src/effects/contours.ts")
  soundsModule = await server.ssrLoadModule("/src/effects/sounds.ts")
})
after(async () => server?.close())

test("interface sounds wait for a gesture, throttle hovers, and mute/dispose voices", () => {
  let created = 0, starts = 0, closed = false
  const nodes = []
  const parameter = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} })
  const context = {
    currentTime: 1, state: "running", destination: {},
    createOscillator() {
      const node = { frequency: parameter(), connect() {}, disconnect() {}, start() { starts++ }, stop() { this.stopped = true }, stopped: false }
      nodes.push(node)
      return node
    },
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} } },
    async close() { closed = true },
  }
  const sound = soundsModule.createInterfaceSounds(() => { created++; return context })
  sound.play("hover")
  assert.equal(created, 0)
  sound.play("tap", true)
  assert.equal(created, 1)
  assert.equal(starts, 1)
  sound.play("hover")
  sound.play("hover")
  assert.equal(starts, 2)
  sound.setEnabled(false)
  sound.play("tap", true)
  assert.equal(starts, 2)
  assert.ok(nodes.every(n => n.stopped))
  sound.setEnabled(true)
  sound.play("select", true)
  assert.equal(starts, 3)
  sound.dispose()
  sound.play("tap", true)
  assert.equal(starts, 3)
  assert.equal(closed, true)
})

test("sideways travel clamps at both boundaries and reverses exactly", () => {
  assert.equal(scrollModule.railPosition(100, 500, 1200), 0)
  assert.equal(scrollModule.railPosition(700, 500, 1200), 200)
  assert.equal(scrollModule.railPosition(650, 500, 1200), 150)
  assert.equal(scrollModule.railPosition(2000, 500, 1200), 1200)
  assert.equal(scrollModule.railPosition(800, 500, 0), 0)
  assert.equal(scrollModule.revealProgress(-1), 0)
  assert.equal(scrollModule.revealProgress(2), 1)
  let last = 0
  for (let i = 0; i <= 100; i++) {
    const p = scrollModule.revealProgress(i / 100)
    assert.ok(p >= last && p <= 1)
    last = p
  }
})

test("signature follows pen movement across the supplied silhouette, with its dot last", () => {
  assert.ok(signatureModule.signatureProgress(264, 52) < 0.02)
  assert.ok(signatureModule.signatureProgress(193, 153) > 0.1)
  assert.ok(signatureModule.signatureProgress(385, 134) > 0.85)
  assert.equal(signatureModule.signatureProgress(394, 113), 0.97)
  assert.equal(signatureModule.SIGNATURE_STROKES.length, 2)
  for (let y = 30; y < 165; y += 10)
    for (let x = 180; x < 420; x += 10) {
      const p = signatureModule.signatureProgress(x, y)
      assert.ok(p >= 0 && p <= 1)
    }
})

test("organic background has deterministic finite static and literal ASCII fallbacks", () => {
  const path = contourModule.contourPath()
  assert.ok(path.startsWith("M") && path.includes("L"))
  assert.ok(!path.includes("NaN"))
  assert.equal(contourModule.contourPath(), path)
  assert.match(contourModule.contourCharacters(), /^[ .:\n]+$/)
  assert.notEqual(
    contourModule.contourField(1, 2, 0),
    contourModule.contourField(1, 2, 10),
  )
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
