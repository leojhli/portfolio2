import { useEffect, useRef, useState } from "react"
import { getContent } from "../content/data"
import "../pickems.css"

type Match = { a: string; b: string; sa: number; sb: number; points: number }

// Layout in SVG units. Three rounds left to right; each match is a two-row card.
const W = 640
const H = 384
const CARD_W = 128
const ROW = 22
const COL_X = [8, 256, 504]

/**
 * A Worlds Pick'em bracket drawn in the site's ink: thin pale lines on black,
 * team names in the mono face, and the favourite team's run traced in gold.
 * The lines draw themselves in when the bracket comes into view, and the
 * score counts up beside it.
 */
export default function PickemBracket({ variant = "page" }: { variant?: "page" | "overlay" }) {
  const p = getContent().pickems
  const host = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(variant === "overlay")
  const [score, setScore] = useState(0)
  const [hover, setHover] = useState<string | null>(null)

  useEffect(() => {
    if (shown) return
    const element = host.current
    if (!element || typeof IntersectionObserver === "undefined") {
      setShown(true)
      return
    }
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true)
          seen.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    seen.observe(element)
    return () => seen.disconnect()
  }, [shown])

  useEffect(() => {
    if (!shown) return
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (still) {
      setScore(p.score)
      return
    }
    let frame = 0
    const start = performance.now() + 500
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 1600))
      setScore(Math.round(p.score * (1 - (1 - t) ** 3)))
      if (t < 1) frame = window.requestAnimationFrame(step)
    }
    frame = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(frame)
  }, [shown, p.score])

  const rounds: Match[][] = p.rounds.map((round) => round.matches)
  // Vertical centre of each match: the first round is evenly spaced, and
  // every later match sits midway between the two it follows.
  const centres: number[][] = [rounds[0].map((_, i) => 58 + i * ((H - 92) / (rounds[0].length - 1)))]
  for (let r = 1; r < rounds.length; r++)
    centres.push(rounds[r].map((_, i) => (centres[r - 1][i * 2] + centres[r - 1][i * 2 + 1]) / 2))

  const winner = (m: Match) => (m.sa > m.sb ? m.a : m.b)
  const fav = p.favourite
  const lines: { d: string; gold: boolean; delay: number }[] = []
  rounds.forEach((round, r) => {
    if (r === 0) return
    round.forEach((match, i) => {
      for (const k of [0, 1]) {
        const from = rounds[r - 1][i * 2 + k]
        const y0 = centres[r - 1][i * 2 + k]
        const y1 = centres[r][i] + (k === 0 ? -ROW / 2 : ROW / 2)
        const x0 = COL_X[r - 1] + CARD_W
        const x1 = COL_X[r]
        const mid = (x0 + x1) / 2
        lines.push({
          d: `M${x0} ${y0} H${mid} V${y1} H${x1}`,
          gold: winner(from) === fav && [match.a, match.b].includes(fav),
          delay: 0.35 + r * 0.45,
        })
      }
    })
  })

  return (
    <figure
      ref={host}
      className="pk"
      data-variant={variant}
      data-shown={shown}
      aria-label={`${p.event}: ${p.score} of ${p.max} points, every pick correct. ${fav} won the title.`}
    >
      <figcaption className="pk-head">
        <span className="pk-event">{p.event}</span>
        <span className="pk-score">
          <b>{score}</b>
          <span> / {p.max}</span>
        </span>
        <span className="pk-badge">{score === p.max ? "Perfect" : " "}</span>
      </figcaption>
      <div className="pk-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} className="pk-svg" role="presentation">
        {p.rounds.map((round, r) => (
          <text key={round.name} className="pk-round" x={COL_X[r]} y={10}>
            {round.name.toUpperCase()} · {round.matches[0].points} PTS
          </text>
        ))}
        {lines.map((line, i) => (
          <path
            key={i}
            d={line.d}
            pathLength={1}
            className={line.gold ? "pk-line pk-gold" : "pk-line"}
            style={{ animationDelay: `${line.delay}s` }}
          />
        ))}
        {rounds.map((round, r) =>
          round.map((match, i) => {
            const y = centres[r][i] - ROW
            const id = `${r}-${i}`
            const won = winner(match)
            const delay = 0.15 + r * 0.45 + i * 0.06
            return (
              <g
                key={id}
                className="pk-match"
                style={{ animationDelay: `${delay}s` }}
                onPointerEnter={() => setHover(id)}
                onPointerLeave={() => setHover(null)}
              >
                <rect x={COL_X[r]} y={y} width={CARD_W} height={ROW * 2} rx={4} className="pk-card" />
                <line x1={COL_X[r]} x2={COL_X[r] + CARD_W} y1={y + ROW} y2={y + ROW} className="pk-divider" />
                {([
                  [match.a, match.sa],
                  [match.b, match.sb],
                ] as const).map(([team, games], k) => {
                  const isWinner = team === won
                  const gold = isWinner && team === fav
                  return (
                    <g key={team} className={gold ? "pk-row pk-row-gold" : isWinner ? "pk-row pk-row-win" : "pk-row"}>
                      <text x={COL_X[r] + 10} y={y + ROW * k + 15}>
                        {team}
                      </text>
                      {isWinner && (
                        <text x={COL_X[r] + CARD_W - 32} y={y + ROW * k + 15} className="pk-tick">
                          ✓
                        </text>
                      )}
                      <text x={COL_X[r] + CARD_W - 12} y={y + ROW * k + 15} textAnchor="end" className="pk-games">
                        {games}
                      </text>
                    </g>
                  )
                })}
                <text
                  x={COL_X[r] + CARD_W / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="pk-points"
                  data-on={hover === id}
                >
                  +{match.points} · called {won}
                </text>
              </g>
            )
          }),
        )}
        <g className="pk-crown" style={{ animationDelay: "1.7s" }}>
          <text x={COL_X[2] + CARD_W} y={centres[2][0] + ROW + 30} textAnchor="end">
            {fav} · WORLD CHAMPIONS
          </text>
        </g>
      </svg>
      </div>
      {p.verifyUrl && (
        <a className="pk-verify" href={p.verifyUrl} target="_blank" rel="noreferrer">
          See it on {p.verifyLabel ?? "the Pick'em site"} ↗
        </a>
      )}
    </figure>
  )
}
