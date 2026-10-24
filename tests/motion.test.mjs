import assert from "node:assert/strict"
import { before, after, test } from "node:test"
import { createServer } from "vite"
import { JSDOM } from "jsdom"

let server, surfaceModule, entranceModule, asciiModule
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  surfaceModule = await server.ssrLoadModule("/src/effects/screenSurface.ts")
  entranceModule = await server.ssrLoadModule("/src/effects/entrances.ts")
  asciiModule = await server.ssrLoadModule("/src/effects/asciiTransition.ts")
})
after(async () => server?.close())

// WebGL calls are explicit doubles: these verify batching and resource lifetime,
// not shader compilation, browser frame rates or visual appearance.
function fixture({
  failCompile = false,
  failLink = false,
  failTexture = -1,
  uploadError = false,
  precision = 23,
} = {}) {
  const dom = new JSDOM("<!doctype html><main></main>"),
    d = dom.window.document
  globalThis.window = dom.window
  globalThis.document = d
  dom.window.WebGLRenderingContext = class {}
  const host = d.createElement("canvas")
  d.body.append(host)
  const calls = [],
    objects = [],
    deleted = new Set()
  let textureCount = 0,
    lostCalls = 0,
    canvas
  const object = (type) => {
    const value = { type, id: objects.length }
    objects.push(value)
    return value
  }
  const gl = {
    createShader: () => object("shader"),
    createProgram: () => object("program"),
    createBuffer: () => object("buffer"),
    createTexture: () =>
      textureCount++ === failTexture ? null : object("texture"),
    getShaderParameter: () => !failCompile,
    getShaderInfoLog: () => "fixture shader error",
    getProgramParameter: () => !failLink,
    getShaderPrecisionFormat: () => ({ precision }),
    getAttribLocation: () => 0,
    getUniformLocation: (_, name) => name,
    getError: () => (uploadError ? 99 : 0),
    getExtension: () => ({
      loseContext() {
        lostCalls++
      },
    }),
  }
  for (const [i, key] of [
    "VERTEX_SHADER",
    "FRAGMENT_SHADER",
    "COMPILE_STATUS",
    "LINK_STATUS",
    "HIGH_FLOAT",
    "ARRAY_BUFFER",
    "STATIC_DRAW",
    "FLOAT",
    "TEXTURE0",
    "TEXTURE_2D",
    "TEXTURE_WRAP_S",
    "TEXTURE_WRAP_T",
    "CLAMP_TO_EDGE",
    "TEXTURE_MIN_FILTER",
    "TEXTURE_MAG_FILTER",
    "NEAREST",
    "RGBA",
    "UNSIGNED_BYTE",
    "UNPACK_FLIP_Y_WEBGL",
    "UNPACK_PREMULTIPLY_ALPHA_WEBGL",
    "TRIANGLES",
  ].entries())
    gl[key] = i + 1
  gl.NO_ERROR = 0
  for (const key of [
    "shaderSource",
    "compileShader",
    "attachShader",
    "linkProgram",
    "useProgram",
    "bindBuffer",
    "bufferData",
    "enableVertexAttribArray",
    "vertexAttribPointer",
    "viewport",
    "pixelStorei",
    "activeTexture",
    "bindTexture",
    "texParameteri",
    "texImage2D",
    "uniform1i",
    "uniform1f",
    "uniform2f",
    "drawArrays",
  ]) {
    gl[key] = (...args) => calls.push({ key, args })
  }
  for (const key of [
    "deleteShader",
    "deleteProgram",
    "deleteBuffer",
    "deleteTexture",
  ]) {
    gl[key] = (value) => {
      assert.ok(!deleted.has(value), "resources are deleted once")
      deleted.add(value)
    }
  }
  const create = d.createElement.bind(d)
  d.createElement = (...args) => {
    const el = create(...args)
    if (args[0] === "canvas") {
      canvas = el
      el.getContext = (kind) => {
        assert.equal(kind, "webgl")
        return gl
      }
    }
    return el
  }
  const source = { width: 3840, height: 2160, ownerDocument: d }
  return {
    dom,
    d,
    host,
    calls,
    objects,
    deleted,
    gl,
    source,
    get canvas() {
      return canvas
    },
    get lostCalls() {
      return lostCalls
    },
  }
}

test("GPU transitions reuse one program and issue one triangle per frame with no raster copies", () => {
  const f = fixture()
  try {
    const surface = surfaceModule.createScreenSurface(f.host, () => {})
    assert.ok(surface)
    const effect = surface.start(f.source, f.source, {
      width: 3840,
      height: 2160,
      variant: "pools",
      direction: -1,
    })
    assert.ok(effect)
    assert.ok(
      f.canvas.width * f.canvas.height <= 2_400_000,
      "4K fill work stays bounded",
    )
    assert.equal(f.canvas.parentElement, f.host.parentElement)
    assert.equal(f.canvas.hidden, false)
    assert.equal(f.host.style.visibility, "hidden")
    assert.ok(
      f.calls.some(
        (c) =>
          c.key === "uniform1i" && c.args[0] === "variant" && c.args[1] === 1,
      ),
    )
    assert.ok(
      f.calls.some(
        (c) =>
          c.key === "uniform1f" &&
          c.args[0] === "direction" &&
          c.args[1] === -1,
      ),
    )
    assert.equal(f.calls.filter((c) => c.key === "texImage2D").length, 2)
    const count = f.objects.length,
      marker = f.calls.length,
      width = f.canvas.width
    for (let i = 0; i <= 120; i++) effect.paint(null, i / 120)
    const frames = f.calls.slice(marker)
    assert.equal(frames.filter((c) => c.key === "drawArrays").length, 121)
    assert.ok(
      frames.every((c) => ["uniform1f", "drawArrays"].includes(c.key)),
      "frames only update scalar uniforms and draw; no canvas resizing/uploads/buffers/readback",
    )
    assert.equal(f.objects.length, count)
    assert.equal(f.canvas.width, width)
    assert.deepEqual(frames.at(-2).args, ["opacity", 0])
    effect.dispose()
    assert.equal(f.canvas.hidden, true)
    assert.equal(f.host.style.visibility, "")
    const second = surface.start(f.source, f.source, {
      width: 1280,
      height: 800,
      variant: "drain",
    })
    assert.ok(second)
    assert.equal(f.objects.filter((o) => o.type === "program").length, 1)
    assert.equal(f.objects.filter((o) => o.type === "shader").length, 2)
    const before = f.calls.length
    effect.paint(null, 0.5)
    effect.dispose()
    assert.equal(
      f.calls.length,
      before,
      "old effects cannot draw or hide a new transition",
    )
    assert.equal(f.canvas.hidden, false)
    surface.dispose()
    surface.dispose()
    assert.equal(f.canvas.isConnected, false)
    assert.equal(f.objects.length, f.deleted.size)
    assert.equal(f.lostCalls, 1)
  } finally {
    f.dom.window.close()
  }
})

test("context loss immediately releases the live overlay and future transitions use the fallback", () => {
  const f = fixture()
  try {
    let losses = 0
    const surface = surfaceModule.createScreenSurface(f.host, () => losses++)
    const effect = surface.start(f.source, f.source, {
      width: 1280,
      height: 800,
      variant: "spill",
    })
    const event = new f.dom.window.Event("webglcontextlost", {
      cancelable: true,
    })
    f.canvas.dispatchEvent(event)
    assert.equal(event.defaultPrevented, true)
    assert.equal(losses, 1)
    assert.equal(f.canvas.hidden, true)
    assert.equal(f.host.style.visibility, "")
    const count = f.calls.length
    effect.paint(null, 0.4)
    assert.equal(f.calls.length, count)
    assert.equal(
      surface.start(f.source, f.source, {
        width: 1280,
        height: 800,
        variant: "pour",
      }),
      null,
    )
    surface.dispose()
    assert.equal(f.objects.length, f.deleted.size)
  } finally {
    f.dom.window.close()
  }
})

test("shader/link failures clean up partial initialization instead of blocking navigation", () => {
  for (const options of [{ failCompile: true }, { failLink: true }]) {
    const f = fixture(options)
    try {
      assert.equal(
        surfaceModule.createScreenSurface(f.host, () => {}),
        null,
      )
      assert.equal(f.objects.length, f.deleted.size)
      assert.equal(f.canvas.isConnected, false)
    } finally {
      f.dom.window.close()
    }
  }
})

test("partial texture allocation and upload failures release both textures and leave no overlay", () => {
  for (const options of [
    { failTexture: 0 },
    { failTexture: 1 },
    { uploadError: true },
  ]) {
    const f = fixture(options)
    try {
      const surface = surfaceModule.createScreenSurface(f.host, () => {})
      assert.ok(surface)
      assert.equal(
        surface.start(f.source, f.source, {
          width: 1280,
          height: 800,
          variant: "split",
        }),
        null,
      )
      assert.equal(f.canvas.hidden, true)
      assert.ok(
        f.objects
          .filter((o) => o.type === "texture")
          .every((o) => f.deleted.has(o)),
      )
      surface.dispose()
      assert.equal(f.objects.length, f.deleted.size)
    } finally {
      f.dom.window.close()
    }
  }
})

test("devices without highp fragment precision receive the mediump shader variant", () => {
  const f = fixture({ precision: 0 })
  try {
    const surface = surfaceModule.createScreenSurface(f.host, () => {})
    const shader = f.calls.filter((c) => c.key === "shaderSource").at(-1)
      .args[1]
    assert.ok(shader.includes("precision mediump float"))
    surface.dispose()
  } finally {
    f.dom.window.close()
  }
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

test("ASCII transitions draw only a bounded number of character traces and release at completion", () => {
  for (const variant of [
    "spill",
    "pools",
    "counterflow",
    "pour",
    "split",
    "drain",
  ]) {
    const calls = [],
      ctx = {
        save() {},
        restore() {},
        fillText(...args) {
          calls.push(args)
        },
        drawImage() {
          assert.fail("ASCII transitions do not copy raster pixels")
        },
        fillRect() {
          assert.fail("ASCII transitions do not paint pixel cells")
        },
      }
    const effect = asciiModule.createAsciiTransition({
      width: 1280,
      height: 800,
      color: "#aaa",
      variant,
    })
    effect.paint(ctx, 0)
    assert.equal(calls.length, 0)
    effect.paint(ctx, 0.4)
    assert.equal(calls.length, 3)
    assert.ok(
      calls.every(
        ([text, x, y]) =>
          /^[\x20-\x7e]*$/.test(text) &&
          x >= 0 &&
          x <= 1280 &&
          y >= 0 &&
          y <= 800,
      ),
    )
    effect.paint(ctx, 1)
    effect.dispose()
    effect.paint(ctx, 0.5)
    assert.equal(calls.length, 3)
  }
})
