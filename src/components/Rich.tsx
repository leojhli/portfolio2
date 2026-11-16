import type { CSSProperties, ReactNode } from "react"

// Numbers worth a reader's eye: counts, speedups, sizes and rates, with the
// noun that gives them meaning ("372 recordings", "2.70×", "30 FPS").
export const NOUNS =
  "recordings|JSON files|dataset validation checks|columns|passing unit tests|unit tests|Unity tutorials|subscribers|views"
export const METRIC = new RegExp(String.raw`\(?\b\d[\d,.]*(?:k|×|%)?(?:\s?(?:ms|s|FPS|px)\b|\s(?:${NOUNS})\b)?\)?`, "g")

// Named techniques and systems get an underline in the entry's colour.
const TERMS = [
  "Fast Multipole Attention",
  "FlashAttention",
  "online softmax",
  "SLAM system",
  "Qualcomm RB5",
  "Python validation tool",
  "sliding-window segmentation",
  "Orion launch app",
  "MCTS",
  "policy/value CNN",
  "self-play pipeline",
  "WebGL2 pipeline",
  "video-to-ASCII component",
  "browser-local video export",
  "Obsidian plugin",
  "Groq Whisper",
  "Socratic feedback",
  "Llama 3.3",
  "game development YouTube channel",
]
const TERM = new RegExp(TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|"), "g")

/**
 * A line of résumé text with its key numbers highlighted like a marker pen
 * and its named techniques underlined, both in the entry's accent colour.
 */
export default function Rich({ text, accent }: { text: string; accent?: string }) {
  const style = accent ? ({ "--accent": accent } as CSSProperties) : undefined
  const marks: { start: number; end: number; kind: "metric" | "term" }[] = []
  for (const match of text.matchAll(TERM)) marks.push({ start: match.index!, end: match.index! + match[0].length, kind: "term" })
  for (const match of text.matchAll(METRIC)) {
    const value = match[0].trim()
    // Not a metric: a bare year, a lone digit, or one side of "9×9".
    const after = text.slice(match.index! + match[0].length)
    if (!value || /^\d{4}$/.test(value) || /^\d$/.test(value) || /^\d/.test(after)) continue
    const start = match.index! + match[0].indexOf(value)
    const end = start + value.length
    if (marks.some((m) => start < m.end && end > m.start)) continue
    marks.push({ start, end, kind: "metric" })
  }
  marks.sort((a, b) => a.start - b.start)
  const parts: ReactNode[] = []
  let at = 0
  for (const [i, mark] of marks.entries()) {
    if (mark.start > at) parts.push(text.slice(at, mark.start))
    const piece = text.slice(mark.start, mark.end)
    parts.push(
      mark.kind === "metric" ? (
        <mark key={i} className="rs-hl">
          {piece}
        </mark>
      ) : (
        <span key={i} className="rs-term">
          {piece}
        </span>
      ),
    )
    at = mark.end
  }
  if (at < text.length) parts.push(text.slice(at))
  return <span style={style}>{parts}</span>
}
