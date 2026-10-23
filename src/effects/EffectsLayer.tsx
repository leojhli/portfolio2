import { useEffect } from "react"
import { connectEffects } from "./coordinator"
import { createRenderer } from "./renderer"

/** Imperative canvas lifetime is separate from React and the persistent media tree. */
export default function EffectsLayer() {
  useEffect(() => {
    const canvas = document.createElement("canvas")
    canvas.setAttribute("aria-hidden", "true")
    canvas.dataset.effectCanvas = ""
    canvas.style.cssText =
      "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;image-rendering:pixelated;z-index:60"
    document.body.appendChild(canvas)
    const renderer = createRenderer(canvas)
    const disconnect = connectEffects(renderer)
    return () => {
      disconnect()
      renderer.dispose()
      canvas.remove()
    }
  }, [])
  return null
}
