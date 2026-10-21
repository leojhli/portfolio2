import type { SVGProps } from "react"

const paths: Record<string, string> = {
  play: "M8 5v14l11-7z",
  pause: "M7 5h4v14H7zM13 5h4v14h-4z",
  prev: "M6 5h2v14H6zM20 5v14L9 12z",
  next: "M16 5h2v14h-2zM4 5v14l11-7z",
  volume: "M4 9v6h4l5 4V5L8 9zM16 8.5a4.5 4.5 0 0 1 0 7",
  close: "M6 6l12 12M18 6L6 18",
  shuffle:
    "M4 7h3c4 0 6 10 10 10h3M4 17h3c1.6 0 2.8-1.6 3.8-3.5M14 9.5C15 8 16 7 17 7h3M18 4l3 3-3 3M18 14l3 3-3 3",
  reset: "M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4",
  palette:
    "M12 3a9 9 0 1 0 0 18c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1 0-.8.7-1.4 1.5-1.4H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8zM7.5 12.5h.01M10 8h.01M14.5 8h.01M17 11.5h.01",
  chevron: "M9 6l6 6-6 6",
  settings:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4",
  arrow: "M7 17L17 7M9 7h8v8",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
}
const filled = new Set(["play", "pause", "prev", "next"])

export default function Icon({
  name,
  size = 18,
  ...rest
}: {
  name: keyof typeof paths | string
  size?: number
} & SVGProps<SVGSVGElement>) {
  const fill = filled.has(name)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  )
}
