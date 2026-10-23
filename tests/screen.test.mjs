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

// Explicit canvas doubles check coverage, buffer use and lifecycle without a
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
  }
}

function fixture(width, height, failAt = -1) {
  const buffers = []
  const ownerDocument = {
    createElement(tag) {
      assert.equal(tag, "canvas")
      const ctx = context()
      const buffer = {
        ownerDocument,
        width: 0,
        height: 0,
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

function destinations(calls) {
  return calls
    .filter(({ args }) => args.length === 9)
    .map(({ args }) => args.slice(5))
}

function assertInBounds(rects, width, height) {
  for (const [x, y, w, h] of rects) {
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0)
    assert.ok(x + w <= width && y + h <= height)
  }
}

function assertCompleteCoverage(rects, width, height) {
  const rows = new Map()
  for (const [x, y, w, h] of rects) {
    const row = rows.get(y) ?? []
    row.push({ x, w, h })
    rows.set(y, row)
  }
  let nextY = 0
  for (const [y, row] of [...rows].sort(([a], [b]) => a - b)) {
    assert.equal(y, nextY, "tile rows meet without vertical gaps or overlap")
    let nextX = 0
    for (const rect of row.sort((a, b) => a.x - b.x)) {
      assert.equal(rect.x, nextX, "tile columns meet without gaps or overlap")
      assert.equal(rect.h, row[0].h)
      nextX += rect.w
    }
    assert.equal(nextX, width)
    nextY += row[0].h
  }
  assert.equal(nextY, height)
}

test("screen timing stays opaque through the raster replacement and uses fine resolution steps", () => {
  for (const progress of [-1, 0, 0.08, 0.3, 0.5, 0.7, 0.86]) {
    assert.equal(geometry.screenOpacity(progress), 1)
  }
  assert.equal(geometry.screenOpacity(1), 0)
  assert.equal(geometry.screenOpacity(2), 0)
  assert.ok(
    geometry.screenOpacity(0.93) > 0 && geometry.screenOpacity(0.93) < 1,
  )
  assert.equal(geometry.screenPixelSize(0), 2)
  assert.equal(geometry.screenPixelSize(0.5), 8)
  assert.equal(geometry.screenPixelSize(1), 2)
  for (const progress of [-1, 0, 0.1, 0.4, 0.86, 1, 2, NaN, Infinity]) {
    assert.ok(Number.isInteger(geometry.screenPixelSize(progress)))
    assert.ok(
      geometry.screenPixelSize(progress) >= 2 &&
        geometry.screenPixelSize(progress) <= 8,
    )
    assert.ok(
      geometry.screenOpacity(progress) >= 0 &&
        geometry.screenOpacity(progress) <= 1,
    )
  }
})

test("all screen variants have bounded deterministic tile order and complete replacement before fade", () => {
  assert.deepEqual([0, 1, 2, 3, -1].map(geometry.screenVariant), [
    "scan",
    "diagonal",
    "dissolve",
    "scan",
    "diagonal",
  ])
  for (const variant of geometry.SCREEN_VARIANTS) {
    for (const [columns, rows] of [
      [1, 1],
      [1, 60],
      [73, 1],
      [73, 42],
    ]) {
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const index = row * columns + column
          const order = geometry.screenTileOrder(
            index,
            column,
            row,
            columns,
            rows,
            variant,
          )
          assert.ok(order >= 0 && order <= 1)
          assert.equal(
            order,
            geometry.screenTileOrder(
              index,
              column,
              row,
              columns,
              rows,
              variant,
            ),
          )
          assert.equal(geometry.screenTileReveal(0, order), 0)
          assert.ok(
            geometry.screenTileReveal(0.86, order) >= 1 - Number.EPSILON,
          )
          const midpoint = geometry.screenTileReveal(0.5, order)
          assert.ok(midpoint >= 0 && midpoint <= 1)
        }
      }
    }
  }
})

test("screen rendering always pixelates the full viewport beneath partial incoming tiles", () => {
  for (const variant of geometry.SCREEN_VARIANTS) {
    const { from, into, buffers, ctx } = fixture(1301, 779)
    const transition = screen.createScreenTransition(from, into, {
      width: 1301,
      height: 779,
      variant,
    })
    assert.equal(buffers.length, 14)
    for (let index = 0; index < buffers.length; index++) {
      const size = 2 + Math.floor(index / 2),
        buffer = buffers[index]
      assert.equal(buffer.width, Math.ceil(1301 / size))
      assert.equal(buffer.height, Math.ceil(779 / size))
      assert.equal(buffer.ctx.calls[0].args[0], index % 2 ? into : from)
      assert.equal(buffer.ctx.calls[0].smoothing, false)
    }
    for (const progress of [0, 0.1, 0.3, 0.5, 0.7, 0.86]) {
      ctx.calls.length = 0
      transition.paint(ctx, progress)
      const base = ctx.calls[0]
      assert.equal(
        base.args[0],
        buffers[(geometry.screenPixelSize(progress) - 2) * 2],
      )
      assert.deepEqual(base.args.slice(1), [0, 0, 1301, 779])
      assert.ok(
        ctx.calls.every(
          ({ alpha, smoothing }) => alpha === 1 && smoothing === false,
        ),
      )
      assertInBounds(destinations(ctx.calls), 1301, 779)
      assert.equal(
        buffers.length,
        14,
        "paint never allocates or resizes buffers",
      )
    }
    assert.equal(ctx.globalAlpha, 1, "paint restores the caller's canvas state")
    assert.equal(ctx.imageSmoothingEnabled, true)
    transition.dispose()
  }
})

test("incoming tiles cover every viewport pixel before the overlay fades, at small and large sizes", () => {
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
      transition.paint(ctx, 0.86)
      const incoming = destinations(ctx.calls)
      assertInBounds(incoming, width, height)
      assertCompleteCoverage(incoming, width, height)
      assert.ok(
        ctx.calls
          .slice(1)
          .every(
            ({ args }) =>
              args[0] === buffers[(geometry.screenPixelSize(0.86) - 2) * 2 + 1],
          ),
      )
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

test("final fade draws only the incoming viewport once without an outgoing ghost", () => {
  for (const variant of geometry.SCREEN_VARIANTS) {
    const { from, into, buffers, ctx } = fixture(1301, 779)
    const transition = screen.createScreenTransition(from, into, {
      width: 1301,
      height: 779,
      variant,
      ascii: true,
    })
    transition.paint(ctx, 0.93)
    assert.equal(
      ctx.calls.length,
      1,
      "fade must not blend outgoing and incoming rasters",
    )
    const [call] = ctx.calls
    assert.equal(
      call.args[0],
      buffers[(geometry.screenPixelSize(0.93) - 2) * 2 + 1],
    )
    assert.deepEqual(call.args.slice(1), [0, 0, 1301, 779])
    assert.equal(call.alpha, geometry.screenOpacity(0.93))
    assert.ok(call.alpha > 0 && call.alpha < 1)
    assert.equal(call.smoothing, false)
    assert.equal(ctx.globalAlpha, 1)
    assert.equal(ctx.imageSmoothingEnabled, true)
    transition.dispose()
    assert.ok(
      buffers.every((buffer) => buffer.width === 0 && buffer.height === 0),
    )
    ctx.calls.length = 0
    transition.paint(ctx, 0.93)
    assert.equal(ctx.calls.length, 0)
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
  assert.ok(
    buffers.every((buffer) => buffer.width === 0 && buffer.height === 0),
  )
  transition.paint(ctx, 0.5)
  assert.equal(ctx.calls.length, 0)
})

test("failed mosaic allocation releases both complete and partial pairs", () => {
  for (const failAt of [0, 1, 3, 13]) {
    const { from, into, buffers } = fixture(1024, 768, failAt)
    assert.throws(
      () =>
        screen.createScreenTransition(from, into, { width: 1024, height: 768 }),
      /unavailable/,
    )
    assert.ok(
      buffers.every((buffer) => buffer.width === 0 && buffer.height === 0),
      `allocation ${failAt} leaves no raster backing stores`,
    )
  }
})
