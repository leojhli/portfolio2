import * as THREE from "three"
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js"
import { clone } from "three/addons/utils/SkeletonUtils.js"

export type DistrictAssetStatus = {
  loaded: number
  total: number
  failed: string[]
}
export const districtAssetFiles = [
  "asia-building",
  "industrial-ac",
  "courier-scooter",
  "chinese-lantern",
] as const

/** Restore source paint without erasing modeled balconies, frames or equipment. */
function restoreBuildingFinishes(scene: THREE.Object3D) {
  const finished = new Set<THREE.MeshStandardMaterial>()
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    for (const source of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      const material = source as THREE.MeshStandardMaterial
      if (!material.isMeshStandardMaterial || finished.has(material)) continue
      finished.add(material)
      const concrete = material.name.startsWith("concrete")
      const facade = material.name.startsWith("build_")
      material.roughness = concrete ? 0.42 : 0.46
      material.metalness = concrete ? 0.08 : 0.22
      if (concrete) material.color.set("#bbc9c5")
      if (!concrete && !facade) continue
      material.userData.districtRestoration = concrete ? "ceramic" : "facade"
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          float restoredLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          ${
            concrete
              ? `// The source atlas contains peeling paint; retain only a fine tonal grain.
                 diffuseColor.rgb = diffuse * (0.97 + 0.03 * sqrt(clamp(restoredLuma, 0.0, 1.0)));`
              : `// Preserve dark window/frame detail while replacing the baked brown patina.
                 float restoredDetail = smoothstep(0.025, 0.64, restoredLuma);
                 vec3 restoredPaint = mix(vec3(0.032, 0.075, 0.1), vec3(0.62, 0.68, 0.62), restoredDetail);
                 diffuseColor.rgb = mix(diffuseColor.rgb, restoredPaint, 0.84);`
          }`,
        )
      }
      material.customProgramCacheKey = () =>
        `rain-district-restored-v1/${concrete ? "ceramic" : "facade"}`
    }
  })
}

/** Public, licensed Sketchfab models. Load only after the visitor enters the district. */
export function loadDistrictModels(
  root: THREE.Group,
  onStatus?: (status: DistrictAssetStatus) => void,
) {
  const loader = new GLTFLoader()
  let disposed = false
  const templates: THREE.Object3D[] = []
  const instances: THREE.Object3D[] = []
  const mixers: THREE.AnimationMixer[] = []
  const status: DistrictAssetStatus = {
    loaded: 0,
    total: districtAssetFiles.length,
    failed: [],
  }
  const resourceSets = () => {
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    const textures = new Set<THREE.Texture>()
    const skeletons = new Set<THREE.Skeleton>()
    const batches = new Set<THREE.InstancedMesh>()
    for (const object of [...templates, ...instances])
      object.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (mesh.geometry) geometries.add(mesh.geometry)
        if ((mesh as THREE.InstancedMesh).isInstancedMesh)
          batches.add(mesh as THREE.InstancedMesh)
        if ((mesh as THREE.SkinnedMesh).skeleton)
          skeletons.add((mesh as THREE.SkinnedMesh).skeleton)
        for (const mat of mesh.material
          ? Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          : []) {
          materials.add(mat)
          for (const value of Object.values(mat))
            if (value instanceof THREE.Texture) textures.add(value)
        }
      })
    return { geometries, materials, textures, skeletons, batches }
  }
  const releaseResources = () => {
    const resources = resourceSets()
    for (const set of Object.values(resources))
      for (const resource of set) resource.dispose()
    for (const texture of resources.textures) {
      const image = texture.source.data
      if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap)
        image.close()
    }
    templates.length = 0
    instances.length = 0
  }
  function place(
    gltf: GLTF,
    x: number,
    z: number,
    height: number,
    turn = 0,
    y = 0.12,
  ) {
    const model = clone(gltf.scene)
    const bounds = new THREE.Box3().setFromObject(model)
    const size = bounds.getSize(new THREE.Vector3())
    const centre = bounds.getCenter(new THREE.Vector3())
    const scale = height / Math.max(size.y, 0.001)
    model.position.set(
      -centre.x * scale,
      -bounds.min.y * scale,
      -centre.z * scale,
    )
    model.scale.setScalar(scale)
    const pivot = new THREE.Group()
    pivot.name = gltf.scene.name || "Sketchfab district detail"
    pivot.position.set(x, y, z)
    pivot.rotation.y = turn
    pivot.add(model)
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.castShadow = true
      child.receiveShadow = true
      for (const mat of Array.isArray(child.material)
        ? child.material
        : [child.material]) {
        for (const texture of Object.values(mat))
          if (texture instanceof THREE.Texture) texture.anisotropy = 4
      }
    })
    root.add(pivot)
    instances.push(pivot)
    if (gltf.animations.length) {
      const mixer = new THREE.AnimationMixer(model)
      gltf.animations.forEach((clip) => mixer.clipAction(clip).play())
      mixers.push(mixer)
    }
  }
  function batchStatic(from: number) {
    root.updateMatrixWorld(true)
    const groups = new Map<string, THREE.Mesh[]>()
    for (const pivot of instances.slice(from))
      pivot.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || Array.isArray(object.material))
          return
        const key = `${object.geometry.uuid}/${object.material.uuid}`
        const meshes = groups.get(key) ?? []
        meshes.push(object)
        groups.set(key, meshes)
      })
    const inverse = root.matrixWorld.clone().invert()
    for (const meshes of groups.values()) {
      if (meshes.length < 2) continue
      const batch = new THREE.InstancedMesh(
        meshes[0].geometry,
        meshes[0].material,
        meshes.length,
      )
      batch.name = `Instanced Sketchfab / ${meshes[0].name}`
      meshes.forEach((mesh, i) => {
        batch.setMatrixAt(
          i,
          new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld),
        )
        mesh.removeFromParent()
      })
      batch.castShadow = batch.receiveShadow = true
      batch.computeBoundingSphere()
      root.add(batch)
      instances.push(batch)
    }
  }
  const ready = Promise.all(
    districtAssetFiles.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(`/models/neon-district/${name}.glb`)
        templates.push(gltf.scene)
        if (disposed) {
          releaseResources()
          return
        }
        const start = instances.length
        if (name === "chinese-lantern")
          gltf.scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material]) {
              const paper = material as THREE.MeshPhysicalMaterial
              // Warm paper reads better than full glass transmission, and avoids another scene render.
              if (paper.isMeshPhysicalMaterial) paper.transmission = 0
              if (paper.isMeshStandardMaterial) {
                paper.emissive.set("#ffd2a0")
                paper.emissiveIntensity = 1.1
                paper.emissiveMap = paper.map
                paper.roughness = 0.68
              }
            }
          })
        if (name === "asia-building") {
          restoreBuildingFinishes(gltf.scene)
          for (const side of [-1, 1])
            for (const z of [-21, -3, 15])
              place(
                gltf,
                side * 13.4,
                z,
                14.3,
                side < 0 ? Math.PI / 2 : -Math.PI / 2,
              )
        } else if (name === "industrial-ac") {
          gltf.scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return
            for (const source of Array.isArray(object.material)
              ? object.material
              : [object.material]) {
              const material = source as THREE.MeshStandardMaterial
              if (!material.isMeshStandardMaterial) continue
              material.roughness = 0.5
              material.metalness = 0.42
              material.normalScale.setScalar(0.45)
            }
          })
          for (const side of [-1, 1])
            for (const z of [-19, -8, 4, 17])
              place(
                gltf,
                side * 6.7,
                z,
                0.65,
                side < 0 ? Math.PI / 2 : -Math.PI / 2,
                3.8,
              )
        } else if (name === "courier-scooter") {
          gltf.scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return
            for (const source of Array.isArray(object.material)
              ? object.material
              : [object.material]) {
              const material = source as THREE.MeshStandardMaterial
              if (!material.isMeshStandardMaterial) continue
              material.roughness = 0.48
              material.metalness = 0.46
              material.emissiveIntensity = 1.65
            }
          })
          place(gltf, -4.7, -9.8, 1.65, 0.35)
          place(gltf, 4.5, 15.1, 1.65, -0.6)
        } else place(gltf, -5.8, 8.3, 0.85, 0, 2.9)
        if (!gltf.animations.length) batchStatic(start)
        status.loaded++
      } catch {
        status.failed.push(name)
      }
      if (!disposed) onStatus?.({ ...status, failed: [...status.failed] })
    }),
  )
  return {
    ready,
    update(dt: number) {
      if (!disposed) for (const mixer of mixers) mixer.update(dt)
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const mixer of mixers) {
        mixer.stopAllAction()
        mixer.uncacheRoot(mixer.getRoot())
      }
      for (const object of instances) object.removeFromParent()
      releaseResources()
    },
  }
}
