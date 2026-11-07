import { useEffect, useLayoutEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import type { CloisterSceneProps } from "../components/CinematicPortfolio"
import { loadCloisterEnvironment } from "./cloisterEnvironment"
import { loadCloisterRunner } from "./cloisterRunner"
import { buildCloisterStones } from "./cloisterStones"
import { createCloisterInk } from "./cloisterInk"
import { createChoreography, AERIAL_TARGET } from "./cloisterChoreography"
import { CloisterTimeline, CLOISTER_SEGMENT_DURATIONS } from "./cloisterTimeline"

/** One renderer throughout the film. Reading poses are still images on the GPU:
 * no render loop runs until playback, resize, or an actual orbit gesture. */
export default function CloisterView(props: CloisterSceneProps) {
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  const sync = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    latest.current = props
    sync.current?.()
  }, [props])

  useEffect(() => {
    const element = host.current
    if (!element) return
    const abort = new AbortController()
    let disposed = false
    let clean = () => {}
    // StrictMode mounts twice in development; don't allocate the discarded GPU
    // context or start two large downloads.
    queueMicrotask(() => {
      if (disposed) return
      try {
        const canvas = document.createElement("canvas")
        canvas.style.cssText =
          "width:100%;height:100%;display:block;outline-offset:-3px"
        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        })
        clean = () => renderer.dispose()
        element.append(canvas)
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x000000)
        const fog = new THREE.Fog(0x000000, 9, 83)
        scene.fog = fog
        const camera = new THREE.PerspectiveCamera(44, 1, 0.07, 340)
        const controls = new OrbitControls(camera, canvas)
        controls.enabled = controls.enablePan = controls.enableDamping = false
        controls.rotateSpeed = 0.72
        controls.zoomSpeed = 0.8
        controls.minDistance = 18
        controls.minPolarAngle = 0.1
        controls.maxPolarAngle = Math.PI * 0.485
        const actor = new THREE.Group()
        scene.add(actor)
        const stones = buildCloisterStones(scene)
        const ink = createCloisterInk(renderer)
        let setting: Awaited<ReturnType<typeof loadCloisterEnvironment>> | undefined
        let runner: Awaited<ReturnType<typeof loadCloisterRunner>> | undefined
        const timeline = new CloisterTimeline()
        const sampleShot = createChoreography()
        let ready = false,
          frame = 0,
          previous = 0,
          width = 1,
          height = 1,
          orbit = false
        let stateKey = "",
          orbitRevision = -1,
          wasHidden = document.hidden
        let previousShot = "",
          resetBlur = true
        const draw = (now: number) => {
          frame = 0
          if (
            !ready ||
            disposed ||
            abort.signal.aborted ||
            document.hidden ||
            !runner
          )
            return
          const { phase, segment } = latest.current
          const dt = previous ? (now - previous) / 1000 : 0
          previous = now
          const done = timeline.advance(dt)
          const p = sampleShot(
            segment,
            timeline.time,
            width / height,
            runner.actionDurations,
          )
          if (!orbit) {
            actor.position.copy(p.position)
            actor.rotation.y = p.yaw
            runner.sample(p.action, p.actionTime, p.blend, {
              bank: p.bank, lean: p.lean,
            })
            camera.position.copy(p.camera)
            camera.fov = p.fov
            if (p.framing > 0)
              camera.setViewOffset(
                width,
                height,
                -p.framing * width,
                0,
                width,
                height,
              )
            else camera.clearViewOffset()
            camera.lookAt(p.target)
            camera.rotateZ(p.roll)
            camera.updateProjectionMatrix()
          }
          // Keep the ink at its full brightness when viewing the entire drawing.
          const pullback = orbit ? 1 : p.aerialProgress
          fog.near = 9 + 170 * pullback
          fog.far = 83 + 170 * pullback
          stones.setDistanceFade(pullback)
          ink.render(scene, camera, pullback, {
            motionBlur: phase === "playing" && done === null ? p.motionBlur : 0,
            deltaSeconds: dt,
            reset: resetBlur || previousShot !== p.shotId,
          })
          previousShot = p.shotId
          resetBlur = false
          if (done !== null) latest.current.onComplete(done)
          else if (phase === "playing") invalidate()
        }
        const paint = (now: number) => {
          try {
            draw(now)
          } catch {
            fail()
          }
        }
        const invalidate = () => {
          if (
            !frame &&
            !disposed &&
            ready &&
            !abort.signal.aborted &&
            !document.hidden
          )
            frame = requestAnimationFrame(paint)
        }
        const setAerial = () => {
          const p = sampleShot(
            4, CLOISTER_SEGMENT_DURATIONS[4], width / height, runner?.actionDurations,
          )
          camera.position.copy(p.camera)
          camera.clearViewOffset()
          camera.fov = p.fov
          camera.updateProjectionMatrix()
          controls.target.copy(AERIAL_TARGET)
          camera.lookAt(controls.target)
          controls.maxDistance = Math.max(
            117,
            p.camera.distanceTo(p.target) * 1.25,
          )
          controls.update()
          actor.position.copy(p.position)
          actor.rotation.y = p.yaw
          runner?.sample(p.action, p.actionTime, p.blend)
        }
        const configure = () => {
          const { phase, segment, revision } = latest.current
          const id = [phase, segment, revision].join("/")
          if (id === stateKey) return
          stateKey = id
          previous = 0
          resetBlur = true
          timeline.configure(phase, segment, revision)
          const nextOrbit = phase === "aerial"
          if (nextOrbit && (!orbit || orbitRevision !== revision)) {
            setAerial()
            orbitRevision = revision
          }
          orbit = controls.enabled = nextOrbit
          if (orbit) {
            canvas.tabIndex = 0
            canvas.removeAttribute("aria-hidden")
            canvas.setAttribute("role", "group")
            canvas.setAttribute(
              "aria-label",
              "Aerial view of Santes Creus. Drag or use arrow keys to orbit. Scroll, pinch, or use plus and minus to zoom.",
            )
            canvas.style.cursor = "grab"
          } else {
            canvas.tabIndex = -1
            canvas.setAttribute("aria-hidden", "true")
            canvas.removeAttribute("role")
            canvas.removeAttribute("aria-label")
            canvas.style.cursor = ""
          }
          invalidate()
        }
        const resize = () => {
          if (disposed) return
          resetBlur = true
          width = Math.max(1, element.clientWidth)
          height = Math.max(1, element.clientHeight)
          renderer.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, width < 800 ? 1.4 : 1.6),
          )
          renderer.setSize(width, height, false)
          camera.aspect = width / height
          camera.updateProjectionMatrix()
          if (orbit)
            controls.maxDistance = Math.max(117, (59 / camera.aspect) * 1.25)
          invalidate()
        }
        const keydown = (e: KeyboardEvent) => {
          if (!orbit) return
          switch (e.key) {
            case "ArrowLeft":
              controls.rotateLeft(0.1)
              break
            case "ArrowRight":
              controls.rotateLeft(-0.1)
              break
            case "ArrowUp":
              controls.rotateUp(0.085)
              break
            case "ArrowDown":
              controls.rotateUp(-0.085)
              break
            case "+":
            case "=":
              controls.dollyIn(1 / 1.12)
              break
            case "-":
              controls.dollyOut(1 / 1.12)
              break
            default:
              return
          }
          e.preventDefault()
          controls.update()
          invalidate()
        }
        const visibility = () => {
          if (document.hidden) {
            cancelAnimationFrame(frame)
            frame = 0
          } else if (wasHidden) {
            previous = 0
            resetBlur = true
            invalidate()
          }
          wasHidden = document.hidden
        }
        const fail = () => {
          if (disposed || abort.signal.aborted) return
          abort.abort()
          cancelAnimationFrame(frame)
          latest.current.onFailure("The film could not be displayed.")
        }
        const lost = (event: Event) => {
          event.preventDefault()
          fail()
        }
        controls.addEventListener("change", invalidate)
        canvas.addEventListener("keydown", keydown)
        canvas.addEventListener("webglcontextlost", lost)
        document.addEventListener("visibilitychange", visibility)
        const observe = new ResizeObserver(resize)
        observe.observe(element)
        resize()
        sync.current = configure
        configure()
        clean = () => {
          ready = false
          sync.current = null
          cancelAnimationFrame(frame)
          observe.disconnect()
          document.removeEventListener("visibilitychange", visibility)
          canvas.removeEventListener("keydown", keydown)
          canvas.removeEventListener("webglcontextlost", lost)
          controls.removeEventListener("change", invalidate)
          controls.dispose()
          timeline.dispose()
          runner?.dispose()
          setting?.dispose()
          stones.dispose()
          ink.dispose()
          renderer.dispose()
          renderer.forceContextLoss()
          canvas.remove()
        }
        Promise.all([
          loadCloisterEnvironment(scene, abort.signal).then((value) => {
            if (disposed || abort.signal.aborted) value.dispose()
            else setting = value
          }),
          loadCloisterRunner(actor, abort.signal).then((value) => {
            if (disposed || abort.signal.aborted) value.dispose()
            else runner = value
          }),
        ])
          .then(() => {
            if (disposed || abort.signal.aborted) return
            ready = true
            stateKey = ""
            orbitRevision = -1
            configure()
            latest.current.onReady()
          })
          .catch(fail)
      } catch {
        clean()
        clean = () => {}
        if (!disposed) latest.current.onFailure("3D graphics are unavailable.")
      }
    })
    return () => {
      disposed = true
      abort.abort()
      clean()
    }
  }, [])

  return <div ref={host} className="cloister-stage" />
}
