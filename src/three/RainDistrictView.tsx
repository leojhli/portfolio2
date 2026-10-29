import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"
import { createDistrictAvatar } from "./DistrictAvatar"
import { Stage, webglAvailable } from "./stage"
import { createRainDistrict } from "./rainDistrict"
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
export default function RainDistrictView({
  selected,
  focusKey,
  onSelect,
  active = true,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const labels = useRef<Array<HTMLButtonElement | null>>([])
  const stage = useRef<Stage | null>(null)
  const walker = useRef<FirstPersonController | null>(null)
  const current = useRef({
    selected,
    focusKey,
    onSelect,
    active,
    view: "first",
  })
  const { mode } = usePrefs()
  const [view, setView] = useState<"first" | "third">("first")
  const [locked, setLocked] = useState(false)
  const [failed, setFailed] = useState(false)
  const [hint, setHint] = useState("")
  const [assetStatus, setAssetStatus] = useState(
    "Loading district details · 0 / 4",
  )
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
    s.renderer.toneMappingExposure = 1.12
    s.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35))
    s.camera.near = 0.08
    s.camera.far = 150
    s.camera.updateProjectionMatrix()
    const world = createRainDistrict(s.scene, {
      onAssets: ({ loaded, total, failed: missing }) => {
        setAssetStatus(
          missing.length
            ? `${missing.length} detail assets unavailable. The district is still open.`
            : loaded === total
              ? ""
              : `Loading district details · ${loaded} / ${total}`,
        )
      },
    })
    s.camera.position.fromArray(world.spawn)
    const avatar = createDistrictAvatar()
    s.scene.add(avatar.root)
    const composer = new EffectComposer(s.renderer)
    const render = new RenderPass(s.scene, s.camera)
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.48, 1.05)
    const output = new OutputPass()
    composer.addPass(render)
    composer.addPass(bloom)
    composer.addPass(output)
    let renderWidth = 0,
      renderHeight = 0
    s.renderOverride = () => {
      if (renderWidth !== s.w || renderHeight !== s.h) {
        renderWidth = s.w
        renderHeight = s.h
        composer.setSize(s.w, s.h)
      }
      composer.render()
    }
    const fp = new FirstPersonController(s.camera, el, world, setLocked)
    walker.current = fp
    let walking = false,
      lastView = "first",
      lastFocus = -1,
      elapsed = 0,
      released = false
    const projected = new THREE.Vector3(),
      anchor = new THREE.Vector3()
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2()
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
      // Include architecture in the ray so a terminal cannot be selected through a wall.
      const hit = ray
        .intersectObject(world.root, true)
        .find((h) => (h.object as THREE.Mesh).isMesh)
      if (!hit || hit.distance > 9) return
      let object: THREE.Object3D | null = hit.object
      while (object && !world.interactables.includes(object as THREE.Group))
        object = object.parent
      if (object) choose(world.interactables.indexOf(object as THREE.Group))
    }
    const key = (event: KeyboardEvent) => {
      if (
        event.code === "KeyE" &&
        current.current.active &&
        current.current.selected < 0 &&
        (event.target === el || fp.locked)
      ) {
        event.preventDefault()
        pick()
      }
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
        lastView = now.view
        fp.setPerspective(now.view as "first" | "third")
      }
      const shouldWalk = now.active && now.selected < 0
      if (shouldWalk !== walking) {
        walking = shouldWalk
        if (walking) {
          fp.activate()
          el.focus({ preventScroll: true })
        } else fp.suspend()
      }
      if (lastFocus !== now.focusKey) {
        if (walking && lastFocus >= 0 && now.selected < 0) fp.activate(true)
        lastFocus = now.focusKey
      }
      fp.update(dt)
      avatar.update(fp.getAvatarPose(), dt)
      world.update(elapsed)
      s.camera.updateMatrixWorld()
      spiritStops.forEach((_, i) => {
        const label = labels.current[i]
        if (!label) return
        anchor.copy(world.interactables[i].position)
        anchor.y += 2.5
        const distance = anchor.distanceTo(fp.playerPosition)
        projected.copy(anchor).project(s.camera)
        label.style.visibility =
          !now.active ||
          now.selected >= 0 ||
          fp.locked ||
          distance > 9 ||
          projected.z > 1 ||
          projected.z < -1 ||
          Math.abs(projected.x) > 0.9 ||
          Math.abs(projected.y) > 0.7
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
      s.renderOverride = undefined
      avatar.dispose()
      bloom.dispose()
      output.dispose()
      composer.dispose()
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
      aria-label="Explore Rain District. WASD or arrow keys to walk, Shift to run, drag to look. E or click to read nearby terminals. Escape releases mouse capture."
    >
      {failed ? (
        <div className="spirit-fallback">
          <pre aria-hidden="true">
            {
              "   / / / /   RAIN DISTRICT   / / /\n  +---+---+        +---+---+---+\n  | [] [] |========| [] [] [] |\n  |  TEA  |  <>    |  RADIO   |\n  |_______|  ||    |__________|\n      .      /  /      .\n   .        /  /    .     ."
            }
          </pre>
          <p>The city, in characters.</p>
          <small>
            3D is unavailable on this device. All four addresses are still
            accessible below.
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
                  aria-pressed={view === "first"}
                  onClick={() => setView("first")}
                >
                  First person
                </button>
                <button
                  className="spirit-button"
                  aria-pressed={view === "third"}
                  onClick={() => setView("third")}
                >
                  Third person
                </button>
              </div>
              {interactive && (
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
                WASD / arrows · Shift to run · drag to look · E to interact
              </p>
              <span className="world-capture-hint" role="status">
                {hint || assetStatus}
              </span>
            </div>
          )}
          {interactive && (
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
