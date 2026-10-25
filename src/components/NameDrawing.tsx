import { useEffect, useId, useRef, useState } from "react"
import li from "../assets/name/li.json"
import jia from "../assets/name/jia.json"
import he from "../assets/name/he.json"
import { heroInkProgress } from "../effects/signature"
import { usePrefs } from "../state/preferences"

const characters = [li, jia, he]
// Original cursive lettering, following the pen rather than tracing glyph edges.
const englishStrokes = [
  "M75 122 C150 105 185 25 143 30 C110 33 107 137 67 177 C40 202 20 170 57 163 C96 153 126 185 164 169 C191 151 205 129 187 127 C157 126 151 179 183 178 C206 177 225 151 230 138 C209 125 199 169 222 176 C251 185 272 138 250 132 C234 122 226 142 238 148 C250 155 275 143 285 135",
  "M375 122 C450 105 485 25 443 30 C410 33 407 137 367 177 C340 202 320 170 357 163 C396 153 426 185 464 169 C480 159 490 135 494 127 L480 161 Q472 184 499 174 L526 151",
  "M502 102 L503 99",
]

export default function NameDrawing() {
  const id = useId().replace(/:/g, "")
  const { mode } = usePrefs()
  const host = useRef<HTMLButtonElement>(null)
  const pointerFocus = useRef(false)
  const [chinese, setChinese] = useState(false)
  const [replay, setReplay] = useState(0)
  useEffect(() => {
    const el = host.current
    if (!el || mode === "ascii") return
    const strokes = [...el.querySelectorAll<SVGPathElement>("[data-ink-start]")]
    let raf = 0, last = 0, elapsed = 0
    let previousScroll = window.scrollY
    let replaying = replay > 0
    const paint = (progress: number) => {
      el.style.setProperty("--signature-progress", String(progress))
      el.dataset.started = String(progress > 0)
      el.dataset.complete = String(progress >= 1)
      strokes.forEach(stroke => {
        const start = Number(stroke.dataset.inkStart)
        const end = Number(stroke.dataset.inkEnd)
        const local = Math.max(0, Math.min(1, (progress - start) / (end - start)))
        stroke.style.strokeDashoffset = String(1 - local)
        stroke.style.opacity = local > 0 ? "1" : "0"
      })
    }
    const tick = (now: number) => {
      raf = 0
      if (document.hidden) { last = 0; return }
      elapsed += last ? Math.min(64, now - last) : 0
      last = now
      const progress = Math.min(1, elapsed / 3000)
      paint(progress)
      if (progress < 1) raf = requestAnimationFrame(tick)
      else replaying = false
    }
    const frame = (event: Event) => {
      const detail = (event as CustomEvent<{ heroProgress: number }>).detail
      // An explicit replay owns the ink until the visitor actually scrolls.
      if (replaying && window.scrollY === previousScroll) return
      previousScroll = window.scrollY
      replaying = false
      cancelAnimationFrame(raf)
      paint(heroInkProgress(detail.heroProgress))
    }
    const visibility = () => {
      cancelAnimationFrame(raf)
      last = 0
      if (!document.hidden && replaying) raf = requestAnimationFrame(tick)
    }
    paint(replaying ? 0 : heroInkProgress(window.scrollY / innerHeight))
    if (replaying) raf = requestAnimationFrame(tick)
    addEventListener("portfolio:frame", frame)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener("portfolio:frame", frame)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [chinese, replay, mode])
  if (mode === "ascii") return <>Leo Li<span className="hero-period">.</span><span className="sr-only"> / 李嘉和</span></>
  const show = (value: boolean) => {
    setChinese(value)
    setReplay(n => n + 1)
  }
  return (
    <>
    <button
      ref={host}
      type="button"
      className="name-drawing"
      aria-label="Leo Li — show or replay handwritten Chinese name"
      aria-pressed={chinese}
      aria-describedby={`${id}-hint`}
      data-language={chinese ? "chinese" : "english"}
      onPointerEnter={event => { if (event.pointerType === "mouse") show(true) }}
      onPointerLeave={event => { if (event.pointerType === "mouse" && document.activeElement !== event.currentTarget) show(false) }}
      onPointerDown={() => { pointerFocus.current = true }}
      onFocus={() => { if (!pointerFocus.current) show(true) }}
      onBlur={() => { pointerFocus.current = false; show(false) }}
      onClick={() => { pointerFocus.current = false; show(!chinese) }}
      onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); show(false) } }}
    >
      <span className="sr-only">Leo Li / 李嘉和</span>
      <span className="name-drawing-art" key={`${chinese}-${replay}`} aria-hidden="true">
        {chinese ? (
          <span className="chinese-name-lettering">
            {characters.map((character, index) => (
              <svg key={index} viewBox="0 0 1024 1024" data-character={"李嘉和"[index]}>
                <g transform="translate(0 900) scale(1 -1)">
                  {character.strokes.map((outline, stroke) => {
                    const clip = `${id}-${index}-${stroke}`
                    return (
                      <g key={stroke}>
                        <defs><clipPath id={clip}><path d={outline} /></clipPath></defs>
                        <path
                          className="name-pen-stroke"
                          clipPath={`url(#${clip})`}
                          d={character.medians[stroke].map(([x, y], point) => `${point ? "L" : "M"}${x} ${y}`).join(" ")}
                          pathLength="1"
                          data-ink-start={stroke / character.strokes.length}
                          data-ink-end={(stroke + 1) / character.strokes.length}
                        />
                      </g>
                    )
                  })}
                </g>
              </svg>
            ))}
          </span>
        ) : (
          <svg className="english-name-lettering" viewBox="0 0 560 230">
            {englishStrokes.map((d, index) => (
              <path key={index} d={d} className="english-pen-stroke" pathLength="1"
                data-ink-start={[0, .52, .95][index]} data-ink-end={[.52, .95, 1][index]} />
            ))}
          </svg>
        )}
      </span>
      <span className="name-drawing-hint" id={`${id}-hint`} aria-hidden="true">
        {chinese ? "Tap to write in English" : "Scroll to write · hover for Chinese"}
      </span>
    </button>
    <button type="button" className="name-replay" onClick={() => setReplay(n => n + 1)}>Replay writing</button>
    </>
  )
}
