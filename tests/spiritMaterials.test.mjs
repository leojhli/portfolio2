import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createHash } from "node:crypto"
import { createServer } from "vite"
import * as THREE from "three"

let server, createSpiritMaterials
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    logLevel: "silent",
  })
  ;({ createSpiritMaterials } = await server.ssrLoadModule(
    "/src/three/spiritMaterials.ts",
  ))
})
after(async () => server?.close())

function compileParameters(material) {
  const shader = {
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  }
  material.onBeforeCompile(shader, {})
  return shader
}
const members = (palette) =>
  Object.values(palette)
    .flat()
    .filter((value) => value?.isMaterial)

test("city finishes retain PBR lighting while giving stone, tile, wood and paper distinct responses", () => {
  const palette = createSpiritMaterials()
  try {
    for (const material of members(palette)) {
      assert.equal(material.isMeshStandardMaterial, true)
      assert.ok(material.color.toArray().every(Number.isFinite))
      assert.ok(material.roughness > 0 && material.roughness <= 1)
    }
    assert.ok(palette.roof.roughness < palette.stone.roughness)
    assert.ok(palette.metal.metalness > 0.5)
    assert.ok(
      palette.glow.emissiveIntensity > 0 &&
        palette.glow.emissiveIntensity < 0.35,
      "paper emits gently rather than flooding the window with yellow",
    )
    assert.notEqual(
      palette.wood.customProgramCacheKey(),
      palette.stone.customProgramCacheKey(),
    )
    assert.equal(
      palette.pavers[0].customProgramCacheKey(),
      palette.stone.customProgramCacheKey(),
      "shared finish programs do not multiply with palette colors",
    )
  } finally {
    palette.dispose()
  }
})

test("surface patches use world transforms after skinning and preserve Three's shading chunks", () => {
  const palette = createSpiritMaterials()
  try {
    for (const material of members(palette)) {
      const shader = compileParameters(material)
      assert.ok(
        shader.vertexShader.indexOf("cityPosition = vec4(transformed") >
          shader.vertexShader.indexOf("#include <skinning_vertex>"),
      )
      assert.ok(
        shader.vertexShader.includes(
          "cityPosition = batchingMatrix * cityPosition",
        ),
      )
      assert.ok(
        shader.vertexShader.includes(
          "cityPosition = instanceMatrix * cityPosition",
        ),
      )
      assert.ok(
        shader.vertexShader.indexOf("instanceMatrix * cityPosition") <
          shader.vertexShader.indexOf("modelMatrix * cityPosition"),
      )
      for (const chunk of [
        "lights_physical_fragment",
        "lights_fragment_begin",
        "normal_fragment_maps",
        "fog_fragment",
        "tonemapping_fragment",
        "colorspace_fragment",
      ]) {
        assert.ok(
          shader.fragmentShader.includes(`#include <${chunk}>`),
          `${chunk} still owns the native rendering behavior`,
        )
      }
      assert.equal(
        (shader.fragmentShader.match(/vec3 citySample =/g) ?? []).length,
        1,
      )
      assert.ok(shader.fragmentShader.includes("roughnessFactor = clamp"))
      assert.ok(shader.fragmentShader.includes("normal = normalize"))
      assert.ok(
        shader.uniforms.cityRelief.value >= 0 &&
          shader.uniforms.cityRelief.value <= 0.02,
      )
      assert.ok(
        !shader.fragmentShader.includes("gl_FragColor ="),
        "surface patches do not replace native lighting/output",
      )
    }
  } finally {
    palette.dispose()
  }
})

test("grain is deterministic linear data, mipmapped, shared by the palette and independently owned", () => {
  const a = createSpiritMaterials(),
    b = createSpiritMaterials()
  try {
    const first = compileParameters(a.plaster).uniforms.cityGrain
    for (const material of members(a))
      assert.equal(compileParameters(material).uniforms.cityGrain, first)
    const second = compileParameters(b.plaster).uniforms.cityGrain
    assert.notEqual(
      first.value,
      second.value,
      "separate world lifetimes do not share disposable GPU resources",
    )
    const texture = first.value
    assert.equal(texture.image.width, 256)
    assert.equal(texture.image.height, 256)
    assert.equal(texture.image.data.length, 256 * 256 * 4)
    assert.equal(texture.colorSpace, THREE.NoColorSpace)
    assert.equal(texture.wrapS, THREE.RepeatWrapping)
    assert.equal(texture.wrapT, THREE.RepeatWrapping)
    assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter)
    assert.equal(texture.generateMipmaps, true)
    const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
    assert.equal(digest(texture.image.data), digest(second.value.image.data))
    const pixels = texture.image.data
    assert.ok(
      new Set(pixels).size > 180,
      "grain contains actual surface variation",
    )
    for (let i = 3; i < pixels.length; i += 4) assert.equal(pixels[i], 255)
  } finally {
    a.dispose()
    b.dispose()
  }
})

test("palette disposal releases its single texture and every material exactly once", () => {
  const palette = createSpiritMaterials()
  const texture = compileParameters(palette.plaster).uniforms.cityGrain.value
  const resources = [texture, ...members(palette)]
  const disposals = new Map(resources.map((value) => [value, 0]))
  resources.forEach((value) =>
    value.addEventListener("dispose", () =>
      disposals.set(value, disposals.get(value) + 1),
    ),
  )
  palette.dispose()
  palette.dispose()
  for (const value of resources)
    assert.equal(disposals.get(value), 1, `${value.name} is released once`)
})
