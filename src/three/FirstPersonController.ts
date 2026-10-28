import * as THREE from "three"
import { moveWalker, type WalkRect } from "./walkGeometry"
type Terrain = {
  colliders: readonly WalkRect[]
  walkBounds: WalkRect
  spawn: readonly number[]
}
export type ExplorationPerspective = "first" | "third"
export type AvatarPose = {
  /** Feet position. The controller eye is 1.7 metres above the walking surface. */
  position: THREE.Vector3
  /** Radians around Y; zero faces -Z. */
  heading: number
  speed: number
  moving: boolean
  visible: boolean
}
const cameraClearance = 0.2

/** First contact with an expanded footprint along a camera boom, in [0, 1]. */
function cameraHitFraction(
  start: THREE.Vector3,
  end: THREE.Vector3,
  rect: WalkRect,
) {
  let entry = 0
  let exit = 1
  for (const [origin, direction, min, max] of [
    [
      start.x,
      end.x - start.x,
      rect.minX - cameraClearance,
      rect.maxX + cameraClearance,
    ],
    [
      start.z,
      end.z - start.z,
      rect.minZ - cameraClearance,
      rect.maxZ + cameraClearance,
    ],
  ]) {
    if (Math.abs(direction) < 0.000001) {
      if (origin < min || origin > max) return 1
      continue
    }
    const a = (min - origin) / direction
    const b = (max - origin) / direction
    entry = Math.max(entry, Math.min(a, b))
    exit = Math.min(exit, Math.max(a, b))
    if (entry > exit) return 1
  }
  return exit >= 0 && entry <= 1 ? Math.max(0, entry - 0.002) : 1
}

const movementKeys = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
])
/** Explicit pointer capture is optional; dragging and keyboard/touch controls always work. */
export class FirstPersonController {
  private keys = new Set<string>()
  private drag: {
    id: number
    x: number
    y: number
  } | null = null
  private enabled = false
  private yaw = 0
  private pitch = 0
  private targetYaw = 0
  private targetPitch = 0
  private vx = 0
  private vz = 0
  private touch = { x: 0, z: 0 }
  private walkingPosition: THREE.Vector3
  private perspective: ExplorationPerspective = "first"
  private actualSpeed = 0
  private desiredCamera = new THREE.Vector3()
  private safeCamera = new THREE.Vector3()
  private released = false
  private hadLock = false
  constructor(
    private camera: THREE.PerspectiveCamera,
    private host: HTMLElement,
    private terrain: Terrain,
    private onLockChange: (locked: boolean) => void,
  ) {
    this.walkingPosition = new THREE.Vector3().fromArray([...terrain.spawn])
    host.addEventListener("blur", this.blur)
    host.addEventListener("pointerdown", this.down)
    host.addEventListener("pointermove", this.move)
    host.addEventListener("pointerup", this.up)
    host.addEventListener("pointercancel", this.up)
    document.addEventListener("mousemove", this.mouse)
    document.addEventListener("pointerlockchange", this.lockChange)
    window.addEventListener("keydown", this.keyDown)
    window.addEventListener("keyup", this.keyUp)
    window.addEventListener("blur", this.clear)
    document.addEventListener("visibilitychange", this.clear)
  }
  get locked() {
    return document.pointerLockElement === this.host
  }
  activate(reset = false) {
    if (reset) {
      this.walkingPosition.fromArray([...this.terrain.spawn])
      this.yaw = this.targetYaw = 0
      this.pitch = this.targetPitch = 0
    }
    this.enabled = true
    this.updateCamera(0, true)
  }
  setPerspective(perspective: ExplorationPerspective) {
    if (this.perspective === perspective) return
    this.perspective = perspective
    if (this.enabled) this.updateCamera(0, true)
  }
  /** A copy: camera orbit/inspection cannot accidentally relocate the walker. */
  get playerPosition() {
    return this.walkingPosition.clone()
  }
  getAvatarPose(): AvatarPose {
    const position = this.walkingPosition.clone()
    position.y -= 1.7
    return {
      position,
      heading: this.yaw,
      speed: this.actualSpeed,
      moving: this.actualSpeed > 0.025,
      // Hide the figure if a close wall folds the camera into the player's body.
      visible:
        this.perspective === "third" &&
        this.camera.position.distanceTo(this.walkingPosition) > 0.8,
    }
  }
  suspend() {
    this.enabled = false
    this.clear()
    this.unlock()
  }
  async capture() {
    if (!this.enabled || !this.host.requestPointerLock)
      throw new Error("Use drag to look")
    this.host.focus({ preventScroll: true })
    await this.host.requestPointerLock()
    // Do not leave a late successful lock active after a transition/unmount.
    if (!this.enabled || this.released) this.unlock()
  }
  unlock() {
    if (this.locked) document.exitPointerLock?.()
  }
  setTouch(x: number, z: number) {
    this.touch = {
      x: Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0,
      z: Number.isFinite(z) ? Math.max(-1, Math.min(1, z)) : 0,
    }
  }
  private clear = () => {
    this.keys.clear()
    this.touch = { x: 0, z: 0 }
    if (this.drag && this.host.hasPointerCapture?.(this.drag.id))
      this.host.releasePointerCapture(this.drag.id)
    this.drag = null
    this.vx = this.vz = this.actualSpeed = 0
  }
  private blur = () => {
    this.clear()
    this.unlock()
  }
  private lockChange = () => {
    const locked = this.locked
    if (!locked && this.hadLock) {
      this.clear()
      window.dispatchEvent(new CustomEvent("portfolio:look-unlocked"))
    }
    this.hadLock = locked
    this.onLockChange(locked)
  }
  private keyDown = (event: KeyboardEvent) => {
    if (!this.enabled || event.ctrlKey || event.metaKey || event.altKey) return
    if (this.locked && event.key === "Tab") {
      this.unlock()
      return
    }
    if (this.locked && event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      this.unlock()
      return
    }
    if (document.activeElement !== this.host) return
    if (movementKeys.has(event.code)) {
      event.preventDefault()
      this.keys.add(event.code)
    }
  }
  private keyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code)
  }
  private down = (event: PointerEvent) => {
    if (
      !this.enabled ||
      this.locked ||
      event.button !== 0 ||
      (event.target as Element).closest("button,a,input,select,textarea")
    )
      return
    this.host.focus({ preventScroll: true })
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
    this.host.setPointerCapture?.(event.pointerId)
  }
  private rotate(dx: number, dy: number) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
    this.targetYaw -= Math.max(-250, Math.min(250, dx)) * 0.0027
    this.targetPitch = Math.max(
      -1.25,
      Math.min(
        1.25,
        this.targetPitch - Math.max(-250, Math.min(250, dy)) * 0.0027,
      ),
    )
  }
  private move = (event: PointerEvent) => {
    if (!this.enabled || this.locked || this.drag?.id !== event.pointerId)
      return
    this.rotate(event.clientX - this.drag.x, event.clientY - this.drag.y)
    this.drag.x = event.clientX
    this.drag.y = event.clientY
  }
  private up = (event: PointerEvent) => {
    if (this.drag?.id !== event.pointerId) return
    if (this.host.hasPointerCapture?.(event.pointerId))
      this.host.releasePointerCapture(event.pointerId)
    this.drag = null
  }
  private mouse = (event: MouseEvent) => {
    if (this.enabled && this.locked)
      this.rotate(event.movementX, event.movementY)
  }
  private clipCamera(end: THREE.Vector3, result: THREE.Vector3) {
    const start = this.walkingPosition
    let fraction = 1
    for (const collider of this.terrain.colliders)
      fraction = Math.min(fraction, cameraHitFraction(start, end, collider))
    const bounds = this.terrain.walkBounds
    for (const [origin, destination, min, max] of [
      [
        start.x,
        end.x,
        bounds.minX + cameraClearance,
        bounds.maxX - cameraClearance,
      ],
      [
        start.z,
        end.z,
        bounds.minZ + cameraClearance,
        bounds.maxZ - cameraClearance,
      ],
    ]) {
      if (destination < min && destination < origin)
        fraction = Math.min(fraction, (min - origin) / (destination - origin))
      if (destination > max && destination > origin)
        fraction = Math.min(fraction, (max - origin) / (destination - origin))
    }
    result.copy(start).lerp(end, Math.max(0, Math.min(1, fraction)))
    return result
  }
  private updateCamera(dt: number, immediate = false) {
    if (this.perspective === "first") {
      this.camera.position.copy(this.walkingPosition)
      this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ")
      return
    }
    const sin = Math.sin(this.yaw),
      cos = Math.cos(this.yaw)
    const reach = 3.2 * Math.cos(this.pitch)
    this.desiredCamera.set(
      this.walkingPosition.x + sin * reach + cos * 0.4,
      Math.max(
        this.walkingPosition.y - 1.35,
        this.walkingPosition.y + 0.68 - Math.sin(this.pitch) * 3.2,
      ),
      this.walkingPosition.z + cos * reach - sin * 0.4,
    )
    this.clipCamera(this.desiredCamera, this.safeCamera)
    this.camera.position.lerp(
      this.safeCamera,
      immediate ? 1 : 1 - Math.exp(-12 * dt),
    )
    // Retest after smoothing: turning around a corner must not ease through its wall.
    // Inward correction is immediate; free space opens back up with damped motion.
    this.clipCamera(this.camera.position, this.safeCamera)
    this.camera.position.copy(this.safeCamera)
    this.camera.rotation.set(this.pitch - 0.16, this.yaw, 0, "YXZ")
  }
  update(seconds: number) {
    if (!this.enabled || document.hidden || !Number.isFinite(seconds)) return
    const dt = Math.min(0.05, Math.max(0, seconds))
    const ease = 1 - Math.exp(-18 * dt)
    this.yaw += (this.targetYaw - this.yaw) * ease
    this.pitch += (this.targetPitch - this.pitch) * ease
    let x =
      this.touch.x +
      Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"))
    let z =
      this.touch.z +
      Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"))
    const amount = Math.max(1, Math.hypot(x, z))
    x /= amount
    z /= amount
    const speed =
      this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 6 : 3.5
    const tx = (Math.cos(this.yaw) * x - Math.sin(this.yaw) * z) * speed
    const tz = (-Math.sin(this.yaw) * x - Math.cos(this.yaw) * z) * speed
    const moveEase = 1 - Math.exp(-(amount > 1 || x || z ? 14 : 20) * dt)
    this.vx += (tx - this.vx) * moveEase
    this.vz += (tz - this.vz) * moveEase
    const next = moveWalker(
      this.walkingPosition,
      this.vx * dt,
      this.vz * dt,
      this.terrain.colliders,
      this.terrain.walkBounds,
    )
    this.actualSpeed =
      dt > 0
        ? Math.hypot(
            next.x - this.walkingPosition.x,
            next.z - this.walkingPosition.z,
          ) / dt
        : 0
    if (this.actualSpeed < 0.005) this.actualSpeed = 0
    this.walkingPosition.set(next.x, this.terrain.spawn[1], next.z)
    this.updateCamera(dt)
  }
  dispose() {
    if (this.released) return
    this.released = true
    this.suspend()
    this.host.removeEventListener("blur", this.blur)
    this.host.removeEventListener("pointerdown", this.down)
    this.host.removeEventListener("pointermove", this.move)
    this.host.removeEventListener("pointerup", this.up)
    this.host.removeEventListener("pointercancel", this.up)
    document.removeEventListener("mousemove", this.mouse)
    document.removeEventListener("pointerlockchange", this.lockChange)
    window.removeEventListener("keydown", this.keyDown)
    window.removeEventListener("keyup", this.keyUp)
    window.removeEventListener("blur", this.clear)
    document.removeEventListener("visibilitychange", this.clear)
  }
}
