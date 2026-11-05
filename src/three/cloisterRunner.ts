import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

export type RunnerBlend = {
  action: string
  time: number
  weight: number
}

const looping = new Set(["run", "jog", "idle", "jump"])

/** A seekable pose on a skinned character. The caller owns travel and heading. */
export async function loadCloisterRunner(
  parent: THREE.Group,
  signal?: AbortSignal,
) {
  const response = await fetch("/models/cloister/runner.glb", { signal })
  if (!response.ok) throw new Error("The runner could not be loaded.")
  const bytes = await response.arrayBuffer()
  signal?.throwIfAborted()

  const { scene, animations } = await new GLTFLoader().parseAsync(bytes, "")
  const root = new THREE.Group()
  root.name = "Wayfarer"
  scene.name = "Rig"
  // The authored mesh faces +Z. Stage headings use -Z. Normalizing the
  // child keeps the public root free for world-space choreography.
  scene.rotation.y = Math.PI
  const standing = new THREE.Box3().setFromObject(scene, true)
  const scale = 1.8 / (standing.max.y - standing.min.y)
  scene.scale.setScalar(scale)
  scene.position.y = -standing.min.y * scale
  root.add(scene)

  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const skeletons = new Set<THREE.Skeleton>()
  scene.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    // The static bind-pose bounds do not contain the vault's extending arms.
    mesh.frustumCulled = false
    geometries.add(mesh.geometry)
    skeletons.add(mesh.skeleton)
    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) {
      material.toneMapped = false
      materials.add(material)
    }
  })

  const mixer = new THREE.AnimationMixer(scene)
  const actions = new Map<string, THREE.AnimationAction>()
  for (const clip of animations) {
    const action = mixer.clipAction(clip)
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.play()
    action.paused = true
    action.enabled = false
    actions.set(clip.name, action)
  }
  const clips = [...actions.keys()]
  const actionDurations: Record<string, number> = Object.fromEntries(
    animations.map((clip) => [clip.name, clip.duration]),
  )
  let disposed = false
  function configure(name: string, time: number, weight: number) {
    const action = actions.get(name)
    if (!action || weight <= 0) return
    const duration = action.getClip().duration
    const t = Math.max(0, Number.isFinite(time) ? time : 0)
    action.enabled = true
    action.time = looping.has(name) ? t % duration : Math.min(t, duration)
    action.setEffectiveWeight(weight)
  }
  function sample(name: string, time: number, blend?: RunnerBlend) {
    if (disposed) return
    for (const a of actions.values()) a.enabled = false
    const primary = actions.has(name) ? name : "idle"
    const mix =
      blend && actions.has(blend.action) && blend.action !== primary
        ? THREE.MathUtils.clamp(blend.weight, 0, 1)
        : 0
    configure(primary, time, 1 - mix)
    if (blend && mix > 0) configure(blend.action, blend.time, mix)
    mixer.update(0)
  }
  function dispose() {
    if (disposed) return
    disposed = true
    root.removeFromParent()
    mixer.stopAllAction()
    mixer.uncacheRoot(scene)
    for (const skeleton of skeletons) skeleton.dispose()
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    root.clear()
  }
  if (signal?.aborted) {
    dispose()
    signal.throwIfAborted()
  }
  sample("run", 0)
  parent.add(root)
  return { root, clips, actionDurations, sample, dispose }
}
