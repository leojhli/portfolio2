import { MathUtils, Vector3 } from "three"
// Retained as the previous edit; its authored timing is independent of V6.
export const CLOISTER_LEGACY_SEGMENT_DURATIONS = [3.15, 2.3, 2.8, 4.7, 5] as const
const CLOISTER_SEGMENT_DURATIONS = CLOISTER_LEGACY_SEGMENT_DURATIONS

// All measurements are in the drawing's world coordinates (metres, Y up).
// These same stone edges determine both the rendered scenery and the foot path.
export const stones = {
  bench: { x: 13.95, z: 8.35, width: 1.7, depth: 0.46, height: 0.87 },
  walk: { x: 4.55, z: 1.6, width: 11.1, depth: 1.34, height: 1 },
  landing: { x: -5.5, z: 1.6, width: 5.3, depth: 1.34, height: 1 },
}

type Key = readonly [second: number, x: number, y: number, z: number]
type Track = readonly Key[]
const clamp = MathUtils.clamp
const smooth = (from: number, to: number, t: number) =>
  MathUtils.smoothstep(t, from, to)

// A monotonic cubic: a curve may turn a corner, but never overshoots a key
// into a column, down through a stone, or past a planted hand.
function along(keys: Track, t: number, out: Vector3) {
  if (t <= keys[0][0]) return out.set(keys[0][1], keys[0][2], keys[0][3])
  const last = keys[keys.length - 1]
  if (t >= last[0]) return out.set(last[1], last[2], last[3])
  let i = 0
  while (i + 1 < keys.length - 1 && t > keys[i + 1][0]) i++
  const a = keys[i],
    b = keys[i + 1],
    dt = b[0] - a[0],
    u = (t - a[0]) / dt
  const slope = (j: number, d: 1 | 2 | 3) => {
    if (j === 0) return (keys[1][d] - keys[0][d]) / (keys[1][0] - keys[0][0])
    if (j === keys.length - 1)
      return (last[d] - keys[j - 1][d]) / (last[0] - keys[j - 1][0])
    const l = (keys[j][d] - keys[j - 1][d]) / (keys[j][0] - keys[j - 1][0])
    const r = (keys[j + 1][d] - keys[j][d]) / (keys[j + 1][0] - keys[j][0])
    return l * r <= 0 ? 0 : (2 * l * r) / (l + r)
  }
  const value = (d: 1 | 2 | 3) =>
    (1 - u) ** 2 * ((1 + 2 * u) * a[d] + u * dt * slope(i, d)) +
    u * u * ((3 - 2 * u) * b[d] + (u - 1) * dt * slope(i + 1, d))
  return out.set(value(1), value(2), value(3))
}

const path: Track[] = [
  [
    [0, -12.9, 0, 14],
    [2, -6.55, 0, 14],
    [5, 3.25, 0, 14],
    [7.35, 10.3, 0, 14],
    [7.85, 10.8, 0, 14],
    [8, 10.8, 0, 14],
  ],
  [
    [0, 10.8, 0, 14],
    [0.4, 10.92, 0, 14],
    [1.9, 13.45, 0, 13.65],
    [3.55, 13.95, 0, 10.35],
    [4.15, 13.95, 0, 9.25],
    [5.15, 13.95, 0, 7.45],
    [7.45, 13.95, 0, 2.8],
    [8.55, 13.65, 0, 1.6],
    [9, 13.65, 0, 1.6],
  ],
  [
    [0, 13.65, 0, 1.6],
    [0.4, 13.55, 0, 1.6],
    [2.6, 11.1, 0, 1.6],
    [3.1, 10.7, 0, 1.6],
    [3.4, 10.128571, 0.357143, 1.6],
    [3.55, 9.842857, 0.535714, 1.6],
    [3.94, 9.1, 1, 1.6],
    [5, 8.4, 1, 1.6],
    [7.5, 4.15, 1, 1.6],
    [9.35, 1.04, 1, 1.6],
    [9.85, 0.8, 1, 1.6],
    [10, 0.8, 1, 1.6],
  ],
  [
    [0, 0.8, 1, 1.6],
    [0.5, 0.7, 1, 1.6],
    [1.5, -0.55, 1, 1.6],
    [1.82, -0.95, 1, 1.6],
    [2.13, -1.72, 1.51, 1.6],
    [2.33, -2.21, 1.57, 1.6],
    [2.67, -3.04, 1.03, 1.6],
    [2.82, -3.24, 1, 1.6],
    [3.5, -3.88, 1, 1.6],
    [5.65, -7.45, 1, 1.6],
    [6.3, -7.78, 1, 1.6],
    [8, -7.78, 1, 1.6],
  ],
  [
    [0, -7.78, 1, 1.6],
    [6, -7.78, 1, 1.6],
  ],
]

// The original route remains the physical source of truth. Editing its clock
// changes the pace without changing a planted hand, a step, or a jump arc.
const SOURCE_STARTS = [0, 8, 17, 27] as const
const SOURCE_LENGTHS = [8, 9, 10, 8] as const
type TimeKey = readonly [edit: number, source: number]
const editClocks: readonly (readonly TimeKey[])[] = [
  [[0, 0], [.6, 1.28], [1.5, 3.3], [3.15, 7]],
  [[0, 7], [.2, 7.5], [.3, 8.5], [.82, 9.6], [1.45, 11.55], [1.9, 12.15], [2.3, 12.55]],
  [[0, 12.55], [.6, 13.15], [1.06, 14.9], [1.75, 17.55], [2.35, 20.1], [2.8, 20.55]],
  [[0, 20.55], [.39, 20.94], [.56, 22], [1.53, 26.3], [1.65, 27.45], [1.82, 28.42], [2.22, 28.82], [2.93, 29.65], [3.1, 29.82]],
]
const editTracks: Track[] = editClocks.map((keys) => keys.map(([edit, source]) => [edit, source, 0, 0]))
const clockSample = new Vector3()
function editedTime(segment: number, seconds: number) {
  return along(editTracks[segment], seconds, clockSample).x
}
function sourceAt(time: number) {
  let segment = 0
  while (segment < 3 && time >= SOURCE_STARTS[segment + 1]) segment++
  return { segment, time: clamp(time - SOURCE_STARTS[segment], 0, SOURCE_LENGTHS[segment]) }
}
function sourcePosition(segment: number, time: number, out: Vector3) {
  along(path[segment], time, out)
  if (segment === 1 && time >= 4.15 && time <= 5.15) {
    const crossing = time - 4.15
    out.z = stones.bench.z + .9 - 1.8 * crossing
    out.y = .3 * Math.sin(Math.PI * crossing)
  }
  if (segment === 2 && time >= 3.1 && time <= 3.94) {
    const climb = (time - 3.1) / .84
    out.x = MathUtils.lerp(10.7, 9.1, climb)
    out.y = climb
  }
  return out
}
function routePosition(time: number, out: Vector3) {
  const source = sourceAt(time)
  return sourcePosition(source.segment, source.time, out)
}

// Integrating the authored path once gives a phase based on metres travelled.
// A sprint therefore keeps its stride length through speed ramps and corners.
const DISTANCE_STEP = .025
const distanceTables: number[][] = []
const routeDistances: number[] = []
const routePoints: Vector3[] = []
let totalDistance = 0
for (let segment = 0; segment < 4; segment++) {
  const table: number[] = []
  const previous = sourcePosition(segment, 0, new Vector3())
  const point = new Vector3()
  for (let i = 0; i <= SOURCE_LENGTHS[segment] / DISTANCE_STEP; i++) {
    sourcePosition(segment, i * DISTANCE_STEP, point)
    if (i) totalDistance += Math.hypot(point.x - previous.x, point.z - previous.z)
    table.push(totalDistance)
    if (!routeDistances.length || totalDistance > routeDistances[routeDistances.length - 1] + 1e-7) {
      routeDistances.push(totalDistance)
      routePoints.push(point.clone())
    }
    previous.copy(point)
  }
  distanceTables.push(table)
}
function distanceAt(segment: number, time: number) {
  const table = distanceTables[segment]
  const sample = clamp(time / DISTANCE_STEP, 0, table.length - 1)
  const left = Math.floor(sample)
  return MathUtils.lerp(table[left], table[Math.min(left + 1, table.length - 1)], sample - left)
}

// A spatial look-ahead keeps heading stable through the old route's brief
// stationary keys. Time derivatives there collapse to zero and snap the torso.
function pointAtDistance(distance: number, out: Vector3) {
  const d = clamp(distance, 0, routeDistances[routeDistances.length - 1])
  let low = 0, high = routeDistances.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (routeDistances[middle] < d) low = middle + 1
    else high = middle
  }
  if (low === 0) return out.copy(routePoints[0])
  const before = low - 1
  return out.lerpVectors(routePoints[before], routePoints[low],
    (d - routeDistances[before]) / (routeDistances[low] - routeDistances[before]))
}

type Cue = { at: number; action: string; stretchTo?: number; rate?: number; offset?: number; blend: number }
const cues: Cue[][] = [
  [{ at: 0, action: "run", blend: 0 }],
  [{ at: 0, action: "run", blend: 0 }, { at: 4.15, action: "vault", blend: .08 }, { at: 5.15, action: "run", blend: .16 }],
  [{ at: 0, action: "run", blend: 0 }, { at: 3.1, action: "climb", stretchTo: .84, blend: .09 }, { at: 3.94, action: "run", blend: .18 }],
  [{ at: 0, action: "run", blend: 0 }, { at: 1.42, action: "takeoff", rate: .8, blend: .18 }, { at: 1.82, action: "jump", blend: .12 }, { at: 2.65, action: "land", blend: .08 }, { at: 3.48, action: "run", blend: .18 }],
]

type Point = readonly [x: number, y: number, z: number]
type Shot = {
  at: number
  from: Point
  to: Point
  aim: Point
  endAim: Point
  fov: readonly [number, number]
  roll: readonly [number, number]
  frame: readonly [number, number]
}
function shot(at: number, from: Point, to: Point, fov: readonly [number, number], aim: Point = [0, 1.02, 0], roll: readonly [number, number] = [0, 0], frame: readonly [number, number] = [.055, .055]): Shot {
  return { at, from, to, aim, endAim: aim, fov, roll, frame }
}
const shots: Shot[][] = [
  [
    shot(0, [2.3, .7, -2.65], [1.4, .8, -2.45], [55, 60], [.1, .93, 0], [-.018, -.035]),
    shot(.7, [-1.65, 1.65, -1.25], [-1.2, 1.45, -1.45], [62, 58], [.38, 1.12, 0], [.03, .012]),
    shot(1.42, [2.3, 4.8, -3.2], [1.1, 4.05, -3.1], [48, 51], [.1, .8, 0], [-.02, .015]),
    shot(2.2, [1.45, 1.08, -3.1], [1.05, 1.13, -3.4], [48, 46], [.12, 1.02, 0], [.025, .008], [.07, .235]),
  ],
  [
    shot(0, [1.05, 1.13, -3.4], [.8, 1.07, -3.1], [46, 49], [.12, 1.02, 0], [.008, .018], [.235, .16]),
    shot(.24, [2.1, .65, -2.35], [1.4, .78, -2.65], [58, 61], [0, .86, 0], [-.025, -.012]),
    shot(.85, [-2.7, 3.6, -1.4], [-2.5, 2.6, -1.1], [54, 58], [0, .8, -.15], [.035, .015]),
    shot(1.45, [-1.9, 1.42, 2.6], [-2.35, 1.18, 1.8], [59, 54], [0, .94, -.1], [-.018, -.032]),
    shot(1.9, [-3.05, 1.05, -.55], [-3.4, 1.2, -.7], [50, 48], [0, .86, -.1], [.016, .008], [.08, .235]),
  ],
  [
    shot(0, [-3.4, 1.2, -.7], [-3.15, 1.13, -.42], [48, 51], [0, .86, -.1], [.008, -.012], [.235, .1]),
    shot(.6, [1.4, .78, -2.5], [1.95, .91, -2.65], [59, 57], [0, .96, -.1], [.03, .012]),
    shot(1.1, [-3.4, 3.7, .8], [-2.7, 3.2, 1.4], [51, 55], [-.1, .83, 0], [-.025, -.012]),
    shot(1.43, [-1.8, 1.23, 2.1], [-1.5, 1.42, 2.55], [60, 56], [-.18, .96, 0], [.02, -.015]),
    shot(2.35, [.4, 1.6, 3.2], [.2, 1.55, 3.55], [49, 47], [-.15, .87, 0], [-.02, -.006], [.08, .235]),
  ],
  [
    shot(0, [.2, 1.55, 3.55], [.05, 1.48, 3.3], [47, 50], [-.15, .87, 0], [-.006, .012], [.235, .1]),
    shot(.56, [2.2, .73, 2.6], [1.65, .9, 2.4], [60, 63], [-.28, .91, 0], [.025, -.018]),
    shot(1.65, [-1.75, 3.8, 3.15], [-1.1, 3.3, 3.3], [51, 56], [-.25, .85, 0], [-.025, .014]),
    shot(2.25, [.25, 1.15, 3.55], [-.5, 1.22, 3.95], [53, 51], [-.15, .72, 0], [.03, .01]),
    // These last two offsets are in leap-local right/up/forward coordinates.
    shot(3.1, [.4, 2.7, -3.15], [.15, 2.25, -2.7], [58, 61], [0, .95, .15], [-.02, -.008]),
    shot(3.8, [-.8, 4.8, -1.9], [-1.4, 5.1, -2.3], [48, 47], [0, .85, .4], [.018, .006], [.08, .235]),
  ],
]

export const CLOISTER_SHOT_CUTS = shots.map((sequence) => sequence.map(({ at }) => at))
export const CLOISTER_LEAP_START_TIME = 3.1
export const CLOISTER_LEAP_FREEZE_TIME = 1.25
// The body and gravity share a speed ramp; the camera keeps its own edit clock.
// Launch at full speed, linger as the arms open, then accelerate into the drop.
const leapClock: Track = [
  [0, 0, 0, 0],
  [.42, .48, 0, 0],
  [.65, .65, 0, 0],
  [1.28, .88, 0, 0],
  [CLOISTER_SEGMENT_DURATIONS[3] - CLOISTER_LEAP_START_TIME, CLOISTER_LEAP_FREEZE_TIME, 0, 0],
]
// The placement is a single authorable anchor; the leap clip owns pose only.
export const LEAP_START = new Vector3(15.1, 6.65, 7)
export const LEAP_FORWARD = new Vector3(-1, 0, 0)
export const AERIAL_TARGET = new Vector3(.7, 3.8, 5.4)
const AERIAL_DIRECTION = new Vector3(.82, .84, 1.06).normalize()
const END = new Vector3(10.52, 0, 7)
const AERIAL_CUT = .55

export function createChoreography() {
  const position = new Vector3(), camera = new Vector3(), target = new Vector3()
  const sampleA = new Vector3(), sampleB = new Vector3(), offset = new Vector3(), aim = new Vector3()
  const leapRight = new Vector3(LEAP_FORWARD.z, 0, -LEAP_FORWARD.x)
  const pose = {
    position, camera, target, yaw: 0, action: "run", actionTime: 0,
    blend: undefined as { action: string; time: number; weight: number } | undefined,
    framing: 0, fov: 48, shotId: "", roll: 0, bank: 0, lean: 0, motionBlur: 0, aerialProgress: 0,
  }
  function setLeap(time: number) {
    const flight = Math.max(0, time - .6)
    position.copy(LEAP_START).addScaledVector(LEAP_FORWARD, flight * 3.6)
    position.y += flight - 4.905 * flight * flight
    pose.yaw = Math.atan2(-LEAP_FORWARD.x, -LEAP_FORWARD.z)
    pose.action = "leap"
    pose.actionTime = time
    pose.blend = undefined
    pose.bank = 0
    pose.lean = 0
  }
  function localLeapVector(point: Vector3) {
    const x = point.x, z = point.z
    point.x = leapRight.x * x + LEAP_FORWARD.x * z
    point.z = leapRight.z * x + LEAP_FORWARD.z * z
    return point
  }
  function sampleCamera(segment: number, seconds: number, widthFactor: number) {
    const track = shots[segment]
    let index = track.length - 1
    while (index > 0 && track[index].at > seconds) index--
    const lens = track[index]
    const until = track[index + 1]?.at ?? CLOISTER_SEGMENT_DURATIONS[segment]
    const progress = clamp((seconds - lens.at) / (until - lens.at), 0, 1)
    offset.fromArray(lens.from).lerp(sampleA.fromArray(lens.to), progress)
    aim.fromArray(lens.aim).lerp(sampleA.fromArray(lens.endAim), progress)
    if (segment === 3 && seconds >= CLOISTER_LEAP_START_TIME) {
      localLeapVector(offset)
      localLeapVector(aim)
    }
    // Moving closer in portrait would crop the extended arms in the leap.
    // Widen the camera distance and the vertical FOV instead.
    offset.multiplyScalar(1 + .48 * (1 - widthFactor))
    camera.copy(position).add(offset)
    target.copy(position).add(aim)
    pose.fov = MathUtils.lerp(lens.fov[0], lens.fov[1], progress) + 5 * (1 - widthFactor)
    pose.framing = MathUtils.lerp(lens.frame[0], lens.frame[1], progress) * widthFactor
    pose.roll = MathUtils.lerp(lens.roll[0], lens.roll[1], progress)
    pose.shotId = `${segment}/${index}`
  }
  return (segment: number, seconds: number, aspect: number, durations: Record<string, number> = {}) => {
    const safeSegment = clamp(Math.floor(segment), 0, 4)
    const time = clamp(Number.isFinite(seconds) ? seconds : 0, 0, CLOISTER_SEGMENT_DURATIONS[safeSegment])
    const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
    const widthFactor = clamp((safeAspect - .68) / .82, 0, 1)
    pose.blend = undefined
    pose.aerialProgress = 0
    pose.bank = 0
    pose.lean = 0
    pose.motionBlur = time < CLOISTER_SEGMENT_DURATIONS[safeSegment] ? .75 : 0
    if (safeSegment === 4) {
      if (time < AERIAL_CUT) {
        setLeap(CLOISTER_LEAP_FREEZE_TIME + Math.min(time, .49))
        // The first resumed frame is exactly the frozen Contact frame.
        sampleCamera(3, CLOISTER_SEGMENT_DURATIONS[3], widthFactor)
        const travel = time / AERIAL_CUT
        camera.addScaledVector(LEAP_FORWARD, -.35 * travel)
        camera.y += .25 * travel
        pose.shotId = "3/5"
      } else {
        const progress = smooth(AERIAL_CUT, CLOISTER_SEGMENT_DURATIONS[4], time)
        pose.aerialProgress = progress
        position.copy(END)
        pose.yaw = Math.PI / 2
        pose.action = "idle"
        pose.actionTime = 1.97
        sampleA.set(11, 14, 18)
        sampleB.copy(AERIAL_DIRECTION).multiplyScalar(Math.max(63, 59 / safeAspect)).add(AERIAL_TARGET)
        camera.lerpVectors(sampleA, sampleB, progress)
        camera.x -= Math.sin(progress * Math.PI) * 6
        camera.y += Math.sin(progress * Math.PI) * 4
        target.copy(AERIAL_TARGET)
        pose.fov = MathUtils.lerp(53, 44, progress)
        pose.framing = 0
        pose.roll = .015 * (1 - progress)
        pose.shotId = "4/aerial"
        pose.motionBlur = .3 * (1 - progress)
      }
      return pose
    }
    if (safeSegment === 3 && time >= CLOISTER_LEAP_START_TIME) {
      setLeap(along(leapClock, time - CLOISTER_LEAP_START_TIME, sampleA).x)
    } else {
      const routeTime = editedTime(safeSegment, time)
      const source = sourceAt(routeTime)
      sourcePosition(source.segment, source.time, position)
      const travelled = distanceAt(source.segment, source.time)
      // Anticipate turns by distance, even while a planted foot is momentarily
      // stationary. This also avoids pivoting in place at old chapter joins.
      pointAtDistance(travelled - .4, sampleA)
      pointAtDistance(travelled + 1.4, sampleB)
      pose.yaw = Math.atan2(sampleA.x - sampleB.x, sampleA.z - sampleB.z)
      const track = cues[source.segment]
      let index = track.length - 1
      while (index > 0 && track[index].at > source.time) index--
      const cue = track[index]
      const sprintTime = travelled / 8.8
      const localTime = (c: Cue) => c.action === "run" ? sprintTime :
        (c.offset ?? 0) + (source.time - c.at) * (c.stretchTo ? (durations[c.action] ?? c.stretchTo) / c.stretchTo : c.rate ?? 1)
      pose.action = cue.action
      pose.actionTime = localTime(cue)
      if (index && source.time < cue.at + cue.blend) {
        const previous = track[index - 1]
        pose.blend = { action: previous.action, time: localTime(previous), weight: 1 - smooth(cue.at, cue.at + cue.blend, source.time) }
      }
      if (pose.action === "run") {
        const heading = pose.yaw
        pointAtDistance(travelled + .1, sampleA)
        pointAtDistance(travelled + 1.9, sampleB)
        const upcoming = Math.atan2(sampleA.x - sampleB.x, sampleA.z - sampleB.z)
        const turn = Math.atan2(Math.sin(upcoming - heading), Math.cos(upcoming - heading))
        pose.bank = clamp(-turn * .16, -.12, .12)
        const a = time < .01 && safeSegment > 0
          ? editedTime(safeSegment - 1, CLOISTER_SEGMENT_DURATIONS[safeSegment - 1] + time - .01)
          : editedTime(safeSegment, Math.max(0, time - .01))
        const b = time > CLOISTER_SEGMENT_DURATIONS[safeSegment] - .01 && safeSegment < 3
          ? editedTime(safeSegment + 1, time + .01 - CLOISTER_SEGMENT_DURATIONS[safeSegment])
          : editedTime(safeSegment, time + .01)
        routePosition(a, sampleA)
        routePosition(b, sampleB)
        const speed = Math.hypot(sampleB.x - sampleA.x, sampleB.z - sampleA.z) / .02
        pose.lean = clamp((speed - 4) * .01, 0, .045)
      }
    }
    sampleCamera(safeSegment, time, widthFactor)
    return pose
  }
}
