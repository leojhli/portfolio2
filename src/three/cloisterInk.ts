import * as THREE from "three"
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js"

export type CloisterFilmFrame = {
  motionBlur: number
  deltaSeconds: number
  reset: boolean
  /** Eagle Vision, 0 to 1. Grey ink sinks to blue; gold ink glows. */
  vision?: number
  /** Seconds since Eagle Vision switched on; drives the expanding pulse. */
  pulse?: number
}

/** One current-frame resolve: a short camera shutter in motion, crisp ink at rest. */
export function createCloisterInk(renderer: THREE.WebGLRenderer) {
  const size = new THREE.Vector2()
  const viewport = new THREE.Vector2()
  const viewProjection = new THREE.Matrix4()
  const previousViewProjection = new THREE.Matrix4()
  let target: THREE.WebGLRenderTarget | undefined
  let disposed = false
  let hasPrevious = false
  let previousCamera: THREE.Camera | undefined
  let depthEnabled = false
  const material = new THREE.ShaderMaterial({
    name: "Cloister shutter and aerial ink",
    uniforms: {
      drawing: { value: null as THREE.Texture | null },
      drawingDepth: { value: null as THREE.DepthTexture | null },
      strength: { value: 0 },
      shutter: { value: 0 },
      fallbackDepth: { value: 1 },
      viewport: { value: viewport },
      inverseViewProjection: { value: new THREE.Matrix4() },
      previousViewProjection: { value: previousViewProjection },
      vision: { value: 0 },
      pulse: { value: 10 },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D drawing;
      uniform sampler2D drawingDepth;
      uniform float strength;
      uniform float shutter;
      uniform float fallbackDepth;
      uniform vec2 viewport;
      uniform mat4 inverseViewProjection;
      uniform mat4 previousViewProjection;
      uniform float vision;
      uniform float pulse;
      varying vec2 vUv;
      void main() {
        vec3 ink = texture2D(drawing, vUv).rgb;
        if (shutter > 0.0) {
          float depth = texture2D(drawingDepth, vUv).r;
          // The transparent pen strokes intentionally do not write depth.
          // Use a focal plane for them; solid actor/stone pixels keep real depth.
          if (depth > 0.99999) depth = fallbackDepth;
          vec4 world = inverseViewProjection * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
          vec4 previous = previousViewProjection * world;
          if (previous.w > 0.00001) {
            vec2 oldUv = previous.xy / previous.w * 0.5 + 0.5;
            vec2 velocity = (vUv - oldUv) * shutter;
            vec2 pixels = velocity * viewport;
            float distance = length(pixels);
            // Three CSS pixels at most. The weighted centre retains the contour;
            // current-frame taps cannot leave a ghost from an earlier shot.
            velocity *= min(1.0, 3.0 / max(distance, 0.00001));
            vec2 margin = 0.5 / viewport;
            ink *= 0.72;
            ink += texture2D(drawing, clamp(vUv + velocity * 0.5, margin, 1.0 - margin)).rgb * 0.10;
            ink += texture2D(drawing, clamp(vUv - velocity * 0.5, margin, 1.0 - margin)).rgb * 0.10;
            ink += texture2D(drawing, clamp(vUv + velocity, margin, 1.0 - margin)).rgb * 0.04;
            ink += texture2D(drawing, clamp(vUv - velocity, margin, 1.0 - margin)).rgb * 0.04;
          }
        }
        float value = max(max(ink.r, ink.g), ink.b);
        float fine = 1.0 - smoothstep(0.02, 0.47, value);
        // Work only on the samples this stroke covers. No neighboring pixels
        // are brightened, and a pixel of pure black remains exactly black.
        ink *= 1.0 + 0.85 * strength * fine;
        if (vision > 0.0) {
          // Gold strokes (the runner and his route) carry colour; the rest of
          // the drawing is neutral grey and sinks into a dim blue.
          float chroma = max(max(ink.r, ink.g), ink.b) - min(min(ink.r, ink.g), ink.b);
          float gold = smoothstep(0.08, 0.22, chroma);
          float lum = dot(ink, vec3(0.299, 0.587, 0.114));
          vec3 blue = lum * vec3(0.30, 0.46, 0.82) * 0.62;
          vec3 glow = ink * 1.35 + vec3(0.10, 0.06, 0.0) * gold;
          vec3 graded = mix(blue, glow, gold);
          // A ring sweeps out from the centre as the sense switches on.
          vec2 p = (vUv - 0.5) * vec2(viewport.x / viewport.y, 1.0);
          float ring = exp(-pow((length(p) - pulse * 1.5) * 9.0, 2.0)) * (1.0 - smoothstep(0.4, 1.1, pulse));
          graded += lum * vec3(0.55, 0.75, 1.0) * ring * 2.2 + vec3(0.04, 0.07, 0.12) * ring;
          // A soft vignette pulls the eye to the centre.
          graded *= 1.0 - 0.45 * smoothstep(0.35, 0.95, length(p));
          ink = mix(ink, graded, vision);
        }
        gl_FragColor = vec4(ink, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
  const quad = new FullScreenQuad(material)
  function releaseTarget() {
    target?.dispose()
    target = undefined
    material.uniforms.drawing.value = null
    material.uniforms.drawingDepth.value = null
    depthEnabled = false
  }

  return {
    render(
      scene: THREE.Scene,
      camera: THREE.Camera,
      strength: number,
      frame?: CloisterFilmFrame,
    ) {
      if (disposed) return
      camera.updateMatrixWorld()
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      const requestedBlur = Number.isFinite(frame?.motionBlur)
        ? THREE.MathUtils.clamp(frame!.motionBlur, 0, 1)
        : 0
      const dt = frame?.deltaSeconds ?? 0
      let canBlur = requestedBlur > 0 && hasPrevious && previousCamera === camera
        && !frame?.reset && Number.isFinite(dt) && dt > 0 && dt < 0.1
      const rememberCamera = () => {
        previousViewProjection.copy(viewProjection)
        previousCamera = camera
        hasPrevious = true
      }
      const vision = Number.isFinite(frame?.vision) ? THREE.MathUtils.clamp(frame!.vision!, 0, 1) : 0
      material.uniforms.vision.value = vision
      material.uniforms.pulse.value = Number.isFinite(frame?.pulse) ? frame!.pulse! : 10
      if (!(strength > 0) && !requestedBlur && !(vision > 0)) {
        if (target) releaseTarget()
        renderer.render(scene, camera)
        rememberCamera()
        return
      }
      renderer.getDrawingBufferSize(size)
      renderer.getSize(viewport)
      viewport.set(Math.max(1, viewport.x), Math.max(1, viewport.y))
      const samples = Math.min(
        renderer.capabilities.maxSamples,
        size.x * size.y > 3_200_000 ? 2 : 4,
      )
      const needsDepth = requestedBlur > 0
      if (target && depthEnabled !== needsDepth) releaseTarget()
      if (!target) {
        const depthTexture = needsDepth
          ? new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType)
          : null
        target = new THREE.WebGLRenderTarget(size.x, size.y, {
          colorSpace: THREE.LinearSRGBColorSpace,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          samples,
          depthTexture,
          resolveDepthBuffer: needsDepth,
          stencilBuffer: false,
        })
        depthEnabled = needsDepth
        target.texture.name = "Cloister current-frame drawing"
        if (depthTexture) depthTexture.name = "Cloister current-frame depth"
        material.uniforms.drawing.value = target.texture
        material.uniforms.drawingDepth.value = depthTexture
      } else if (target.width !== size.x || target.height !== size.y) {
        target.samples = samples
        target.setSize(size.x, size.y)
        canBlur = false
      }
      material.uniforms.strength.value = Number.isFinite(strength)
        ? THREE.MathUtils.clamp(strength, 0, 1)
        : 0
      material.uniforms.inverseViewProjection.value.copy(viewProjection).invert()
      // A fixed exposure rather than a fixed previous-frame contribution keeps
      // the streak consistent at 30, 60 or 120 fps. Cuts never share exposure.
      material.uniforms.shutter.value = canBlur ? requestedBlur / (110 * dt) : 0
      const projection = camera.projectionMatrix.elements
      material.uniforms.fallbackDepth.value =
        ((projection[10] * -8 + projection[14]) / (projection[11] * -8 + projection[15])) * 0.5 + 0.5
      const destination = renderer.getRenderTarget()
      try {
        renderer.setRenderTarget(target)
        renderer.render(scene, camera)
      } finally {
        renderer.setRenderTarget(destination)
      }
      quad.render(renderer)
      rememberCamera()
    },
    dispose() {
      if (disposed) return
      disposed = true
      hasPrevious = false
      releaseTarget()
      material.dispose()
      quad.dispose()
    },
  }
}
