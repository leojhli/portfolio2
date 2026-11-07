import * as THREE from "three"

export const LEAP_DURATION = 2.4
export const LEAP_FREEZE_TIME = 1.25

/**
 * An authored Leap of Faith on the existing character skeleton. Travel and
 * gravity belong to the scene; this clip supplies anticipation, an open-armed
 * flight and the beginning of the dive. Baking on a private hierarchy leaves
 * the loaded bind pose and the other animation clips untouched.
 */
export function createLeapClip(
  scene: THREE.Object3D,
  sourceClips: THREE.AnimationClip[],
) {
  const rig = scene.clone(true)
  const bones: THREE.Bone[] = []
  rig.traverse((object) => {
    if ((object as THREE.Bone).isBone) bones.push(object as THREE.Bone)
  })
  const rest = bones.map((bone) => ({
    quaternion: bone.quaternion.clone(),
    position: bone.position.clone(),
  }))
  const bone = (name: string) => {
    const result = rig.getObjectByName(name)
    if (!result) throw new Error(`Leap skeleton is missing ${name}.`)
    return result
  }
  const pelvis = bone("pelvis")
  const pelvisIndex = bones.indexOf(pelvis as THREE.Bone)
  const mixer = new THREE.AnimationMixer(rig)
  const idle = sourceClips.find((clip) => clip.name === "idle")
  const stance = idle ? mixer.clipAction(idle) : undefined
  const axis = new THREE.Vector3(1, 0, 0)
  const worldRotation = (object: THREE.Object3D) =>
    object.getWorldQuaternion(new THREE.Quaternion())
  rig.updateMatrixWorld(true)
  const plantedFeet = ["l", "r"].map((side) => ({
    side,
    position: bone(`foot_${side}`).getWorldPosition(new THREE.Vector3()),
    rotation: worldRotation(bone(`foot_${side}`)),
  }))

  function reset() {
    mixer.stopAllAction()
    bones.forEach((object, index) => {
      object.quaternion.copy(rest[index].quaternion)
      object.position.copy(rest[index].position)
    })
    rig.updateMatrixWorld(true)
  }

  // Aim using the actual joint-to-joint direction rather than assuming a
  // particular Blender/UE bone axis. This also keeps both arms symmetrical.
  function aim(name: string, childName: string, direction: THREE.Vector3) {
    const object = bone(name)
    const pivot = object.getWorldPosition(new THREE.Vector3())
    const current = bone(childName)
      .getWorldPosition(new THREE.Vector3())
      .sub(pivot)
      .normalize()
    const correction = new THREE.Quaternion().setFromUnitVectors(
      current,
      direction.normalize(),
    )
    const parentRotation = worldRotation(object.parent!)
    object.quaternion.premultiply(
      parentRotation.clone().invert().multiply(correction).multiply(parentRotation),
    ).normalize()
    object.updateMatrixWorld(true)
  }

  function spreadPose() {
    for (const [side, sign] of [["l", 1], ["r", -1]] as const) {
      aim(`upperarm_${side}`, `lowerarm_${side}`, new THREE.Vector3(sign, -.09, -.07))
      aim(`lowerarm_${side}`, `hand_${side}`, new THREE.Vector3(sign, .015, -.08))
      // Close the boots slightly and let the knees trail. The silhouette is a
      // deliberate diving pose, not an upright bind-pose cross.
      aim(`thigh_${side}`, `calf_${side}`, new THREE.Vector3(-sign * .08, -1, -.015))
      aim(`calf_${side}`, `foot_${side}`, new THREE.Vector3(0, -1, -.14))
    }
  }

  function plantFeet() {
    for (const foot of plantedFeet) {
      const ankle = bone(`foot_${foot.side}`)
      for (let pass = 0; pass < 28; pass++) {
        for (const name of [`calf_${foot.side}`, `thigh_${foot.side}`]) {
          const object = bone(name)
          const pivot = object.getWorldPosition(new THREE.Vector3())
          const current = ankle.getWorldPosition(new THREE.Vector3()).sub(pivot).normalize()
          const desired = foot.position.clone().sub(pivot).normalize()
          const correction = new THREE.Quaternion().setFromUnitVectors(current, desired)
          const parentRotation = worldRotation(object.parent!)
          object.quaternion.premultiply(
            parentRotation.clone().invert().multiply(correction).multiply(parentRotation),
          ).normalize()
          object.updateMatrixWorld(true)
        }
      }
      // Keep the soles flat as the knees bend, rather than pivoting the boot
      // through the ledge when solving only for a toe contact.
      ankle.quaternion.copy(worldRotation(ankle.parent!).invert().multiply(foot.rotation))
      ankle.updateMatrixWorld(true)
    }
  }

  const keys = [
    { at: 0, planted: true, pitch: 0, crouch: .025 },
    { at: .18, planted: true, pitch: 8, crouch: .14 },
    { at: .35, planted: true, pitch: 18, crouch: .025 },
    { at: .5, planted: true, pitch: 28, crouch: 0 },
    { at: .6, pitch: 44 },
    { at: .9, pitch: 68 },
    { at: LEAP_FREEZE_TIME, pitch: 83 },
    { at: 1.65, pitch: 95 },
    { at: 1.95, pitch: 125 },
    { at: LEAP_DURATION, pitch: 158 },
  ]
  const frames = keys.map((key) => {
    reset()
    if (key.planted && stance && idle) {
      stance.play()
      stance.paused = true
      stance.time = Math.min(.3, idle.duration)
      mixer.update(0)
      rig.updateMatrixWorld(true)
      const opening = THREE.MathUtils.smoothstep(key.at, .18, .6)
      for (const [side, sign] of [["l", 1], ["r", -1]] as const) {
        aim(`upperarm_${side}`, `lowerarm_${side}`, new THREE.Vector3(sign * (.3 + opening), -.85 + opening * .75, -.3))
        aim(`lowerarm_${side}`, `hand_${side}`, new THREE.Vector3(sign * (.3 + opening), -.85 + opening * .75, -.3))
      }
    } else {
      spreadPose()
    }
    // Strip the source stance's vertical motion: one trajectory owns gravity.
    // The small anticipation crouch is the only hip-height change in this clip.
    pelvis.position.copy(rest[pelvisIndex].position)
    rig.updateMatrixWorld(true)
    const parentRotation = worldRotation(pelvis.parent!)
    const localCrouch = new THREE.Vector3(0, -(key.crouch ?? 0), 0)
      .applyQuaternion(parentRotation.clone().invert())
    pelvis.position.add(localCrouch)
    const pitch = new THREE.Quaternion().setFromAxisAngle(
      axis,
      THREE.MathUtils.degToRad(key.pitch),
    )
    pelvis.quaternion.premultiply(
      parentRotation.clone().invert().multiply(pitch).multiply(parentRotation),
    ).normalize()
    rig.updateMatrixWorld(true)
    if (key.planted) plantFeet()
    return {
      position: pelvis.position.clone(),
      rotations: bones.map((object) => object.quaternion.clone()),
    }
  })
  const keyTimes = keys.map((key) => key.at)
  // Bake a cubic curve instead of making the shoulders and chest change
  // angular velocity abruptly at every authored pose. Quaternion components
  // are hemisphere-corrected below and normalized after interpolation.
  const times = Array.from({ length: 73 }, (_, i) => i * LEAP_DURATION / 72)
  function interpolate(values: number[][], time: number, clampToKeys = false) {
    let i = 0
    while (i < keyTimes.length - 2 && time > keyTimes[i + 1]) i++
    const dt = keyTimes[i + 1] - keyTimes[i]
    const u = THREE.MathUtils.clamp((time - keyTimes[i]) / dt, 0, 1)
    return values[i].map((a, component) => {
      const b = values[i + 1][component]
      const slope = (k: number) => {
        const before = Math.max(0, k - 1)
        const after = Math.min(values.length - 1, k + 1)
        return (values[after][component] - values[before][component]) /
          (keyTimes[after] - keyTimes[before])
      }
      const value = (2 * u ** 3 - 3 * u ** 2 + 1) * a +
        (u ** 3 - 2 * u ** 2 + u) * dt * slope(i) +
        (-2 * u ** 3 + 3 * u ** 2) * b +
        (u ** 3 - u ** 2) * dt * slope(i + 1)
      return clampToKeys ? THREE.MathUtils.clamp(value, Math.min(a, b), Math.max(a, b)) : value
    })
  }
  const tracks: THREE.KeyframeTrack[] = bones.map((object, index) => {
    const rotations = frames.map((frame) => frame.rotations[index])
    for (let i = 1; i < rotations.length; i++) {
      if (rotations[i - 1].dot(rotations[i]) < 0) {
        const q = rotations[i]
        q.set(-q.x, -q.y, -q.z, -q.w)
      }
    }
    return new THREE.QuaternionKeyframeTrack(
      `${object.name}.quaternion`,
      times,
      times.flatMap((time) => new THREE.Quaternion()
        .fromArray(interpolate(rotations.map((q) => q.toArray()), time))
        .normalize().toArray()),
    )
  })
  tracks.push(new THREE.VectorKeyframeTrack(
    "pelvis.position",
    times,
    times.flatMap((time) => interpolate(frames.map((frame) => frame.position.toArray()), time, true)),
  ))
  mixer.stopAllAction()
  mixer.uncacheRoot(rig)
  return new THREE.AnimationClip("leap", LEAP_DURATION, tracks)
}
