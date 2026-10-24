import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"
import { JSDOM } from "jsdom"
import React, { act } from "react"
import { createRoot } from "react-dom/client"

let server,
  geometry,
  rendererModule,
  snapshotModule,
  coordinatorModule,
  asciiTextModule,
  App
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  geometry = await server.ssrLoadModule("/src/effects/geometry.ts")
  rendererModule = await server.ssrLoadModule("/src/effects/renderer.ts")
  snapshotModule = await server.ssrLoadModule("/src/effects/snapshot.ts")
  coordinatorModule = await server.ssrLoadModule("/src/effects/coordinator.ts")
  asciiTextModule = await server.ssrLoadModule("/src/effects/asciiText.ts")
  // Resolve lazy module I/O before React's act scope so initial Suspense work
  // can finish within that scope, without timing-dependent resource warnings.
  await Promise.all(
    [
      "/src/effects/EffectsLayer.tsx",
      "/src/three/PoolView.tsx",
      "/src/three/PlanetView.tsx",
    ].map((path) => server.ssrLoadModule(path)),
  )
  App = (await server.ssrLoadModule("/src/App.tsx")).default
})
after(async () => server?.close())

// Layout/canvas are explicit test doubles. These exercise lifecycle and semantic
// behavior without opening or controlling a browser; they do not certify visuals.
function fixture({ width = 1280, reduced = false, stored = {} } = {}) {
  const dom = new JSDOM(
    '<!doctype html><style>* {font:16px sans-serif;writing-mode:horizontal-tb;opacity:1;visibility:visible} h1,h2{font-size:36px}</style><div id="root"></div>',
    { url: "http://localhost/", pretendToBeVisual: true },
  )
  const w = dom.window,
    frames = new Map(),
    paintCalls = []
  for (const [key, value] of Object.entries(stored))
    w.localStorage.setItem(key, value)
  let nextFrame = 0,
    clock = performance.now(),
    currentWidth = width
  for (const name of [
    "window",
    "document",
    "Element",
    "HTMLElement",
    "HTMLImageElement",
    "HTMLCanvasElement",
    "SVGSVGElement",
    "NodeFilter",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
    "PointerEvent",
    "history",
    "location",
    "localStorage",
  ]) {
    if (name === "window") globalThis.window = w
    else if (w[name]) globalThis[name] = w[name]
  }
  Object.defineProperty(w, "innerWidth", {
    get: () => currentWidth,
    configurable: true,
  })
  Object.defineProperty(globalThis, "innerWidth", {
    get: () => currentWidth,
    configurable: true,
  })
  globalThis.innerHeight = w.innerHeight = 800
  globalThis.devicePixelRatio = 1
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.getComputedStyle = w.getComputedStyle.bind(w)
  globalThis.getSelection = w.getSelection.bind(w)
  globalThis.addEventListener = w.addEventListener.bind(w)
  globalThis.removeEventListener = w.removeEventListener.bind(w)
  globalThis.matchMedia = w.matchMedia = (query) => ({
    matches: query.includes("min-width")
      ? currentWidth >= 1024
      : query.includes("reduced-motion")
        ? reduced
        : false,
    addEventListener() {},
    removeEventListener() {},
  })
  globalThis.requestAnimationFrame = w.requestAnimationFrame = (cb) => {
    frames.set(++nextFrame, cb)
    return nextFrame
  }
  globalThis.cancelAnimationFrame = w.cancelAnimationFrame = (id) =>
    frames.delete(id)
  globalThis.Path2D = class {}
  globalThis.ResizeObserver = w.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
  w.scrollBy = () => {}
  w.HTMLElement.prototype.scrollIntoView = function () {}
  w.HTMLElement.prototype.animate = function () {
    return { cancel() {} }
  }
  Object.defineProperty(w.document, "hidden", {
    value: false,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(w.SVGSVGElement.prototype, "viewBox", {
    get: () => ({ baseVal: { x: 0, y: 0, width: 24, height: 24 } }),
    configurable: true,
  })
  const bounds = (left, top, width, height) => ({
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON() {},
  })
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const panel = this.closest("[data-panel]")
    const panels = [...w.document.querySelectorAll("[data-panel]")]
    const slide = w.document.querySelector(".deck")?.scrollLeft ?? 0
    const left = panel ? panels.indexOf(panel) * currentWidth - slide : 0
    return this === panel
      ? bounds(left, 0, currentWidth, 800)
      : bounds(
          left + 40,
          this.matches("h1,h2") ? 100 : 230,
          Math.min(500, currentWidth - 80),
          this.matches("h1,h2") ? 80 : 100,
        )
  }
  w.Range.prototype.getBoundingClientRect = function () {
    const r = this.startContainer.parentElement.getBoundingClientRect()
    return bounds(r.left + this.startOffset * 8, r.top, 8, 18)
  }
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "")
  }
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open")
    this.dispatchEvent(new w.Event("close"))
  }
  const context = () => ({
    imageCalls: [],
    textCalls: [],
    frameCalls: [],
    clearCalls: [],
    setTransform() {},
    clearRect(...args) {
      if (this.clearCalls.length < 5000) this.clearCalls.push(args)
      if (args[2] === innerWidth && args[3] === innerHeight)
        this.frameCalls = []
    },
    beginPath() {},
    roundRect() {},
    fill() {},
    stroke() {},
    strokeRect() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    createRadialGradient() {
      return { addColorStop() {} }
    },
    drawImage(...args) {
      if (this.imageCalls.length < 5000) this.imageCalls.push(args)
    },
    fillRect(...args) {
      assert.ok(args.every(Number.isFinite))
      this.frameCalls.push({
        args,
        color: this.fillStyle,
        alpha: this.globalAlpha,
      })
      if (paintCalls.length < 10000) paintCalls.push(args)
    },
    fillText(text, x, y) {
      if (this.textCalls.length < 10000) this.textCalls.push(text)
      assert.ok(
        Number.isFinite(x) && Number.isFinite(y),
        `${text}: finite text coordinates`,
      )
      if (paintCalls.length < 10000) paintCalls.push([x, y])
    },
    getImageData(x, y, width, height) {
      const data = new Uint8ClampedArray(width * height * 4)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 40
        data[i + 1] = 100
        data[i + 2] = 160
        data[i + 3] = 255
      }
      return { data }
    },
  })
  w.HTMLCanvasElement.prototype.getContext = function (type) {
    return type === "2d" ? (this._ctx ??= context()) : null
  }
  const audioInstances = []
  globalThis.Audio = class extends w.EventTarget {
    paused = true
    currentTime = 0
    duration = 200
    ended = false
    src = ""
    constructor() {
      super()
      audioInstances.push(this)
    }
    async play() {
      this.paused = false
      this.dispatchEvent(new w.Event("playing"))
    }
    pause() {
      this.paused = true
      this.dispatchEvent(new w.Event("pause"))
    }
  }
  return {
    dom,
    frames,
    paintCalls,
    audioInstances,
    resize(value) {
      currentWidth = value
      w.dispatchEvent(new w.Event("resize"))
    },
    advance(ms = 1200) {
      clock = Math.max(clock, performance.now())
      for (let i = 0; i < ms / 16; i++) {
        clock += 16
        const callbacks = [...frames.values()]
        frames.clear()
        callbacks.forEach((cb) => cb(clock))
      }
    },
  }
}

function movePointer(x = 100, y = 250, overrides = {}) {
  const event = new Event("pointermove")
  for (const [key, value] of Object.entries({
    clientX: x,
    clientY: y,
    pointerType: "mouse",
    buttons: 0,
    ...overrides,
  }))
    Object.defineProperty(event, key, { value })
  window.dispatchEvent(event)
}

test("local assembly paths land exactly on targets and stay within their budget", () => {
  const from = { x: 20, y: 30 },
    to = { x: 900, y: 500 }
  assert.deepEqual(geometry.assemblyAt(from, to, -1, 0.3), from)
  const end = geometry.assemblyAt(from, to, 2, 0.3)
  assert.ok(Math.abs(end.x - to.x) < 1e-8 && Math.abs(end.y - to.y) < 1e-8)
  for (let seed = 0; seed < 100; seed++) {
    const p = geometry.assemblyAt(from, to, seed / 100, geometry.noise(seed))
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y))
  }
  assert.ok(geometry.particleBudget(10000, 10000, true) <= 12000)
  assert.ok(geometry.particleBudget(10000, 10000, false) <= 36000)
  assert.ok(geometry.particleBudget(1440, 900, false) >= 30000)
})

test("high-resolution snapshots keep 2px fragments and thousands of samples even at the pool limit", () => {
  const f = fixture(),
    d = f.dom.window.document
  try {
    d.body.insertAdjacentHTML(
      "beforeend",
      '<section id="fine"><h2>Fine particles</h2></section>',
    )
    const root = d.getElementById("fine")
    const dense = snapshotModule.snapshot(root, 20000)
    assert.ok(
      dense.length >= 10000,
      "small visual supplies thousands of particles",
    )
    assert.ok(dense.every((sample) => sample.size === 2))
    const limited = snapshotModule.snapshot(root, 2000)
    assert.equal(limited.length, 2000)
    assert.ok(
      limited.every((sample) => sample.size === 2),
      "budgeting does not enlarge fragments",
    )
  } finally {
    f.dom.window.close()
  }
})

test("renderer cancels native entrances and completes pending dialog closure on disposal", () => {
  const f = fixture(),
    d = f.dom.window.document
  d.documentElement.dataset.motion = "on"
  d.body.insertAdjacentHTML(
    "beforeend",
    '<section id="one"><h2>Original text</h2></section>',
  )
  const canvas = d.createElement("canvas")
  d.body.append(canvas)
  const renderer = rendererModule.createRenderer(canvas)
  const one = d.getElementById("one")
  assert.equal(renderer.transition, undefined, "page transitions are removed")
  renderer.assemble(one)
  assert.equal(f.frames.size, 1)
  renderer.morph(one)
  f.advance(1200)
  assert.equal(f.frames.size, 0)
  assert.equal(one.textContent, "Original text")
  let closed = 0
  renderer.disperse(one, () => closed++)
  renderer.dispose()
  assert.equal(closed, 1)
  assert.equal(f.frames.size, 0)
  assert.equal(
    d.querySelector("[data-screen-pixelation],[data-liquid-surface]"),
    null,
  )
  f.dom.window.close()
})

test("the liquid interaction stays local and never translates page elements", () => {
  const f = fixture(),
    d = f.dom.window.document
  d.documentElement.dataset.motion = "on"
  d.body.style.backgroundPosition = "8px 12px"
  d.body.insertAdjacentHTML(
    "beforeend",
    '<header><a class="nav-link" href="#example">Navigation</a></header><p style="filter:contrast(1.1);translate:2px 3px">Unmarked text <span>nested label</span></p><span>Metadata</span><button>Button</button>',
  )
  const nodes = [...d.querySelectorAll("header,p,span,button,a")]
  const styles = nodes.map((el) => el.getAttribute("style"))
  const canvas = d.createElement("canvas")
  canvas.dataset.effectCanvas = ""
  d.body.append(canvas)
  const renderer = rendererModule.createRenderer(canvas)
  try {
    movePointer()
    f.advance(2400)
    assert.ok(canvas.hasAttribute("data-liquid-active"))
    assert.ok(
      canvas._ctx.frameCalls.length > 1000,
      "the local source supplies many tiny pixels",
    )
    assert.deepEqual(
      nodes.map((el) => el.getAttribute("style")),
      styles,
    )
    assert.equal(d.body.style.backgroundPosition, "8px 12px")
    assert.ok(
      canvas._ctx.clearCalls.some(
        ([x, y, w, h]) => x === 40 && y === 321 && w === 500 && h === 2,
      ),
      "the liquid overlay exposes the native animated underline",
    )
    for (const {
      args: [x, y, w, h],
    } of canvas._ctx.frameCalls) {
      assert.ok(
        Math.hypot(x + w / 2 - 100, y + h / 2 - 250) < 117,
        "pixels stay in the local cursor neighborhood",
      )
      assert.equal(w, 2)
      assert.equal(h, 2)
    }
    assert.equal(f.frames.size, 0, "a held cursor rests without pulsing")
    const held = canvas._ctx.frameCalls
    f.advance(2400)
    assert.equal(
      canvas._ctx.frameCalls,
      held,
      "no re-emission or timed pulse while resting",
    )
    window.dispatchEvent(new Event("blur"))
    f.advance(1800)
    assert.equal(canvas.hasAttribute("data-liquid-active"), false)
    assert.equal(canvas._ctx.frameCalls.length, 0)
    assert.equal(f.frames.size, 0)
    assert.deepEqual(
      nodes.map((el) => el.getAttribute("style")),
      styles,
    )
  } finally {
    renderer.dispose()
    f.dom.window.close()
  }
})
test("viewport rasters include navigation and status text as well as the panel", () => {
  const f = fixture(),
    d = f.dom.window.document
  try {
    d.body.insertAdjacentHTML(
      "beforeend",
      '<header>Navigation</header><section id="panel"><h2>Panel text</h2></section><footer data-deck-status>Page status</footer>',
    )
    const raster = snapshotModule.captureRaster(d.getElementById("panel"))
    assert.equal(raster.width, 1280)
    assert.equal(raster.height, 800)
    const painted = raster._ctx.textCalls.join("").replace(/\s/gu, "")
    assert.ok(painted.includes("Navigation"))
    assert.ok(painted.includes("Pagestatus"))
    assert.ok(painted.includes("Paneltext"))
  } finally {
    f.dom.window.close()
  }
})

test("ASCII pointer motion never starts pixel displacement or copies viewport rasters", () => {
  const f = fixture(),
    d = f.dom.window.document
  d.documentElement.dataset.motion = "on"
  d.documentElement.dataset.mode = "ascii"
  d.body.insertAdjacentHTML(
    "beforeend",
    "<section><h2>Original text</h2></section>",
  )
  const canvas = d.createElement("canvas")
  d.body.append(canvas)
  const renderer = rendererModule.createRenderer(canvas)
  try {
    movePointer(120, 240)
    f.advance(240)
    assert.equal(canvas._ctx.frameCalls.length, 0)
    assert.equal(canvas._ctx.imageCalls.length, 0)
    assert.equal(f.frames.size, 0)
    renderer.morph(d.querySelector("section"))
    f.advance(1200)
    assert.equal(canvas._ctx.imageCalls.length, 0)
    assert.equal(canvas._ctx.frameCalls.length, 0)
    assert.equal(d.querySelector("h2").textContent, "Original text")
  } finally {
    renderer.dispose()
    f.dom.window.close()
  }
})

test("visible text is literally redrawn from ASCII symbols while its real DOM text survives", async () => {
  const f = fixture(),
    d = f.dom.window.document
  d.documentElement.dataset.mode = "ascii"
  d.body.insertAdjacentHTML(
    "beforeend",
    '<h1 id="literal-ascii">Hello world</h1><p id="late-label" style="visibility:hidden">Later</p>',
  )
  const heading = d.getElementById("literal-ascii")
  const stop = asciiTextModule.createAsciiText(d.body)
  try {
    f.advance(800)
    const canvas = heading.querySelector("[data-ascii-text]")
    assert.ok(canvas)
    const late = d.getElementById("late-label")
    assert.equal(late.querySelector("[data-ascii-text]"), null)
    late.style.visibility = "visible"
    await Promise.resolve()
    f.advance(500)
    assert.ok(
      late.querySelector("[data-ascii-text]"),
      "scene labels are converted when they become visible",
    )
    assert.equal(canvas.getAttribute("aria-hidden"), "true")
    assert.equal(heading.textContent, "Hello world")
    assert.ok(heading.hasAttribute("data-ascii-text-host"))
    assert.ok(canvas._ctx.textCalls.length > 20)
    assert.ok(
      canvas._ctx.textCalls.every((char) => /^[.:+*#@]$/.test(char)),
      "each visible drawing operation is an ASCII mark, never the original words",
    )
    const before = canvas._ctx.textCalls.length
    d.body.dispatchEvent(new Event("scroll"))
    f.advance(100)
    assert.equal(
      canvas._ctx.textCalls.length,
      before,
      "scrolling reuses the cached character artwork",
    )
    heading.firstChild.nodeValue = "Updated label"
    await Promise.resolve()
    f.advance(500)
    assert.equal(heading.querySelectorAll("[data-ascii-text]").length, 1)
    assert.equal(heading.textContent, "Updated label")
    assert.equal(heading.querySelector("[data-ascii-text]"), canvas)
    stop()
    assert.equal(heading.querySelector("[data-ascii-text]"), null)
    assert.ok(!heading.hasAttribute("data-ascii-text-host"))
    assert.equal(heading.textContent, "Updated label")
  } finally {
    stop()
    f.dom.window.close()
  }
})

test("full-viewport captures measure text runs while local cursor captures retain individual glyphs", () => {
  const f = fixture(),
    d = f.dom.window.document
  d.body.insertAdjacentHTML(
    "beforeend",
    '<section id="text-runs"><p>This interface stays responsive while every small character remains available.</p></section>',
  )
  const original = f.dom.window.Range.prototype.getBoundingClientRect
  let measurements = 0
  f.dom.window.Range.prototype.getBoundingClientRect = function () {
    measurements++
    return original.call(this)
  }
  try {
    const root = d.getElementById("text-runs")
    const raster = snapshotModule.captureRaster(root)
    const full = measurements
    assert.ok(
      full < 20,
      "full-page capture measures words instead of every letter",
    )
    assert.ok(raster._ctx.textCalls.some((text) => text.includes("responsive")))
    measurements = 0
    snapshotModule.snapshot(root, 20000, false, 2, true, {
      left: 0,
      top: 0,
      right: 272,
      bottom: 400,
    })
    assert.ok(
      measurements > full * 3,
      "the local path keeps precise glyph placement",
    )
  } finally {
    f.dom.window.close()
  }
})

test("clipped local snapshots retain every 2px cell on a stable viewport grid", () => {
  const f = fixture(),
    d = f.dom.window.document
  try {
    const region = { left: 24, top: 88, right: 296, bottom: 360 }
    const cells = snapshotModule.snapshot(d.body, 20000, false, 2, true, region)
    assert.equal(cells.length, 136 * 136)
    assert.ok(
      cells.every(
        (s) => s.size === 2 && s.x > 24 && s.x < 296 && s.y > 88 && s.y < 360,
      ),
    )
    assert.equal(new Set(cells.map((s) => s.x + ":" + s.y)).size, cells.length)
    const again = snapshotModule.snapshot(d.body, 20000, false, 2, true, region)
    assert.deepEqual(
      cells,
      again,
      "local density does not use a random reservoir",
    )
  } finally {
    f.dom.window.close()
  }
})

test("clicks never send outward pulses; selection, hidden tabs and editing release the local effect", () => {
  const f = fixture(),
    d = f.dom.window.document
  d.documentElement.dataset.motion = "on"
  d.body.insertAdjacentHTML(
    "beforeend",
    '<p id="selection">Selectable content</p><input aria-label="Edit">',
  )
  const canvas = d.createElement("canvas")
  canvas.dataset.effectCanvas = ""
  d.body.append(canvas)
  const renderer = rendererModule.createRenderer(canvas)
  try {
    for (let i = 0; i < 80; i++)
      d.body.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          detail: 1,
          clientX: i * 8,
          clientY: 100,
        }),
      )
    assert.equal(f.frames.size, 0, "clicks do not launch global effects")
    movePointer()
    f.advance(160)
    assert.ok(canvas.hasAttribute("data-liquid-active"))
    const range = d.createRange()
    range.selectNodeContents(d.getElementById("selection"))
    d.getSelection().addRange(range)
    d.dispatchEvent(new Event("selectionchange"))
    assert.equal(f.frames.size, 0)
    assert.equal(canvas.hasAttribute("data-liquid-active"), false)
    d.getSelection().removeAllRanges()
    movePointer()
    f.advance(160)
    d.querySelector("input").focus()
    assert.equal(f.frames.size, 0)
    assert.equal(canvas.hasAttribute("data-liquid-active"), false)
    d.querySelector("input").blur()
    movePointer()
    f.advance(160)
    d.hidden = true
    d.dispatchEvent(new Event("visibilitychange"))
    assert.equal(f.frames.size, 0)
    d.hidden = false
    movePointer(100, 250, { pointerType: "touch" })
    assert.equal(
      f.frames.size,
      0,
      "touch interactions do not require decorative hover",
    )
    d.documentElement.dataset.motion = "off"
    movePointer()
    assert.equal(f.frames.size, 0)
    let closed = false
    renderer.disperse(d.body, () => (closed = true))
    assert.equal(closed, true)
  } finally {
    renderer.dispose()
    f.dom.window.close()
  }
})
test("a failed canvas leaves navigation/content usable and closes dialogs immediately", () => {
  const f = fixture(),
    d = f.dom.window.document
  d.documentElement.dataset.motion = "on"
  const canvas = d.createElement("canvas")
  canvas.getContext = () => null
  const renderer = rendererModule.createRenderer(canvas)
  d.body.insertAdjacentHTML(
    "beforeend",
    "<h2>Content stays readable</h2><button>Still clickable</button>",
  )
  const before = d.body.textContent
  renderer.assemble(d.body)
  renderer.morph(d.body)
  let closed = false
  renderer.disperse(d.body, () => (closed = true))
  assert.equal(closed, true)
  assert.equal(d.body.textContent, before)
  assert.equal(f.frames.size, 0)
  renderer.dispose()
  f.dom.window.close()
})

async function mountApp(f) {
  const root = createRoot(document.getElementById("root"))
  await act(async () => {
    root.render(React.createElement(App))
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
  return async () => {
    await act(async () => root.unmount())
    f.dom.window.close()
  }
}
const byText = (selector, text) =>
  [...document.querySelectorAll(selector)].find((el) => {
    const copy = el.cloneNode(true)
    copy
      .querySelectorAll('[aria-hidden="true"]')
      .forEach((node) => node.remove())
    return copy.textContent.trim() === text
  })
const click = async (el) => {
  assert.ok(el, "control exists")
  await act(async () => el.click())
}

test("horizontal scrolling is continuous, proportional to input, and keeps depth linked to position", async () => {
  const f = fixture(),
    unmount = await mountApp(f)
  try {
    const deck = document.querySelector(".deck"),
      track = document.querySelector(".deck-track")
    const wheel = (delta) =>
      deck.dispatchEvent(
        new window.WheelEvent("wheel", {
          deltaY: delta,
          bubbles: true,
          cancelable: true,
        }),
      )
    wheel(180)
    await act(async () => f.advance(800))
    assert.ok(
      deck.scrollLeft > 170 && deck.scrollLeft < 190,
      "small wheel input does not jump a page",
    )
    assert.equal(track.style.transform, "")
    assert.equal(
      document.querySelector("[data-liquid-surface],[data-screen-pixelation]"),
      null,
    )
    const art = document.querySelector('[data-depth="0.075"]')
    assert.ok(parseFloat(art.style.getPropertyValue("--depth-x")) > 0)
    const first = document.querySelector("[data-panel]")
    Object.defineProperty(first, "scrollHeight", {
      value: 1200,
      configurable: true,
    })
    Object.defineProperty(first, "clientHeight", {
      value: 800,
      configurable: true,
    })
    const inside = new window.WheelEvent("wheel", {
      deltaY: 100,
      bubbles: true,
      cancelable: true,
    })
    first.dispatchEvent(inside)
    await act(async () => f.advance(64))
    assert.equal(
      inside.defaultPrevented,
      false,
      "a tall section keeps its own vertical scrolling",
    )
    assert.ok(Math.abs(deck.scrollLeft - 180) < 1)
    delete first.scrollHeight
    delete first.clientHeight
    const horizontal = new window.WheelEvent("wheel", {
      deltaX: 80,
      deltaY: 2,
      bubbles: true,
      cancelable: true,
    })
    deck.dispatchEvent(horizontal)
    assert.equal(
      horizontal.defaultPrevented,
      false,
      "trackpad horizontal momentum remains native",
    )
    wheel(210)
    await act(async () => f.advance(800))
    assert.ok(deck.scrollLeft > 380 && deck.scrollLeft < 400)
    const before = deck.scrollLeft
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })),
    )
    await act(async () => f.advance(800))
    assert.ok(Math.abs(deck.scrollLeft - before - 96) < 1)
    await click(byText("a", "Projects"))
    await act(async () => f.advance(1100))
    assert.ok(Math.abs(deck.scrollLeft - 2560) < 1)
    assert.equal(location.hash, "#projects")
    assert.equal(
      document
        .querySelector('[data-deck-status] a[href="#projects"]')
        .getAttribute("aria-current"),
      "true",
    )
    deck.scrollLeft = 3010
    await act(async () => deck.dispatchEvent(new Event("scroll")))
    await act(async () => f.advance(32))
    assert.equal(
      deck.scrollLeft,
      3010,
      "native scroll can rest at any fractional section",
    )
    const pool = document.querySelector('[data-depth="0.06"]')
    assert.ok(pool.hasAttribute("data-scroll-reveal"))
    const faded = Number(pool.style.getPropertyValue("--scroll-opacity"))
    const lifted = parseFloat(pool.style.getPropertyValue("--scroll-y"))
    assert.ok(faded > 0.16 && faded < 1)
    assert.ok(lifted > 0)
    deck.scrollLeft = 3700
    await act(async () => deck.dispatchEvent(new Event("scroll")))
    await act(async () => f.advance(32))
    assert.equal(Number(pool.style.getPropertyValue("--scroll-opacity")), 1)
    assert.equal(parseFloat(pool.style.getPropertyValue("--scroll-y")), 0)
    deck.scrollLeft = 3010
    await act(async () => deck.dispatchEvent(new Event("scroll")))
    await act(async () => f.advance(32))
    assert.equal(Number(pool.style.getPropertyValue("--scroll-opacity")), faded)
    assert.equal(parseFloat(pool.style.getPropertyValue("--scroll-y")), lifted)
  } finally {
    await unmount()
  }
})

test("ASCII presentation uses character controls and frames, keeps media mounted, and cleans up on leaving", async () => {
  const f = fixture(),
    unmount = await mountApp(f)
  try {
    const footerNav = document.querySelector("[data-deck-status] nav")
    assert.ok(footerNav.classList.contains("left-1/2"))
    assert.ok(footerNav.classList.contains("-translate-x-1/2"))
    assert.ok(!document.querySelector("header").classList.contains("border-b"))
    assert.ok(
      !document
        .querySelector("[data-deck-status]")
        .classList.contains("border-t"),
    )
    assert.equal(document.querySelector("header > .palette-strip"), null)
    await click(document.querySelector('[aria-label="Play"]'))
    const audio = f.audioInstances[0]
    await click(byText("button", "ASCII"))
    await act(async () => f.advance(1200))
    const frames = [...document.querySelectorAll("[data-ascii-decor]")]
    assert.ok(frames.length > 10)
    assert.ok(
      frames.every(
        (el) =>
          el.getAttribute("aria-hidden") === "true" &&
          /^[+|\- \n]+$/.test(el.textContent),
      ),
    )
    assert.ok(
      document
        .querySelector('[aria-label="Play"],[aria-label="Pause"]')
        .querySelector("[data-ascii-icon]"),
    )
    assert.equal(document.querySelector(".brand-home svg"), null)
    assert.ok(
      document.querySelector(".brand-home").textContent.includes("[LL]"),
    )
    assert.equal(
      document
        .querySelector('[aria-label="Volume"]')
        .closest(".ascii-range") !== null,
      true,
    )
    assert.equal(f.audioInstances.length, 1)
    assert.equal(audio.paused, false)
    await click(byText("a", "Contact"))
    await act(async () => f.advance(1200))
    assert.equal(location.hash, "#contact")
    await click(byText("button", "Dynamic"))
    await act(async () => f.advance(1200))
    assert.equal(document.querySelector("[data-ascii-decor]"), null)
    assert.equal(document.querySelector("[data-ascii-framed]"), null)
    assert.ok(document.querySelector(".brand-home svg"))
    assert.equal(audio.paused, false)
  } finally {
    await unmount()
  }
})

test("real React tree preserves audio and text through rapid navigation, history, mode changes and motion-off", async () => {
  const f = fixture(),
    unmount = await mountApp(f)
  try {
    assert.equal(document.documentElement.dataset.layout, "h")
    assert.equal(document.documentElement.dataset.theme, "dark")
    assert.equal(document.documentElement.dataset.motion, "on")
    assert.ok(
      document
        .querySelector('[aria-controls="palette-pop"]')
        .textContent.includes("Graphite"),
    )
    assert.equal(document.querySelectorAll("[data-panel]").length, 7)
    assert.equal(f.audioInstances.length, 0, "audio does not autoplay")
    await click(document.querySelector('[aria-label="Play"]'))
    const audio = f.audioInstances[0]
    assert.ok(audio && !audio.paused)
    audio.currentTime = 37
    await click(byText("a", "Projects"))
    await click(byText("a", "About"))
    await click(byText("a", "Experience"))
    await act(async () => f.advance(1000))
    assert.equal(location.hash, "#experience")
    assert.ok(Math.abs(document.querySelector(".deck").scrollLeft - 1280) < 1)
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    )
    assert.equal(document.querySelector(".deck-track").style.transition, "")
    await act(async () => {
      history.replaceState(null, "", "#projects")
      window.dispatchEvent(new Event("popstate"))
    })
    assert.equal(document.querySelector(".deck").scrollLeft, 2560)
    await click(byText("button", "ASCII"))
    await act(async () => f.advance(1600))
    assert.equal(document.documentElement.dataset.mode, "ascii")
    assert.ok(document.getElementById("intro-h").textContent.includes("李嘉和"))
    await click(byText("button", "Dark"))
    assert.equal(f.audioInstances.length, 1)
    assert.equal(audio.currentTime, 37)
    assert.equal(audio.paused, false)
    await click(
      [...document.querySelectorAll("button")].find((el) =>
        el.textContent.includes("Motion:"),
      ),
    )
    await click(document.querySelector('input[name="motion"][value="off"]'))
    assert.equal(document.documentElement.dataset.motion, "off")
    assert.equal(document.querySelector("[data-effect-canvas]"), null)
    await click(byText("a", "Contact"))
    assert.equal(document.querySelector(".deck-track").style.transition, "")
    assert.equal(location.hash, "#contact")
  } finally {
    await unmount()
  }
})

test("restored colourful palettes are grouped, selectable and remembered without reviving the old default", async () => {
  let f = fixture({
    stored: {
      "pf.v2.palette": "candy",
      "pf.v2.appearance": "light",
      "pf.v2.motion": "off",
    },
  })
  let unmount = await mountApp(f)
  try {
    const trigger = document.querySelector('[aria-controls="palette-pop"]')
    assert.ok(trigger.textContent.includes("Graphite"))
    assert.equal(document.documentElement.dataset.theme, "light")
    assert.equal(document.documentElement.dataset.motion, "off")
    await click(trigger)
    const picker = document.getElementById("palette-pop")
    assert.deepEqual(
      [...picker.querySelectorAll("fieldset fieldset > legend")].map(
        (el) => el.textContent,
      ),
      ["Minimal", "Colorful"],
    )
    assert.equal(picker.querySelectorAll('input[name="palette"]').length, 24)
    await click(picker.querySelector('input[value="candy"]'))
    assert.ok(trigger.textContent.includes("Candy Shop"))
    assert.equal(localStorage.getItem("pf.v3.palette"), "candy")
    const visited = new Set()
    for (let i = 0; i < 24; i++) {
      visited.add(picker.querySelector('input[name="palette"]:checked').value)
      await click(document.querySelector('[aria-label="Next palette"]'))
    }
    assert.equal(visited.size, 24, "cycling reaches both collections")
    assert.equal(
      picker.querySelector('input[name="palette"]:checked').value,
      "candy",
    )
    assert.equal(localStorage.getItem("pf.v3.palette"), "candy")
  } finally {
    await unmount()
  }
  f = fixture({
    stored: {
      "pf.v3.palette": "candy",
      "pf.v2.palette": "paper",
      "pf.v2.motion": "off",
    },
  })
  unmount = await mountApp(f)
  try {
    assert.ok(
      document
        .querySelector('[aria-controls="palette-pop"]')
        .textContent.includes("Candy Shop"),
      "a new explicit colourful choice takes precedence and survives reload",
    )
  } finally {
    await unmount()
  }
})

test("book dialogs reopen, close on cancel, and return focus without unmounting media", async () => {
  const f = fixture({
      width: 390,
      reduced: true,
      stored: { "pf.v2.motion": "system" },
    }),
    unmount = await mountApp(f)
  try {
    assert.equal(document.documentElement.dataset.layout, "v")
    const book = document.querySelector('[aria-haspopup="dialog"]')
    await click(book)
    const dialog = document.querySelector("dialog")
    assert.equal(dialog.open, true)
    const title = document.getElementById("book-title").textContent
    await click(dialog.querySelector('[aria-label="Close"]'))
    assert.equal(dialog.open, false)
    assert.equal(document.activeElement, book)
    await click(book)
    assert.equal(document.getElementById("book-title").textContent, title)
    await act(async () =>
      dialog.dispatchEvent(new Event("cancel", { cancelable: true })),
    )
    assert.equal(dialog.open, false)
    assert.equal(document.activeElement, book)
    assert.equal(document.querySelector("[data-effect-canvas]"), null)
  } finally {
    await unmount()
  }
})

test("new defaults replace legacy preferences once, while new explicit choices remain remembered", async () => {
  let f = fixture({
    reduced: true,
    stored: {
      "pf.appearance": "light",
      "pf.palette": "riso",
      "pf.motion": "off",
    },
  })
  let unmount = await mountApp(f)
  try {
    assert.equal(document.documentElement.dataset.theme, "dark")
    assert.equal(document.documentElement.dataset.motion, "on")
    assert.ok(
      document
        .querySelector('[aria-controls="palette-pop"]')
        .textContent.includes("Graphite"),
    )
    await click(byText("button", "Light"))
    assert.equal(localStorage.getItem("pf.v2.appearance"), "light")
  } finally {
    await unmount()
  }
  f = fixture({
    stored: {
      "pf.v2.appearance": "light",
      "pf.v2.palette": "paper",
      "pf.v2.motion": "off",
    },
  })
  unmount = await mountApp(f)
  try {
    assert.equal(document.documentElement.dataset.theme, "light")
    assert.equal(document.documentElement.dataset.motion, "off")
    assert.ok(
      document
        .querySelector('[aria-controls="palette-pop"]')
        .textContent.includes("Paper"),
    )
  } finally {
    await unmount()
  }
})
