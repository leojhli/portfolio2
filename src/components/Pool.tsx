import { lazy, Suspense, useState, type CSSProperties } from "react"
import { usePrefs } from "../state/preferences"

const PoolView = lazy(() => import("../three/PoolView"))

/** Static stand-in when WebGL is unavailable: four lanes with palette ropes. */
function FlatPool() {
  return (
    <div
      role="img"
      aria-label="Illustration: a four-lane swimming pool"
      className="absolute inset-6 grid grid-rows-4 overflow-hidden rounded-lg border-[1.5px] border-fg bg-v1"
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`relative ${
            i ? "border-t-[3px] border-dotted border-paper" : ""
          }`}
        >
          {i === 1 && (
            <span className="absolute left-[38%] top-1/2 size-4 -translate-y-1/2 rounded-full border-[1.5px] border-fg bg-accent-fill" />
          )}
        </span>
      ))}
    </div>
  )
}

export default function Pool() {
  const { motion } = usePrefs()
  const [failed, setFailed] = useState(false)
  return (
    <figure
      className="card m-0 overflow-hidden"
      style={{ "--hover": "var(--c-v2)" } as CSSProperties}
    >
      <div data-fx className="relative aspect-[4/3] max-h-[50vh] w-full">
        {failed ? (
          <FlatPool />
        ) : (
          <Suspense fallback={null}>
            <PoolView onFail={() => setFailed(true)} />
          </Suspense>
        )}
      </div>
      <figcaption className="flex items-center justify-between gap-3 border-t-[1.5px] border-fg px-5 py-3 font-sans text-xs">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="palette-strip h-2.5 w-8 rounded-sm border border-fg"
          />{" "}
          Lane 2 · 25m freestyle
        </span>
        <span className="text-muted">
          {motion ? "on the clock" : "paused · motion off"}
        </span>
      </figcaption>
    </figure>
  )
}
