import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { applyCloisterSilhouette } from "./cloisterSilhouette"

type CameraKey = {
  frame: number
  position: [number, number, number]
  target: [number, number, number]
  fov: number
  roll: number
  framing: number
  shotId: string
  motionBlur: number
  subject?: [number, number, number]
  aerialProgress?: number
  unscaledOffset?: [number, number, number]
}
type CameraShot = {
  id: string
  start: number
  end: number
  startFrame: number
  endFrame: number
  fov: number
  blur: number
  samples: CameraKey[]
}
export type BakedCameraData = {
  fps: number
  duration: number
  format?: "classic"
  shots: CameraShot[]
}

/** A cut selects its new shot before interpolation. Adjacent shots never blend. */
export function createBakedCameraSampler(data: BakedCameraData) {
  if (!Number.isFinite(data.fps) || data.fps <= 0 ||
    !Number.isFinite(data.duration) || data.duration <= 0 || !data.shots?.length)
    throw new Error("The camera route is invalid.")
  for (const [index, shot] of data.shots.entries()) {
    if (!shot.id || !Number.isFinite(shot.start) || !Number.isFinite(shot.end) ||
      shot.end <= shot.start || !shot.samples?.length ||
      (index === 0 ? shot.start !== 0 : Math.abs(shot.start - data.shots[index - 1].end) > 1e-5))
      throw new Error("The camera shots must cover one continuous film.")
    for (const [i, key] of shot.samples.entries()) {
      if (![key.frame, ...key.position, ...key.target, key.fov, key.roll,
        key.framing, key.motionBlur].every(Number.isFinite) || key.fov <= 0 ||
        key.fov >= 180 || (i > 0 && key.frame <= shot.samples[i - 1].frame))
        throw new Error("A camera shot contains invalid samples.")
    }
  }
  if (Math.abs(data.shots[data.shots.length - 1].end - data.duration) > 1e-5)
    throw new Error("The camera route does not reach the end of the film.")
  const result = {
    camera: new THREE.Vector3(), target: new THREE.Vector3(), fov: 48,
    roll: 0, framing: 0, shotId: "", motionBlur: 0, aerialProgress: 0,
  }
  const offset = new THREE.Vector3()
  const subject = new THREE.Vector3()
  const unscaledOffset = new THREE.Vector3()
  const aerialDirection = new THREE.Vector3(.82, .84, 1.06).normalize()
  return (globalTime: number, aspect = 16 / 9) => {
    const time = THREE.MathUtils.clamp(Number.isFinite(globalTime) ? globalTime : 0, 0, data.duration)
    let shotIndex = data.shots.length - 1
    while (shotIndex > 0 && data.shots[shotIndex].start > time) shotIndex--
    const shot = data.shots[shotIndex], keys = shot.samples
    const frame = time * data.fps + 1
    let low = 0, high = keys.length - 1
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (keys[middle].frame < frame) low = middle + 1
      else high = middle
    }
    const b = keys[low], a = keys[Math.max(0, low - 1)]
    const u = b.frame === a.frame ? 0 : THREE.MathUtils.clamp((frame - a.frame) / (b.frame - a.frame), 0, 1)
    const mix = (a: number, b: number) => THREE.MathUtils.lerp(a, b, u)
    result.camera.set(...a.position).lerp(offset.set(...b.position), u)
    result.target.set(...a.target).lerp(offset.set(...b.target), u)
    result.fov = mix(a.fov, b.fov)
    result.roll = mix(a.roll, b.roll)
    result.framing = mix(a.framing, b.framing)
    result.shotId = shot.id
    result.motionBlur = time === data.duration ? 0 : mix(a.motionBlur, b.motionBlur)
    result.aerialProgress = data.format === "classic"
      ? mix(a.aerialProgress ?? 0, b.aerialProgress ?? 0)
      : THREE.MathUtils.smoothstep(time, data.duration - 4, data.duration)
    if (data.format === "classic") {
      const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
      if (shot.id.includes("4/aerial")) {
        result.camera.addScaledVector(aerialDirection,
          (Math.max(63, 59 / safeAspect) - 63) * result.aerialProgress)
      } else {
        const widthFactor = THREE.MathUtils.clamp((safeAspect - .68) / .82, 0, 1)
        subject.fromArray(a.subject ?? a.target).lerp(offset.fromArray(b.subject ?? b.target), u)
        unscaledOffset.set(
          mix(a.unscaledOffset?.[0] ?? 0, b.unscaledOffset?.[0] ?? 0),
          mix(a.unscaledOffset?.[1] ?? 0, b.unscaledOffset?.[1] ?? 0),
          mix(a.unscaledOffset?.[2] ?? 0, b.unscaledOffset?.[2] ?? 0),
        )
        offset.copy(result.camera).sub(subject).sub(unscaledOffset)
          .multiplyScalar(1 + .48 * (1 - widthFactor))
        result.camera.copy(subject).add(offset).add(unscaledOffset)
        result.fov += 5 * (1 - widthFactor)
        result.framing *= widthFactor
      }
      return result
    }
    // Retain the authored lens during the action. The final pullback fits the
    // complete drawing on a narrow screen before handing it to OrbitControls.
    const portraitFit = Math.max(1, .95 / Math.max(.2, aspect))
    const distanceScale = THREE.MathUtils.lerp(1, portraitFit, result.aerialProgress)
    offset.copy(result.camera).sub(result.target).multiplyScalar(distanceScale)
    result.camera.copy(result.target).add(offset)
    return result
  }
}

/** The GLB already contains its 1.8m normalization, root travel, and all poses. */
type RouteAsset = { asset: string; camera: string; actorName: string; clipName: string }
async function loadCloisterBakedRoute(
  parent: THREE.Object3D, signal: AbortSignal | undefined, source: RouteAsset,
) {
  const [assetResponse, cameraResponse] = await Promise.all([
    fetch(source.asset, { signal }),
    fetch(source.camera, { signal }),
  ])
  if (!assetResponse.ok || !cameraResponse.ok) throw new Error("The cinematic route could not be loaded.")
  const [bytes, cameraData] = await Promise.all([
    assetResponse.arrayBuffer(), cameraResponse.json() as Promise<BakedCameraData>,
  ])
  signal?.throwIfAborted()
  const sampleCamera = createBakedCameraSampler(cameraData)
  const gltf = await new GLTFLoader().parseAsync(bytes, "")
  const root = new THREE.Group()
  root.name = "Cinematic route / authored transforms"
  root.add(gltf.scene)
  const actor = gltf.scene.getObjectByName(source.actorName)
  const clip = gltf.animations.find((item) => item.name === source.clipName)
  if (!actor || !clip || Math.abs(clip.duration - cameraData.duration) > 1 / cameraData.fps)
    throw new Error("The cinematic animation and camera route do not match.")
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  const skeletons = new Set<THREE.Skeleton>()
  gltf.scene.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh
    if (!mesh.isMesh) return
    mesh.frustumCulled = false
    mesh.castShadow = mesh.receiveShadow = false
    geometries.add(mesh.geometry)
    if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton)
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material)
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
    }
  })
  const silhouette = applyCloisterSilhouette(actor)
  const mixer = new THREE.AnimationMixer(gltf.scene)
  const action = mixer.clipAction(clip)
  action.setLoop(THREE.LoopOnce, 1)
  action.clampWhenFinished = true
  let disposed = false
  function sample(time: number) {
    if (disposed) return
    // Reset the endpoint latch too: a seek back from the end must restore playback.
    action.reset().play()
    const clamped = THREE.MathUtils.clamp(Number.isFinite(time) ? time : 0, 0, clip!.duration)
    const authoredFrame = Math.round(clamped * cameraData.fps)
    // The sum of segment durations may differ from the next segment's start
    // by floating-point epsilon. Both must seek the identical authored frame.
    mixer.setTime(Math.abs(clamped * cameraData.fps - authoredFrame) < 1e-7
      ? authoredFrame / cameraData.fps : clamped)
    root.updateMatrixWorld(true)
  }
  function dispose() {
    if (disposed) return
    disposed = true
    root.removeFromParent()
    mixer.stopAllAction()
    mixer.uncacheRoot(gltf.scene)
    silhouette.dispose()
    skeletons.forEach((skeleton) => skeleton.dispose())
    geometries.forEach((geometry) => geometry.dispose())
    textures.forEach((texture) => texture.dispose())
    materials.forEach((material) => material.dispose())
    root.clear()
  }
  if (signal?.aborted) {
    dispose()
    signal.throwIfAborted()
  }
  sample(0)
  parent.add(root)
  return { root, actor, duration: clip.duration, sample, sampleCamera, dispose }
}

export function loadCloisterClassicRoute(parent: THREE.Object3D, signal?: AbortSignal) {
  return loadCloisterBakedRoute(parent, signal, {
    asset: "/models/cloister/classic-climb.glb",
    camera: "/models/cloister/classic-climb-camera.json",
    actorName: "Portfolio_classic_Actor_Travel",
    clipName: "Portfolio_Classic_Climb_60fps",
  })
}
