// Convert Nexus321's officially downloaded Altaïr glTF into the existing
// portfolio rig. The input is static: this adds skin weights, not new geometry.
// Usage: node scripts/prepare-altair.mjs [download-directory] [reference-runner]
import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import * as T from "three"

const input = process.argv[2] || ".tmp-altair/source"
const reference = process.argv[3] || "public/models/cloister/runner.glb"
const output = "public/models/cloister/altair.glb"
const source = {
  j: JSON.parse(fs.readFileSync(path.join(input, "scene.gltf"), "utf8")),
  bin: fs.readFileSync(path.join(input, "scene.bin")),
}
function glb(file) {
  const bytes = fs.readFileSync(file)
  const length = bytes.readUInt32LE(12)
  return {
    j: JSON.parse(bytes.subarray(20, 20 + length)),
    bin: bytes.subarray(28 + length),
  }
}
const runner = glb(reference)
const constructors = {
  5121: Uint8Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
}
const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }
function read(document, index) {
  const a = document.j.accessors[index]
  const view = document.j.bufferViews[a.bufferView]
  const C = constructors[a.componentType]
  if (!C || a.sparse) throw Error("Unsupported source accessor")
  if (view.byteStride && view.byteStride !== C.BYTES_PER_ELEMENT * components[a.type])
    throw Error("Interleaved attributes need explicit unpacking")
  return new C(
    document.bin.buffer,
    document.bin.byteOffset + (view.byteOffset || 0) + (a.byteOffset || 0),
    a.count * components[a.type],
  )
}
function objects(document) {
  const all = document.j.nodes.map((n) => {
    const o = new T.Object3D()
    o.name = n.name
    if (n.matrix) o.applyMatrix4(new T.Matrix4().fromArray(n.matrix))
    if (n.translation) o.position.fromArray(n.translation)
    if (n.rotation) o.quaternion.fromArray(n.rotation)
    if (n.scale) o.scale.fromArray(n.scale)
    return o
  })
  document.j.nodes.forEach((n, i) => n.children?.forEach((c) => all[i].add(all[c])))
  all.filter((n) => !n.parent).forEach((n) => n.updateMatrixWorld(true))
  return all
}
if (source.j.skins?.length || source.j.animations?.length)
  throw Error("Expected the verified static source; reassess its existing rig before replacing it")

// Preserve the reference skeleton, bind matrices and already retargeted clips.
// Matching its standing height and foot plane also preserves the runtime's
// height normalization and the hand/foot contact scale used by choreography.
const base = runner.j.meshes[0].primitives[0]
const bodyPositions = read(runner, base.attributes.POSITION)
const bodyIndices = read(runner, base.indices)
const bodyJoints = read(runner, base.attributes.JOINTS_0)
const bodyWeights = read(runner, base.attributes.WEIGHTS_0)
const referenceMin = Math.min(...runner.j.meshes[0].primitives.map((p) => runner.j.accessors[p.attributes.POSITION].min[1]))
const referenceMax = Math.max(...runner.j.meshes[0].primitives.map((p) => runner.j.accessors[p.attributes.POSITION].max[1]))
const sourceObjects = objects(source)
const sourceBounds = new T.Box3()
for (let n = 0; n < source.j.nodes.length; n++) {
  const raw = source.j.nodes[n]
  if (raw.mesh === undefined) continue
  for (const p of source.j.meshes[raw.mesh].primitives) {
    const positions = read(source, p.attributes.POSITION)
    for (let i = 0; i < positions.length; i += 3)
      sourceBounds.expandByPoint(new T.Vector3().fromArray(positions, i).applyMatrix4(sourceObjects[n].matrixWorld))
  }
}
const scale = (referenceMax - referenceMin) / (sourceBounds.max.y - sourceBounds.min.y)
const alignment = new T.Matrix4().makeScale(scale, scale, scale)
alignment.setPosition(0, referenceMin - sourceBounds.min.y * scale, -0.055)

const skin = runner.j.skins[0]
const jointNames = skin.joints.map((n) => runner.j.nodes[n].name)
const joint = (name) => {
  const index = jointNames.indexOf(name)
  if (index < 0) throw Error("Required joint missing: " + name)
  return index
}
const head = joint("Head"), pelvis = joint("pelvis"), spine = joint("spine_03")

// A triangle BVH gives continuous barycentric skin-weight transfer. Nearest
// vertices alone leave visible steps across the robe and wrist boundaries.
const bodyTriangles = []
for (let i = 0; i < bodyIndices.length; i += 3) {
  const indices = Array.from(bodyIndices.subarray(i, i + 3))
  const points = indices.map((n) => new T.Vector3().fromArray(bodyPositions, n * 3))
  const triangle = new T.Triangle(...points)
  const box = new T.Box3().setFromPoints(points)
  bodyTriangles.push({ indices, triangle, box, center: box.getCenter(new T.Vector3()) })
}
function tree(triangles) {
  const box = new T.Box3()
  triangles.forEach((t) => box.union(t.box))
  if (triangles.length <= 16) return { box, triangles }
  const extent = box.getSize(new T.Vector3())
  const axis = extent.x >= extent.y && extent.x >= extent.z ? "x" : extent.y >= extent.z ? "y" : "z"
  triangles.sort((a, b) => a.center[axis] - b.center[axis])
  const middle = Math.floor(triangles.length / 2)
  return { box, children: [tree(triangles.slice(0, middle)), tree(triangles.slice(middle))] }
}
const fullTree = tree(bodyTriangles.slice())
const legTrees = [
  tree(bodyTriangles.filter((t) => t.center.x < 0 && t.center.y < 1.2)),
  tree(bodyTriangles.filter((t) => t.center.x >= 0 && t.center.y < 1.2)),
]
function nearest(point, root) {
  let bestDistance = Infinity, found
  const closest = new T.Vector3()
  function visit(node) {
    if (node.box.distanceToPoint(point) ** 2 > bestDistance) return
    if (node.triangles) {
      for (const t of node.triangles) {
        t.triangle.closestPointToPoint(point, closest)
        const distance = point.distanceToSquared(closest)
        if (distance < bestDistance) {
          bestDistance = distance
          found = { t, point: closest.clone() }
        }
      }
    } else {
      const [a, b] = node.children
      if (a.box.distanceToPoint(point) < b.box.distanceToPoint(point)) { visit(a); visit(b) }
      else { visit(b); visit(a) }
    }
  }
  visit(root)
  if (!found) throw Error("Skin transfer found no body surface")
  const bary = found.t.triangle.getBarycoord(found.point, new T.Vector3()).toArray()
  const weights = new Map()
  found.t.indices.forEach((v, i) => {
    for (let k = 0; k < 4; k++) {
      const id = bodyJoints[v * 4 + k]
      weights.set(id, (weights.get(id) || 0) + bary[i] * bodyWeights[v * 4 + k])
    }
  })
  return weights
}
function blend(weights, id, amount) {
  for (const [key, weight] of weights) weights.set(key, weight * (1 - amount))
  weights.set(id, (weights.get(id) || 0) + amount)
  return weights
}
function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const j = {
  asset: {
    version: "2.0",
    generator: "Cloister / prepare-altair.mjs",
    copyright: "Altaïr model by Nexus321, CC BY 4.0. Rig and base animations by Quaternius, CC0.",
    extras: {
      source: "https://sketchfab.com/3d-models/assassins-creed-altair-blend-1c9466cd5283403dace6991565b4a2cc",
      modifications: "Unit and axis conversion; transferred skinning; eight retargeted portfolio animations; texture removal for black fill and runtime white contours. Original triangle geometry retained.",
    },
  },
  extensionsUsed: ["KHR_materials_unlit"],
  scene: 0,
  scenes: structuredClone(runner.j.scenes),
  nodes: structuredClone(runner.j.nodes),
  skins: [], meshes: [{ name: "Altair_Nexus321", primitives: [] }],
  materials: [{ name: "Pitch black silhouette", doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0, 0, 0, 1], metallicFactor: 0, roughnessFactor: 1 }, extensions: { KHR_materials_unlit: {} } }],
  animations: [], accessors: [], bufferViews: [], buffers: [],
}
j.nodes[65].name = "Altair"
const chunks = []
let offset = 0
function put(array, type, options = {}) {
  const pad = (4 - offset % 4) % 4
  if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad }
  const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength)
  const view = j.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length }) - 1
  chunks.push(bytes); offset += bytes.length
  return j.accessors.push({ bufferView: view, componentType: Number(Object.keys(constructors).find((c) => array instanceof constructors[c])), count: array.length / components[type], type, ...options }) - 1
}
const copied = new Map()
function copy(index) {
  if (copied.has(index)) return copied.get(index)
  const { type, min, max, normalized } = runner.j.accessors[index]
  const result = put(read(runner, index), type, { min, max, normalized })
  copied.set(index, result)
  return result
}
j.skins = [{ ...structuredClone(skin), inverseBindMatrices: copy(skin.inverseBindMatrices) }]
j.animations = runner.j.animations.map((a) => ({ ...structuredClone(a), samplers: a.samplers.map((s) => ({ ...s, input: copy(s.input), output: copy(s.output) })) }))
const summary = []
for (let n = 0; n < source.j.nodes.length; n++) {
  const raw = source.j.nodes[n]
  if (raw.mesh === undefined) continue
  const meshIndex = raw.mesh
  const matrix = alignment.clone().multiply(sourceObjects[n].matrixWorld)
  const normalMatrix = new T.Matrix3().getNormalMatrix(matrix)
  for (const primitive of source.j.meshes[meshIndex].primitives) {
    const original = read(source, primitive.attributes.POSITION)
    const originalNormals = read(source, primitive.attributes.NORMAL)
    const positions = new Float32Array(original.length)
    const normals = new Float32Array(originalNormals.length)
    const indices = read(source, primitive.indices).slice()
    const jointIds = new Uint16Array(original.length / 3 * 4)
    const weights = new Float32Array(jointIds.length)
    const box = new T.Box3()
    const neighborSide = new Float32Array(original.length / 3)
    for (let i = 0; i < indices.length; i += 3) {
      const side = original[indices[i] * 3] + original[indices[i + 1] * 3] + original[indices[i + 2] * 3]
      for (let k = 0; k < 3; k++) neighborSide[indices[i + k]] += side
    }
    for (let v = 0; v < original.length / 3; v++) {
      const point = new T.Vector3().fromArray(original, v * 3).applyMatrix4(matrix)
      point.toArray(positions, v * 3)
      new T.Vector3().fromArray(originalNormals, v * 3).applyNormalMatrix(normalMatrix).toArray(normals, v * 3)
      box.expandByPoint(point)
      const side = point.x === 0 ? (neighborSide[v] < 0 ? -1 : 1) : Math.sign(point.x)
      const cloth = (meshIndex === 2 || meshIndex === 3) && point.y < 1.1
      let transferred = nearest(point, cloth ? legTrees[side < 0 ? 0 : 1] : fullTree)
      // Keep scabbards and throwing knives rigid at their attachment points.
      if (meshIndex === 6 || meshIndex === 7) transferred = new Map([[pelvis, 1]])
      if (meshIndex === 11) transferred = new Map([[spine, 1]])
      if (meshIndex === 9) transferred = new Map([[joint("hand_l"), 1]])
      // Face/eyes remain a single solid head. The hood mantle still follows
      // the shoulders; only the hood above the neck is locked to the head.
      if (meshIndex === 0 || meshIndex === 12) transferred = new Map([[head, 1]])
      if (meshIndex === 8) transferred = blend(transferred, head, smooth(1.57, 1.67, point.y))
      if (cloth) {
        // The split robe follows the corresponding leg. Its low hem must not
        // acquire toe or ankle weights simply because it hangs near a boot.
        const replacement = joint(side < 0 ? "calf_r" : "calf_l")
        for (const [id, weight] of [...transferred])
          if (/^(foot|ball)/.test(jointNames[id])) {
            transferred.delete(id)
            transferred.set(replacement, (transferred.get(replacement) || 0) + weight)
          }
      }
      const sorted = [...transferred].filter(([, w]) => w > 1e-8).sort((a, b) => b[1] - a[1]).slice(0, 4)
      const total = sorted.reduce((sum, [, w]) => sum + w, 0)
      if (!(total > 0)) throw Error("Invalid transferred weights")
      sorted.forEach(([id, weight], k) => { jointIds[v * 4 + k] = id; weights[v * 4 + k] = weight / total })
    }
    const name = source.j.materials[primitive.material].name
    j.meshes[0].primitives.push({
      attributes: {
        POSITION: put(positions, "VEC3", { min: box.min.toArray(), max: box.max.toArray() }),
        NORMAL: put(normals, "VEC3"), JOINTS_0: put(jointIds, "VEC4"), WEIGHTS_0: put(weights, "VEC4"),
      },
      indices: put(indices, "SCALAR"), material: 0,
      extras: { originalMesh: meshIndex, originalMaterial: name },
    })
    summary.push({ mesh: meshIndex, material: name, vertices: original.length / 3, triangles: indices.length / 3 })
  }
}
const padding = (4 - offset % 4) % 4
chunks.push(Buffer.alloc(padding))
j.buffers = [{ byteLength: offset + padding }]
const json = Buffer.from(JSON.stringify(j))
const jsonPadding = (4 - json.length % 4) % 4
const binary = Buffer.concat(chunks)
const header = Buffer.alloc(20)
header.write("glTF"); header.writeUInt32LE(2, 4)
header.writeUInt32LE(28 + json.length + jsonPadding + binary.length, 8)
header.writeUInt32LE(json.length + jsonPadding, 12); header.write("JSON", 16)
const binaryHeader = Buffer.alloc(8)
binaryHeader.writeUInt32LE(binary.length); binaryHeader.write("BIN\0", 4)
fs.writeFileSync(output, Buffer.concat([header, json, Buffer.alloc(jsonPadding, 32), binaryHeader, binary]))
const manifest = {
  model: "Assassins-creed-altair-blend", author: "Nexus321",
  source: j.asset.extras.source, license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  file: path.basename(output),
  sha256: createHash("sha256").update(fs.readFileSync(output)).digest("hex"),
  sourceGeometrySha256: createHash("sha256").update(source.bin).digest("hex"),
  downloadedSource: "Official Sketchfab glTF download; 14 static meshes, no skeleton or animations",
  sourceTriangles: summary.reduce((n, m) => n + m.triangles, 0),
  sourceVerticesWithAttributeSeams: summary.reduce((n, m) => n + m.vertices, 0),
  geometry: "All original triangle indices and positions retained after uniform unit conversion, source node transforms, and global alignment; no substitute character geometry.",
  skinning: "Barycentric nearest-body triangle transfer from Quaternius runner, with corresponding-leg robe assignment, rigid weapons, and head/hood constraints.",
  rigAndAnimations: "Existing portfolio Quaternius CC0 rig; eight clips retained byte-for-byte. Custom vault retained.",
  rendering: "Textures omitted; pitch black unlit material; white contours added at runtime.",
  coordinateSystem: { up: "+Y", facing: "+Z", heightBeforeRuntimeNormalization: referenceMax - referenceMin, footPlane: referenceMin, uniformSourceScale: scale, globalDepthOffset: -0.055 },
  clips: j.animations.map((a) => a.name), meshes: summary,
}
fs.writeFileSync("public/models/cloister/altair-provenance.json", JSON.stringify(manifest, null, 2) + "\n")
console.log(JSON.stringify({ output, bytes: fs.statSync(output).size, triangles: manifest.sourceTriangles, meshes: summary.length, clips: manifest.clips, coordinateSystem: manifest.coordinateSystem }, null, 2))
