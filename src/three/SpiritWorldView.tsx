import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { Stage, webglAvailable } from "./stage"
import { createSpiritWorld } from "./spiritWorld"
import { FirstPersonController } from "./FirstPersonController"
import { spiritStops } from "../content/spiritWorld"
import { usePrefs } from "../state/preferences"
import "../firstPerson.css"
type Props = {
  selected: number
  focusKey: number
  onSelect: (index: number) => void
  active?: boolean
}
export default function SpiritWorldView({
  selected,
  focusKey,
  onSelect,
  active = true,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const labels = useRef<Array<HTMLButtonElement | null>>([])
  const stage = useRef<Stage | null>(null)
  const walker = useRef<FirstPersonController | null>(null)
  const current = useRef({ selected, focusKey, onSelect, active, view: "walk" })
  const { mode } = usePrefs()
  const [view, setView] = useState<"walk" | "orbit">("walk")
  const [locked, setLocked] = useState(false)
  const [failed, setFailed] = useState(false)
  const [hint, setHint] = useState("")
  current.current = { selected, focusKey, onSelect, active, view }
  useEffect(() => {
    const el = host.current
    if (!el || !webglAvailable()) {
      setFailed(true)
      return
    }
    let s: Stage
    try {
      s = new Stage(
        el,
        { ascii: mode === "ascii", motion: true, inkIsDark: false },
        65,
      )
    } catch {
      setFailed(true)
      return
    }
    stage.current = s
    s.renderer.shadowMap.enabled = true
    s.renderer.shadowMap.type = THREE.PCFShadowMap
    s.renderer.toneMapping = THREE.ACESFilmicToneMapping
    s.renderer.toneMappingExposure = 1.15
    s.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    s.camera.near = 0.08
    s.camera.far = 220
    s.camera.updateProjectionMatrix()
    const world = createSpiritWorld(s.scene)
    s.camera.position.fromArray([...world.spawn])
    const controls = new OrbitControls(s.camera, s.renderer.domElement)
    controls.enabled = false
    controls.target.set(0, 9, -10)
    controls.enableDamping = true
    controls.dampingFactor = 0.065
    controls.enablePan = false
    controls.minDistance = 12
    controls.maxDistance = 110
    controls.minPolarAngle = 0.25
    controls.maxPolarAngle = 1.42
    const fp = new FirstPersonController(s.camera, el, world, setLocked)
    walker.current = fp
    let walking = false,
      lastView = "walk",
      lastSelection = -2,
      lastFocus = -1,
      touring = false,
      elapsed = 0,
      released = false
    const cameraTarget = new THREE.Vector3(47, 36, 64)
    const lookTarget = new THREE.Vector3(0, 9, -10)
    const projected = new THREE.Vector3()
    const anchor = new THREE.Vector3()
    const ray = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const start = () => {
      touring = false
    }
    controls.addEventListener("start", start)
    const choose = (index: number) => {
      if (!current.current.active) return
      fp.suspend()
      walking = false
      current.current.onSelect(index)
    }
    let downX = 0,
      downY = 0
    const down = (e: PointerEvent) => {
      downX = e.clientX
      downY = e.clientY
      if (
        current.current.active &&
        !(e.target as Element).closest("button,a,input")
      )
        el.focus({ preventScroll: true })
    }
    const pick = (e?: MouseEvent) => {
      if (!current.current.active || current.current.selected >= 0) return
      if (
        e &&
        ((e.target as Element).closest("button") ||
          (!fp.locked && Math.hypot(e.clientX - downX, e.clientY - downY) > 6))
      )
        return
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      if (fp.locked || !e) pointer.set(0, 0)
      else
        pointer.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        )
      ray.setFromCamera(pointer, s.camera)
      // Include architecture in the ray so a character cannot be selected through a wall.
      const hit = ray
        .intersectObjects(s.scene.children, true)
        .find((h) => (h.object as THREE.Mesh).isMesh)
      if (!hit || (current.current.view === "walk" && hit.distance > 7)) return
      let object: THREE.Object3D | null = hit.object
      while (object && !world.characters.includes(object as THREE.Group))
        object = object.parent
      if (object) choose(world.characters.indexOf(object as THREE.Group))
    }
    const key = (e: KeyboardEvent) => {
      if (
        !current.current.active ||
        current.current.selected >= 0 ||
        (e.target !== el && !fp.locked)
      )
        return
      if (e.code === "KeyE" && current.current.view === "walk") {
        e.preventDefault()
        pick()
        return
      }
      if (
        current.current.view !== "orbit" ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-"].includes(
          e.key,
        )
      )
        return
      e.preventDefault()
      touring = false
      const relative = s.camera.position.clone().sub(controls.target)
      if (e.key === "ArrowLeft" || e.key === "ArrowRight")
        relative.applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          e.key === "ArrowLeft" ? 0.12 : -0.12,
        )
      else if (e.key === "ArrowUp" || e.key === "ArrowDown")
        relative.y = Math.max(
          4,
          Math.min(40, relative.y + (e.key === "ArrowUp" ? 1 : -1)),
        )
      else relative.multiplyScalar(e.key === "+" ? 0.92 : 1.08)
      relative.clampLength(12, 110)
      s.camera.position.copy(controls.target).add(relative)
      controls.update()
    }
    const lost = (e: Event) => {
      e.preventDefault()
      release()
      setFailed(true)
    }
    el.addEventListener("pointerdown", down)
    el.addEventListener("click", pick)
    el.addEventListener("keydown", key)
    s.renderer.domElement.addEventListener("webglcontextlost", lost)
    s.onFrame = (dt) => {
      if (document.hidden) return
      elapsed += dt
      const now = current.current
      if (lastView !== now.view) {
        fp.suspend()
        walking = false
        lastView = now.view
        s.camera.fov = now.view === "walk" ? 65 : 46
        s.camera.updateProjectionMatrix()
        if (now.view === "orbit") {
          s.camera.position.set(47, 36, 64)
          controls.target.set(0, 9, -10)
          lastSelection = -2
        }
      }
      const shouldWalk = now.active && now.view === "walk" && now.selected < 0
      if (shouldWalk !== walking) {
        walking = shouldWalk
        if (walking) {
          fp.activate()
          el.focus({ preventScroll: true })
        } else fp.suspend()
      }
      controls.enabled = now.active && now.view === "orbit"
      if (lastSelection !== now.selected || lastFocus !== now.focusKey) {
        // "Whole courtyard" is also a recovery point for keyboard/touch walkers.
        if (
          walking &&
          lastFocus >= 0 &&
          lastFocus !== now.focusKey &&
          now.selected < 0
        )
          fp.activate(true)
        lastFocus = now.focusKey
        lastSelection = now.selected
        const stop = spiritStops[lastSelection]
        cameraTarget.fromArray(stop ? [...stop.camera] : [47, 36, 64])
        lookTarget.fromArray(stop ? [...stop.position] : [0, 9, -10])
        touring = true
      }
      if (now.view === "walk") fp.update(dt)
      else if (controls.enabled) {
        if (touring) {
          const ease = 1 - Math.exp(-dt * 2.8)
          s.camera.position.lerp(cameraTarget, ease)
          controls.target.lerp(lookTarget, ease)
          if (s.camera.position.distanceTo(cameraTarget) < 0.03) touring = false
        }
        controls.update()
      }
      s.camera.updateMatrixWorld()
      world.update(elapsed)
      spiritStops.forEach((stop, i) => {
        const label = labels.current[i]
        if (!label) return
        if (i < world.characters.length) {
          anchor.copy(world.characters[i].position)
          anchor.y += 2.1
        } else anchor.fromArray([...stop.position])
        const distance = anchor.distanceTo(s.camera.position)
        projected.copy(anchor).project(s.camera)
        label.style.visibility =
          !now.active ||
          now.selected >= 0 ||
          fp.locked ||
          (now.view === "walk" && distance > 12) ||
          projected.z > 1 ||
          projected.z < -1 ||
          Math.abs(projected.x) > 0.96 ||
          Math.abs(projected.y) > 0.85
            ? "hidden"
            : "visible"
        label.style.transform = `translate(${(projected.x * 0.5 + 0.5) * s.w}px,${(-projected.y * 0.5 + 0.5) * s.h}px) translate(-50%,-50%)`
      })
    }
    const release = () => {
      if (released) return
      released = true
      fp.dispose()
      walker.current = null
      controls.removeEventListener("start", start)
      controls.dispose()
      el.removeEventListener("pointerdown", down)
      el.removeEventListener("click", pick)
      el.removeEventListener("keydown", key)
      s.renderer.domElement.removeEventListener("webglcontextlost", lost)
      world.dispose()
      s.dispose()
      stage.current = null
    }
    return release
  }, [])
  useEffect(() => {
    stage.current?.setOpts({ ascii: mode === "ascii", inkIsDark: false })
  }, [mode])
  const interactive = active && selected < 0 && !failed
  const capture = async () => {
    try {
      await walker.current?.capture()
      setHint("")
    } catch {
      setHint("Mouse capture unavailable. Drag the scene to look around.")
    }
  }
  return (
    <div
      ref={host}
      className="spirit-scene stage"
      data-view={view}
      data-locked={locked}
      role="region"
      tabIndex={0}
      aria-label={
        view === "walk"
          ? "Explore Seireitei. WASD or arrow keys to walk, Shift to run, drag to look. E or click to meet nearby characters. Escape releases mouse capture."
          : "Aerial view. Drag or arrow keys to orbit. Scroll, pinch, plus or minus to zoom."
      }
    >
      {failed ? (
        <div className="spirit-fallback">
          <pre aria-hidden="true">
            {
              "           *          .\n              _/\\_\n         ____/| [] |\\____\n        /_____|____|_____\\\n    ___/|  [] | [] | []  |\\___\n   /____|_____/____\\_____|____\\\n        | []  |    |  [] |\n   _____|_____|____|_____|_____\n  /             ||             \\\n /______________||______________\\"
            }
          </pre>
          <p>The courtyard, in ink.</p>
          <small>
            3D is unavailable on this device. Every location is still accessible
            below.
          </small>
        </div>
      ) : (
        <>
          {spiritStops.map((stop, i) => (
            <button
              key={stop.id}
              ref={(node) => {
                labels.current[i] = node
              }}
              className="spirit-hotspot"
              aria-label={`Explore ${stop.name}`}
              aria-pressed={selected === i}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSelect(i)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <span>{stop.name}</span>
            </button>
          ))}
          {active && (
            <div
              className="world-view-controls"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div
                className="world-view-switch"
                role="group"
                aria-label="Exploration view"
              >
                <button
                  className="spirit-button"
                  aria-pressed={view === "walk"}
                  onClick={() => setView("walk")}
                >
                  First person
                </button>
                <button
                  className="spirit-button"
                  aria-pressed={view === "orbit"}
                  onClick={() => setView("orbit")}
                >
                  Aerial view
                </button>
              </div>
              {view === "walk" && interactive && (
                <button
                  className="spirit-button capture-mouse"
                  onClick={() =>
                    locked ? walker.current?.unlock() : void capture()
                  }
                >
                  {locked ? "Release mouse · Esc" : "Capture mouse"}
                </button>
              )}
              <p className="world-help">
                {view === "walk"
                  ? "WASD / arrows · Shift to run · drag to look · E to interact"
                  : "Drag / arrows to orbit · scroll / pinch to zoom"}
              </p>
              <span className="world-capture-hint" role="status">
                {hint}
              </span>
            </div>
          )}
          {interactive && view === "walk" && (
            <>
              <span className="world-reticle" aria-hidden="true">
                +
              </span>
              <div
                className="world-dpad"
                role="group"
                aria-label="Walking controls"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {[
                  { label: "Walk forward", text: "↑", x: 0, z: 1 },
                  { label: "Walk left", text: "←", x: -1, z: 0 },
                  { label: "Walk backward", text: "↓", x: 0, z: -1 },
                  { label: "Walk right", text: "→", x: 1, z: 0 },
                ].map((b, i) => (
                  <button
                    key={b.label}
                    type="button"
                    className={`walk-direction walk-direction-${i}`}
                    aria-label={b.label}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.currentTarget.setPointerCapture?.(e.pointerId)
                      walker.current?.setTouch(b.x, b.z)
                    }}
                    onPointerUp={() => walker.current?.setTouch(0, 0)}
                    onPointerCancel={() => walker.current?.setTouch(0, 0)}
                    onLostPointerCapture={() => walker.current?.setTouch(0, 0)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault()
                        walker.current?.setTouch(b.x, b.z)
                      }
                    }}
                    onKeyUp={() => walker.current?.setTouch(0, 0)}
                    onBlur={() => walker.current?.setTouch(0, 0)}
                  >
                    {b.text}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
