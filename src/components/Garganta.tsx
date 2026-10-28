import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { useAudio } from "../state/audio"
import { usePrefs } from "../state/preferences"
import { getContent } from "../content/data"
import { spiritStops } from "../content/spiritWorld"
import { playDistrictAmbience } from "../effects/districtAmbience"
import { cancelEffects } from "../effects/coordinator"

const SpiritWorldView = lazy(() => import("../three/RainDistrictView"))
const content = getContent()
const ARRIVAL_MS = 700

export default function Garganta() {
  const audio = useAudio()
  const { mode } = usePrefs()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const restoreMusic = useRef<(() => void) | null>(null)
  const stopAmbience = useRef<(() => void) | null>(null)
  const lastLookUnlock = useRef(-Infinity)
  const timer = useRef(0)
  const savedOverflow = useRef("")
  const active = useRef(false)
  const [open, setOpen] = useState(false)
  const [entered, setEntered] = useState(false)
  const [selected, setSelected] = useState(-1)
  const [focusKey, setFocusKey] = useState(0)
  const [ambience, setAmbience] = useState(true)

  useEffect(() => {
    const unlock = () => {
      lastLookUnlock.current = performance.now()
    }
    window.addEventListener("portfolio:look-unlocked", unlock)
    return () => window.removeEventListener("portfolio:look-unlocked", unlock)
  }, [])

  const select = (index: number) => {
    setSelected(index)
    setFocusKey((value) => value + 1)
  }

  const close = () => {
    if (!active.current) return
    active.current = false
    clearTimeout(timer.current)
    stopAmbience.current?.()
    stopAmbience.current = null
    if (document.pointerLockElement) document.exitPointerLock?.()
    dialog.current?.close()
    document.documentElement.style.overflow = savedOverflow.current
    delete document.documentElement.dataset.spiritWorld
    dispatchEvent(new Event("portfolio:world"))
    setOpen(false)
    restoreMusic.current?.()
    restoreMusic.current = null
    trigger.current?.focus({ preventScroll: true })
  }

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      stopAmbience.current?.()
      if (active.current) {
        if (document.pointerLockElement) document.exitPointerLock?.()
        document.documentElement.style.overflow = savedOverflow.current
        delete document.documentElement.dataset.spiritWorld
        dispatchEvent(new Event("portfolio:world"))
      }
      restoreMusic.current?.()
    },
    [],
  )

  const enter = () => {
    if (active.current) return
    active.current = true
    cancelEffects()
    savedOverflow.current = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"
    document.documentElement.dataset.spiritWorld = "true"
    dispatchEvent(new Event("portfolio:world"))
    restoreMusic.current = audio.suspend()
    setSelected(-1)
    setEntered(false)
    setOpen(true)
    dialog.current?.showModal()
    let enabled = true
    try {
      enabled = localStorage.getItem("pf.sound") !== "off"
    } catch {
      /* Storage can be unavailable; keep the normal sound default. */
    }
    setAmbience(enabled)
    if (enabled) stopAmbience.current = playDistrictAmbience()
    timer.current = window.setTimeout(() => setEntered(true), ARRIVAL_MS)
  }

  const arrive = () => {
    clearTimeout(timer.current)
    setEntered(true)
  }
  const stop = spiritStops[selected]

  return (
    <>
      <div className="district-discovery">
        <span className="eyebrow">One more place to get lost.</span>
        <button
          ref={trigger}
          type="button"
          className="district-trigger"
          data-world-trigger
          aria-label="Enter Rain District"
          aria-haspopup="dialog"
          onClick={enter}
        >
          <span className="district-ticket" aria-hidden="true">
            {mode === "ascii" ? (
              <pre className="district-ticket-ascii">{`+--------------------+
|  / /  RAIN DISTRICT |
| / /   NIGHT PASS   |
|      [ 01 -> 04 ]  |
+--------------------+`}</pre>
            ) : (
              <svg viewBox="0 0 312 176" fill="none">
                <path
                  className="district-ticket-face"
                  d="M12 1H300L311 12V67C295 67 295 91 311 91V164L300 175H12L1 164V91C17 91 17 67 1 67V12Z"
                />
                <path
                  className="district-ticket-border"
                  d="M19 16H293V160H19Z"
                />
                <path className="district-ticket-perforation" d="M224 17V159" />
                <path
                  className="district-ticket-line"
                  d="M35 133H71L95 109H144L169 84H204M35 141H75L99 117H148L173 92H204"
                />
                <circle
                  className="district-ticket-stop"
                  cx="95"
                  cy="109"
                  r="4"
                />
                <circle
                  className="district-ticket-stop"
                  cx="169"
                  cy="84"
                  r="4"
                />
                <text className="district-ticket-hanzi" x="33" y="82">
                  雨巷
                </text>
                <text className="district-ticket-caption" x="36" y="100">
                  AFTER HOURS / 夜行
                </text>
                <text className="district-ticket-number" x="240" y="49">
                  04
                </text>
                <path
                  className="district-ticket-barcode"
                  d="M241 76V137M245 76V137M252 76V137M260 76V137M264 76V137M272 76V137"
                />
                <text className="district-ticket-small" x="240" y="150">
                  ONE WAY IN
                </text>
              </svg>
            )}
          </span>
          <span className="district-caption">
            <span>RAIN DISTRICT</span>
            <span>A city after hours. Come wander.</span>
            <span className="district-enter">
              Enter the district <span aria-hidden="true">↗</span>
            </span>
          </span>
        </button>
        <p>Rain on concrete. Tea still warm. The last tram hasn’t left.</p>
      </div>
      <dialog
        ref={dialog}
        className="garganta"
        aria-labelledby="district-title"
        data-entered={entered}
        onCancel={(event) => {
          event.preventDefault()
          if (
            document.pointerLockElement ||
            performance.now() - lastLookUnlock.current < 250
          ) {
            document.exitPointerLock?.()
            return
          }
          close()
        }}
      >
        {open && (
          <>
            <div className="spirit-world-viewport">
              <Suspense
                fallback={
                  <div className="spirit-loading" role="status">
                    <span lang="zh">雨巷</span>Arriving in Rain District…
                  </div>
                }
              >
                <SpiritWorldView
                  selected={selected}
                  focusKey={focusKey}
                  onSelect={select}
                  active={entered}
                />
              </Suspense>
            </div>
            <div className="district-arrival" aria-hidden="true" />
            <header className="spirit-header">
              <div>
                <p className="spirit-eyebrow">
                  <span lang="zh">雨巷</span> / AFTER HOURS
                </p>
                <h2 id="district-title">Rain District</h2>
                <p>Four addresses. No wrong turns.</p>
              </div>
              <button
                type="button"
                className="spirit-button"
                onClick={close}
                autoFocus
                aria-label="Return to portfolio"
              >
                Return ↗
              </button>
            </header>
            {!entered && (
              <button
                type="button"
                className="spirit-skip spirit-button"
                onClick={arrive}
              >
                Skip arrival
              </button>
            )}
            <div className="spirit-toolbar">
              <button
                type="button"
                className="spirit-button"
                onClick={() => select(-1)}
              >
                Reset view
              </button>
              <span>Take the long way home.</span>
              <button
                type="button"
                className="spirit-button"
                aria-pressed={ambience}
                onClick={() => {
                  stopAmbience.current?.()
                  stopAmbience.current = ambience
                    ? null
                    : playDistrictAmbience()
                  setAmbience(!ambience)
                }}
              >
                Ambience: {ambience ? "On" : "Off"}
              </button>
            </div>
            <nav className="spirit-locations" aria-label="District locations">
              {spiritStops.map((place, i) => (
                <button
                  type="button"
                  key={place.id}
                  aria-pressed={selected === i}
                  onClick={() => {
                    select(i)
                    arrive()
                  }}
                >
                  <span>0{i + 1}</span>
                  {place.name}
                  <small>{place.id}</small>
                </button>
              ))}
            </nav>
            {stop && (
              <aside
                className="spirit-note"
                aria-label={`${stop.name} details`}
              >
                <button
                  type="button"
                  className="spirit-note-close"
                  aria-label="Close location details"
                  onClick={() => setSelected(-1)}
                >
                  ×
                </button>
                <p className="spirit-eyebrow">
                  <span lang="zh">{stop.character}</span> / {stop.id}
                </p>
                <h3>{stop.name}</h3>
                <p className="spirit-note-lead">{stop.subtitle}</p>
                <p className="spirit-note-quote">{stop.note}</p>
                {stop.id === "experience" && (
                  <ul>
                    {content.experience.map((item) => (
                      <li key={item.id}>
                        <strong>{item.role}</strong>
                        <span>
                          {item.organization} · {item.dates}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {stop.id === "projects" && (
                  <ul>
                    {content.projects.map((item) => (
                      <li key={item.id}>
                        <strong>{item.title}</strong>
                        <span>{item.summary}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {stop.id === "about" && <p>{content.beyond.intro}</p>}
                {stop.id === "contact" && (
                  <p>If our paths cross, let’s make something memorable.</p>
                )}
                <a className="spirit-link" href={`#${stop.id}`} onClick={close}>
                  Open {stop.id} on the portfolio ↗
                </a>
              </aside>
            )}
            <p className="spirit-credit">
              <span>A place imagined by Leo Li.</span>
              <a
                href="/models/neon-district/credits.html"
                target="_blank"
                rel="noreferrer"
              >
                Model credits ↗
              </a>
              {mode === "ascii" && <span>Rendered in characters.</span>}
            </p>
          </>
        )}
      </dialog>
    </>
  )
}
