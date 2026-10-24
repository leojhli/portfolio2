import { clamp } from "./geometry"
import {
  screenOpacity,
  SCREEN_VARIANTS,
  type ScreenVariant,
} from "./screenGeometry"
import type { ScreenTransition } from "./screen"

const VERTEX = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = vec2(position.x * .5 + .5, .5 - position.y * .5);
  gl_Position = vec4(position, 0., 1.);
}
`

// A continuous field replaces thousands of CPU strip blits. Texture cells stay
// fine; their coordinates advect continuously instead of switching resolutions.
export const LIQUID_FRAGMENT = `
precision highp float;
varying vec2 uv;
uniform sampler2D outgoing;
uniform sampler2D incoming;
uniform vec2 size;
uniform float progress;
uniform float opacity;
uniform float direction;
uniform int variant;

float ease(float v) { v = clamp(v, 0., 1.); return v*v*(3.-2.*v); }
vec3 pixel(sampler2D image, vec2 at) {
  vec2 cell = vec2(2.) / size;
  return texture2D(image, clamp((floor(at/cell)+.5)*cell, cell*.5, 1.-cell*.5)).rgb;
}
void main() {
  float t = ease((progress-.035)/.765);
  float e = sin(3.14159265*t);
  bool vertical = variant == 3;
  bool mirror = vertical ? direction < 0. : direction > 0.;
  float x = vertical ? uv.y : uv.x;
  float s = vertical ? uv.x : uv.y;
  if (mirror) x = 1.-x;
  float d = 1.;
  vec2 flow = vec2(0.);
  if (variant == 0) {
    float front = t*1.28-.14+e*(.075*sin(s*8.5+t*2.)+.03*sin(s*21.-t*3.));
    d = x-front;
    flow = vec2(.9+.25*sin(s*8.-t*3.), .4*cos(s*9.+t*2.))*e;
  } else if (variant == 1) {
    for (int i=0; i<3; i++) {
      float fi = float(i);
      vec2 center = i==0 ? vec2(.17,.28) : (i==1 ? vec2(.58,.77) : vec2(.87,.12));
      float radius = max(0.,pow(t,1.4)*.78-.025+e*.018*sin(s*13.+fi*2.));
      d = min(d, length(vec2(x-center.x,(s-center.y)*.8))-radius);
    }
    flow = vec2(sin(s*8.+t*2.),cos(s*11.-t*3.)*.7)*e;
  } else if (variant == 2) {
    float side = ease((s-.2)/.6);
    float bend = e*.045*sin(s*12.-t*2.);
    float travel = pow(t,1.5)*1.4;
    d = min(x-(travel-.12-side*.6+bend), 1.-(travel-.12-(1.-side)*.6-bend)-x);
    flow = vec2(cos(s*3.14159265)*1.2,sin(s*7.-t*3.)*.6)*e;
  } else if (variant == 3) {
    float front = t*1.5-.25+e*(.14*sin(s*13.+t*2.)+.055*sin(s*29.-t*2.));
    d = x-front;
    flow = vec2(sin(s*12.+t*3.)*.55,1.+.25*sin(s*9.-t*2.))*e;
  } else if (variant == 4) {
    float center = .5+e*.09*sin(s*8.+t*2.);
    d = abs(x-center)-max(0.,t*.76-.05);
    flow = vec2(sin(s*6.-t*2.)*.9,cos(s*10.+t*2.)*.5)*e;
  } else {
    float center = .58+e*.04*sin(s*9.+t*2.);
    float radius = max(0.,(1.-t)*1.28-.02+e*.025*sin(s*15.+t*3.));
    d = radius-length(vec2(x-center,(s-.48)*.85));
    flow = vec2(sin(s*10.-t*3.)*.6,(.48-s)*1.5)*e;
  }
  if (mirror) {
    if (vertical) flow.y *= -1.;
    else flow.x *= -1.;
  }
  float pixels = d*(vertical ? size.y : size.x);
  float mask = 1.-smoothstep(-.8,.8,pixels);
  if (t<=0.) mask=0.;
  if (progress>=.8) { mask=1.; flow=vec2(0.); }
  float strength = min(38.,min(size.x,size.y)*.045);
  float distance = pixels/64.;
  vec2 displacement = flow*strength*exp(-distance*distance)/size;
  vec3 before = pixel(outgoing,uv+displacement);
  vec3 after = pixel(incoming,uv-displacement*.65);
  // Premultiplied output gives the final handoff to HTML a clean, single fade.
  gl_FragColor = vec4(mix(before,after,mask)*opacity,opacity);
}
`

export type ScreenSurface = {
  start(
    from: HTMLCanvasElement,
    into: HTMLCanvasElement,
    options: {
      width: number
      height: number
      variant: ScreenVariant
      direction?: 1 | -1
    },
  ): ScreenTransition | null
  dispose(): void
}

/** One persistent WebGL context, program and triangle; two textures per turn. */
export function createScreenSurface(
  host: HTMLCanvasElement,
  onLoss: () => void,
): ScreenSurface | null {
  if (!window.WebGLRenderingContext) return null
  const canvas = host.ownerDocument.createElement("canvas")
  let gl: WebGLRenderingContext | null = null
  try {
    gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    })
  } catch {
    return null
  }
  if (!gl) return null
  const g = gl
  const hostVisibility = host.style.visibility
  const shaders: WebGLShader[] = []
  let program: WebGLProgram | null = null,
    buffer: WebGLBuffer | null = null,
    textures: WebGLTexture[] = [],
    dead = false,
    lost = false,
    active: ScreenTransition | null = null
  const release = () => {
    textures.forEach((texture) => g.deleteTexture(texture))
    textures = []
  }
  const dispose = () => {
    if (dead) return
    dead = true
    active?.dispose()
    release()
    if (buffer) g.deleteBuffer(buffer)
    if (program) g.deleteProgram(program)
    shaders.forEach((shader) => g.deleteShader(shader))
    canvas.removeEventListener("webglcontextlost", onLost)
    canvas.remove()
    canvas.width = canvas.height = 0
    g.getExtension("WEBGL_lose_context")?.loseContext()
  }
  const onLost = (event: Event) => {
    event.preventDefault()
    lost = true
    canvas.hidden = true
    host.style.visibility = hostVisibility
    onLoss()
  }
  try {
    const compile = (type: number, source: string) => {
      const shader = g.createShader(type)
      if (!shader) throw new Error("Liquid shader unavailable")
      shaders.push(shader)
      g.shaderSource(shader, source)
      g.compileShader(shader)
      if (!g.getShaderParameter(shader, g.COMPILE_STATUS))
        throw new Error(
          g.getShaderInfoLog(shader) ?? "Liquid shader compilation failed",
        )
      return shader
    }
    program = g.createProgram()
    if (!program) throw new Error("Liquid program unavailable")
    g.attachShader(program, compile(g.VERTEX_SHADER, VERTEX))
    const precision = g.getShaderPrecisionFormat(
      g.FRAGMENT_SHADER,
      g.HIGH_FLOAT,
    )
    g.attachShader(
      program,
      compile(
        g.FRAGMENT_SHADER,
        precision?.precision
          ? LIQUID_FRAGMENT
          : LIQUID_FRAGMENT.replace("precision highp", "precision mediump"),
      ),
    )
    g.linkProgram(program)
    if (!g.getProgramParameter(program, g.LINK_STATUS))
      throw new Error("Liquid shader link failed")
    g.useProgram(program)
    buffer = g.createBuffer()
    if (!buffer) throw new Error("Liquid geometry unavailable")
    g.bindBuffer(g.ARRAY_BUFFER, buffer)
    // One oversized triangle covers the viewport without a shared diagonal seam.
    g.bufferData(
      g.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      g.STATIC_DRAW,
    )
    const position = g.getAttribLocation(program, "position")
    g.enableVertexAttribArray(position)
    g.vertexAttribPointer(position, 2, g.FLOAT, false, 0, 0)
    const uniforms = {
      outgoing: g.getUniformLocation(program, "outgoing"),
      incoming: g.getUniformLocation(program, "incoming"),
      size: g.getUniformLocation(program, "size"),
      progress: g.getUniformLocation(program, "progress"),
      opacity: g.getUniformLocation(program, "opacity"),
      direction: g.getUniformLocation(program, "direction"),
      variant: g.getUniformLocation(program, "variant"),
    }
    canvas.dataset.effectCanvas = ""
    canvas.dataset.liquidSurface = ""
    canvas.setAttribute("aria-hidden", "true")
    canvas.style.cssText =
      "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:61"
    canvas.hidden = true
    canvas.addEventListener("webglcontextlost", onLost)
    return {
      start(from, into, options) {
        if (dead || lost) return null
        active?.dispose()
        try {
          const { width, height, variant, direction = 1 } = options
          // Fine 2px artwork needs no Retina oversampling. Cap fill work at 2.4M pixels.
          const scale = Math.min(1, Math.sqrt(2_400_000 / (width * height)))
          canvas.width = Math.max(1, Math.floor(width * scale))
          canvas.height = Math.max(1, Math.floor(height * scale))
          g.viewport(0, 0, canvas.width, canvas.height)
          g.useProgram(program)
          g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, 0)
          g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
          for (const [i, source] of [from, into].entries()) {
            const texture = g.createTexture()
            if (!texture) throw new Error("Liquid texture unavailable")
            textures.push(texture)
            g.activeTexture(g.TEXTURE0 + i)
            g.bindTexture(g.TEXTURE_2D, texture)
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST)
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST)
            g.texImage2D(
              g.TEXTURE_2D,
              0,
              g.RGBA,
              g.RGBA,
              g.UNSIGNED_BYTE,
              source,
            )
            if (g.getError() !== g.NO_ERROR)
              throw new Error("Liquid texture upload failed")
          }
          g.uniform1i(uniforms.outgoing, 0)
          g.uniform1i(uniforms.incoming, 1)
          g.uniform2f(uniforms.size, width, height)
          g.uniform1i(uniforms.variant, SCREEN_VARIANTS.indexOf(variant))
          g.uniform1f(uniforms.direction, direction)
          ;(host.parentElement ?? host.ownerDocument.body).appendChild(canvas)
          canvas.hidden = false
          host.style.visibility = "hidden"
          let disposed = false
          const effect: ScreenTransition = {
            composited: true,
            paint(_ctx, progress) {
              if (disposed || dead || lost) return
              const p = Number.isFinite(progress) ? clamp(progress) : 0
              g.uniform1f(uniforms.progress, p)
              g.uniform1f(uniforms.opacity, screenOpacity(p))
              g.drawArrays(g.TRIANGLES, 0, 3)
            },
            dispose() {
              if (disposed) return
              disposed = true
              canvas.hidden = true
              host.style.visibility = hostVisibility
              release()
              active = null
            },
          }
          active = effect
          return effect
        } catch {
          release()
          canvas.hidden = true
          host.style.visibility = hostVisibility
          // A failed upload cannot leave an opaque overlay blocking the destination.
          return null
        }
      },
      dispose,
    }
  } catch {
    dispose()
    return null
  }
}
