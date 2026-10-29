import * as THREE from "three"

type Finish = "plaster" | "stone" | "tile" | "wood" | "metal" | "paper" | "cloth" | "foliage"

const finishId: Record<Finish, number> = {
  plaster: 0,
  stone: 1,
  tile: 2,
  wood: 3,
  metal: 4,
  paper: 5,
  cloth: 6,
  foliage: 7,
}

/** One periodic, linear-data atlas gives maintained finishes a subtle tactile grain. */
function makeGrain() {
  const size = 256
  const data = new Uint8Array(size * size * 4)
  const hash = (x: number, y: number) => {
    let n = Math.imul(x + 173, 374761393) ^ Math.imul(y + 419, 668265263)
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295
  }
  const noise = (x: number, y: number, period: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y)
    const fx = x - ix,
      fy = y - iy
    const sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy)
    const a = hash(ix % period, iy % period)
    const b = hash((ix + 1) % period, iy % period)
    const c = hash(ix % period, (iy + 1) % period)
    const d = hash((ix + 1) % period, (iy + 1) % period)
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(a, b, sx),
      THREE.MathUtils.lerp(c, d, sx),
      sy,
    )
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size
      const broad = noise(u * 8, v * 8, 8)
      const medium = noise(u * 32, v * 32, 32)
      const grain = 0.5 + 0.5 * Math.sin((u * 18 + broad * 0.65) * Math.PI * 2)
      const i = (y * size + x) * 4
      data[i] = Math.round((broad * 0.72 + medium * 0.28) * 255)
      data[i + 1] = Math.round(hash(x, y) * 255)
      data[i + 2] = Math.round(grain * 255)
      data[i + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.name = "Rain District / shared periodic surface grain"
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

const vertexDeclaration = "varying vec3 vCityWorldPosition;"
const worldPosition = `
  vec4 cityPosition = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    cityPosition = batchingMatrix * cityPosition;
  #endif
  #ifdef USE_INSTANCING
    cityPosition = instanceMatrix * cityPosition;
  #endif
  vCityWorldPosition = (modelMatrix * cityPosition).xyz;
`

const fragmentDeclaration = `
varying vec3 vCityWorldPosition;
uniform sampler2D cityGrain;
uniform float cityWear;
uniform float cityRelief;

// Triplanar sampling retains real-world scale on walls, paving and curved roofs.
// Derivatives use geometric normals so mesh smoothing does not smear the pattern.
vec3 citySurface(vec3 p) {
  vec3 weights = abs(cross(dFdx(p), dFdy(p)));
  weights /= max(max(weights.x, weights.y), max(weights.z, 0.000001));
  weights *= weights;
  weights *= weights;
  weights /= max(dot(weights, vec3(1.0)), 0.000001);
  #if CITY_FINISH == 3
    vec2 scale = vec2(0.58, 0.065);
  #else
    vec2 scale = vec2(0.42);
  #endif
  return texture2D(cityGrain, p.zy * scale).rgb * weights.x
       + texture2D(cityGrain, p.xz * scale).rgb * weights.y
       + texture2D(cityGrain, p.xy * scale).rgb * weights.z;
}
`

const surfaceColor = `
  vec3 citySample = citySurface(vCityWorldPosition);
  float cityMottle = citySample.r - 0.5;
  float cityFine = citySample.g - 0.5;
  float cityHeight = citySample.r * 0.7 + citySample.g * 0.3;
  float cityRoughness = cityMottle * 0.05;
  float cityShade = 1.0;
  #if CITY_FINISH == 0
    // Clean mineral enamel; no damp tide line along the street.
    cityShade += cityMottle * 0.12 + cityFine * 0.025;
  #elif CITY_FINISH == 1
    cityShade += cityMottle * 0.18 + cityFine * 0.045;
    cityHeight = citySample.r * 0.8 + citySample.g * 0.2;
    cityRoughness += cityFine * 0.045;
  #elif CITY_FINISH == 2
    cityShade += cityMottle * 0.12 + cityFine * 0.025;
    cityRoughness += cityFine * 0.035;
  #elif CITY_FINISH == 3
    float cityFibers = citySample.b;
    cityShade += cityMottle * 0.16 - pow(cityFibers, 4.0) * 0.12;
    cityHeight = cityFibers * 0.6 + citySample.r * 0.4;
    cityRoughness += cityFibers * 0.05;
  #elif CITY_FINISH == 4
    cityShade += cityMottle * 0.1 + cityFine * 0.02;
    cityRoughness += (1.0 - citySample.r) * 0.045;
  #elif CITY_FINISH == 5
    cityShade += cityMottle * 0.15 + cityFine * 0.045;
    totalEmissiveRadiance *= 0.85 + citySample.r * 0.15;
  #elif CITY_FINISH == 6
    cityShade += cityMottle * 0.12 + cityFine * 0.07;
  #else
    cityShade += cityMottle * 0.21 + cityFine * 0.035;
  #endif
  diffuseColor.rgb *= mix(1.0, cityShade, cityWear);
`

const surfaceNormal = `
  // Screen-space derivative relief follows the existing view-space normal,
  // avoiding seams from missing tangents or arbitrary box UV orientation.
  vec3 cityDx = dFdx(-vViewPosition);
  vec3 cityDy = dFdy(-vViewPosition);
  vec3 cityRx = cross(cityDy, normal);
  vec3 cityRy = cross(normal, cityDx);
  float cityDet = dot(cityDx, cityRx);
  vec3 cityGradient = sign(cityDet) *
    (dFdx(cityHeight) * cityRx + dFdy(cityHeight) * cityRy);
  normal = normalize(max(abs(cityDet), 0.000001) * normal - cityRelief * cityGradient);
`

/** Procedural finishes remain ordinary PBR materials: lighting/shadows stay native Three.js. */
export function createDistrictMaterials() {
  const grain = makeGrain()
  const grainUniform = { value: grain }
  const owned: THREE.MeshStandardMaterial[] = []
  const material = (
    name: string,
    color: string,
    finish: Finish,
    roughness = 0.8,
    relief = 0.008,
    parameters: THREE.MeshStandardMaterialParameters = {},
  ) => {
    const result = new THREE.MeshStandardMaterial({
      color,
      roughness,
      ...parameters,
    })
    result.name = `Rain District / ${name}`
    result.userData.surfaceFinish = finish
    result.onBeforeCompile = (shader) => {
      shader.uniforms.cityGrain = grainUniform
      shader.uniforms.cityWear = { value: finish === "wood" ? 0.65 : 0.28 }
      shader.uniforms.cityRelief = { value: relief }
      shader.vertexShader =
        `${vertexDeclaration}\n${shader.vertexShader}`.replace(
          "#include <project_vertex>",
          `#include <project_vertex>\n${worldPosition}`,
        )
      shader.fragmentShader =
        `#define CITY_FINISH ${finishId[finish]}\n${fragmentDeclaration}\n${shader.fragmentShader}`
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>\n${surfaceColor}`,
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + cityRoughness, 0.08, 1.0);",
          )
          .replace(
            "#include <normal_fragment_maps>",
            `#include <normal_fragment_maps>\n${surfaceNormal}`,
          )
    }
    // Uniform values vary per material; only the finish changes the program source.
    result.customProgramCacheKey = () => `rain-district-surface-v2/${finish}`
    owned.push(result)
    return result
  }
  const plaster = material(
    "warm ivory ceramic",
    "#b4c0ba",
    "plaster",
    0.38,
    0.0015,
  )
  const stone = material(
    "honed blue-grey stone",
    "#526b76",
    "stone",
    0.54,
    0.004,
  )
  const roof = material(
    "deep indigo glazed tile",
    "#294e66",
    "tile",
    0.25,
    0.001,
    { metalness: 0.22 },
  )
  const roofEdge = material(
    "tile ridge glaze",
    "#618496",
    "tile",
    0.22,
    0.001,
    { metalness: 0.32 },
  )
  const dark = material(
    "midnight lacquer joinery",
    "#2b3b4a",
    "wood",
    0.32,
    0.002,
  )
  const wood = material("oiled honey timber", "#a77851", "wood", 0.46, 0.004)
  const metal = material(
    "satin titanium hardware",
    "#b6cbd0",
    "metal",
    0.28,
    0.001,
    { metalness: 0.58, emissive: "#314c5c", emissiveIntensity: 0.08 },
  )
  const glow = material(
    "warm paper lanterns",
    "#f2ddbb",
    "paper",
    0.72,
    0.001,
    { emissive: "#ffc28a", emissiveIntensity: 0.8 },
  )
  const pink = material("sakura blossom", "#d889a4", "foliage", 0.95, 0.002)
  const palePink = material(
    "pale sakura blossom",
    "#edbac9",
    "foliage",
    0.95,
    0.002,
  )
  const green = material("garden foliage", "#528e69", "foliage", 0.82, 0.003)
  const grass = material("planted garden", "#436f55", "foliage", 0.88, 0.004)
  const black = material("indigo cloth", "#151c28", "cloth", 0.92, 0.003)
  const pavers = ["#50636d", "#647680", "#465b66"].map((color, i) =>
    material(`honed paver ${i + 1}`, color, "stone", 0.46, 0.003),
  )
  let disposed = false
  return {
    plaster,
    stone,
    roof,
    roofEdge,
    dark,
    wood,
    metal,
    glow,
    pink,
    palePink,
    green,
    grass,
    black,
    pavers,
    dispose() {
      if (disposed) return
      disposed = true
      grain.dispose()
      owned.forEach((value) => value.dispose())
    },
  }
}
