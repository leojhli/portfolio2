import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { applyCloisterSilhouette } from "./cloisterSilhouette"
import { createLeapClip } from "./cloisterLeap"
import { readBytes } from "./fetchProgress"

export const RUNNER_BYTES = 1_467_712

export type RunnerBlend = {
  action: string
  time: number
  weight: number
}

export type RunnerMotion = { bank: number; lean: number }

const looping = new Set(["run", "jog", "idle", "jump"])

/** A seekable pose on a skinned character. The caller owns travel and heading. */
export async function loadCloisterRunner(
  parent: THREE.Group,
  signal?: AbortSignal,
  onProgress?: (fraction: number) => void,
) {
  const response = await fetch("/models/cloister/altair.glb", { signal })
  if (!response.ok) throw new Error("The runner could not be loaded.")
  const bytes = await readBytes(response, RUNNER_BYTES, onProgress)
  signal?.throwIfAborted()

  const { scene, animations } = await new GLTFLoader().parseAsync(bytes, "")
  animations.push(createLeapClip(scene, animations))
  const root = new THREE.Group()
  root.name = "Altaïr"
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
    if (!mesh.isMesh) return
    // The static bind-pose bounds do not contain the vault's extending arms.
    mesh.frustumCulled = false
    geometries.add(mesh.geometry)
    if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton)
    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) {
      material.toneMapped = false
      materials.add(material)
    }
  })
  const silhouette = applyCloisterSilhouette(scene)

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
  // Clip seconds at which each boot is lowest in the run cycle. Footstep
  // sounds are timed from these, so they follow the stride at any speed.
  const footfalls: number[] = []
  const run = actions.get("run")
  const feet = ["foot_l", "foot_r"].map((name) => scene.getObjectByName(name))
  if (run && feet.every(Boolean)) {
    const lowest = feet.map(() => ({ y: Infinity, time: 0 }))
    const point = new THREE.Vector3()
    const length = run.getClip().duration
    run.enabled = true
    run.setEffectiveWeight(1)
    for (let i = 0; i < 48; i++) {
      run.time = (i / 48) * length
      mixer.update(0)
      scene.updateMatrixWorld(true)
      feet.forEach((foot, index) => {
        const y = foot!.getWorldPosition(point).y
        if (y < lowest[index].y) lowest[index] = { y, time: run.time }
      })
    }
    run.enabled = false
    footfalls.push(...lowest.map((entry) => entry.time))
  }
  const torso = scene.getObjectByName("spine_01")
  const unbankedTorso = torso?.quaternion.clone()
  const frameRotation = new THREE.Quaternion()
  const parentRotation = new THREE.Quaternion()
  const bodyTilt = new THREE.Quaternion()
  const leanRotation = new THREE.Quaternion()
  const forwardAxis = new THREE.Vector3(0, 0, 1)
  const lateralAxis = new THREE.Vector3(1, 0, 0)
  let torsoAdjusted = false
  function configure(name: string, time: number, weight: number) {
    const action = actions.get(name)
    if (!action || weight <= 0) return
    const duration = action.getClip().duration
    const t = Math.max(0, Number.isFinite(time) ? time : 0)
    action.enabled = true
    action.time = looping.has(name) ? t % duration : Math.min(t, duration)
    action.setEffectiveWeight(weight)
  }
  function sample(name: string, time: number, blend?: RunnerBlend, motion?: RunnerMotion) {
    if (disposed) return
    // Some source clips leave this spine joint at its bind pose. Restore the
    // previous unmodified sample before mixing so repeated seeks cannot bank
    // farther on each call, including when moving between tracked/untracked clips.
    if (torsoAdjusted && torso && unbankedTorso) torso.quaternion.copy(unbankedTorso)
    torsoAdjusted = false
    for (const a of actions.values()) a.enabled = false
    const primary = actions.has(name) ? name : "idle"
    const mix =
      blend && actions.has(blend.action) && blend.action !== primary
        ? THREE.MathUtils.clamp(blend.weight, 0, 1)
        : 0
    configure(primary, time, 1 - mix)
    if (blend && mix > 0) configure(blend.action, blend.time, mix)
    mixer.update(0)
    if (torso && unbankedTorso && motion && (primary === "run" || primary === "jog")) {
      const bank = Number.isFinite(motion.bank) ? THREE.MathUtils.clamp(motion.bank, -.12, .12) : 0
      const lean = Number.isFinite(motion.lean) ? THREE.MathUtils.clamp(motion.lean, -.045, .045) : 0
      if (bank || lean) {
        unbankedTorso.copy(torso.quaternion)
        scene.getWorldQuaternion(frameRotation)
        torso.parent!.getWorldQuaternion(parentRotation)
        bodyTilt.setFromAxisAngle(forwardAxis, bank)
        leanRotation.setFromAxisAngle(lateralAxis, lean)
        bodyTilt.multiply(leanRotation)
        bodyTilt.premultiply(frameRotation).multiply(frameRotation.invert())
        bodyTilt.premultiply(parentRotation.clone().invert()).multiply(parentRotation)
        torso.quaternion.premultiply(bodyTilt).normalize()
        torsoAdjusted = true
      }
    }
  }
  function dispose() {
    if (disposed) return
    disposed = true
    root.removeFromParent()
    mixer.stopAllAction()
    mixer.uncacheRoot(scene)
    silhouette.dispose()
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
  return { root, clips, actionDurations, footfalls, sample, dispose }
}
