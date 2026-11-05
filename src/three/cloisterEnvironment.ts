import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js"

/** The original licensed Grease Pencil drawing, kept as authored stroke geometry. */
export async function loadCloisterEnvironment(
  parent: THREE.Object3D,
  signal?: AbortSignal,
) {
  const response = await fetch("/models/cloister/cloister.glb", { signal })
  if (!response.ok) throw new Error("The cloister could not be loaded.")
  const bytes = await response.arrayBuffer()
  signal?.throwIfAborted()
  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(bytes, "")
  const root = gltf.scene
  root.name = "Santes Creus / drawing by Giravolt and Rubén González Candial"
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    root.removeFromParent()
    const geometry = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>()
    root.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      geometry.add(mesh.geometry)
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]) {
        materials.add(material)
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value)
      }
    })
    textures.forEach((texture) => texture.dispose())
    materials.forEach((material) => material.dispose())
    geometry.forEach((g) => g.dispose())
    root.clear()
  }
  if (signal?.aborted) {
    dispose()
    signal.throwIfAborted()
  }
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = mesh.receiveShadow = false
    for (const mat of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) {
      const material = mat as THREE.MeshBasicMaterial
      material.color.set("#b8b8b8")
      material.toneMapped = false
      material.fog = true
    }
  })
  parent.add(root)
  root.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(root)
  return { root, bounds, dispose }
}
