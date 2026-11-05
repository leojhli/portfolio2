import { MathUtils, Vector3 } from "three"
import { CLOISTER_SEGMENT_DURATIONS } from "./cloisterTimeline"

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
    [2.6, 10.7, 0, 1.6],
    [3.1, 10.51, 0, 1.6],
    [3.4, 10.39, 0.26, 1.6],
    [3.55, 10.19, 0.3, 1.6],
    [3.94, 9.65, 1, 1.6],
    [5, 9.15, 1, 1.6],
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

// Each shot moves the lens relative to the moving actor. Matching first/last
// keys keeps the picture continuous when a reader presses Continue.
const lens: Track[] = [
  [
    [0, -2.2, 0.94, -2.45],
    [1.8, -1.45, 1.05, -3.15],
    [4.6, 1.38, 1.35, -4.25],
    [6.7, 3.5, 1.72, -2.9],
    [8, 3.85, 1.65, -1.4],
  ],
  [
    [0, 3.85, 1.65, -1.4],
    [2, 0.9, 1.72, -4.2],
    [3.7, -2.27, 1.34, -2.5],
    [4.6, -3.48, 0.96, -0.75],
    [5.5, -3.5, 1.45, 0.9],
    [7.4, -3.4, 2.05, 2.9],
    [9, -3.5, 2.25, 3.6],
  ],
  [
    [0, -3.5, 2.25, 3.6],
    [2.25, -1.75, 1.37, 3.08],
    [3.8, 0.4, 1.54, 3.0],
    [6.2, 2.2, 2.2, 4.25],
    [8.2, 1.7, 2.65, 4.65],
    [10, 1.15, 2.9, 5.1],
  ],
  [
    [0, 1.15, 2.9, 5.1],
    [1.8, 0.3, 1.25, 3.8],
    [2.38, -0.8, 1.17, 4.35],
    [3.55, -1.5, 1.32, 4.6],
    [5.8, -2.3, 1.63, 4],
    [8, -3.2, 2.65, 5.15],
  ],
]
const targets: Track[] = [
  [
    [0, 0.32, 0.98, 0],
    [4, 0.45, 0.98, 0],
    [8, 0, 1.15, 0],
  ],
  [
    [0, 0, 1.15, 0],
    [2, 0, 1.05, -0.08],
    [4.7, 0, 0.86, -0.24],
    [9, 0, 1.13, 0],
  ],
  [
    [0, 0, 1.13, 0],
    [2.6, -0.2, 0.98, 0],
    [4.35, -0.15, 0.85, 0],
    [10, 0, 1.13, 0],
  ],
  [
    [0, 0, 1.13, 0],
    [2.4, -0.23, 0.72, 0],
    [5.3, -0.12, 1, 0],
    [8, 0, 1.13, 0],
  ],
]
const END = new Vector3(-7.78, 1, 1.6)
export const AERIAL_TARGET = new Vector3(0.7, 3.8, 5.4)
const AERIAL_DIRECTION = new Vector3(0.82, 0.84, 1.06).normalize()

type Cue = {
  at: number
  action: string
  stretchTo?: number
  offset?: number
  blend: number
}
const cues: Cue[][] = [
  [
    { at: 0, action: "run", blend: 0 },
    { at: 7.43, action: "idle", blend: 0.42 },
  ],
  [
    { at: 0, action: "idle", offset: 0.57, blend: 0 },
    { at: 0.12, action: "jog", blend: 0.32 },
    { at: 4.15, action: "vault", blend: 0.08 },
    { at: 5.15, action: "jog", offset: 0.36, blend: 0.15 },
    { at: 8.32, action: "idle", blend: 0.35 },
  ],
  [
    { at: 0, action: "idle", offset: 0.68, blend: 0 },
    { at: 0.16, action: "jog", blend: 0.3 },
    { at: 3.1, action: "climb", stretchTo: 0.84, blend: 0.09 },
    { at: 3.94, action: "jog", offset: 0.58, blend: 0.19 },
    { at: 9.45, action: "idle", blend: 0.4 },
  ],
  [
    { at: 0, action: "idle", offset: 0.55, blend: 0 },
    { at: 0.23, action: "jog", blend: 0.25 },
    { at: 1.16, action: "takeoff", stretchTo: 0.66, blend: 0.09 },
    { at: 1.82, action: "jump", blend: 0.1 },
    { at: 2.54, action: "land", stretchTo: 0.94, blend: 0.08 },
    { at: 3.48, action: "jog", blend: 0.17 },
    { at: 6.03, action: "idle", blend: 0.28 },
  ],
  [{ at: 0, action: "idle", offset: 1.97, blend: 0 }],
]

export function createChoreography() {
  const position = new Vector3(),
    camera = new Vector3(),
    target = new Vector3(),
    sampleA = new Vector3(),
    sampleB = new Vector3()
  const pose = {
    position,
    camera,
    target,
    yaw: 0,
    action: "run",
    actionTime: 0,
    blend: undefined as {
      action: string
      time: number
      weight: number
    } | undefined,
    framing: 0,
    fov: 43,
  }
  return (
    segment: number,
    seconds: number,
    aspect: number,
    durations: Record<string, number> = {},
  ) => {
    const t = clamp(seconds, 0, CLOISTER_SEGMENT_DURATIONS[segment])
    const widthFactor = clamp((aspect - 0.68) / 0.82, 0, 1)
    along(path[segment], t, position)
    if (segment === 1 && t >= 4.15 && t <= 5.15) {
      const crossing = t - 4.15
      position.z = stones.bench.z + 0.9 - 1.8 * crossing
      position.y = 0.3 * Math.sin(Math.PI * crossing)
    }
    const faceTime = Math.min(t, [7.66, 8.48, 9.52, 6.12, 0][segment])
    along(path[segment], Math.max(0, faceTime - 0.045), sampleA)
    along(path[segment], faceTime + 0.045, sampleB)
    pose.yaw =
      segment === 4
        ? Math.PI / 2
        : Math.atan2(sampleA.x - sampleB.x, sampleA.z - sampleB.z)
    if (segment === 2 && t < 0.55)
      pose.yaw = MathUtils.lerp(0.28, Math.PI / 2, smooth(0, 0.55, t))
    const settle = [7.6, 8.52, 9.6, 6.03, 0][segment]
    const track = cues[segment]
    let index = track.length - 1
    while (index > 0 && track[index].at > t) index--
    const cue = track[index]
    const localTime = (c: Cue) =>
      (c.offset ?? 0) +
      (t - c.at) *
        (c.stretchTo ? (durations[c.action] ?? c.stretchTo) / c.stretchTo : 1)
    pose.action = cue.action
    pose.actionTime = localTime(cue)
    pose.blend = undefined
    if (index && t < cue.at + cue.blend) {
      const previous = track[index - 1]
      pose.blend = {
        action: previous.action,
        time: localTime(previous),
        weight: 1 - smooth(cue.at, cue.at + cue.blend, t),
      }
    }
    if (segment !== 4) {
      along(lens[segment], t, camera)
      // A little more breathing room in portrait. The runner stays readable in
      // profile through the vault and jump, rather than disappearing behind text.
      camera.multiplyScalar(1.13 - 0.13 * widthFactor).add(position)
      along(targets[segment], t, target).add(position)
      pose.fov =
        [44, 46, 45, 46][segment] +
        4 * (1 - widthFactor) -
        2 * smooth(settle - 1, settle + 0.35, t)
      if (segment > 0)
        pose.fov +=
          ([42, 44, 43][segment - 1] - [44, 46, 45, 46][segment]) *
          (1 - smooth(0, 1.2, t))
      pose.framing =
        (0.115 + 0.119 * smooth(settle - 1.15, settle + 0.35, t)) * widthFactor
      if (segment > 0)
        pose.framing += 0.119 * (1 - smooth(0, 1.2, t)) * widthFactor
    } else {
      // Back away from the Contact portrait in a single crane shot. Size the
      // final distance against the narrower dimension, so portrait fits too.
      const p = smooth(0, 6, t),
        d = Math.max(63, 59 / aspect)
      const lift = Math.sin(p * Math.PI)
      along(lens[3], 8, sampleA)
        .multiplyScalar(1.13 - 0.13 * widthFactor)
        .add(END)
      sampleB.copy(AERIAL_DIRECTION).multiplyScalar(d).add(AERIAL_TARGET)
      camera.lerpVectors(sampleA, sampleB, p)
      camera.x -= lift * 10
      camera.y += lift * 9
      target.copy(END).y += 1.13
      target.lerp(AERIAL_TARGET, p)
      pose.fov = MathUtils.lerp(44 + 4 * (1 - widthFactor), 44, p)
      pose.framing = 0.234 * widthFactor * (1 - p)
    }
    return pose
  }
}
