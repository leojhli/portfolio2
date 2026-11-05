import * as THREE from "three"
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js"

/** Resolve distant pen strokes in linear light, then gently lift partial coverage. */
export function createCloisterInk(renderer: THREE.WebGLRenderer) {
  const size = new THREE.Vector2()
  let target: THREE.WebGLRenderTarget | undefined
  let disposed = false
  const material = new THREE.ShaderMaterial({
    name: "Cloister aerial ink",
    uniforms: {
      drawing: { value: null as THREE.Texture | null },
      strength: { value: 0 },
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
      uniform float strength;
      varying vec2 vUv;
      void main() {
        vec3 ink = texture2D(drawing, vUv).rgb;
        float value = max(max(ink.r, ink.g), ink.b);
        float fine = 1.0 - smoothstep(0.02, 0.47, value);
        // Work only on the samples this stroke covers. No neighboring pixels
        // are brightened, and a pixel of pure black remains exactly black.
        gl_FragColor = vec4(ink * (1.0 + 0.85 * strength * fine), 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
  const quad = new FullScreenQuad(material)
  function releaseTarget() {
    target?.dispose()
    target = undefined
    material.uniforms.drawing.value = null
  }

  return {
    render(scene: THREE.Scene, camera: THREE.Camera, strength: number) {
      if (disposed) return
      if (!(strength > 0)) {
        if (target) releaseTarget()
        renderer.render(scene, camera)
        return
      }
      renderer.getDrawingBufferSize(size)
      const samples = Math.min(
        renderer.capabilities.maxSamples,
        size.x * size.y > 3_200_000 ? 2 : 4,
      )
      if (!target) {
        target = new THREE.WebGLRenderTarget(size.x, size.y, {
          colorSpace: THREE.LinearSRGBColorSpace,
          minFilter: THREE.NearestFilter,
          magFilter: THREE.NearestFilter,
          samples,
          resolveDepthBuffer: false,
          stencilBuffer: false,
        })
        target.texture.name = "Cloister aerial coverage"
        material.uniforms.drawing.value = target.texture
      } else if (target.width !== size.x || target.height !== size.y) {
        target.samples = samples
        target.setSize(size.x, size.y)
      }
      material.uniforms.strength.value = Math.min(strength, 1)
      const destination = renderer.getRenderTarget()
      try {
        renderer.setRenderTarget(target)
        renderer.render(scene, camera)
      } finally {
        renderer.setRenderTarget(destination)
      }
      quad.render(renderer)
    },
    dispose() {
      if (disposed) return
      disposed = true
      releaseTarget()
      material.dispose()
      quad.dispose()
    },
  }
}
