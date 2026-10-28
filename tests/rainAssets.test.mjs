import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

const directory = new URL("../public/models/neon-district/", import.meta.url)
const manifest = JSON.parse(
  await readFile(new URL("manifest.json", directory), "utf8"),
)

// These checks operate on shipped binary assets, independently of the renderer.
// A missing image, corrupt accessor, changed source file, or oversized replacement
// should fail here before a user enters the optional 3D world.
function parseGlb(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, "GLB magic")
  assert.equal(bytes.readUInt32LE(4), 2, "glTF 2 container")
  assert.equal(bytes.readUInt32LE(8), bytes.length, "complete GLB download")
  const chunks = []
  for (let offset = 12; offset < bytes.length; ) {
    assert.ok(offset + 8 <= bytes.length, "complete chunk header")
    const length = bytes.readUInt32LE(offset)
    assert.equal(length % 4, 0, "aligned chunk")
    assert.ok(offset + 8 + length <= bytes.length, "complete chunk payload")
    chunks.push({
      type: bytes.readUInt32LE(offset + 4),
      data: bytes.subarray(offset + 8, offset + 8 + length),
    })
    offset += 8 + length
  }
  assert.equal(chunks.length, 2, "JSON and one embedded binary chunk")
  assert.equal(chunks[0].type, 0x4e4f534a)
  assert.equal(chunks[1].type, 0x004e4942)
  const json = JSON.parse(chunks[0].data.toString("utf8"))
  return { json, binary: chunks[1].data }
}

function imageDimensions(image, mimeType) {
  if (mimeType === "image/png") {
    assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
    assert.equal(image.subarray(12, 16).toString(), "IHDR")
    return [image.readUInt32BE(16), image.readUInt32BE(20)]
  }
  assert.equal(mimeType, "image/jpeg", "textures need no optional decoder")
  assert.equal(image.readUInt16BE(0), 0xffd8, "JPEG start marker")
  for (let offset = 2; offset + 4 < image.length; ) {
    assert.equal(image[offset], 0xff, "JPEG marker boundary")
    while (image[offset] === 0xff) offset++
    const marker = image[offset++]
    assert.notEqual(marker, 0xda, "JPEG dimensions precede scan data")
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    )
      continue
    const length = image.readUInt16BE(offset)
    assert.ok(length >= 2 && offset + length <= image.length)
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
        0xcf,
      ].includes(marker)
    )
      return [image.readUInt16BE(offset + 5), image.readUInt16BE(offset + 3)]
    offset += length
  }
  assert.fail("JPEG has a supported frame header")
}

function geometryOnlyGlb(json, binary) {
  const geometryDocument = structuredClone(json)
  // Node has no image decoder/GPU. Preserve the complete geometry, transforms,
  // skeleton and clips while omitting materials' image fetches for this check.
  geometryDocument.materials = json.materials.map(({ name }) => ({ name }))
  delete geometryDocument.images
  delete geometryDocument.textures
  const serialized = Buffer.from(JSON.stringify(geometryDocument))
  const padded = Buffer.concat([
    serialized,
    Buffer.alloc((4 - (serialized.length % 4)) % 4, 32),
  ])
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(28 + padded.length + binary.length, 8)
  header.writeUInt32LE(padded.length, 12)
  header.writeUInt32LE(0x4e4f534a, 16)
  const binaryHeader = Buffer.alloc(8)
  binaryHeader.writeUInt32LE(binary.length, 0)
  binaryHeader.writeUInt32LE(0x004e4942, 4)
  const glb = Buffer.concat([header, padded, binaryHeader, binary])
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength)
}

const models = await Promise.all(
  manifest.models.map(async (record) => {
    assert.match(record.path, /^\/models\/neon-district\/[a-z-]+\.glb$/)
    const bytes = await readFile(
      new URL(record.path.split("/").at(-1), directory),
    )
    return { record, bytes, ...parseGlb(bytes) }
  }),
)

test("shipped models retain source identity, usable licenses and complete attribution", async () => {
  const credits = await readFile(new URL("credits.html", directory), "utf8")
  assert.equal(
    new Set(models.map(({ record }) => record.sketchfabUid)).size,
    models.length,
  )
  assert.ok(
    models.length >= 2,
    "the district combines genuinely distinct models",
  )
  for (const { record, bytes, json } of models) {
    assert.equal(record.license.id, "CC-BY-4.0")
    assert.equal(
      record.license.url,
      "https://creativecommons.org/licenses/by/4.0/",
    )
    assert.equal(json.asset.version, "2.0")
    assert.match(json.asset.extras.license, /^CC-BY-4\.0 /)
    assert.equal(json.asset.extras.source, record.sourceUrl)
    assert.ok(json.asset.extras.source.endsWith(record.sketchfabUid))
    assert.ok(json.asset.extras.author.startsWith(record.author))
    assert.ok(
      credits.includes(record.sourceUrl),
      `${record.id} links back to its creator's work`,
    )
    assert.ok(
      credits.includes(record.author),
      `${record.id} visibly credits its author`,
    )
    assert.equal(bytes.length, record.bytes)
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      record.sha256,
    )
    const mirror = new URL(record.downloadUrl)
    assert.equal(mirror.hostname, "huggingface.co")
    assert.ok(
      mirror.pathname.startsWith(
        "/datasets/allenai/objaverse/resolve/main/glbs/",
      ),
    )
    assert.ok(mirror.pathname.endsWith(`/${record.sketchfabUid}.glb`))
  }
})

test("optional world assets stay inside the 20 MB budget and contain their texture dependencies", () => {
  const total = models.reduce((sum, { bytes }) => sum + bytes.length, 0)
  assert.equal(total, manifest.totalBytes)
  assert.ok(total <= 20_000_000, "combined optional-world download budget")
  for (const { record, json, binary } of models) {
    assert.equal(json.buffers.length, 1)
    assert.equal(
      json.buffers[0].uri,
      undefined,
      "no external binary dependency",
    )
    assert.ok(json.buffers[0].byteLength <= binary.length)
    assert.ok(binary.length - json.buffers[0].byteLength < 4)
    for (const view of json.bufferViews) {
      assert.equal(view.buffer, 0)
      assert.ok((view.byteOffset ?? 0) + view.byteLength <= binary.length)
    }
    for (const image of json.images) {
      assert.equal(image.uri, undefined, "no remote image dependency")
      const view = json.bufferViews[image.bufferView]
      assert.ok(view, "embedded image view exists")
      const offset = view.byteOffset ?? 0
      const dimensions = imageDimensions(
        binary.subarray(offset, offset + view.byteLength),
        image.mimeType,
      )
      assert.ok(
        dimensions.every((value) => value > 0 && value <= 1024),
        `${record.id} texture memory budget`,
      )
    }
    for (const texture of json.textures) assert.ok(json.images[texture.source])
    assert.ok(
      !(json.extensionsRequired ?? []).some((extension) =>
        [
          "KHR_draco_mesh_compression",
          "EXT_meshopt_compression",
          "KHR_texture_basisu",
        ].includes(extension),
      ),
      "no unshipped decoder is needed",
    )
  }
})

test("real GLB geometry, bounds and animation tracks load without broken accessors", async () => {
  for (const { record, json, binary } of models) {
    const asset = await new GLTFLoader().parseAsync(
      geometryOnlyGlb(json, binary),
      "",
    )
    asset.scene.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(asset.scene)
    assert.ok(!bounds.isEmpty())
    for (const key of ["min", "max"]) {
      bounds[key].toArray().forEach((value, axis) => {
        assert.ok(Number.isFinite(value))
        assert.ok(
          Math.abs(value - record.geometry.bounds[key][axis]) < 0.001,
          `${record.id}: transformed ${key} axis ${axis} must match placement metadata`,
        )
      })
    }
    let triangles = 0
    const resources = new Set()
    asset.scene.traverse((object) => {
      if (!object.isMesh) return
      const positions = object.geometry.getAttribute("position")
      assert.ok(positions.count > 0)
      assert.ok(Array.from(positions.array).every(Number.isFinite))
      const index = object.geometry.index
      if (index)
        assert.ok(
          Array.from(index.array).every((value) => value < positions.count),
        )
      triangles += (index?.count ?? positions.count) / 3
      resources.add(object.geometry)
      for (const material of [].concat(object.material)) resources.add(material)
    })
    assert.equal(triangles, record.geometry.triangles)
    assert.equal(asset.animations.length, record.animations.length)
    for (const clip of asset.animations) {
      assert.ok(clip.duration > 0)
      assert.equal(clip.validate(), true)
      assert.ok(record.animations.some(({ name }) => name === clip.name))
    }
    for (const resource of resources) resource.dispose()
  }
})
