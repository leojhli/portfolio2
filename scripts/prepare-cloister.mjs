/** Preserve Giravolt's authored stroke triangles; quantize positions and remove unused shading data. */
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import assert from "node:assert/strict"
import { MeshoptEncoder } from "meshoptimizer/encoder"
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js"

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])

const source = process.argv[2] ?? ".tmp-cloister/source"
const destination = "public/models/cloister"
const original = JSON.parse(
  fs.readFileSync(path.join(source, "scene.gltf"), "utf8"),
)
const input = fs.readFileSync(path.join(source, original.buffers[0].uri))
const output = {
  asset: {
    version: "2.0",
    generator: "portfolio2 / source-preserving cloister preparation",
  },
  extensionsUsed: [
    "KHR_materials_unlit",
    "KHR_mesh_quantization",
    "EXT_meshopt_compression",
  ],
  extensionsRequired: ["KHR_mesh_quantization", "EXT_meshopt_compression"],
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [
    {
      name: "Santes Creus / Giravolt",
      matrix: original.nodes[0].matrix,
      children: [],
    },
  ],
  meshes: [],
  materials: [
    {
      name: "Original white drawing",
      doubleSided: true,
      extensions: { KHR_materials_unlit: {} },
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
    },
  ],
  buffers: [
    { byteLength: 0 },
    {
      byteLength: 0,
      extensions: { EXT_meshopt_compression: { fallback: true } },
    },
  ],
  bufferViews: [],
  accessors: [],
}
const chunks = []
let offset = 0,
  decodedOffset = 0,
  triangles = 0,
  sourceVertices = 0,
  retainedVertices = 0,
  omittedTriangles = 0
let measuredMaximumPositionError = 0,
  collapsedTriangles = 0,
  adjustedPositions = 0
const sourceSamples = []
const append = (array, target, stride, mode) => {
  const sourceBytes = new Uint8Array(
    array.buffer,
    array.byteOffset,
    array.byteLength,
  )
  const count = sourceBytes.byteLength / stride
  const bytes = Buffer.from(
    MeshoptEncoder.encodeGltfBuffer(sourceBytes, count, stride, mode),
  )
  const decoded = new Uint8Array(sourceBytes.byteLength)
  MeshoptDecoder.decodeGltfBuffer(decoded, count, stride, bytes, mode)
  if (mode === "ATTRIBUTES") assert.deepEqual(decoded, sourceBytes)
  else {
    // TRIANGLES may rotate vertices cyclically, but must preserve winding and every face.
    const indices = new array.constructor(decoded.buffer)
    for (let i = 0; i < indices.length; i += 3)
      assert.ok(
        [0, 1, 2].some((k) =>
          [0, 1, 2].every((j) => indices[i + j] === array[i + ((j + k) % 3)]),
        ),
      )
  }
  const pad = (4 - (bytes.length % 4)) % 4
  const id = output.bufferViews.length
  output.bufferViews.push({
    buffer: 1,
    byteOffset: decodedOffset,
    byteLength: sourceBytes.byteLength,
    target,
    ...(mode === "ATTRIBUTES" ? { byteStride: stride } : {}),
    extensions: {
      EXT_meshopt_compression: {
        buffer: 0,
        byteOffset: offset,
        byteLength: bytes.length,
        byteStride: stride,
        count,
        mode,
      },
    },
  })
  chunks.push(bytes, Buffer.alloc(pad))
  offset += bytes.length + pad
  decodedOffset +=
    sourceBytes.byteLength + ((4 - (sourceBytes.byteLength % 4)) % 4)
  return id
}
const read = (accessorId) => {
  const a = original.accessors[accessorId],
    view = original.bufferViews[a.bufferView]
  const sizes = { 5123: 2, 5125: 4, 5126: 4 }
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]
  const size = sizes[a.componentType]
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0)
  const stride = view.byteStride ?? width * size
  const result = new Array(a.count * width)
  for (let i = 0; i < a.count; i++)
    for (let k = 0; k < width; k++) {
      const p = start + i * stride + k * size
      result[i * width + k] =
        a.componentType === 5126
          ? input.readFloatLE(p)
          : a.componentType === 5125
            ? input.readUInt32LE(p)
            : input.readUInt16LE(p)
    }
  return result
}
for (const mesh of original.meshes)
  for (const primitive of mesh.primitives) {
    const material = original.materials[primitive.material]
    const indices = read(primitive.indices)
    if (
      material.alphaMode === "BLEND" &&
      material.pbrMetallicRoughness?.baseColorFactor?.[3] === 0
    ) {
      omittedTriangles += indices.length / 3
      continue
    }
    const a = original.accessors[primitive.attributes.POSITION]
    const min = a.min,
      scale = a.max.map((v, i) => Math.max(v - min[i], 0.000001))
    const positions = read(primitive.attributes.POSITION)
    const positions16 = [],
      unique = new Map(),
      occupied = new Set(),
      remap = new Uint32Array(a.count)
    for (let i = 0; i < a.count; i++) {
      const position = positions.slice(i * 3, i * 3 + 3)
      const key = position.join(",")
      let index = unique.get(key)
      if (index === undefined) {
        const exact = position.map((v, k) => ((v - min[k]) / scale[k]) * 65535)
        let q = exact.map((v) => Math.max(0, Math.min(65535, Math.round(v))))
        const gridKey = (values) =>
          values[0] * 4294967296 + values[1] * 65536 + values[2]
        // Preserve distinct source vertices even when an exceptionally thin stroke
        // shares a quantization cell. The nearest free adjacent cell avoids erasing it.
        if (occupied.has(gridKey(q))) {
          const candidates = []
          for (let x = -1; x <= 1; x++)
            for (let y = -1; y <= 1; y++)
              for (let z = -1; z <= 1; z++) {
                const candidate = [q[0] + x, q[1] + y, q[2] + z]
                if (
                  candidate.some((v) => v < 0 || v > 65535) ||
                  occupied.has(gridKey(candidate))
                )
                  continue
                candidates.push({
                  candidate,
                  error: candidate.reduce(
                    (sum, v, k) => sum + ((v - exact[k]) * scale[k]) ** 2,
                    0,
                  ),
                })
              }
          candidates.sort((a, b) => a.error - b.error)
          assert.ok(
            candidates.length,
            "A stroke vertex needs a wider quantization neighborhood",
          )
          q = candidates[0].candidate
          adjustedPositions++
        }
        for (let k = 0; k < 3; k++)
          measuredMaximumPositionError = Math.max(
            measuredMaximumPositionError,
            Math.abs(min[k] + (q[k] / 65535) * scale[k] - position[k]),
          )
        occupied.add(gridKey(q))
        index = unique.size
        unique.set(key, index)
        positions16.push(...q, 0)
      }
      remap[i] = index
    }
    const reorderedIndices = Uint32Array.from(indices, (i) => remap[i])
    for (let i = 0; i < reorderedIndices.length; i += 3) {
      const [a, b, c] = reorderedIndices.subarray(i, i + 3)
      if (a === b || b === c || c === a) collapsedTriangles++
    }
    const [vertexRemap, vertexCount] = MeshoptEncoder.reorderMesh(
      reorderedIndices,
      true,
      true,
    )
    const reorderedPositions = new Uint16Array(vertexCount * 4)
    for (let i = 0; i < unique.size; i++)
      if (vertexRemap[i] !== 0xffffffff)
        reorderedPositions.set(
          positions16.slice(i * 4, i * 4 + 4),
          vertexRemap[i] * 4,
        )
    const meshIndex = output.meshes.length
    for (const index of [
      indices[0],
      indices[Math.floor(indices.length / 2)],
      indices.at(-1),
    ])
      sourceSamples.push({
        mesh: meshIndex,
        vertex: vertexRemap[remap[index]],
        position: positions.slice(index * 3, index * 3 + 3),
      })
    const positionView = append(reorderedPositions, 34962, 8, "ATTRIBUTES")
    const positionAccessor = output.accessors.length
    output.accessors.push({
      bufferView: positionView,
      byteOffset: 0,
      componentType: 5123,
      normalized: true,
      count: vertexCount,
      type: "VEC3",
      min: [0, 0, 0],
      max: [65535, 65535, 65535],
    })
    const IndexArray = vertexCount <= 65535 ? Uint16Array : Uint32Array
    const outIndices = new IndexArray(reorderedIndices)
    const indexView = append(
      outIndices,
      34963,
      IndexArray.BYTES_PER_ELEMENT,
      "TRIANGLES",
    )
    const indexAccessor = output.accessors.length
    output.accessors.push({
      bufferView: indexView,
      componentType: IndexArray === Uint16Array ? 5123 : 5125,
      count: outIndices.length,
      type: "SCALAR",
    })
    output.meshes.push({
      name: mesh.name,
      primitives: [
        {
          attributes: { POSITION: positionAccessor },
          indices: indexAccessor,
          material: 0,
          mode: 4,
        },
      ],
    })
    output.nodes[0].children.push(output.nodes.length)
    output.nodes.push({
      name: mesh.name,
      mesh: meshIndex,
      translation: min,
      scale,
    })
    sourceVertices += a.count
    retainedVertices += vertexCount
    triangles += indices.length / 3
  }
output.buffers[0].byteLength = offset
output.buffers[1].byteLength = decodedOffset
const json = Buffer.from(JSON.stringify(output)),
  jsonPadded = Buffer.concat([
    json,
    Buffer.alloc((4 - (json.length % 4)) % 4, 32),
  ])
const binary = Buffer.concat(chunks)
const header = Buffer.alloc(20)
header.writeUInt32LE(0x46546c67, 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(28 + jsonPadded.length + binary.length, 8)
header.writeUInt32LE(jsonPadded.length, 12)
header.writeUInt32LE(0x4e4f534a, 16)
const binHeader = Buffer.alloc(8)
binHeader.writeUInt32LE(binary.length, 0)
binHeader.writeUInt32LE(0x004e4942, 4)
const glb = Buffer.concat([header, jsonPadded, binHeader, binary])
fs.mkdirSync(destination, { recursive: true })
fs.writeFileSync(path.join(destination, "cloister.glb"), glb)
fs.copyFileSync(
  path.join(source, "license.txt"),
  path.join(destination, "LICENSE-CLOISTER.txt"),
)
const report = {
  title: "Claustre del Reial Monestir de Santes Creus",
  author: "Giravolt",
  artist: "Rubén González Candial",
  source:
    "https://sketchfab.com/3d-models/claustre-del-reial-monestir-de-santes-creus-66787ebf720f4687aa11a51d6e883de7",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  sourceGeometrySha256: crypto.createHash("sha256").update(input).digest("hex"),
  file: "cloister.glb",
  sha256: crypto.createHash("sha256").update(glb).digest("hex"),
  modifications:
    "Removed unused normals/UVs and fully transparent two-triangle plane. Deduplicated exact source positions and quantized to 16 bits per component within each original mesh, moving colliding positions to the nearest free neighboring cell to preserve thin strokes. Reordered triangles and vertices for locality; retained all visible source triangle records. EXT_meshopt_compression encodes the prepared geometry losslessly. Both attribute and triangle streams were decoded and verified during preparation.",
  triangles,
  omittedTriangles,
  meshes: output.meshes.length,
  sourceVertices,
  retainedVertices,
  sourceBytes: input.length,
  decodedBufferBytes: decodedOffset,
  downloadBytes: glb.length,
  maximumPositionError: Math.max(
    ...output.nodes
      .slice(1)
      .flatMap((n) => n.scale.map((s) => (s / 65535) * 1.5)),
  ),
  measuredMaximumPositionError,
  adjustedPositions,
  collapsedTriangles,
  sourceSamples,
}
fs.writeFileSync(
  path.join(destination, "cloister-manifest.json"),
  JSON.stringify(report, null, 2) + "\n",
)
console.log(
  JSON.stringify(
    {
      ...report,
      sourceSamples: `${sourceSamples.length} original source vertices recorded for roundtrip validation`,
    },
    null,
    2,
  ),
)
