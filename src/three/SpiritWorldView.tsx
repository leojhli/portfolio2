import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { Stage, webglAvailable } from "./stage"
import { createSpiritWorld } from "./spiritWorld"
import { spiritStops } from "../content/spiritWorld"
import { usePrefs } from "../state/preferences"

type Props = {
  selected: number
  focusKey: number
  onSelect: (index: number) => void
}

export default function SpiritWorldView({
  selected,
  focusKey,
  onSelect,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const labels = useRef<Array<HTMLButtonElement | null>>([])
  const stage = useRef<Stage | null>(null)
  const selection = useRef(selected)
  selection.current = selected
  const focus = useRef(focusKey),
    choose = useRef(onSelect)
  focus.current = focusKey
  choose.current = onSelect
  const { mode } = usePrefs()
  const [failed, setFailed] = useState(false)
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
        42,
      )
    } catch {
      setFailed(true)
      return
    }
    stage.current = s
    s.renderer.shadowMap.enabled = true
    s.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    s.renderer.toneMapping = THREE.ACESFilmicToneMapping
    s.renderer.toneMappingExposure = 1.15
    s.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5))
    s.camera.position.set(25, 18, 33)
    const controls = new OrbitControls(s.camera, el)
    controls.target.set(0, 2, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.065
    controls.enablePan = false
    controls.minDistance = 12
    controls.maxDistance = 58
    controls.minPolarAngle = 0.25
    controls.maxPolarAngle = 1.42
    const world = createSpiritWorld(s.scene)
    let lastSelection = -2,
      lastFocus = -1,
      touring = true,
      elapsed = 0
    const cameraTarget = new THREE.Vector3(25, 18, 33),
      lookTarget = new THREE.Vector3(0, 2, 0),
      projected = new THREE.Vector3()
    const start = () => {
      touring = false
    }
    controls.addEventListener("start", start)
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2()
    let downX = 0,
      downY = 0
    const down = (event: PointerEvent) => {
      downX = event.clientX
      downY = event.clientY
    }
    const pick = (event: MouseEvent) => {
      if (
        (event.target as Element).closest("button") ||
        Math.hypot(event.clientX - downX, event.clientY - downY) > 6
      )
        return
      const rect = el.getBoundingClientRect()
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      ray.setFromCamera(pointer, s.camera)
      const hit = ray.intersectObjects(world.characters, true)[0]
      if (!hit) return
      let object: THREE.Object3D | null = hit.object
      while (object && !world.characters.includes(object as THREE.Group))
        object = object.parent
      if (object)
        choose.current(world.characters.indexOf(object as THREE.Group))
    }
    const key = (event: KeyboardEvent) => {
      if (
        event.target !== el ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-"].includes(
          event.key,
        )
      )
        return
      event.preventDefault()
      touring = false
      const relative = s.camera.position.clone().sub(controls.target)
      if (event.key === "ArrowLeft" || event.key === "ArrowRight")
        relative.applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          event.key === "ArrowLeft" ? 0.12 : -0.12,
        )
      else if (event.key === "ArrowUp" || event.key === "ArrowDown")
        relative.y = Math.max(
          4,
          Math.min(35, relative.y + (event.key === "ArrowUp" ? 1 : -1)),
        )
      else relative.multiplyScalar(event.key === "+" ? 0.92 : 1.08)
      s.camera.position.copy(controls.target).add(relative)
      controls.update()
    }
    el.addEventListener("pointerdown", down)
    el.addEventListener("click", pick)
    el.addEventListener("keydown", key)
    const lost = (event: Event) => {
      event.preventDefault()
      release()
      setFailed(true)
    }
    s.renderer.domElement.addEventListener("webglcontextlost", lost)
    s.onFrame = (dt) => {
      if (document.hidden) return
      elapsed += dt
      if (lastSelection !== selection.current || lastFocus !== focus.current) {
        lastFocus = focus.current
        lastSelection = selection.current
        touring = true
        const stop = spiritStops[lastSelection]
        cameraTarget.fromArray(stop ? [...stop.camera] : [25, 18, 33])
        lookTarget.fromArray(stop ? [...stop.position] : [0, 2, 0])
      }
      if (touring) {
        const ease = 1 - Math.exp(-dt * 2.8)
        s.camera.position.lerp(cameraTarget, ease)
        controls.target.lerp(lookTarget, ease)
        if (s.camera.position.distanceTo(cameraTarget) < 0.03) touring = false
      }
      controls.update()
      world.update(elapsed)
      spiritStops.forEach((stop, i) => {
        const label = labels.current[i]
        if (!label) return
        projected.fromArray([...stop.position]).project(s.camera)
        label.style.visibility =
          projected.z > 1 ||
          projected.z < -1 ||
          Math.abs(projected.x) > 1.15 ||
          Math.abs(projected.y) > 1.15
            ? "hidden"
            : "visible"
        label.style.transform = `translate(${(projected.x * 0.5 + 0.5) * s.w}px,${(-projected.y * 0.5 + 0.5) * s.h}px) translate(-50%,-50%)`
      })
    }
    let released = false
    const release = () => {
      if (released) return
      released = true
      controls.removeEventListener("start", start)
      controls.dispose()
      el.removeEventListener("pointerdown", down)
      el.removeEventListener("click", pick)
      el.removeEventListener("keydown", key)
      s.renderer.domElement.removeEventListener("webglcontextlost", lost)
      s.dispose()
      stage.current = null
    }
    return release
  }, [])
  useEffect(() => {
    stage.current?.setOpts({ ascii: mode === "ascii", inkIsDark: false })
  }, [mode])
  return (
    <div
      ref={host}
      className="spirit-scene stage"
      role="region"
      tabIndex={0}
      aria-label="Moonlit Seireitei-inspired courtyard. Drag or use arrow keys to orbit; pinch, scroll, or use plus and minus to zoom. Choose a location to explore."
    >
      {failed ? (
        <div className="spirit-fallback">
          <pre aria-hidden="true">
            {
              "             *                 .\n       .             _/\\_\n                    /____\\\n               ____/| [] |\\____\n              /_____|____|_____\\\n          ___/|  []  | [] |  [] |\\___\n         /____|______/____\\____|____\\\n             |  []  |    |  []  |\n        _____|______|____|______|_____\n       /             ||              \\\n      /______________||_______________\\\n                     ||\n                     ||\n"
            }
          </pre>
          <p>The courtyard, in ink.</p>
          <small>
            3D is unavailable on this device. Every location is still accessible
            below.
          </small>
        </div>
      ) : (
        spiritStops.map((stop, i) => (
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
        ))
      )}
    </div>
  )
}

