import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { useAudio } from "../state/audio"
import { usePrefs } from "../state/preferences"
import { getContent } from "../content/data"
import { spiritStops, TREACHERY_SRC } from "../content/spiritWorld"
import { playGargantaSound } from "../effects/gargantaSound"
import BankaiSword from "./BankaiSword"
import { cancelEffects } from "../effects/coordinator"

const SpiritWorldView = lazy(() => import("../three/SpiritWorldView"))
const content = getContent()

export default function Garganta() {
  const audio = useAudio(),
    { mode } = usePrefs()
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null)
  const soundtrack = useRef<HTMLAudioElement | null>(null)
  const restoreMusic = useRef<(() => void) | null>(null),
    stopEffects = useRef<(() => void) | null>(null)
  const timer = useRef(0),
    savedOverflow = useRef(""),
    session = useRef(0),
    active = useRef(false)
  const [open, setOpen] = useState(false),
    [entered, setEntered] = useState(false),
    [selected, setSelected] = useState(-1),
    [focusKey, setFocusKey] = useState(0)
  const select = (index: number) => {
    setSelected(index)
    setFocusKey((value) => value + 1)
  }
  const [music, setMusic] = useState(true),
    [effects, setEffects] = useState(true),
    [audioError, setAudioError] = useState(false)
  const close = () => {
    if (!active.current) return
    active.current = false
    session.current++
    clearTimeout(timer.current)
    stopEffects.current?.()
    stopEffects.current = null
    soundtrack.current?.pause()
    if (soundtrack.current) soundtrack.current.currentTime = 0
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
      stopEffects.current?.()
      soundtrack.current?.pause()
      if (soundtrack.current) soundtrack.current.onerror = null
      if (active.current)
        document.documentElement.style.overflow = savedOverflow.current
      delete document.documentElement.dataset.spiritWorld
      dispatchEvent(new Event("portfolio:world"))
    },
    [],
  )
  const enter = () => {
    if (open) return
    active.current = true
    const token = ++session.current
    cancelEffects()
    savedOverflow.current = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"
    document.documentElement.dataset.spiritWorld = "true"
    dispatchEvent(new Event("portfolio:world"))
    restoreMusic.current = audio.suspend()
    setSelected(-1)
    setEntered(false)
    setOpen(true)
    setAudioError(false)
    dialog.current?.showModal()
    let enabled = true
    try {
      enabled = localStorage.getItem("pf.sound") !== "off"
    } catch {
      /* use default */
    }
    setEffects(enabled)
    if (enabled) stopEffects.current = playGargantaSound()
    const song = soundtrack.current ?? new Audio()
    soundtrack.current = song
    song.src = TREACHERY_SRC
    song.loop = true
    song.volume = 0.52
    song.preload = "none"
    song.onerror = () => {
      if (session.current === token) {
        setAudioError(true)
        setMusic(false)
      }
    }
    setMusic(true)
    void song.play().catch(() => {
      if (session.current !== token) return
      setAudioError(true)
      setMusic(false)
    })
    timer.current = window.setTimeout(() => setEntered(true), 2350)
  }
  const stop = spiritStops[selected]
  return (
    <>
      <div className="bankai-discovery">
        <span className="eyebrow">There’s another side to this.</span>
        <button
          ref={trigger}
          type="button"
          className="bankai-trigger"
          data-world-trigger
          aria-label="Draw Tensa Zangetsu and enter the Garganta"
          aria-haspopup="dialog"
          onClick={enter}
        >
          <BankaiSword />
          <span className="bankai-caption">
            <span>TENSA ZANGETSU</span>
            <span>Cross the boundary ↗</span>
          </span>
        </button>
        <p>A small tribute to a very big obsession.</p>
      </div>
      <dialog
        ref={dialog}
        className="garganta"
        aria-labelledby="garganta-title"
        data-entered={entered}
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
      >
        {open && (
          <>
            <div className="spirit-world-viewport">
              <Suspense
                fallback={
                  <div className="spirit-loading" role="status">
                    Crossing the boundary…
                  </div>
                }
              >
                <SpiritWorldView
                  selected={selected}
                  focusKey={focusKey}
                  onSelect={select}
                />
              </Suspense>
            </div>
            <div className="garganta-rift" aria-hidden="true">
              <div className="rift-upper" />
              <div className="rift-lower" />
              <div className="rift-cut" />
            </div>
            <header className="spirit-header">
              <div>
                <p className="spirit-eyebrow">THE OTHER SIDE / 001</p>
                <h2 id="garganta-title">Beyond the boundary.</h2>
                <p>A Seireitei-inspired world. A little piece of me.</p>
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
                onClick={() => {
                  clearTimeout(timer.current)
                  setEntered(true)
                  stopEffects.current?.()
                }}
              >
                Skip entrance
              </button>
            )}
            <div className="spirit-toolbar">
              <button
                type="button"
                className="spirit-button"
                onClick={() => {
                  select(-1)
                }}
              >
                Whole courtyard
              </button>
              <button
                type="button"
                className="spirit-button"
                onClick={() => {
                  clearTimeout(timer.current)
                  setEntered(false)
                  stopEffects.current?.()
                  if (effects) stopEffects.current = playGargantaSound()
                  timer.current = window.setTimeout(
                    () => setEntered(true),
                    2350,
                  )
                }}
              >
                Replay crossing
              </button>
              <span>Drag to orbit · scroll / pinch to zoom</span>
              <button
                type="button"
                className="spirit-button"
                aria-pressed={music}
                onClick={() => {
                  const song = soundtrack.current
                  if (!song) return
                  if (music) {
                    song.pause()
                    setMusic(false)
                  } else {
                    void song
                      .play()
                      .then(() => {
                        setMusic(true)
                        setAudioError(false)
                      })
                      .catch(() => setAudioError(true))
                  }
                }}
              >
                {music ? "Pause" : "Play"} Treachery
              </button>
              <button
                type="button"
                className="spirit-button"
                aria-pressed={effects}
                onClick={() => {
                  setEffects(!effects)
                  if (effects) stopEffects.current?.()
                }}
              >
                Portal FX: {effects ? "On" : "Off"}
              </button>
            </div>
            {audioError && (
              <p className="spirit-audio-error" role="status">
                Soundtrack couldn’t start. Press Play Treachery to retry.
              </p>
            )}
            <nav className="spirit-locations" aria-label="Courtyard locations">
              {spiritStops.map((place, i) => (
                <button
                  type="button"
                  key={place.id}
                  aria-pressed={selected === i}
                  onClick={() => {
                    select(i)
                    setEntered(true)
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
                  {stop.character} / {stop.id}
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
                  <p>
                    Back to the living world. Let’s build something worth
                    crossing over for.
                  </p>
                )}
                <a className="spirit-link" href={`#${stop.id}`} onClick={close}>
                  Open {stop.id} on the portfolio ↗
                </a>
              </aside>
            )}
            <p className="spirit-credit">
              An unofficial BLEACH fan-art world by Leo Li.{" "}
              {mode === "ascii"
                ? "Rendered in characters."
                : "Ichigo · Rukia · Byakuya"}
            </p>
          </>
        )}
      </dialog>
    </>
  )
}
