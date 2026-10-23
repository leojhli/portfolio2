import * as THREE from "three"
import { AsciiRaster } from "../effects/ascii"

export type StageOpts = {
  ascii: boolean
  motion: boolean
  inkIsDark: boolean
}

export function webglAvailable() {
  try {
    const c = document.createElement("canvas")
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl"))
    )
  } catch {
    return false
  }
}

/**
 * Owns one renderer + scene + camera inside `host`. Pauses while off-screen,
 * renders a single still frame when motion is off (re-rendering only on
 * `invalidate()`), and in ASCII mode converts each frame into coloured characters.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  /** ASCII-mode output: a 2D canvas so every glyph can carry its own colour. */
  readonly out = document.createElement("canvas")
  onFrame: (dt: number, t: number) => void = () => {}
  w = 0
  h = 0
  private raster = new AsciiRaster()
  private family = "monospace"
  private visible = true
  private dirty = true
  private raf = 0
  private last = 0
  private lastAscii = 0
  private clock = 0
  private ro: ResizeObserver
  private io?: IntersectionObserver

  constructor(
    private host: HTMLElement,
    public opts: StageOpts,
    fov = 32,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100)
    const canvas = this.renderer.domElement
    canvas.setAttribute("aria-hidden", "true")
    canvas.classList.add("stage-gl")
    this.out.className = "ascii-out"
    this.out.setAttribute("aria-hidden", "true")
    host.prepend(canvas, this.out)
    canvas.addEventListener("portfolio:sample", this.paint)
    this.out.addEventListener("portfolio:sample", this.paint)
    // Still frames (motion off) are drawn once, so redraw when the mono font arrives.
    document.fonts?.ready.then(() => this.resize())
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    if ("IntersectionObserver" in window) {
      this.io = new IntersectionObserver(
        ([e]) => {
          this.visible = e.isIntersecting
          if (this.visible) this.dirty = true
        },
        { rootMargin: "80px" },
      )
      this.io.observe(host)
    }
    this.resize()
    this.raf = requestAnimationFrame(this.frame)
  }

  setOpts(o: Partial<StageOpts>) {
    Object.assign(this.opts, o)
    if (!this.opts.ascii)
      this.out
        .getContext("2d")
        ?.clearRect(0, 0, this.out.width, this.out.height)
    this.dirty = true
  }
  invalidate() {
    this.dirty = true
  }

  private resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight
    if (!w || !h) return
    this.w = w
    this.h = h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    const k = Math.min(window.devicePixelRatio || 1, 2)
    this.out.width = Math.round(w * k)
    this.out.height = Math.round(h * k)
    this.raster.fit(this.out, w, h)
    this.family = getComputedStyle(this.out).fontFamily || "monospace"
    this.dirty = true
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0
    this.last = now
    if (!this.visible || !this.w) return
    const { motion, ascii } = this.opts
    if (!motion && !this.dirty) return
    if (motion) this.clock += dt
    // ASCII output refreshes at ~20fps; there is no point drawing faster than that.
    if (ascii && motion && !this.dirty && now - this.lastAscii < 50) {
      this.onFrame(dt, this.clock)
      return
    }
    this.onFrame(motion ? dt : 0, this.clock)
    this.paint()
    this.dirty = false
  }

  private paint = () => {
    if (!this.w || !this.h) return
    this.renderer.render(this.scene, this.camera)
    if (this.opts.ascii) {
      this.lastAscii = performance.now()
      const c = this.renderer.domElement
      this.raster.paint(
        this.out,
        this.w,
        this.h,
        c,
        c.width,
        c.height,
        this.opts.inkIsDark,
        this.family,
      )
    }
  }

  dispose() {
    this.renderer.domElement.removeEventListener("portfolio:sample", this.paint)
    this.out.removeEventListener("portfolio:sample", this.paint)
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.io?.disconnect()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.out.remove()
  }
}
