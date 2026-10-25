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
      "/src/three/SpiritWorldView.tsx",
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
    "CustomEvent",
    "Image",
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
  globalThis.dispatchEvent = w.dispatchEvent.bind(w)
  globalThis.addEventListener = w.addEventListener.bind(w)
  globalThis.removeEventListener = w.removeEventListener.bind(w)
  globalThis.matchMedia = w.matchMedia = (query) => ({
    get matches() {
      return query.includes("min-width")
        ? currentWidth >= 1024
        : query.includes("reduced-motion")
          ? reduced
          : false
    },
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
  let yPosition = 0
  Object.defineProperty(w, "scrollY", {
    get: () => yPosition,
    configurable: true,
  })
  Object.defineProperty(globalThis, "scrollY", {
    get: () => yPosition,
    configurable: true,
  })
  w.scrollTo = ({ top }) => {
    yPosition = Math.max(0, top)
    w.dispatchEvent(new w.Event("scroll"))
  }
  w.scrollBy = ({ top }) => w.scrollTo({ top: yPosition + top })
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
  const chapterBox = (chapter) => {
    const story = w.document.querySelector(".story")
    if (!story) return { top: 0, height: 800 }
    let top = 0
    for (const child of story.children) {
      const height =
        parseFloat(child.style.height) ||
        (child.id === "intro" ? 1320 : child.id === "playground" ? 3000 : 1000)
      if (child === chapter || child.contains(chapter))
        return {
          top:
            top +
            (chapter.id === "listening"
              ? 1400
              : chapter.id === "games"
                ? 2300
                : 0),
          height,
        }
      top += height
    }
    return { top: 0, height: 800 }
  }
  Object.defineProperty(w.HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return this.classList.contains("rail-track") ? 2680 : currentWidth
    },
  })
  Object.defineProperty(w.HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return 800
    },
  })
  Object.defineProperty(w.HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get() {
      return this.classList.contains("rail-track") ? 2680 : currentWidth
    },
  })
  Object.defineProperty(w.document.documentElement, "scrollHeight", {
    configurable: true,
    get() {
      return [...(w.document.querySelector(".story")?.children ?? [])].reduce(
        (sum, n) =>
          sum +
          (parseFloat(n.style.height) ||
            (n.id === "intro" ? 1320 : n.id === "playground" ? 3000 : 1000)),
        0,
      )
    },
  })
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const panel = this.closest("[data-panel]")
    const box = chapterBox(panel)
    if (this === panel)
      return bounds(0, box.top - yPosition, currentWidth, box.height)
    const rail = this.closest("[data-horizontal]")
    if (rail && w.document.documentElement.dataset.rails === "on") {
      const track = rail.querySelector(".rail-track")
      const x = Number(
        track.style.transform.match(/translate3d\((-?[\d.]+)px/)?.[1] ?? 0,
      )
      const item = [...track.children].find(
        (n) => n === this || n.contains(this),
      )
      const index = item ? [...track.children].indexOf(item) : 0
      return bounds(
        x + index * 600,
        Math.max(0, box.top - yPosition) + 120,
        this === track ? 2680 : 540,
        400,
      )
    }
    return bounds(
      40,
      box.top - yPosition + (this.matches("h1,h2") ? 100 : 230),
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
    createImageData(width, height) {
      return { data: new Uint8ClampedArray(width * height * 4), width, height }
    },
    putImageData() {},
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

test("cursor toggle persists independently and clears active displacement while motion stays on", async () => {
  let f = fixture({ reduced: true, stored: { "pf.v2.motion": "off" } }),
    unmount = await mountApp(f)
  try {
    assert.equal(document.documentElement.dataset.motion, "on")
    assert.equal(document.querySelector('[aria-controls="motion-pop"]'), null)
    const button = document.querySelector('[aria-label="Cursor barrier"]')
    const canvas = document.querySelector("[data-effect-canvas]")
    movePointer(120, 240)
    await act(async () => f.advance(240))
    await click(button)
    await act(async () => f.advance(32))
    assert.equal(button.getAttribute("aria-pressed"), "false")
    assert.equal(localStorage.getItem("pf.cursorBarrier"), "off")
    canvas._ctx.frameCalls = []
    canvas._ctx.imageCalls = []
    movePointer(160, 260)
    await act(async () => f.advance(240))
    assert.equal(canvas._ctx.frameCalls.length, 0)
    assert.equal(canvas._ctx.imageCalls.length, 0)
    await click(button)
    assert.equal(button.getAttribute("aria-pressed"), "true")
    assert.equal(localStorage.getItem("pf.cursorBarrier"), "on")
  } finally {
    await unmount()
  }
  f = fixture({
    stored: { "pf.cursorBarrier": "off", "pf.v2.motion": "system" },
  })
  unmount = await mountApp(f)
  try {
    assert.equal(document.documentElement.dataset.motion, "on")
    assert.equal(
      document
        .querySelector('[aria-label="Cursor barrier"]')
        .getAttribute("aria-pressed"),
      "false",
    )
  } finally {
    await unmount()
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

test("native vertical scrolling drives sideways chapters without intercepting wheel or keys", async () => {
  const f = fixture(),
    unmount = await mountApp(f)
  try {
    assert.equal(document.documentElement.dataset.layout, "story")
    assert.equal(document.documentElement.dataset.rails, "on")
    assert.equal(document.querySelectorAll("[data-horizontal]").length, 2)
    const chapter = document.getElementById("projects"),
      track = chapter.querySelector(".rail-track")
    const top = chapter.getBoundingClientRect().top + scrollY
    assert.equal(chapter.style.height, "2200px")
    const wheel = new window.WheelEvent("wheel", {
      deltaY: 240,
      bubbles: true,
      cancelable: true,
    })
    chapter.dispatchEvent(wheel)
    assert.equal(wheel.defaultPrevented, false)
    const key = new KeyboardEvent("keydown", {
      key: "PageDown",
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(key)
    assert.equal(key.defaultPrevented, false)
    await act(async () => window.scrollTo({ top: top + 420 }))
    await act(async () => f.advance(32))
    assert.equal(track.style.transform, "translate3d(-420px,0,0)")
    await act(async () => window.scrollTo({ top: top + 200 }))
    await act(async () => f.advance(32))
    assert.equal(track.style.transform, "translate3d(-200px,0,0)")
    await act(async () => window.scrollTo({ top: top + 1800 }))
    await act(async () => f.advance(32))
    assert.equal(track.style.transform, "translate3d(-1400px,0,0)")
    await click(byText("a", "About"))
    await act(async () => f.advance(32))
    assert.equal(location.hash, "#about")
    assert.equal(
      document
        .querySelector('[data-deck-status] a[href="#about"]')
        .getAttribute("aria-current"),
      "true",
    )
    await click(document.querySelector('[aria-label="Cursor barrier"]'))
    assert.equal(document.documentElement.dataset.rails, "on")
    assert.equal(document.documentElement.dataset.motion, "on")
    assert.equal(document.documentElement.dataset.cursorBarrier, "off")
    assert.equal(
      document.getElementById("about").getBoundingClientRect().top,
      0,
      "cursor changes preserve the current chapter",
    )
  } finally {
    await unmount()
  }
})

test("background clicks, typing and object activation have distinct sound timbres", async () => {
  const f = fixture(),
    previous = globalThis.AudioContext,
    played = []
  const parameter = () => ({
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  })
  globalThis.AudioContext = class {
    state = "running"
    currentTime = 1
    destination = {}
    createOscillator() {
      return {
        frequency: parameter(),
        connect() {},
        disconnect() {},
        start() {
          played.push(this.type)
        },
        stop() {},
      }
    }
    createGain() {
      return { gain: parameter(), connect() {}, disconnect() {} }
    }
    async close() {}
  }
  const unmount = await mountApp(f)
  try {
    await click(document.body)
    await act(async () =>
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a", bubbles: true }),
      ),
    )
    await click(document.querySelector('[aria-controls="theme-pop"]'))
    assert.deepEqual(played, ["triangle", "square", "sine"])
    await act(async () =>
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "c",
          ctrlKey: true,
          bubbles: true,
        }),
      ),
    )
    assert.equal(played.length, 3, "shortcuts stay silent")
    await click(document.querySelector('[aria-label="Interface sounds"]'))
    await click(document.body)
    assert.equal(played.length, 3, "mute covers every sound category")
  } finally {
    await unmount()
    if (previous === undefined) delete globalThis.AudioContext
    else globalThis.AudioContext = previous
  }
})

test("Bankai portal hands off music, supports fallback locations, and restores focus on exit", async () => {
  const f = fixture({stored:{"pf.sound":"off"}}), unmount = await mountApp(f)
  try {
    assert.equal(f.audioInstances.length,0,"portal soundtrack never autoplays")
    await click(document.querySelector('[aria-label="Play"]'))
    const original=f.audioInstances[0]
    original.currentTime=37
    const trigger=document.querySelector('[data-world-trigger]')
    await click(trigger)
    const portal=document.querySelector('dialog.garganta'), song=f.audioInstances[1]
    assert.equal(portal.open,true)
    assert.equal(document.documentElement.style.overflow,"hidden")
    assert.equal(original.paused,true)
    assert.equal(song.src,"/music/spirit-world/treachery.mp3")
    assert.equal(song.paused,false)
    await click(byText("button","Skip entrance"))
    assert.equal(portal.dataset.entered,"true")
    assert.ok(portal.querySelector(".spirit-fallback"),"non-WebGL devices retain the experience")
    await click(portal.querySelectorAll('.spirit-locations button')[1])
    assert.ok(portal.querySelector('.spirit-note').textContent.includes('The archive'))
    await click(portal.querySelector('.spirit-note a'))
    assert.equal(portal.open,false)
    assert.equal(location.hash,"#projects")
    assert.equal(song.paused,true)
    assert.equal(original.paused,false)
    assert.equal(original.currentTime,37)
    assert.equal(document.documentElement.style.overflow,"")
    await click(trigger)
    assert.equal(f.audioInstances.length,2,"reentry reuses the soundtrack")
    await act(async()=>portal.dispatchEvent(new Event("cancel",{cancelable:true})))
    assert.equal(portal.open,false)
    assert.equal(document.activeElement,trigger)
    assert.equal(original.paused,false)
  } finally { await unmount() }
})

test("rail focus reveals hidden controls and resizing preserves chapter position", async () => {
  const f = fixture(),
    unmount = await mountApp(f)
  try {
    const chapter = document.getElementById("projects")
    const target = chapter.querySelectorAll("summary")[2]
    await act(async () => target.focus())
    await act(async () => f.advance(32))
    const rect = target.getBoundingClientRect()
    assert.ok(rect.left >= 0 && rect.right <= innerWidth)
    await click(byText("a", "About"))
    await act(async () => f.advance(32))
    await act(async () => {
      f.resize(390)
      f.advance(32)
    })
    assert.equal(document.documentElement.dataset.rails, "off")
    assert.equal(
      document.getElementById("about").getBoundingClientRect().top,
      0,
    )
    await act(async () => {
      f.resize(1280)
      f.advance(32)
    })
    assert.equal(document.documentElement.dataset.rails, "on")
    assert.equal(
      document.getElementById("about").getBoundingClientRect().top,
      0,
    )
  } finally {
    await unmount()
  }
})

test("overlay scrollbar supports keyboard and dragging without reserving a gutter; sounds persist", async () => {
  const f = fixture(),
    unmount = await mountApp(f)
  try {
    const bar = document.querySelector('[role="scrollbar"]')
    assert.equal(document.documentElement.dataset.overlayScrollbar, "true")
    bar.setPointerCapture = () => {}
    await act(async () => {
      window.scrollTo({ top: 500 })
      f.advance(32)
    })
    const before = scrollY
    await act(async () =>
      bar.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      ),
    )
    assert.equal(scrollY, before + 48)
    await act(async () => f.advance(32))
    const pointer = (type, y, target = bar) => {
      const e = new MouseEvent(type, {
        clientY: y,
        button: 0,
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(e, "pointerId", { value: 1 })
      target.dispatchEvent(e)
    }
    const start = scrollY
    await act(async () => {
      pointer("pointerdown", 100, bar.firstElementChild)
      pointer("pointermove", 140)
      pointer("pointerup", 140)
      f.advance(32)
    })
    assert.ok(scrollY > start)
    assert.equal(bar.dataset.dragging, undefined)
    await act(async () => {
      bar.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
      )
      f.advance(32)
    })
    assert.equal(scrollY, 0)
    assert.equal(bar.getAttribute("aria-valuenow"), "0")
    const sound = document.querySelector('[aria-label="Interface sounds"]')
    await click(sound)
    assert.equal(sound.getAttribute("aria-pressed"), "false")
    assert.equal(localStorage.getItem("pf.sound"), "off")
  } finally {
    await unmount()
  }
})

test("signature follows hero scroll, reverses, and draws Contact only once", async () => {
  const f = fixture(),
    observers = []
  globalThis.IntersectionObserver = window.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback
      this.targets = []
      observers.push(this)
    }
    observe(target) {
      this.targets.push(target)
    }
    unobserve() {}
    disconnect() {
      this.targets = []
    }
  }
  const unmount = await mountApp(f)
  try {
    assert.equal(document.querySelectorAll(".photo img").length, 5)
    const hero = document.querySelector(".signature-hero")
    const contact = document.querySelector(".contact-chapter .signature")
    assert.equal(hero.dataset.started, "false")
    assert.equal(hero.style.getPropertyValue("--signature-progress"), "0")
    await act(async () => {
      window.scrollTo({ top: 400 })
      f.advance(32)
    })
    const partial = Number(hero.style.getPropertyValue("--signature-progress"))
    assert.ok(partial > 0.5 && partial < 1)
    assert.equal(hero.dataset.started, "true")
    await act(async () => {
      window.scrollTo({ top: 0 })
      f.advance(32)
    })
    assert.ok(
      Number(hero.style.getPropertyValue("--signature-progress")) < partial,
    )
    const io = observers.find((o) => o.targets.includes(contact))
    await act(async () => {
      io.callback([{ target: contact, isIntersecting: true }])
      f.advance(2400)
    })
    assert.equal(contact.dataset.complete, "true")
    await click(document.querySelector('[aria-controls="theme-pop"]'))
    await click(document.querySelector('input[name="theme"][value="paper"]'))
    assert.equal(
      contact.dataset.complete,
      "true",
      "theme changes do not replay the signature",
    )
    assert.equal(hero.dataset.started, "false")
    assert.equal(hero.style.getPropertyValue("--signature-progress"), "0")
  } finally {
    await unmount()
    delete globalThis.IntersectionObserver
    delete window.IntersectionObserver
  }
})

test("ASCII presentation uses character controls and frames, keeps media mounted, and cleans up on leaving", async () => {
  const f = fixture(),
    unmount = await mountApp(f)
  try {
    const footerNav = document.querySelector("[data-deck-status] nav")
    assert.ok(footerNav.querySelector('a[href="#about"]'))
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

test("real React tree preserves audio and text through rapid navigation, history, mode changes and cursor toggles", async () => {
  const f = fixture(),
    unmount = await mountApp(f)
  try {
    assert.equal(document.documentElement.dataset.layout, "story")
    assert.equal(document.documentElement.dataset.theme, "dark")
    assert.equal(document.documentElement.dataset.motion, "on")
    assert.ok(
      document
        .querySelector('[aria-controls="theme-pop"]')
        .textContent.includes("Ink"),
    )
    assert.equal(document.querySelectorAll("[data-panel]").length, 9)
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
    assert.equal(
      document.getElementById("experience").getBoundingClientRect().top,
      0,
    )
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    )
    assert.equal(document.querySelector(".rail-track").style.transition, "")
    await act(async () => {
      history.replaceState(null, "", "#projects")
      window.dispatchEvent(new Event("popstate"))
    })
    assert.equal(
      document.getElementById("projects").getBoundingClientRect().top,
      0,
    )
    await click(byText("button", "ASCII"))
    await act(async () => f.advance(1600))
    assert.equal(document.documentElement.dataset.mode, "ascii")
    assert.ok(document.getElementById("intro").textContent.includes("李嘉和"))
    await click(document.querySelector('[aria-controls="theme-pop"]'))
    await click(document.querySelector('input[name="theme"][value="paper"]'))
    assert.equal(f.audioInstances.length, 1)
    assert.equal(audio.currentTime, 37)
    assert.equal(audio.paused, false)
    assert.equal(
      document.querySelector('[aria-label="Cursor barrier"]').disabled,
      true,
    )
    await click(byText("button", "Dynamic"))
    await click(document.querySelector('[aria-label="Cursor barrier"]'))
    assert.equal(document.documentElement.dataset.motion, "on")
    assert.equal(document.documentElement.dataset.cursorBarrier, "off")
    assert.equal(audio.paused, false)
    await click(byText("a", "Contact"))
    assert.equal(document.querySelector(".rail-track").style.transition, "")
    assert.equal(location.hash, "#contact")
  } finally {
    await unmount()
  }
})

test("three curated themes migrate existing preferences and persist one explicit selection", async () => {
  let f = fixture({
      stored: { "pf.v3.palette": "candy", "pf.v2.motion": "off" },
    }),
    unmount = await mountApp(f)
  try {
    assert.equal(document.documentElement.dataset.palette, "electric-blue")
    await click(document.querySelector('[aria-controls="theme-pop"]'))
    assert.deepEqual(
      [...document.querySelectorAll('input[name="theme"]')].map((n) => n.value),
      ["ink", "paper", "electric-blue"],
    )
    assert.equal(byText("button", "Light"), undefined)
    await click(document.querySelector('input[name="theme"][value="paper"]'))
    assert.equal(localStorage.getItem("pf.v4.theme"), "paper")
    assert.equal(document.documentElement.dataset.theme, "light")
  } finally {
    await unmount()
  }
  f = fixture({
    stored: {
      "pf.v4.theme": "ink",
      "pf.v2.appearance": "light",
      "pf.v3.palette": "candy",
    },
  })
  unmount = await mountApp(f)
  try {
    assert.equal(document.documentElement.dataset.palette, "ink")
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
    assert.equal(document.documentElement.dataset.layout, "story")
    const book = document.querySelector('[aria-haspopup="dialog"]')
    await click(book)
    const dialog = document.querySelector("dialog")
    assert.equal(dialog.open, true)
    const title = document.getElementById("book-title").textContent
    await click(dialog.querySelector('[aria-label="Close"]'))
    await act(async () => f.advance(240))
    assert.equal(dialog.open, false)
    assert.equal(document.activeElement, book)
    await click(book)
    assert.equal(document.getElementById("book-title").textContent, title)
    await act(async () =>
      dialog.dispatchEvent(new Event("cancel", { cancelable: true })),
    )
    await act(async () => f.advance(240))
    assert.equal(dialog.open, false)
    assert.equal(document.activeElement, book)
    assert.equal(document.documentElement.dataset.motion, "on")
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
        .querySelector('[aria-controls="theme-pop"]')
        .textContent.includes("Ink"),
    )
    await click(document.querySelector('[aria-controls="theme-pop"]'))
    await click(document.querySelector('input[name="theme"][value="paper"]'))
    assert.equal(localStorage.getItem("pf.v4.theme"), "paper")
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
    assert.equal(document.documentElement.dataset.motion, "on")
    assert.ok(
      document
        .querySelector('[aria-controls="theme-pop"]')
        .textContent.includes("Paper"),
    )
  } finally {
    await unmount()
  }
})

test("hero names use independent Chinese stroke clips and retain an accessible English heading", async () => {
  const f = fixture(), unmount = await mountApp(f)
  try {
    const characters = [...document.querySelectorAll(".chinese-name-drawing > svg")]
    assert.deepEqual(characters.map(el => el.dataset.character), ["李", "嘉", "和"])
    const strokes = [...document.querySelectorAll(".name-pen-stroke")]
    assert.equal(strokes.length, 29)
    const delays = strokes.map(el => parseFloat(el.style.getPropertyValue("--pen-delay")))
    assert.ok(delays.every((delay, i) => !i || delay > delays[i - 1]))
    for (const stroke of strokes) {
      const id = stroke.getAttribute("clip-path").slice(5, -1)
      assert.ok(document.getElementById(id)?.querySelector("path").getAttribute("d"))
    }
    assert.equal(document.querySelector("#intro-h .sr-only").textContent, "Leo Li.")
  } finally { await unmount() }
})
