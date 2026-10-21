import { useRef } from "react"
import { createPool } from "./pool"
import { useStage } from "./useStage"

export default function PoolView({ onFail }: { onFail(): void }) {
  const host = useRef<HTMLDivElement>(null)
  useStage(host, (s, _el, c) => createPool(s, c), [], onFail)
  return (
    <div
      ref={host}
      role="img"
      aria-label="Illustration: a swimmer doing lengths in a pool while a coach watches from the deck"
      className="stage size-full"
    />
  )
}
