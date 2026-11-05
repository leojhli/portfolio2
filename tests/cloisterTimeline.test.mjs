import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server,
  CloisterTimeline,
  CLOISTER_SEGMENT_DURATIONS,
  CLOISTER_MAX_FRAME_DELTA
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  ;({ CloisterTimeline, CLOISTER_SEGMENT_DURATIONS, CLOISTER_MAX_FRAME_DELTA } =
    await server.ssrLoadModule("/src/three/cloisterTimeline.ts"))
})
after(async () => server?.close())

const near = (actual, expected) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-8,
    `${actual} should equal ${expected}`,
  )
const play = (timeline, seconds, fps = 60) => {
  const completions = []
  for (let i = 0; i < Math.round(seconds * fps); i++) {
    const completed = timeline.advance(1 / fps)
    if (completed !== null) completions.push(completed)
  }
  return completions
}

test("each shot completes once at its authored endpoint without advancing into a reading pause", () => {
  const timeline = new CloisterTimeline()
  assert.deepEqual(timeline.sample(), {
    segment: 0,
    time: 0,
    progress: 0,
    completed: false,
  })
  assert.equal(timeline.advance(0.05), null)
  assert.equal(timeline.time, 0, "loading does not spend cinematic time")
  for (const [segment, duration] of CLOISTER_SEGMENT_DURATIONS.entries()) {
    timeline.configure("playing", segment, 0)
    assert.deepEqual(play(timeline, duration + 1), [segment])
    assert.deepEqual(timeline.sample(), {
      segment,
      time: duration,
      progress: 1,
      completed: true,
    })
    timeline.configure("playing", segment, 0)
    assert.deepEqual(
      play(timeline, 1),
      [],
      "repeated configuration cannot re-emit completion",
    )
    timeline.configure("reading", segment, 0)
    assert.deepEqual(play(timeline, 10), [])
  }
})

test("pause, loading and fallback freeze the shot and repeated playing configuration preserves progress", () => {
  const timeline = new CloisterTimeline()
  timeline.configure("playing", 1, 0)
  for (let i = 0; i < 30; i++) {
    timeline.configure("playing", 1, 0)
    timeline.advance(1 / 30)
  }
  near(timeline.time, 1)
  const held = timeline.sample()
  for (const phase of ["paused", "loading", "fallback"]) {
    timeline.configure(phase, 1, 0)
    assert.deepEqual(play(timeline, 20), [])
    assert.deepEqual(timeline.sample(), held)
  }
  timeline.configure("playing", 1, 0)
  assert.deepEqual(play(timeline, 8), [1])
  assert.equal(timeline.time, 9)
})

test("direct chapter selection seeks the reading pose without leaking a prior shot completion", () => {
  const timeline = new CloisterTimeline()
  timeline.configure("playing", 0, 0)
  play(timeline, 7.95)
  timeline.configure("reading", 2, 0)
  assert.deepEqual(timeline.sample(), {
    segment: 2,
    time: 10,
    progress: 1,
    completed: true,
  })
  timeline.configure("playing", 2, 0)
  assert.equal(
    timeline.advance(0.05),
    null,
    "a seek is never a playback completion",
  )
  timeline.configure("playing", 3, 0)
  assert.equal(timeline.time, 0)
  assert.deepEqual(play(timeline, 8), [3])
  timeline.configure("aerial", 4, 0)
  assert.deepEqual(timeline.sample(), {
    segment: 4,
    time: 6,
    progress: 1,
    completed: true,
  })
  assert.deepEqual(play(timeline, 20), [])
})

test("replay revision resets the same shot and permits exactly one fresh completion", () => {
  const timeline = new CloisterTimeline()
  timeline.configure("playing", 0, 0)
  assert.deepEqual(play(timeline, 8), [0])
  timeline.configure("playing", 0, 1)
  assert.equal(timeline.time, 0)
  assert.equal(timeline.sample().completed, false)
  assert.deepEqual(play(timeline, 8), [0])
  timeline.configure("playing", 0, 1)
  assert.equal(timeline.advance(0.05), null)
})

test("frame-rate variations are deterministic and a background gap cannot consume an entire shot", () => {
  for (const fps of [30, 60, 120]) {
    const timeline = new CloisterTimeline()
    timeline.configure("playing", 2, 0)
    assert.deepEqual(play(timeline, 4, fps), [])
    near(timeline.time, 4)
    assert.deepEqual(play(timeline, 6, fps), [2])
    assert.equal(timeline.time, 10)
  }
  const timeline = new CloisterTimeline()
  timeline.configure("playing", 0, 0)
  assert.equal(timeline.advance(3600), null)
  assert.equal(timeline.time, CLOISTER_MAX_FRAME_DELTA)
  const before = timeline.sample()
  for (const dt of [NaN, Infinity, -Infinity, -2, 0]) {
    assert.equal(timeline.advance(dt), null)
    assert.deepEqual(timeline.sample(), before)
  }
})

test("disposing mid-shot is inert even after replay or a pending completion frame", () => {
  const timeline = new CloisterTimeline()
  timeline.configure("playing", 0, 0)
  play(timeline, 7.95)
  const before = timeline.sample()
  timeline.dispose()
  timeline.dispose()
  assert.equal(timeline.advance(0.05), null)
  timeline.configure("playing", 0, 1)
  timeline.configure("reading", 2, 1)
  assert.deepEqual(play(timeline, 15), [])
  assert.deepEqual(timeline.sample(), before)
})
