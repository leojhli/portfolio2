import * as THREE from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import type { AvatarPose } from "./FirstPersonController"

/** Original human-scale night courier. The model faces -Z and stands on y=0. */
export function createDistrictAvatar() {
  const root = new THREE.Group()
  root.name = "Night courier"
  root.visible = false
  const body = new THREE.Group()
  body.name = "courier-body"
  root.add(body)
  const fabric = new THREE.MeshStandardMaterial({
    color: "#233039",
    roughness: 0.88,
  })
  const panel = new THREE.MeshStandardMaterial({
    color: "#38484c",
    roughness: 0.76,
  })
  const dark = new THREE.MeshStandardMaterial({
    color: "#12191e",
    roughness: 0.69,
  })
  const skin = new THREE.MeshStandardMaterial({
    color: "#bf957e",
    roughness: 0.83,
  })
  const sole = new THREE.MeshStandardMaterial({
    color: "#788382",
    roughness: 0.9,
  })
  const metal = new THREE.MeshStandardMaterial({
    color: "#b0c2c0",
    metalness: 0.65,
    roughness: 0.42,
  })
  const jade = new THREE.MeshStandardMaterial({
    color: "#67bcb4",
    emissive: "#2aa99b",
    emissiveIntensity: 1.15,
    metalness: 0.2,
    roughness: 0.48,
  })
  const materials = [fabric, panel, dark, skin, sole, metal, jade]
  const geometries = new Set<THREE.BufferGeometry>()
  const own = <T extends THREE.BufferGeometry>(geometry: T) => {
    geometries.add(geometry)
    return geometry
  }
  const unitBox = own(new THREE.BoxGeometry(1, 1, 1))
  const unitSphere = own(new THREE.SphereGeometry(1, 16, 12))
  const unitCylinder = own(new THREE.CylinderGeometry(1, 1, 1, 10))
  const add = (
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
  ) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.scale.set(sx, sy, sz)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  const box = (
    parent: THREE.Object3D,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
  ) => add(parent, unitBox, material, x, y, z, width, height, depth)
  const oval = (
    parent: THREE.Object3D,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
  ) => add(parent, unitSphere, material, x, y, z, rx, ry, rz)
  const rod = (
    parent: THREE.Object3D,
    material: THREE.Material,
    from: THREE.Vector3,
    to: THREE.Vector3,
    radius: number,
  ) => {
    const midpoint = from.clone().add(to).multiplyScalar(0.5)
    const mesh = add(
      parent,
      unitCylinder,
      material,
      midpoint.x,
      midpoint.y,
      midpoint.z,
      radius,
      from.distanceTo(to),
      radius,
    )
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      to.clone().sub(from).normalize(),
    )
    return mesh
  }
  const pivot = (
    parent: THREE.Group,
    name: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const group = new THREE.Group()
    group.name = name
    group.position.set(x, y, z)
    parent.add(group)
    return group
  }

  // Fitted jacket with shaped shoulders and a higher stand collar.
  const torso = own(new THREE.CylinderGeometry(0.22, 0.165, 0.49, 12))
  const jacket = add(body, torso, fabric, 0, 1.19, 0)
  jacket.scale.z = 0.64
  oval(body, fabric, 0, 1.39, 0, 0.225, 0.085, 0.136)
  box(body, dark, 0, 1.13, -0.128, 0.015, 0.49, 0.012)
  box(body, metal, 0, 1.31, -0.14, 0.022, 0.04, 0.012)
  const collar = add(
    body,
    own(new THREE.CylinderGeometry(0.093, 0.13, 0.11, 12)),
    panel,
    0,
    1.46,
    0,
  )
  collar.scale.z = 0.85
  // Offset storm flap, chest pocket and reflective cuff details remain quiet in the neon.
  const flap = box(body, panel, -0.068, 1.235, -0.132, 0.085, 0.31, 0.013)
  flap.rotation.z = -0.035
  box(body, dark, 0.115, 1.28, -0.129, 0.105, 0.13, 0.018)
  box(body, jade, 0.115, 1.305, -0.142, 0.061, 0.009, 0.006)
  oval(body, dark, 0, 0.91, 0, 0.165, 0.12, 0.11)
  box(body, panel, 0, 0.98, 0, 0.32, 0.035, 0.225)
  box(body, metal, 0.06, 0.98, -0.118, 0.045, 0.037, 0.01)

  // A compact sling pack and asymmetrical stitched strap are visible from the chase camera.
  const bag = box(body, dark, -0.04, 1.24, 0.14, 0.225, 0.3, 0.11)
  bag.rotation.z = -0.15
  const bagFace = box(body, panel, -0.04, 1.24, 0.199, 0.18, 0.24, 0.012)
  bagFace.rotation.z = -0.15
  rod(
    body,
    panel,
    new THREE.Vector3(-0.19, 1.4, -0.11),
    new THREE.Vector3(0.13, 1.05, -0.14),
    0.022,
  )
  rod(
    body,
    panel,
    new THREE.Vector3(-0.19, 1.4, 0.1),
    new THREE.Vector3(0.13, 1.05, 0.13),
    0.022,
  )
  box(body, jade, -0.044, 1.25, 0.211, 0.012, 0.105, 0.008)
  box(body, metal, 0.16, 1.06, 0.1, 0.023, 0.055, 0.02)

  // A tapered, neutral face rather than a helmet or anime silhouette.
  const head = pivot(body, "courier-head", 0, 1.6, 0)
  const faceGeometry = own(unitSphere.clone())
  const positions = faceGeometry.attributes.position
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i)
    const jaw = y < -0.15 ? 1 + (y + 0.15) * 0.23 : 1
    positions.setXYZ(i, positions.getX(i) * jaw, y, positions.getZ(i))
  }
  faceGeometry.computeVertexNormals()
  add(head, faceGeometry, skin, 0, 0, -0.006, 0.112, 0.14, 0.103)
  oval(head, skin, -0.112, -0.005, 0, 0.018, 0.034, 0.019)
  oval(head, skin, 0.112, -0.005, 0, 0.018, 0.034, 0.019)
  oval(head, skin, 0, -0.014, -0.106, 0.016, 0.025, 0.018)
  for (const side of [-1, 1]) {
    box(head, dark, side * 0.039, 0.02, -0.102, 0.032, 0.008, 0.008)
    const brow = box(
      head,
      dark,
      side * 0.039,
      0.043,
      -0.099,
      0.036,
      0.006,
      0.006,
    )
    brow.rotation.z = side * 0.05
  }
  box(head, panel, 0, -0.065, -0.098, 0.033, 0.004, 0.004)
  const hair = own(
    new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
  )
  add(head, hair, dark, 0, 0.018, 0.01, 0.116, 0.13, 0.108)
  oval(head, dark, 0, 0.064, -0.06, 0.106, 0.055, 0.063)
  oval(head, dark, -0.065, 0.068, -0.073, 0.05, 0.04, 0.048)
  box(head, jade, 0.126, 0.006, 0, 0.008, 0.029, 0.014)

  const arms: THREE.Group[] = []
  const elbows: THREE.Group[] = []
  const legs: THREE.Group[] = []
  const knees: THREE.Group[] = []
  const tails: THREE.Group[] = []
  const upperArm = own(new THREE.CapsuleGeometry(0.061, 0.2, 4, 10))
  const forearm = own(new THREE.CapsuleGeometry(0.053, 0.18, 4, 10))
  const thigh = own(new THREE.CapsuleGeometry(0.076, 0.235, 4, 10))
  const shin = own(new THREE.CapsuleGeometry(0.057, 0.235, 4, 10))
  for (const [i, side] of [-1, 1].entries()) {
    const arm = pivot(body, `courier-arm-${i}`, side * 0.233, 1.38, 0)
    arms.push(arm)
    add(arm, upperArm, fabric, side * 0.015, -0.155, 0)
    const elbow = pivot(arm, `courier-elbow-${i}`, side * 0.015, -0.3, 0)
    elbows.push(elbow)
    add(elbow, forearm, fabric, 0, -0.13, 0)
    box(elbow, panel, 0, -0.235, 0, 0.105, 0.04, 0.105)
    if (i === 0) box(elbow, jade, 0, -0.235, -0.058, 0.047, 0.009, 0.009)
    oval(elbow, skin, 0, -0.31, -0.005, 0.041, 0.075, 0.033)
    const leg = pivot(body, `courier-leg-${i}`, side * 0.098, 0.87, 0)
    legs.push(leg)
    add(leg, thigh, dark, 0, -0.185, 0)
    box(leg, panel, side * 0.065, -0.17, 0, 0.035, 0.14, 0.11)
    const knee = pivot(leg, `courier-knee-${i}`, 0, -0.375, 0)
    knees.push(knee)
    add(knee, shin, dark, 0, -0.18, 0)
    oval(knee, panel, 0, -0.015, -0.044, 0.058, 0.065, 0.032)
    oval(knee, dark, 0, -0.415, -0.036, 0.072, 0.068, 0.139)
    box(knee, sole, 0, -0.468, -0.038, 0.137, 0.025, 0.245)
    box(knee, panel, 0, -0.405, -0.114, 0.095, 0.016, 0.035)
    const tail = pivot(body, `courier-coat-${i}`, side * 0.096, 1.0, 0)
    tails.push(tail)
    const skirt = add(
      tail,
      own(
        new THREE.CylinderGeometry(
          0.125,
          0.15,
          0.32,
          8,
          1,
          true,
          i * Math.PI,
          Math.PI,
        ),
      ),
      fabric,
      0,
      -0.16,
      0,
    )
    skirt.scale.z = 0.85
    box(tail, panel, side * 0.115, -0.21, -0.015, 0.01, 0.2, 0.01)
  }

  // Batch only static meshes within each joint. Limbs stay independently articulated.
  body.traverse((object) => {
    if (!(object instanceof THREE.Group)) return
    const batches = new Map<THREE.Material, THREE.Mesh[]>()
    for (const child of object.children) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material))
        continue
      const group = batches.get(child.material) ?? []
      group.push(child)
      batches.set(child.material, group)
    }
    for (const [material, meshes] of batches) {
      if (meshes.length < 2) continue
      const transformed = meshes.map((mesh) => {
        mesh.updateMatrix()
        return mesh.geometry.clone().applyMatrix4(mesh.matrix)
      })
      const merged = mergeGeometries(transformed, false)
      transformed.forEach((geometry) => geometry.dispose())
      if (!merged) continue
      for (const mesh of meshes) object.remove(mesh)
      add(object, own(merged), material, 0, 0, 0)
    }
  })
  // Source templates are no longer needed after their last mesh has been batched.
  const liveGeometry = new Set<THREE.BufferGeometry>()
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) liveGeometry.add(object.geometry)
  })
  for (const geometry of geometries) {
    if (!liveGeometry.has(geometry)) {
      geometry.dispose()
      geometries.delete(geometry)
    }
  }

  let phase = 0
  let stride = 0
  let disposed = false
  return {
    root,
    update(pose: AvatarPose, seconds: number) {
      if (disposed) return
      const dt = Number.isFinite(seconds)
        ? Math.max(0, Math.min(0.05, seconds))
        : 0
      const speed = Math.max(
        0,
        Math.min(6, Number.isFinite(pose.speed) ? pose.speed : 0),
      )
      stride +=
        ((pose.moving ? Math.min(1, speed / 3.5) : 0) - stride) *
        (1 - Math.exp(-14 * dt))
      phase += speed * dt * 3.2
      root.position.copy(pose.position)
      root.rotation.y = pose.heading
      root.visible = pose.visible
      body.position.y = Math.abs(Math.sin(phase)) * 0.018 * stride
      body.rotation.z = Math.sin(phase) * 0.012 * stride
      for (let i = 0; i < 2; i++) {
        const swing = Math.sin(phase + i * Math.PI)
        legs[i].rotation.x = swing * 0.46 * stride
        knees[i].rotation.x = -Math.max(0, -swing) * 0.62 * stride
        arms[i].rotation.x = -swing * 0.3 * stride
        arms[i].rotation.z = (i === 0 ? -1 : 1) * 0.065
        elbows[i].rotation.x = 0.1 + Math.max(0, swing) * 0.12 * stride
        tails[i].rotation.x = -0.045 - Math.abs(swing) * 0.12 * stride
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      root.removeFromParent()
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
    },
  }
}
