import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server, screen, geometry
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  screen = await server.ssrLoadModule("/src/effects/screen.ts")
  geometry = await server.ssrLoadModule("/src/effects/screenGeometry.ts")
})

after(async () => server?.close())

// These canvas doubles check geometry, buffer use and lifecycle without a
// browser. They deliberately do not claim to verify the appearance of pixels.
function context() {
  const calls = [],
    stack = []
  return {
    calls,
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    save() {
      stack.push([this.globalAlpha, this.imageSmoothingEnabled])
    },
    restore() {
      assert.ok(stack.length, "paint balances canvas save and restore")
      ;[this.globalAlpha, this.imageSmoothingEnabled] = stack.pop()
    },
    drawImage(...args) {
      assert.ok(args.slice(1).every(Number.isFinite))
      calls.push({
        args,
        alpha: this.globalAlpha,
        smoothing: this.imageSmoothingEnabled,
      })
    },
    fillText() {},
    get savedStates() {
      return stack.length
    },
  }
}

function fixture(width, height, failAt = -1) {
  const buffers = []
  const ownerDocument = {
    createElement(tag) {
      assert.equal(tag, "canvas")
      const ctx = context()
      let bufferWidth = 0,
        bufferHeight = 0,
        resizes = 0
      const buffer = {
        ownerDocument,
        get width() {
          return bufferWidth
        },
        set width(value) {
          resizes++
          bufferWidth = value
        },
        get height() {
          return bufferHeight
        },
        set height(value) {
          resizes++
          bufferHeight = value
        },
        get resizes() {
          return resizes
        },
        ctx,
        getContext(kind) {
          assert.equal(kind, "2d")
          return buffers.indexOf(buffer) === failAt ? null : ctx
        },
      }
      buffers.push(buffer)
      return buffer
    },
  }
  const from = { ownerDocument, width, height, name: "outgoing" }
  const into = { ownerDocument, width, height, name: "incoming" }
  return { from, into, buffers, ctx: context() }
}

function spans(band) {
  return Array.from({ length: band.count }, (_, i) => [
    band.starts[i],
    band.ends[i],
  ])
}

function assertBand(band) {
  assert.ok(band.count >= 0 && band.count <= 3)
  assert.ok(Number.isFinite(band.dx) && Number.isFinite(band.dy))
  let previous = 0
  for (const [start, end] of spans(band)) {
    assert.ok(start >= previous && start >= 0 && end <= 1 && end > start)
    previous = end
  }
}

// Length of the symmetric difference between two sets of reveal intervals.
// This remains meaningful when growing pools join and their span count changes.
function maskDifference(a, b) {
  let overlap = 0
  for (const [a0, a1] of a) {
    for (const [b0, b1] of b) {
      overlap += Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
    }
  }
  const length = (mask) => mask.reduce((sum, [lo, hi]) => sum + hi - lo, 0)
  return length(a) + length(b) - 2 * overlap
}

function assertInBounds(calls, width, height) {
  const epsilon = 1e-8
  for (const { args } of calls) {
    const source = args[0]
    if (args.length === 5) {
      assert.deepEqual(args.slice(1), [0, 0, width, height])
      continue
    }
    assert.equal(args.length, 9)
    const [, sx, sy, sw, sh, x, y, w, h] = args
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0)
    assert.ok(x + w <= width + epsilon && y + h <= height + epsilon)
    assert.ok(sx >= 0 && sy >= 0 && sw > 0 && sh > 0)
    assert.ok(
      sx + sw <= source.width + epsilon && sy + sh <= source.height + epsilon,
      "flow samples stay inside their source raster, including viewport edges",
    )
  }
}

function isDisplaced({ args }, width, height) {
  if (args.length !== 9) return false
  const [source, sx, sy, , , x, y] = args
  return (
    Math.abs((sx / source.width) * width - x) > 1e-6 ||
    Math.abs((sy / source.height) * height - y) > 1e-6
  )
}

test("screen timing stays opaque beyond the deck slide and keeps cells at a stable two pixels", () => {
  for (const progress of [-1, 0, 0.08, 0.3, 0.5, 0.7, 0.8, 0.86]) {
    assert.equal(geometry.screenOpacity(progress), 1)
  }
  assert.equal(geometry.screenOpacity(1), 0)
  assert.equal(geometry.screenOpacity(2), 0)
  assert.ok(
    geometry.screenOpacity(0.93) > 0 && geometry.screenOpacity(0.93) < 1,
  )
  assert.equal(geometry.screenPixelSize(0), 2)
  assert.equal(geometry.screenPixelSize(0.41), 2)
  assert.equal(geometry.screenPixelSize(0.8), 2)
  assert.equal(geometry.screenPixelSize(1), 2)
  for (const progress of [-1, 0, 0.1, 0.4, 0.86, 1, 2, NaN, Infinity]) {
    assert.ok(Number.isInteger(geometry.screenPixelSize(progress)))
    assert.ok(
      geometry.screenPixelSize(progress) >= 2 &&
        geometry.screenPixelSize(progress) <= 2,
    )
    assert.ok(
      geometry.screenOpacity(progress) >= 0 &&
        geometry.screenOpacity(progress) <= 1,
    )
  }
})

test("six distinct liquid masks reuse their output and settle completely before fade", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, -1, NaN].map(geometry.screenVariant), [
    "spill",
    "pools",
    "counterflow",
    "pour",
    "split",
    "drain",
    "spill",
    "pools",
    "spill",
  ])
  const signatures = new Set()
  for (const variant of geometry.SCREEN_VARIANTS) {
    const out = geometry.createFlowBand(),
      starts = out.starts,
      ends = out.ends,
      signature = []
    for (const direction of [-1, 1]) {
      for (let row = 0; row <= 32; row++) {
        const position = row / 32
        for (const progress of [-1, 0, 0.1, 0.25, 0.4, 0.6, 0.8, 0.86, 1, 2]) {
          assert.equal(
            geometry.screenFlowAt(position, progress, variant, direction, out),
            out,
          )
          assert.equal(out.starts, starts)
          assert.equal(out.ends, ends)
          assertBand(out)
          if (progress <= 0) {
            assert.equal(
              out.count,
              0,
              "no incoming pixels at the opening frame",
            )
            assert.equal(out.dx, 0)
            assert.equal(out.dy, 0)
          } else if (progress >= 0.8) {
            assert.deepEqual(spans(out), [[0, 1]])
            assert.equal(out.dx, 0)
            assert.equal(out.dy, 0)
          } else if (direction === 1) {
            signature.push(spans(out))
          }
        }
      }
    }
    signatures.add(JSON.stringify(signature))
  }
  assert.equal(
    signatures.size,
    6,
    "each navigation style has its own liquid pattern",
  )
})

test("reverse navigation mirrors the liquid coverage and the corresponding flow axis", () => {
  for (const variant of geometry.SCREEN_VARIANTS) {
    const forward = geometry.createFlowBand(),
      backward = geometry.createFlowBand()
    for (const position of [0, 0.13, 0.37, 0.68, 1]) {
      for (const progress of [0, 0.1, 0.25, 0.4, 0.6, 0.8]) {
        geometry.screenFlowAt(position, progress, variant, 1, forward)
        geometry.screenFlowAt(position, progress, variant, -1, backward)
        const mirrored = spans(backward)
          .map(([start, end]) => [1 - end, 1 - start])
          .reverse()
        assert.equal(forward.count, mirrored.length)
        for (let i = 0; i < forward.count; i++) {
          assert.ok(Math.abs(forward.starts[i] - mirrored[i][0]) < 1e-12)
          assert.ok(Math.abs(forward.ends[i] - mirrored[i][1]) < 1e-12)
        }
        const same = variant === "pour" ? "dx" : "dy",
          opposite = variant === "pour" ? "dy" : "dx"
        assert.equal(forward[same], backward[same])
        assert.ok(Math.abs(forward[opposite] + backward[opposite]) < 1e-12)
      }
    }
  }
})

test("liquid masks are deterministic and move continuously instead of jittering or popping tiles", () => {
  for (const variant of geometry.SCREEN_VARIANTS) {
    const a = geometry.createFlowBand(),
      b = geometry.createFlowBand()
    for (const direction of [-1, 1]) {
      for (let row = 0; row <= 16; row++) {
        for (let frame = 0; frame <= 100; frame++) {
          const position = row / 16,
            progress = frame / 100
          geometry.screenFlowAt(position, progress, variant, direction, a)
          geometry.screenFlowAt(position, progress, variant, direction, b)
          assert.deepEqual(spans(a), spans(b))
          assert.equal(a.dx, b.dx)
          assert.equal(a.dy, b.dy)
          geometry.screenFlowAt(
            position,
            progress + 1e-5,
            variant,
            direction,
            b,
          )
          assert.ok(maskDifference(spans(a), spans(b)) < 0.01)
          assert.ok(Math.abs(a.dx - b.dx) < 0.001)
          assert.ok(Math.abs(a.dy - b.dy) < 0.001)
        }
      }
    }
  }
})

test("partial frames mask the entire viewport, sample within bounds, and reuse two fixed mosaics", () => {
  for (const [width, height] of [
    [1, 1],
    [1, 67],
    [71, 1],
    [390, 844],
    [1301, 779],
    [3840, 2160],
  ]) {
    for (const variant of geometry.SCREEN_VARIANTS) {
      for (const direction of [-1, 1]) {
        const { from, into, buffers, ctx } = fixture(width, height)
        const transition = screen.createScreenTransition(from, into, {
          width,
          height,
          variant,
          direction,
          ascii: true,
        })
        assert.equal(buffers.length, 2)
        for (let index = 0; index < buffers.length; index++) {
          const size = 2 + Math.floor(index / 2),
            buffer = buffers[index]
          assert.equal(buffer.width, Math.ceil(width / size))
          assert.equal(buffer.height, Math.ceil(height / size))
          assert.equal(buffer.ctx.calls[0].args[0], index % 2 ? into : from)
          assert.equal(buffer.ctx.calls[0].smoothing, false)
          assert.equal(buffer.ctx.calls.length, 1)
          assert.equal(buffer.resizes, 2)
        }
        ctx.globalAlpha = 0.37
        for (const progress of [0, 0.04, 0.1, 0.3, 0.5, 0.7, 0.799999]) {
          ctx.calls.length = 0
          transition.paint(ctx, progress)
          const base = ctx.calls[0]
          assert.equal(
            base.args[0],
            buffers[(geometry.screenPixelSize(progress) - 2) * 2],
          )
          assert.deepEqual(base.args.slice(1), [0, 0, width, height])
          assert.ok(
            ctx.calls.every(
              ({ alpha, smoothing }) => alpha === 1 && smoothing === false,
            ),
            "the outgoing base and both sides of each fluid boundary stay opaque",
          )
          assertInBounds(ctx.calls, width, height)
          assert.ok(
            ctx.calls.length < 2000,
            "strip count remains bounded at 4K",
          )
          assert.equal(
            buffers.length,
            2,
            "paint does not allocate new canvases",
          )
          assert.ok(
            buffers.every(
              (buffer) => buffer.resizes === 2 && buffer.ctx.calls.length === 1,
            ),
            "paint neither resizes nor redraws cached mosaics",
          )
          assert.equal(ctx.globalAlpha, 0.37, "paint restores caller alpha")
          assert.equal(ctx.imageSmoothingEnabled, true)
          assert.equal(ctx.savedStates, 0)
          if (progress === 0) assert.equal(ctx.calls.length, 1)
        }
        transition.dispose()
      }
    }
  }
})

test("each style advects the source pixels on both sides of its liquid interface", () => {
  for (const variant of geometry.SCREEN_VARIANTS) {
    const width = 1301,
      height = 779,
      { from, into, buffers, ctx } = fixture(width, height)
    const transition = screen.createScreenTransition(from, into, {
      width,
      height,
      variant,
    })
    transition.paint(ctx, 0.4)
    const index = (geometry.screenPixelSize(0.4) - 2) * 2
    for (const source of [buffers[index], buffers[index + 1]]) {
      assert.ok(
        ctx.calls.some(
          (call) => call.args[0] === source && isDisplaced(call, width, height),
        ),
        `${variant} carries both the outgoing and incoming textures along its boundary`,
      )
    }
    assert.ok(
      ctx.calls.some(
        (call) => call.args.length === 9 && !isDisplaced(call, width, height),
      ),
      "settled areas of the incoming page keep their original source coordinates",
    )
    transition.dispose()
  }
})

test("handoff and fade draw one complete, unwarped incoming viewport with no outgoing ghost", () => {
  for (const [width, height] of [
    [1, 1],
    [390, 844],
    [1301, 779],
    [3840, 2160],
  ]) {
    for (const variant of geometry.SCREEN_VARIANTS) {
      const { from, into, buffers, ctx } = fixture(width, height)
      const transition = screen.createScreenTransition(from, into, {
        width,
        height,
        variant,
        ascii: true,
      })
      for (const progress of [0.8, 0.86, 0.93, 0.999]) {
        ctx.calls.length = 0
        transition.paint(ctx, progress)
        assert.equal(ctx.calls.length, 1)
        const [call] = ctx.calls
        assert.equal(
          call.args[0],
          buffers[(geometry.screenPixelSize(progress) - 2) * 2 + 1],
        )
        assert.deepEqual(call.args.slice(1), [0, 0, width, height])
        assert.equal(call.alpha, geometry.screenOpacity(progress))
        assert.equal(call.smoothing, false)
        assert.equal(ctx.globalAlpha, 1)
        assert.equal(ctx.imageSmoothingEnabled, true)
        assert.equal(ctx.savedStates, 0)
      }
      ctx.calls.length = 0
      transition.paint(ctx, 1)
      assert.equal(
        ctx.calls.length,
        0,
        "completed overlay leaves the live DOM clear",
      )
      transition.dispose()
    }
  }
})

test("dispose releases every mosaic and makes future paints inert", () => {
  const { from, into, buffers, ctx } = fixture(1024, 768)
  const transition = screen.createScreenTransition(from, into, {
    width: 1024,
    height: 768,
  })
  transition.dispose()
  transition.dispose()
  assert.equal(buffers.length, 2)
  assert.ok(
    buffers.every((buffer) => buffer.width === 0 && buffer.height === 0),
  )
  assert.ok(buffers.every((buffer) => buffer.resizes === 4))
  transition.paint(ctx, 0.5)
  transition.paint(ctx, 0.93)
  assert.equal(ctx.calls.length, 0)
})

test("failed mosaic allocation releases complete and partial pairs", () => {
  for (const failAt of [0, 1]) {
    const { from, into, buffers } = fixture(1024, 768, failAt)
    assert.throws(
      () =>
        screen.createScreenTransition(from, into, { width: 1024, height: 768 }),
      /unavailable/,
    )
    assert.equal(buffers.length, failAt + 1)
    assert.ok(
      buffers.every((buffer) => buffer.width === 0 && buffer.height === 0),
      `allocation ${failAt} leaves no raster backing stores`,
    )
  }
})
