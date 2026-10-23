import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"
import { JSDOM } from "jsdom"
import React, { act } from "react"
import { createRoot } from "react-dom/client"

let server, geometry, rendererModule, snapshotModule, App
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  geometry = await server.ssrLoadModule("/src/effects/geometry.ts")
  rendererModule = await server.ssrLoadModule("/src/effects/renderer.ts")
  snapshotModule = await server.ssrLoadModule("/src/effects/snapshot.ts")
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
    const slide = parseFloat(
      w.document
        .querySelector(".deck-track")
        ?.style.transform.match(/translate3d\(([-\d.]+)/)?.[1] ?? "0",
    )
    const left = panel
      ? panels.indexOf(panel) * currentWidth + (slide / 100) * currentWidth
      : 0
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
    setTransform() {},
    clearRect() {},
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
      if (paintCalls.length < 10000) paintCalls.push(args)
    },
    fillText(text, x, y) {
      this.textCalls.push(text)
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

test("ripple radius is finite and bounded even when rAF predates the click", () => {
  const reach = geometry.farthestCorner({ x: 40, y: 200 }, 1280, 800)
  for (const age of [-100, -0.3, 0, 10, 450, 900, 2000]) {
    const { radius, alpha } = geometry.rippleAt(age, reach)
    assert.ok(Number.isFinite(radius) && radius >= 0 && radius <= reach)
    assert.ok(alpha >= 0 && alpha <= 1)
  }
  assert.equal(geometry.rippleAt(-1, reach).radius, 0)
})

test("scatter paths land exactly on targets; dust reconstructs at its origin", () => {
  const from = { x: 20, y: 30 },
    to = { x: 900, y: 500 }
  assert.deepEqual(geometry.assemblyAt(from, to, -1, 0.3), from)
  const end = geometry.assemblyAt(from, to, 2, 0.3)
  assert.ok(Math.abs(end.x - to.x) < 1e-8 && Math.abs(end.y - to.y) < 1e-8)
  for (let seed = 0; seed < 100; seed++) {
    const p = geometry.assemblyAt(from, to, seed / 100, geometry.noise(seed))
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y))
    const dust = geometry.dustAt(from, { x: 1, y: 0 }, seed / 100)
    assert.ok(Math.abs(dust.x - from.x) <= 22)
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

test("renderer retargets, cancels work, and completes pending dialog closure on disposal", () => {
  const f = fixture(),
    d = f.dom.window.document
  d.documentElement.dataset.motion = "on"
  d.body.insertAdjacentHTML(
    "beforeend",
    '<header>Navigation</header><div class="deck"><section id="one"><h2>李嘉和 stays intact</h2></section><section id="two"><h2>Projects</h2></section></div><footer data-deck-status>Pages</footer>',
  )
  const canvas = d.createElement("canvas")
  d.body.append(canvas)
  const renderer = rendererModule.createRenderer(canvas)
  const one = d.getElementById("one"),
    two = d.getElementById("two"),
    text = one.textContent
  renderer.transition(one, two)
  assert.equal(d.querySelectorAll("[data-screen-pixelation]").length, 3)
  assert.ok(
    [...d.querySelectorAll("header,.deck,[data-deck-status]")].every(
      (el) => !el.style.filter,
    ),
    "live content never receives blur-producing SVG filters",
  )
  assert.deepEqual(
    canvas._ctx.imageCalls[0].slice(1),
    [0, 0, 1280, 800],
    "first paint covers the viewport synchronously",
  )
  assert.equal(canvas._ctx.imageSmoothingEnabled, false)
  assert.equal(f.frames.size, 1)
  renderer.transition(two, one)
  assert.equal(
    f.frames.size,
    1,
    "new navigation replaces the previous frame loop",
  )
  f.advance()
  assert.equal(f.frames.size, 0)
  assert.equal(d.querySelectorAll("[data-screen-pixelation]").length, 0)
  assert.equal(one.textContent, text)
  renderer.assemble(one)
  let closed = 0
  renderer.disperse(one, () => closed++)
  renderer.dispose()
  assert.equal(closed, 1)
  assert.equal(f.frames.size, 0)
  d.body.click()
  assert.equal(f.frames.size, 0, "listeners are removed")
  f.dom.window.close()
})

test("unmarked text and navigation react to proximity and restore their original styles", () => {
  const f = fixture(),
    d = f.dom.window.document
  d.documentElement.dataset.motion = "on"
  d.body.insertAdjacentHTML(
    "beforeend",
    '<header><a href="#example">Navigation</a></header><p style="filter:contrast(1.1)">Unmarked text <span id="nested">nested label</span></p><span id="meta">Metadata</span><button>Unmarked button</button>',
  )
  const canvas = d.createElement("canvas")
  canvas.dataset.effectCanvas = ""
  d.body.append(canvas)
  const renderer = rendererModule.createRenderer(canvas)
  const pointer = new Event("pointermove")
  Object.defineProperties(pointer, {
    clientX: { value: 100 },
    clientY: { value: 250 },
    pointerType: { value: "mouse" },
    buttons: { value: 0 },
  })
  window.dispatchEvent(pointer)
  f.advance(32)
  for (const el of d.querySelectorAll("p,#meta,button,a")) {
    assert.ok(
      el.hasAttribute("data-proximity-active"),
      `${el.tagName} reacts without data-fx`,
    )
    assert.ok(!el.style.filter.includes("url("))
    assert.ok(el.style.translate.includes("calc("))
  }
  assert.equal(
    d.getElementById("nested").style.translate,
    "",
    "nested labels do not get a second transform",
  )
  assert.equal(
    d.getElementById("nested").hasAttribute("data-proximity-active"),
    false,
  )
  assert.ok(d.querySelector("p").style.filter.includes("contrast"))
  f.advance(1200)
  assert.equal(d.querySelectorAll("[data-proximity-active]").length, 0)
  assert.equal(d.querySelector("p").style.filter, "contrast(1.1)")
  assert.equal(f.frames.size, 0)
  window.dispatchEvent(pointer)
  f.advance(32)
  renderer.cancel()
  assert.equal(d.querySelectorAll("[data-proximity-active]").length, 0)
  assert.equal(d.querySelector("p").style.filter, "contrast(1.1)")
  assert.equal(f.frames.size, 0)
  renderer.dispose()
  f.dom.window.close()
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
    const painted = raster._ctx.textCalls.join("")
    assert.ok(painted.includes("Navigation"))
    assert.ok(painted.includes("Pagestatus"))
    assert.ok(painted.includes("Paneltext"))
  } finally {
    f.dom.window.close()
  }
})

test("proximity eases direction changes instead of snapping across the center", () => {
  const f = fixture(),
    d = f.dom.window.document
  d.documentElement.dataset.motion = "on"
  d.body.insertAdjacentHTML("beforeend", '<p id="smooth">Smooth motion</p>')
  const canvas = d.createElement("canvas")
  canvas.dataset.effectCanvas = ""
  d.body.append(canvas)
  const renderer = rendererModule.createRenderer(canvas)
  const move = (x) => {
    const event = new Event("pointermove")
    Object.defineProperties(event, {
      clientX: { value: x },
      clientY: { value: 250 },
      pointerType: { value: "mouse" },
      buttons: { value: 0 },
    })
    window.dispatchEvent(event)
  }
  const position = () =>
    Number(
      d.getElementById("smooth").style.translate.match(/\+ ([-\d.]+)px/)?.[1],
    )
  try {
    move(100)
    f.advance(64)
    const before = position()
    assert.ok(before > 0)
    move(530)
    f.advance(16)
    assert.ok(
      position() > 0,
      "direction reversal eases through the old position",
    )
    assert.ok(position() < before)
    f.advance(1600)
    assert.equal(d.getElementById("smooth").style.translate, "")
    assert.equal(f.frames.size, 0)
  } finally {
    renderer.dispose()
    f.dom.window.close()
  }
})

test("rapid ripples finish, selections and hidden tabs clear work, motion-off is immediate", () => {
  const f = fixture(),
    d = f.dom.window.document
  d.documentElement.dataset.motion = "on"
  const canvas = d.createElement("canvas")
  d.body.append(canvas)
  const renderer = rendererModule.createRenderer(canvas)
  for (let i = 0; i < 80; i++)
    d.body.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        detail: 1,
        clientX: i * 8,
        clientY: 100,
      }),
    )
  assert.equal(f.frames.size, 1)
  f.advance(2000)
  assert.equal(f.frames.size, 0)
  assert.ok(f.paintCalls.length > 0)
  d.body.click()
  d.body.insertAdjacentHTML(
    "beforeend",
    '<p id="selection">Selectable content</p>',
  )
  const range = d.createRange()
  range.selectNodeContents(d.getElementById("selection"))
  d.getSelection().addRange(range)
  d.dispatchEvent(new Event("selectionchange"))
  assert.equal(f.frames.size, 0)
  d.getSelection().removeAllRanges()
  d.body.click()
  d.hidden = true
  d.dispatchEvent(new Event("visibilitychange"))
  assert.equal(f.frames.size, 0)
  d.hidden = false
  d.documentElement.dataset.motion = "off"
  let closed = false
  renderer.disperse(d.body, () => (closed = true))
  assert.equal(closed, true)
  assert.equal(f.frames.size, 0)
  renderer.dispose()
  f.dom.window.close()
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
  renderer.transition(d.body, d.body)
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
  [...document.querySelectorAll(selector)].find(
    (el) => el.textContent.trim() === text,
  )
const click = async (el) => {
  assert.ok(el, "control exists")
  await act(async () => el.click())
}

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
        .textContent.includes("Candy Shop"),
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
    assert.equal(location.hash, "#experience")
    assert.match(
      document.querySelector(".deck-track").style.transform,
      /-100vw/,
    )
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    )
    assert.equal(document.querySelector(".deck-track").style.transition, "none")
    await act(async () => {
      history.replaceState(null, "", "#projects")
      window.dispatchEvent(new Event("popstate"))
    })
    assert.match(
      document.querySelector(".deck-track").style.transform,
      /-200vw/,
    )
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
    assert.equal(document.querySelector(".deck-track").style.transition, "none")
    assert.equal(location.hash, "#contact")
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
        .textContent.includes("Candy Shop"),
    )
    await click(byText("button", "Light"))
    assert.equal(localStorage.getItem("pf.v2.appearance"), "light")
  } finally {
    await unmount()
  }
  f = fixture({
    stored: {
      "pf.v2.appearance": "light",
      "pf.v2.palette": "riso",
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
        .textContent.includes("Riso Print"),
    )
  } finally {
    await unmount()
  }
})
