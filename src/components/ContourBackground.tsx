import { useEffect, useMemo, useRef, useState } from "react"
import { usePrefs } from "../state/preferences"
import {
  contourPath,
  contourCharacters,
  contourVertex,
  contourFragment,
} from "../effects/contours"

export default function ContourBackground() {
  const { motion, mode, palette } = usePrefs()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const path = useMemo(contourPath, []),
    characters = useMemo(contourCharacters, [])
  useEffect(() => {
    setReady(false)
    const el = canvas.current
    if (!el || mode === "ascii") return
    let gl: WebGL2RenderingContext | null = null
    try {
      gl = el.getContext("webgl2", {
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
        powerPreference: "low-power",
      })
    } catch {
      return
    }
    if (!gl) return
    const g = gl,
      program = g.createProgram(),
      buffer = g.createBuffer(),
      shaders: WebGLShader[] = []
    if (!program || !buffer) return
    let raf = 0,
      disposed = false,
      visible = scrollY > innerHeight * 0.12
    const compile = (kind: number, source: string) => {
      const shader = g.createShader(kind)
      if (!shader) return false
      shaders.push(shader)
      g.shaderSource(shader, source)
      g.compileShader(shader)
      if (!g.getShaderParameter(shader, g.COMPILE_STATUS)) return false
      g.attachShader(program, shader)
      return true
    }
    const release = () => {
      g.deleteBuffer(buffer)
      g.deleteProgram(program)
      shaders.forEach((s) => g.deleteShader(s))
    }
    if (
      !compile(g.VERTEX_SHADER, contourVertex) ||
      !compile(g.FRAGMENT_SHADER, contourFragment)
    ) {
      release()
      return
    }
    g.linkProgram(program)
    if (!g.getProgramParameter(program, g.LINK_STATUS)) {
      release()
      return
    }
    g.useProgram(program)
    g.bindBuffer(g.ARRAY_BUFFER, buffer)
    g.bufferData(
      g.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      g.STATIC_DRAW,
    )
    const position = g.getAttribLocation(program, "position")
    g.enableVertexAttribArray(position)
    g.vertexAttribPointer(position, 2, g.FLOAT, false, 0, 0)
    const clock = g.getUniformLocation(program, "time"),
      resolution = g.getUniformLocation(program, "resolution")
    const color = palette.vars.accent
      .match(/\w\w/g)!
      .map((v) => parseInt(v, 16) / 255)
    g.uniform3f(
      g.getUniformLocation(program, "ink"),
      color[0],
      color[1],
      color[2],
    )
    const draw = (now: number) => {
      raf = 0
      if (disposed) return
      g.uniform1f(clock, motion ? now * 0.00013 : 0)
      g.drawArrays(g.TRIANGLES, 0, 6)
      if (motion && visible && !document.hidden)
        raf = requestAnimationFrame(draw)
    }
    const resize = () => {
      const ratio = Math.min(1, 1400 / Math.max(1, innerWidth))
      el.width = Math.round(innerWidth * ratio)
      el.height = Math.round(innerHeight * ratio)
      g.viewport(0, 0, el.width, el.height)
      g.uniform2f(resolution, el.width, el.height)
      if (!raf) draw(performance.now())
    }
    const wake = () => {
      visible = scrollY > innerHeight * 0.12
      if (document.hidden || !visible) {
        cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf) draw(performance.now())
    }
    const lost = (event: Event) => {
      event.preventDefault()
      cancelAnimationFrame(raf)
      disposed = true
      setReady(false)
    }
    el.addEventListener("webglcontextlost", lost)
    addEventListener("resize", resize)
    addEventListener("portfolio:frame", wake)
    document.addEventListener("visibilitychange", wake)
    resize()
    setReady(true)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      removeEventListener("resize", resize)
      removeEventListener("portfolio:frame", wake)
      document.removeEventListener("visibilitychange", wake)
      el.removeEventListener("webglcontextlost", lost)
      release()
    }
  }, [motion, mode, palette])
  return (
    <div className="contour-background" aria-hidden="true">
      {mode === "ascii" ? (
        <pre className="contour-ascii">{characters}</pre>
      ) : (
        <>
          {!ready && (
            <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
          )}
          <canvas ref={canvas} style={{ opacity: ready ? 1 : 0 }} />
        </>
      )}
    </div>
  )
}
