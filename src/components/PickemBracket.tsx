import { useEffect, useRef, useState } from "react"
import { getContent } from "../content/data"
import "../pickems.css"

type Match = { a: string; b: string; sa: number; sb: number; points: number }

// Layout in SVG units. Three rounds left to right; each match is a two-row card
// with a points chip on the left of the winning row.
const W = 690
const H = 404
const CARD_W = 150
const ROW = 27
const COL_X = [38, 278, 518]
const logo = (team: string) => `/teams/${team}.webp`

/**
 * The Worlds Pick'em bracket in the site's ink: team logos, scores in the
 * mono face, a points chip for every correct pick, and the favourite team's
 * run traced in gold. It draws itself in when it comes into view, and the
 * score counts up. Below it, the prediction-market bet on the same run.
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
      { threshold: 0.3 },
    )
    seen.observe(element)
    return () => seen.disconnect()
  }, [shown])

  useEffect(() => {
    if (!shown) return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
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
  const centres: number[][] = [rounds[0].map((_, i) => 62 + i * ((H - 100) / (rounds[0].length - 1)))]
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
        const fromRow = from.sa > from.sb ? 0 : 1
        const y0 = centres[r - 1][i * 2 + k] - ROW / 2 + fromRow * ROW
        const y1 = centres[r][i] + (k === 0 ? -ROW / 2 : ROW / 2)
        const x0 = COL_X[r - 1] + CARD_W
        const x1 = COL_X[r] - 40
        const mid = (x0 + x1) / 2
        lines.push({
          d: `M${x0} ${y0} H${mid} V${y1} H${x1}`,
          gold: winner(from) === fav && [match.a, match.b].includes(fav),
          delay: 0.35 + r * 0.45,
        })
      }
    })
  })

  const bet = p.bet
  const roi = bet ? Math.round((bet.profit / (bet.payout - bet.profit)) * 100) : 0

  return (
    <figure
      ref={host}
      className="pk"
      data-variant={variant}
      data-shown={shown}
      aria-label={`${p.event}: ${p.score} of ${p.max} knockout points, every pick correct. ${fav} won the title.`}
    >
      <figcaption className="pk-head">
        <div className="pk-title">
          <span className="pk-event">{p.event}</span>
          <span className="pk-meta">
            {p.handle} · {p.rank} · {p.total} pts overall
          </span>
        </div>
        <div className="pk-tally">
          <span className="pk-score">
            <b>{score}</b>
            <span> / {p.max}</span>
          </span>
          <span className="pk-badge">Perfect knockouts</span>
        </div>
      </figcaption>

      <div className="pk-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="pk-svg" role="presentation">
          <defs>
            <linearGradient id="pk-gold-fill" x1="0" x2="1">
              <stop offset="0" stopColor="var(--pk-gold)" stopOpacity=".26" />
              <stop offset="1" stopColor="var(--pk-gold)" stopOpacity=".06" />
            </linearGradient>
            <filter id="pk-glow" x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          {p.rounds.map((round, r) => (
            <g key={round.name} className="pk-round">
              <text x={COL_X[r]} y={10}>{round.name.toUpperCase()}</text>
              <text x={COL_X[r]} y={23} className="pk-round-pts">
                {round.matches[0].points} PTS / PICK
              </text>
            </g>
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
              const top = centres[r][i] - ROW
              const x = COL_X[r]
              const id = `${r}-${i}`
              const won = winner(match)
              const final = r === rounds.length - 1
              const delay = 0.15 + r * 0.45 + i * 0.06
              return (
                <g
                  key={id}
                  className={final ? "pk-match pk-final" : "pk-match"}
                  style={{ animationDelay: `${delay}s` }}
                  onPointerEnter={() => setHover(id)}
                  onPointerLeave={() => setHover(null)}
                >
                  {final && (
                    <rect x={x - 6} y={top - 6} width={CARD_W + 12} height={ROW * 2 + 12} rx={10} className="pk-halo" filter="url(#pk-glow)" />
                  )}
                  <rect x={x} y={top} width={CARD_W} height={ROW * 2} rx={6} className="pk-card" />
                  {([
                    [match.a, match.sa],
                    [match.b, match.sb],
                  ] as const).map(([team, games], k) => {
                    const isWinner = team === won
                    const gold = isWinner && team === fav
                    const y = top + ROW * k
                    return (
                      <g key={team} className={gold ? "pk-row pk-row-gold" : isWinner ? "pk-row pk-row-win" : "pk-row pk-row-lose"}>
                        {isWinner && (
                          <rect
                            x={x + 1}
                            y={y + (k === 0 ? 1 : 0)}
                            width={CARD_W - 2}
                            height={ROW - 1}
                            className="pk-win-fill"
                            fill={gold ? "url(#pk-gold-fill)" : undefined}
                          />
                        )}
                        <image href={logo(team)} x={x + 9} y={y + 5} width={17} height={17} className="pk-logo" />
                        <text x={x + 34} y={y + 18} className="pk-team">
                          {team}
                        </text>
                        {isWinner && (
                          <g className="pk-check">
                            <circle cx={x + CARD_W - 40} cy={y + ROW / 2} r={6.5} />
                            <path d={`M${x + CARD_W - 43} ${y + ROW / 2} l2.2 2.3 l4.2 -4.6`} />
                          </g>
                        )}
                        <line x1={x + CARD_W - 26} x2={x + CARD_W - 26} y1={y + 4} y2={y + ROW - 4} className="pk-sep" />
                        <text x={x + CARD_W - 13} y={y + 18} textAnchor="middle" className="pk-games">
                          {games}
                        </text>
                        {isWinner && (
                          <g className="pk-chip">
                            <rect x={x - 34} y={y + 6} width={29} height={ROW - 12} rx={4} />
                            <text x={x - 19.5} y={y + 17.5} textAnchor="middle">
                              +{match.points}
                            </text>
                          </g>
                        )}
                      </g>
                    )
                  })}
                  <line x1={x} x2={x + CARD_W} y1={top + ROW} y2={top + ROW} className="pk-divider" />
                  <text x={x + CARD_W / 2} y={top - 6} textAnchor="middle" className="pk-points" data-on={hover === id}>
                    picked {won} · +{match.points}
                  </text>
                </g>
              )
            }),
          )}
          <g className="pk-crown" style={{ animationDelay: "1.7s" }}>
            <path
              d={`M${COL_X[2] + 2} ${centres[2][0] + ROW + 30} l4 -9 l5 6 l4 -8 l4 8 l5 -6 l4 9 z`}
              className="pk-trophy"
            />
            <text x={COL_X[2] + 34} y={centres[2][0] + ROW + 30}>
              WORLD CHAMPIONS
            </text>
          </g>
        </svg>
      </div>

      {bet && (
        <div className="pk-bet">
          <div className="pk-bet-copy">
            <span className="pk-bet-kicker">And I put money on it</span>
            <span className="pk-bet-market">{bet.market}</span>
            <span className="pk-bet-detail">
              {bet.shares} {bet.outcome} at {bet.price}¢ · stake ${(bet.payout - bet.profit).toFixed(2)} · paid $
              {bet.payout.toFixed(2)}
            </span>
          </div>
          <div className="pk-bet-odds" aria-hidden="true">
            <span className="pk-odds-from">{bet.price}¢</span>
            <span className="pk-odds-track">
              <i style={{ left: `${bet.price}%` }} />
            </span>
            <span className="pk-odds-to">$1</span>
          </div>
          <div className="pk-bet-result">
            <b>+${bet.profit.toFixed(2)}</b>
            <span>+{roi}%</span>
          </div>
        </div>
      )}

      {(p.verifyUrl || bet?.url) && (
        <p className="pk-proof">
          Verify:{" "}
          {p.verifyUrl && (
            <a href={p.verifyUrl} target="_blank" rel="noreferrer">
              Pick'em bracket on LoL Esports ↗
            </a>
          )}
          {bet?.url && (
            <a href={bet.url} target="_blank" rel="noreferrer">
              Polymarket profile ↗
            </a>
          )}
        </p>
      )}
    </figure>
  )
}
