import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"

const AsciiPreview = lazy(() => import("./AsciiPreview"))

export type PreviewSpec =
  | { kind: "image"; src: string; caption?: string }
  | { kind: "logo"; src: string; caption?: string }
  | { kind: "video"; src: string; poster?: string; caption?: string }
  | { kind: "ascii"; src: string; caption?: string }

const SIZE: Record<PreviewSpec["kind"], [number, number]> = {
  image: [248, 155],
  logo: [150, 150],
  video: [200, 280],
  ascii: [288, 162],
}

/**
 * A link that shows a small preview card while the pointer rests on it: a
 * screenshot of the page, a logo, or a clip. The card sits above the link
 * (below when there is no room) and leans toward the pointer.
 */
export default function PreviewLink({
  href,
  preview,
  className,
  style,
  children,
}: {
  href: string
  preview?: PreviewSpec
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const anchor = useRef<HTMLAnchorElement>(null)
  const [card, setCard] = useState<{ x: number; y: number; below: boolean; lean: number } | null>(null)
  const external = /^https?:/.test(href)
  // Load the picture ahead of time so the card is never empty when it opens.
  useEffect(() => {
    if (preview && (preview.kind === "image" || preview.kind === "logo")) new Image().src = preview.src
  }, [preview])
  const link = (
    <a
      ref={anchor}
      className={className}
      style={style}
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      onMouseEnter={(event) => place(event.clientX)}
      onMouseMove={(event) => place(event.clientX)}
      onMouseLeave={() => setCard(null)}
      onFocus={() => place()}
      onBlur={() => setCard(null)}
    >
      {children}
    </a>
  )
  if (!preview) return link
  const [width, height] = SIZE[preview.kind]
  const total = height + (preview.caption ? 26 : 0) + 10

  function place(pointerX?: number) {
    const element = anchor.current
    if (!element || !preview) return
    // Touch screens have no hover; the link simply opens.
    if (pointerX !== undefined && window.matchMedia?.("(hover: none)").matches) return
    const box = element.getBoundingClientRect()
    const centre = box.left + box.width / 2
    const below = box.top < total + 20
    const x = Math.min(window.innerWidth - width / 2 - 12, Math.max(width / 2 + 12, centre))
    // Half the pointer's offset from the link's centre, as on the reference site.
    const lean = pointerX === undefined ? 0 : Math.max(-60, Math.min(60, (pointerX - centre) / 2))
    setCard({ x, y: below ? box.bottom + 10 : box.top - 10, below, lean })
  }

  return (
    <span className="pv-wrap">
      {link}
      {card && (
        <span
          className="pv-card"
          data-kind={preview.kind}
          data-below={card.below}
          aria-hidden="true"
          style={
            {
              left: card.x,
              top: card.y,
              width,
              "--lean": `${card.lean}px`,
            } as CSSProperties
          }
        >
          <span className="pv-frame" style={{ height }}>
            {preview.kind === "image" && <img src={preview.src} alt="" width={width} height={height} />}
            {preview.kind === "logo" && <img src={preview.src} alt="" width={width} height={height} />}
            {preview.kind === "video" && (
              <video src={preview.src} poster={preview.poster} muted loop playsInline autoPlay />
            )}
            {preview.kind === "ascii" && (
              <Suspense fallback={null}>
                <AsciiPreview src={preview.src} />
              </Suspense>
            )}
          </span>
          {preview.caption && <span className="pv-caption">{preview.caption}</span>}
        </span>
      )}
    </span>
  )
}
