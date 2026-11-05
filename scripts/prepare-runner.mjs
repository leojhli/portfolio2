// npm dependencies are enough to rebuild this asset from the three official free
// Quaternius Standard archives; extract all three into the supplied directory.
import fs from "node:fs"
import path from "node:path"
import * as T from "three"

const dir = process.argv[2] || ".tmp-cloister/animations"
const output = "public/models/cloister/runner.glb"
function source(name) {
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
    )
  const f = walk(dir).find((f) => path.basename(f) === name)
  if (!f) throw Error("Missing source: " + name)
  const b = fs.readFileSync(f)
  let j, bin
  if (name.endsWith(".glb")) {
    const l = b.readUInt32LE(12)
    j = JSON.parse(b.subarray(20, 20 + l))
    bin = b.subarray(28 + l)
  } else {
    j = JSON.parse(b)
    bin = fs.readFileSync(path.join(path.dirname(f), j.buffers[0].uri))
  }
  return { j, bin }
}
const body = source("Superhero_Male_FullBody.gltf"),
  lib1 = source("UAL1_Standard.glb"),
  lib2 = source("UAL2_Standard.glb")
const j = {
  asset: { version: "2.0", generator: "Cloister / prepare-runner.mjs" },
  extensionsUsed: ["KHR_materials_unlit"],
  scene: 0,
  scenes: [{ nodes: [66] }],
  nodes: structuredClone(body.j.nodes.slice(0, 65)),
  skins: [],
  meshes: [],
  materials: [
    {
      name: "Ink and chalk",
      doubleSided: true,
      pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 1 },
      extensions: { KHR_materials_unlit: {} },
    },
  ],
  animations: [],
  accessors: [],
  bufferViews: [],
  buffers: [],
}
const chunks = []
let offset = 0
const types = {
  5126: Float32Array,
  5125: Uint32Array,
  5123: Uint16Array,
  5121: Uint8Array,
}
const sizes = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }
function read(src, i) {
  const a = src.j.accessors[i],
    v = src.j.bufferViews[a.bufferView],
    C = types[a.componentType]
  if (v.byteStride && v.byteStride !== sizes[a.type] * C.BYTES_PER_ELEMENT)
    throw Error("Unexpected interleaved source")
  return new C(
    src.bin.buffer,
    src.bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0),
    a.count * sizes[a.type],
  )
}
function put(arr, type, opts = {}) {
  const pad = (4 - (offset % 4)) % 4
  if (pad) {
    chunks.push(Buffer.alloc(pad))
    offset += pad
  }
  const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)
  const view =
    j.bufferViews.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: bytes.length,
    }) - 1
  chunks.push(bytes)
  offset += bytes.length
  const ct = Number(Object.keys(types).find((k) => arr instanceof types[k]))
  return (
    j.accessors.push({
      bufferView: view,
      componentType: ct,
      count: arr.length / sizes[type],
      type,
      ...opts,
    }) - 1
  )
}
function copy(src, i) {
  const { type, min, max, normalized } = src.j.accessors[i]
  return put(read(src, i), type, { min, max, normalized })
}
function nodes(src) {
  const n = src.j.nodes.map((raw) => {
    const o = new T.Object3D()
    o.name = raw.name
    if (raw.translation) o.position.fromArray(raw.translation)
    if (raw.rotation) o.quaternion.fromArray(raw.rotation)
    if (raw.scale) o.scale.fromArray(raw.scale)
    return o
  })
  src.j.nodes.forEach((raw, i) => raw.children?.forEach((c) => n[i].add(n[c])))
  for (const o of n.filter((o) => !o.parent)) o.updateMatrixWorld(true)
  return n
}
const avatar = nodes(body),
  rig = nodes(lib1)
const targets = new Map(avatar.slice(0, 65).map((o, i) => [o.name, i]))
const skin = body.j.skins[0],
  joints = skin.joints
j.skins = [
  { ...skin, inverseBindMatrices: copy(body, skin.inverseBindMatrices) },
]
j.nodes.push({ name: "Wayfarer", mesh: 0, skin: 0 }, {
  name: "Armature",
  children: [64, 65],
})
const p = body.j.meshes[2].primitives[0],
  at = p.attributes
const pos = read(body, at.POSITION),
  normals = read(body, at.NORMAL)
const col = new Uint8Array(pos.length)
// One ink tint for the face and hands, boots below the knee, pale linen sleeves.
// Bake a soft studio light into the monochrome palette to keep it legible at
// every camera angle without paying for separate scene lights.
const srgb = (v) =>
  Math.round(255 * (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
function shade(linearArray, i, value) {
  const c = srgb(Math.max(0, Math.min(1, value)))
  linearArray[i] = linearArray[i + 1] = linearArray[i + 2] = c
}
for (let i = 0; i < pos.length; i += 3) {
  const x = Math.abs(pos[i]),
    y = pos[i + 1]
  const tone =
    y > 1.56 ? 0.095 : x > 0.73 ? 0.37 : y < 0.4 ? 0.38 : y < 1.01 ? 0.69 : 0.88
  shade(
    col,
    i,
    tone *
      (0.88 +
        0.12 *
          (0.48 * normals[i] + 0.72 * normals[i + 1] + 0.3 * normals[i + 2])),
  )
}
const primitives = [
  {
    attributes: {
      POSITION: copy(body, at.POSITION),
      JOINTS_0: copy(body, at.JOINTS_0),
      WEIGHTS_0: copy(body, at.WEIGHTS_0),
      COLOR_0: put(col, "VEC3", { normalized: true }),
    },
    indices: copy(body, p.indices),
    material: 0,
  },
]
// Original clothing in bind space. These vertices use the same skeletal skin
// as the body: the cowl turns with the head, the coat and mantle bend at the
// spine, and each split hem follows its own leg on takeoff.
const cp = [],
  cc = [],
  cj = [],
  cw = [],
  ci = []
function v(point, tone, weights) {
  const n = cp.length / 3
  cp.push(...point)
  const c = srgb(tone)
  cc.push(c, c, c)
  const ids = [],
    ws = []
  for (const [bone, w] of weights) {
    ids.push(joints.indexOf(targets.get(bone)))
    ws.push(w)
  }
  while (ids.length < 4) {
    ids.push(0)
    ws.push(0)
  }
  cj.push(...ids)
  cw.push(...ws)
  return n
}
function surface(segments, steps, sample) {
  const start = cp.length / 3
  for (let row = 0; row < steps; row++)
    for (let i = 0; i <= segments; i++) {
      const { point, tone, weights } = sample(row, i / segments)
      v(point, tone, weights)
    }
  for (let r = 0; r < steps - 1; r++)
    for (let i = 0; i < segments; i++) {
      const a = start + r * (segments + 1) + i,
        b = a + 1,
        c = a + segments + 1,
        d = c + 1
      ci.push(a, c, b, b, c, d)
    }
}
function tube(rows, { steps = 32, from = 0, to = 2 * Math.PI } = {}) {
  surface(steps, rows.length, (r, u) => {
    const [y, rx, rz, cz, tone, bone, extra] = rows[r],
      a = from + (to - from) * u
    const wp = typeof bone === "function" ? bone(a) : [[bone, 1]]
    const ripple = 1 + 0.015 * Math.cos(8 * a + 0.35 * r)
    return {
      point: [
        rx * Math.sin(a) * ripple,
        y + (extra ? extra(a) : 0),
        cz + rz * Math.cos(a) * ripple,
      ],
      tone: tone * (0.925 + 0.06 * Math.cos(a - 0.7) + 0.012 * Math.cos(a * 8)),
      weights: wp,
    }
  })
}
const sideLeg = (a) => (Math.sin(a) > 0 ? "thigh_l" : "thigh_r")
tube([
  [
    0.75,
    0.226,
    0.151,
    -0.023,
    0.78,
    (a) => [
      ["pelvis", 0.35],
      [sideLeg(a), 0.65],
    ],
    (a) => -0.08 * (0.5 - 0.5 * Math.cos(a)) + 0.035 * Math.cos(a * 3),
  ],
  [0.91, 0.208, 0.145, -0.021, 0.84, "pelvis"],
  [1.045, 0.17, 0.132, -0.016, 0.9, "spine_01"],
  [1.24, 0.19, 0.146, -0.012, 0.94, "spine_02"],
  [1.39, 0.245, 0.169, -0.02, 0.94, "spine_03"],
  [1.46, 0.239, 0.153, -0.015, 0.96, "spine_03"],
  [1.51, 0.096, 0.105, -0.016, 0.96, "spine_03"],
])
// A diagonal, overlapping shoulder mantle. The broken edge gives it a
// recognizable silhouette without historic insignia or a game costume.
tube([
  [
    1.34,
    0.259,
    0.18,
    -0.018,
    0.79,
    "spine_03",
    (a) => 0.085 * Math.sin(a) - 0.045 * Math.max(0, -Math.cos(a)),
  ],
  [1.44, 0.264, 0.17, -0.018, 0.87, "spine_03", (a) => 0.027 * Math.sin(a)],
  [1.52, 0.129, 0.126, -0.021, 0.91, "neck_01"],
  [1.555, 0.098, 0.106, -0.022, 0.93, "neck_01"],
])
tube([
  [0.997, 0.177, 0.139, -0.015, 0.24, "spine_01", (a) => 0.014 * Math.sin(a)],
  [1.043, 0.174, 0.14, -0.014, 0.32, "spine_01", (a) => 0.014 * Math.sin(a)],
])
// The hood is a set of elliptical sections running from the black face
// opening towards the rounded, folded back. The opening is intentionally open.
const hood = [
  [0.109, 1.69, 0.096, 0.136],
  [0.065, 1.699, 0.119, 0.165],
  [-0.018, 1.699, 0.133, 0.185],
  [-0.104, 1.677, 0.122, 0.174],
  [-0.165, 1.642, 0.086, 0.122],
  [-0.195, 1.614, 0.017, 0.04],
  [-0.196, 1.61, 0.001, 0.001],
]
surface(32, hood.length, (r, u) => {
  const [z, y, rx, ry] = hood[r],
    a = u * Math.PI * 2,
    c = Math.cos(a),
    s = Math.sin(a)
  return {
    point: [
      rx * s,
      y + ry * c,
      z +
        (r === 0
          ? 0.072 * Math.max(c, 0) - 0.015 * (1 - c)
          : 0.025 * Math.max(c, 0)),
    ],
    tone: (r === 0 ? 0.95 : 0.89) * (0.91 + 0.065 * c + 0.035 * s),
    weights: [["Head", 1]],
  }
})
surface(32, 2, (r, u) => {
  const a = u * Math.PI * 2,
    c = Math.cos(a),
    s = Math.sin(a)
  return {
    point: [
      (0.096 - r * 0.007) * s,
      1.69 + (0.136 - r * 0.009) * c,
      0.109 + 0.072 * Math.max(c, 0) - 0.015 * (1 - c) - r * 0.012,
    ],
    tone: r ? 0.34 : 0.77,
    weights: [["Head", 1]],
  }
})
const mins = [Infinity, Infinity, Infinity],
  maxs = [-Infinity, -Infinity, -Infinity]
cp.forEach((x, i) => {
  mins[i % 3] = Math.min(mins[i % 3], x)
  maxs[i % 3] = Math.max(maxs[i % 3], x)
})
primitives.push({
  attributes: {
    POSITION: put(Float32Array.from(cp), "VEC3", { min: mins, max: maxs }),
    JOINTS_0: put(Uint8Array.from(cj), "VEC4"),
    WEIGHTS_0: put(Float32Array.from(cw), "VEC4"),
    COLOR_0: put(Uint8Array.from(cc), "VEC3", { normalized: true }),
  },
  indices: put(Uint16Array.from(ci), "SCALAR"),
  material: 0,
})
j.meshes = [{ name: "Wayfarer / split coat and open cowl", primitives }]

const ordered = [...joints].sort((a, b) => {
  const depth = (i) => {
    let d = 0,
      o = avatar[i]
    while (o.parent) {
      d++
      o = o.parent
    }
    return d
  }
  return depth(a) - depth(b)
})
const worldQ = (o) => o.getWorldQuaternion(new T.Quaternion())
const changes = avatar
  .slice(0, 65)
  .map((o, i) => worldQ(rig[i]).invert().multiply(worldQ(o)))
const pelvisIx = targets.get("pelvis"),
  targetRestPelvis = avatar[pelvisIx].position.clone(),
  sourceRestPelvis = rig[pelvisIx].position.clone()
const clips = {}
for (const lib of [lib1, lib2])
  for (const a of lib.j.animations) {
    const channels = []
    let duration = 0
    for (const ch of a.channels) {
      const name = lib.j.nodes[ch.target.node].name,
        i = targets.get(name)
      if (
        i === undefined ||
        name === "root" ||
        (ch.target.path !== "rotation" &&
          !(name === "pelvis" && ch.target.path === "translation"))
      )
        continue
      const sam = a.samplers[ch.sampler],
        times = read(lib, sam.input),
        values = read(lib, sam.output)
      const interp =
        ch.target.path === "rotation"
          ? new T.QuaternionLinearInterpolant(times, values, 4)
          : new T.LinearInterpolant(times, values, 3)
      duration = Math.max(duration, times.at(-1))
      channels.push({
        i,
        prop: ch.target.path === "rotation" ? "quaternion" : "position",
        interp,
      })
    }
    clips[a.name] = { channels, duration }
  }
function pose(name, time) {
  for (const ch of clips[name].channels)
    rig[ch.i][ch.prop].fromArray(ch.interp.evaluate(time))
  rig[66].updateMatrixWorld(true)
  const qs = [],
    ws = []
  for (const i of ordered) {
    ws[i] = new T.Quaternion()
      .setFromRotationMatrix(
        new T.Matrix4().extractRotation(rig[i].matrixWorld),
      )
      .multiply(changes[i])
    const pi = targets.get(avatar[i].parent?.name)
    qs[i] =
      pi === undefined
        ? ws[i].clone()
        : ws[pi].clone().invert().multiply(ws[i]).normalize()
  }
  return {
    qs,
    p: rig[pelvisIx].position
      .clone()
      .sub(sourceRestPelvis)
      .add(targetRestPelvis),
  }
}
const lerpPose = (a, b, t) => ({
  p: a.p.lerp(b.p, t),
  qs: a.qs.map((q, i) => q.slerp(b.qs[i], t)),
})
function bake(name, duration, sample) {
  const steps = Math.round(duration * 30),
    frames = Array.from({ length: steps + 1 }, (_, i) =>
      sample((i / steps) * duration),
    ),
    times = Float32Array.from(frames, (_, i) => (duration * i) / steps)
  const allTimes = put(times, "SCALAR", { min: [0], max: [duration] }),
    singleTime = put(Float32Array.of(0), "SCALAR", { min: [0], max: [0] })
  const anim = { name, samplers: [], channels: [] }
  for (const i of ordered) {
    const q = frames.map((p) => p.qs[i])
    for (let k = 1; k < q.length; k++)
      if (q[k - 1].dot(q[k]) < 0) q[k].set(-q[k].x, -q[k].y, -q[k].z, -q[k].w)
    const still = q.every((o) => 1 - Math.abs(o.dot(q[0])) < 2e-8)
    if (still && 1 - Math.abs(q[0].dot(avatar[i].quaternion)) < 2e-8) continue
    const rot = Float32Array.from(
      (still ? [q[0]] : q).flatMap((o) => o.toArray()),
    )
    anim.channels.push({
      sampler: anim.samplers.length,
      target: { node: i, path: "rotation" },
    })
    anim.samplers.push({
      input: still ? singleTime : allTimes,
      output: put(rot, "VEC4"),
      interpolation: "LINEAR",
    })
  }
  anim.channels.push({
    sampler: anim.samplers.length,
    target: { node: pelvisIx, path: "translation" },
  })
  anim.samplers.push({
    input: allTimes,
    output: put(
      Float32Array.from(frames.flatMap((f) => f.p.toArray())),
      "VEC3",
    ),
    interpolation: "LINEAR",
  })
  j.animations.push(anim)
}
const map = {
  idle: "Idle_Loop",
  run: "Sprint_Loop",
  jog: "Jog_Fwd_Loop",
  climb: "ClimbUp_1m",
  jump: "NinjaJump_Idle_Loop",
  takeoff: "NinjaJump_Start",
  land: "NinjaJump_Land",
}
for (const [alias, name] of Object.entries(map))
  bake(alias, clips[name].duration, (t) => pose(name, t))
// A new speed-vault, keyed between the passing sprint, reaching mantle, tucked
// flight and landing poses. A grounded right palm is solved on the middle beat.
const vaultKeys = [
  [0, "Sprint_Loop", 0.15],
  [0.17, "ClimbUp_1m", 0.04],
  [0.31, "ClimbUp_1m", 0.23],
  [0.45, "ClimbUp_1m", 0.305],
  [0.58, "ClimbUp_1m", 0.355],
  [0.68, "NinjaJump_Idle_Loop", 0.35],
  [0.83, "NinjaJump_Land", 0.12],
  [1, "Sprint_Loop", 0.52],
]
const rigCopy = nodes(body)
function palmPlant(frame, t) {
  const envelope = Math.min(
    1,
    Math.max(0, (t - 0.15) / 0.2),
    Math.max(0, (0.71 - t) / 0.15),
  )
  if (!envelope) return frame
  rigCopy[pelvisIx].position.copy(frame.p)
  frame.qs.forEach((q, i) => rigCopy[i].quaternion.copy(q))
  const pelvis = rigCopy[pelvisIx],
    parentQ = worldQ(pelvis.parent)
  const roll = new T.Quaternion().setFromAxisAngle(
    new T.Vector3(0, 0, 1),
    1.36 * envelope,
  )
  pelvis.quaternion
    .premultiply(parentQ.clone().invert().multiply(roll).multiply(parentQ))
    .normalize()
  frame.qs[pelvisIx].copy(pelvis.quaternion)
  const hand = rigCopy[targets.get("hand_r")],
    arm = rigCopy[targets.get("upperarm_r")],
    elbow = rigCopy[targets.get("lowerarm_r")]
  // Coordinates in the source's forward +Z space, before stage scaling.
  const lift = 0.3 * Math.sin(Math.PI * t),
    ground = 0.914,
    scale = 1.8 / (maxs[1] + 0.00950967)
  const target = new T.Vector3(
    -0.38,
    (ground - lift) / scale - 0.00950967,
    ((0.5 - t) * 1.8) / scale,
  )
  const eff = () => hand.getWorldPosition(new T.Vector3())
  for (let pass = 0; pass < 28; pass++)
    for (const joint of [elbow, arm]) {
      const pivot = joint.getWorldPosition(new T.Vector3()),
        from = eff().sub(pivot).normalize(),
        to = target.clone().sub(pivot).normalize()
      const correction = new T.Quaternion().setFromUnitVectors(from, to),
        pw = worldQ(joint.parent)
      joint.quaternion
        .premultiply(pw.clone().invert().multiply(correction).multiply(pw))
        .normalize()
      joint.updateMatrixWorld(true)
    }
  for (const joint of [arm, elbow])
    frame.qs[targets.get(joint.name)].slerp(joint.quaternion, envelope)
  return frame
}
bake("vault", 1, (t) => {
  let k = 1
  while (k < vaultKeys.length - 1 && vaultKeys[k][0] < t) k++
  const a = vaultKeys[k - 1],
    b = vaultKeys[k],
    u = (t - a[0]) / (b[0] - a[0])
  return palmPlant(
    lerpPose(pose(a[1], a[2]), pose(b[1], b[2]), u * u * (3 - 2 * u)),
    t,
  )
})
const pad = (4 - (offset % 4)) % 4
chunks.push(Buffer.alloc(pad))
j.buffers = [{ byteLength: offset + pad }]
const json = Buffer.from(JSON.stringify(j)),
  jp = (4 - (json.length % 4)) % 4,
  bin = Buffer.concat(chunks)
const header = Buffer.alloc(20)
header.write("glTF")
header.writeUInt32LE(2, 4)
header.writeUInt32LE(28 + json.length + jp + bin.length, 8)
header.writeUInt32LE(json.length + jp, 12)
header.write("JSON", 16)
const bh = Buffer.alloc(8)
bh.writeUInt32LE(bin.length)
bh.write("BIN\0", 4)
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(
  output,
  Buffer.concat([header, json, Buffer.alloc(jp, 32), bh, bin]),
)
console.log(
  "Wrote",
  output,
  fs.statSync(output).size,
  "bytes;",
  j.animations.map((a) => a.name).join(", "),
  "; rest height",
  maxs[1],
)
