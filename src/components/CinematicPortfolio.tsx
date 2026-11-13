import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { getContent, type Project } from "../content/data"
import { usePrefs } from "../state/preferences"
import Logo from "./Logo"
import AsciiPreview from "./AsciiPreview"
import { createCloisterAudio, type CloisterAudio } from "../effects/cloisterAudio"
import "../cinematic.css"

export type CinematicPhase = "loading" | "playing" | "paused" | "reading" | "aerial" | "fallback"

/** What the runner is doing right now, reported by the scene for sound. */
export type SceneSound =
  | { kind: "step" | "vault" | "mount" | "takeoff" }
  | { kind: "land"; weight: number }
  | { kind: "air"; level: number }

export type CloisterSceneProps = {
  phase: CinematicPhase
  segment: number
  revision: number
  onReady: () => void
  onProgress?: (fraction: number) => void
  onSound?: (event: SceneSound) => void
  onComplete: (segment: number) => void
  onFailure: (message: string) => void
}
const CloisterView = lazy(() => import("../three/CloisterView"))

const chapters = [
  { id: "experience", title: "Experience" },
  { id: "projects", title: "Projects" },
  { id: "contact", title: "Contact" },
] as const
const LAST = chapters.length - 1
/** The segment after the last chapter: wall jump, Leap of Faith, aerial view. */
const FINALE = chapters.length

const c = getContent()
const isFilled = (value: string | undefined) =>
  !!value?.trim() && !value.trim().startsWith("[")
const experiences = c.experience.filter((item) => isFilled(item.role))
const projects: Project[] = c.projects.filter((item) => isFilled(item.title))
const contacts = c.contacts.flatMap(({ id, label, href }) =>
  href ? [{ id, label, href }] : [],
)
const indexFromHash = () =>
  chapters.findIndex((chapter) => `#${chapter.id}` === window.location.hash)

class SceneBoundary extends Component<{
  children: ReactNode
  onFailure: (message: string) => void
}, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error) {
    this.props.onFailure(error.message)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}
function RunningSilhouette() {
  return (
    <picture className="cine-loading-runner" aria-hidden="true">
      <source
        media="(prefers-reduced-motion: reduce)"
        srcSet="/models/cloister/runner-still.webp"
      />
      <img
        src="/models/cloister/runner-loop.webp"
        width="175"
        height="176"
        alt=""
        fetchPriority="high"
      />
    </picture>
  )
}

export default function CinematicPortfolio() {
  const { mode, setMode } = usePrefs()
  // Arrival shows the loading screen; one click enters and starts the film
  // with sound. A chapter link skips straight to reading.
  const [skipMotion, setSkipMotion] = useState(false)
  const [story, setStory] = useState<{
    phase: CinematicPhase
    segment: number
    revision: number
  }>(() => {
    const chapter = typeof window === "undefined" ? -1 : indexFromHash()
    return {
      phase: chapter >= 0 || skipMotion ? "reading" : "loading",
      segment: Math.max(chapter, 0),
      revision: 0,
    }
  })
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState(0)
  const [entered, setEntered] = useState(story.phase !== "loading")
  const enteredRef = useRef(entered)
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem("pf.sound") !== "off"
    } catch {
      return true
    }
  })
  const audio = useRef<CloisterAudio | null>(null)
  const [failed, setFailed] = useState(false)
  const [credits, setCredits] = useState(false)
  const hasPlayed = useRef(false)
  const readingHeading = useRef<Array<HTMLHeadingElement | null>>([])
  const panel = useRef<HTMLDivElement>(null)
  const pause = useRef<HTMLButtonElement>(null)
  const creditsTrigger = useRef<HTMLButtonElement>(null)
  const creditsClose = useRef<HTMLButtonElement>(null)
  const previousPhase = useRef(story.phase)
  const reading = story.phase === "reading" || story.phase === "fallback"
  const chapter = chapters[Math.min(story.segment, LAST)]

  useEffect(() => {
    document.title = `${c.profile.displayName} — ${c.profile.chineseName}`
    // The cloister is a fixed art direction, including for returning ASCII visitors.
    if (mode !== "dynamic") setMode("dynamic")
  }, [mode, setMode])

  useEffect(() => {
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    if (!preference) return
    const update = () => {
      setSkipMotion(preference.matches)
      if (preference.matches)
        setStory((s) =>
          s.phase === "playing" || s.phase === "loading" || s.phase === "paused"
            ? { ...s, phase: s.segment === FINALE ? "aerial" : "reading" }
            : s,
        )
    }
    preference.addEventListener("change", update)
    return () => preference.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    if (!credits) return
    creditsClose.current?.focus({ preventScroll: true })
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setCredits(false)
      creditsTrigger.current?.focus({ preventScroll: true })
    }
    window.addEventListener("keydown", dismiss)
    return () => window.removeEventListener("keydown", dismiss)
  }, [credits])

  useEffect(() => {
    const navigate = () => {
      const index = indexFromHash()
      if (index >= 0)
        setStory((s) => ({
          ...s,
          segment: index,
          phase: failed ? "fallback" : "reading",
          revision: s.revision + 1,
        }))
    }
    window.addEventListener("hashchange", navigate)
    window.addEventListener("popstate", navigate)
    return () => {
      window.removeEventListener("hashchange", navigate)
      window.removeEventListener("popstate", navigate)
    }
  }, [failed])

  useEffect(() => {
    const engine = createCloisterAudio(c.profile.music)
    audio.current = engine
    if (import.meta.env.DEV)
      (window as { __cloisterAudio?: CloisterAudio }).__cloisterAudio = engine
    // Browsers allow sound only after a click or key press.
    const unlock = () => engine.unlock()
    window.addEventListener("pointerdown", unlock, true)
    window.addEventListener("keydown", unlock, true)
    return () => {
      window.removeEventListener("pointerdown", unlock, true)
      window.removeEventListener("keydown", unlock, true)
      audio.current = null
      engine.dispose()
    }
  }, [])

  useEffect(() => {
    audio.current?.setEnabled(sound)
    try {
      localStorage.setItem("pf.sound", sound ? "on" : "off")
    } catch {
      // Private browsing: the choice lasts for this visit only.
    }
  }, [sound])

  useEffect(() => {
    const was = previousPhase.current
    audio.current?.setReading(story.phase !== "playing")
    if (was !== story.phase && was !== "loading" && story.phase !== "loading") {
      if (story.phase === "playing") audio.current?.cue("go")
      else if (was === "playing") audio.current?.cue("stop")
    }
    if (story.phase === "playing") hasPlayed.current = true
    if (reading) {
      panel.current?.scrollTo({ top: 0, behavior: "instant" })
      readingHeading.current[story.segment]?.focus({ preventScroll: true })
    } else if (
      story.phase === "playing" &&
      previousPhase.current !== "loading"
    ) {
      pause.current?.focus({ preventScroll: true })
    }
    previousPhase.current = story.phase
  }, [reading, story.phase, story.segment, story.revision])

  const visit = (index: number) => {
    const hash = `#${chapters[index].id}`
    if (window.location.hash !== hash) window.history.pushState(null, "", hash)
    setCredits(false)
    setStory((s) => ({
      ...s,
      phase: failed ? "fallback" : "reading",
      segment: index,
      revision: s.revision + 1,
    }))
  }

  const next = () => {
    if (failed || !ready) {
      visit((story.segment + 1) % chapters.length)
      return
    }
    if (skipMotion && story.segment < LAST) {
      visit(story.segment + 1)
      return
    }
    setStory((s) => ({
      ...s,
      segment: Math.min(s.segment + 1, FINALE),
      phase: skipMotion ? "aerial" : "playing",
    }))
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    )
  }

  const enter = () => {
    enteredRef.current = true
    setEntered(true)
    setStory((s) =>
      s.phase === "loading" && ready ? { ...s, phase: "playing" } : s,
    )
  }

  const replay = () => {
    enteredRef.current = true
    setEntered(true)
    setSkipMotion(false)
    setCredits(false)
    setStory((s) => ({
      ...s,
      phase: ready ? "playing" : "loading",
      segment: 0,
      revision: s.revision + 1,
    }))
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    )
  }

  const complete = useCallback(
    (segment: number) => {
      setStory((s) =>
        s.phase === "playing" &&
        s.segment === segment &&
        s.revision === story.revision
          ? { ...s, phase: segment === FINALE ? "aerial" : "reading" }
          : s,
      )
    },
    [story.revision],
  )

  const sceneReady = useCallback(() => {
    setReady(true)
    setStory((s) =>
      s.phase === "loading" && enteredRef.current
        ? { ...s, phase: "playing" }
        : s,
    )
  }, [])

  const sceneSound = useCallback((event: SceneSound) => {
    audio.current?.scene(event)
  }, [])

  const sceneProgress = useCallback((fraction: number) => {
    setProgress((value) => Math.max(value, Math.round(fraction * 100) / 100))
  }, [])

  const sceneFailed = useCallback(() => {
    setFailed(true)
    setStory((s) => ({
      ...s,
      segment: Math.min(s.segment, LAST),
      phase: "fallback",
    }))
  }, [])

  const skip = () => {
    if (story.segment === FINALE) setStory((s) => ({ ...s, phase: "aerial" }))
    else visit(story.segment)
  }

  return (
    <div
      className="cine-portfolio"
      data-phase={story.phase}
      data-reading={reading}
      onClick={(event) => {
        // A click on the drawing continues the film. Text stays selectable,
        // and every control keeps its own behaviour.
        if (
          reading &&
          !(event.target as Element).closest(
            "a, button, summary, main, header, footer, aside",
          )
        )
          next()
      }}
    >
      <a
        className="cine-skip"
        href="#experience"
        onClick={(event) => {
          event.preventDefault()
          visit(0)
        }}
      >
        Skip to portfolio content
      </a>
      <div className="cine-world">
        {failed ? (
          <img
            className="cine-still"
            src="/models/cloister/cloister-still.webp"
            width="1400"
            height="1040"
            alt="Aerial drawing of the cloister at Santes Creus, with Gothic arcades around a garden."
          />
        ) : (
          <SceneBoundary onFailure={sceneFailed}>
            <Suspense fallback={null}>
              <CloisterView
                {...story}
                onReady={sceneReady}
                onProgress={sceneProgress}
                onSound={sceneSound}
                onComplete={complete}
                onFailure={sceneFailed}
              />
            </Suspense>
          </SceneBoundary>
        )}
      </div>
      <div className="cine-letterbox" aria-hidden="true" />
      <div className="cine-vignette" aria-hidden="true" />
      <header className="cine-header">
        <a
          href="#intro"
          className="cine-brand"
          aria-label="Leo Li, replay the introduction"
          onClick={(event) => {
            event.preventDefault()
            if (!failed) replay()
            else visit(0)
          }}
        >
          <Logo />
          <span>
            LEO LI <small>{c.profile.chineseName}</small>
          </span>
        </a>
        <nav className="cine-chapters" aria-label="Portfolio chapters">
          {chapters.map((item, index) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={
                reading && story.segment === index ? "page" : undefined
              }
              onClick={(event) => {
                event.preventDefault()
                visit(index)
              }}
            >
              {item.title}
            </a>
          ))}
        </nav>
        <a className="cine-mode-link" href="/quickview">
          Quickview
        </a>
        <button
          type="button"
          className="cine-sound"
          aria-pressed={sound}
          aria-label={sound ? "Turn music and sound off" : "Turn music and sound on"}
          title={sound ? "Sound on" : "Sound off"}
          onClick={() => setSound((value) => !value)}
        >
          <span className="cine-sound-bars" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="cine-sound-label">{sound ? "Sound on" : "Sound off"}</span>
        </button>
      </header>
      <div
        className="cine-gate"
        data-open={story.phase !== "loading" || failed}
      >
        {story.phase === "loading" && !failed && (
          <div className="cine-loading">
            <RunningSilhouette />
            <p className="cine-loading-name">
              Leo Li <span lang="zh">{c.profile.chineseName}</span>
            </p>
            <div
              className="cine-progress"
              role="progressbar"
              aria-label="Loading the cloister"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ready ? 100 : Math.min(99, Math.round(progress * 100))}
            >
              <span
                style={{
                  transform: `scaleX(${ready ? 1 : Math.min(.99, progress)})`,
                }}
              />
            </div>
            <p className="cine-loading-status" role="status">
              {ready
                ? "The cloister is ready"
                : `Entering the cloister ${String(Math.min(99, Math.round(progress * 100))).padStart(2, "0")}%`}
            </p>
            {ready && !entered ? (
              <button
                type="button"
                className="cine-enter"
                autoFocus
                onClick={enter}
              >
                Click to enter
                <span aria-hidden="true">→</span>
              </button>
            ) : (
              <span className="cine-enter-space" aria-hidden="true" />
            )}
            <button
              type="button"
              className="cine-text-button"
              onClick={() => visit(0)}
            >
              Read the portfolio now ↗
            </button>
          </div>
        )}
      </div>
      {!reading && story.phase !== "aerial" && (
        <div className="cine-introduction" aria-hidden={story.segment > 0}>
          {story.segment === 0 && (
            <>
              <p className="cine-kicker">
                Computer engineering / University of Waterloo
              </p>
              <h1>
                Leo Li<span>.</span>
              </h1>
            </>
          )}
        </div>
      )}
      <main
        className="cine-reading"
        ref={panel}
        hidden={!reading}
        aria-label="Portfolio content"
      >
        {failed && (
          <p className="cine-fallback-note" role="status">
            The film couldn’t load. You can still read every chapter.
          </p>
        )}
        {chapters.map((item, index) => (
          <section
            key={item.id}
            id={item.id}
            hidden={!reading || story.segment !== index}
            aria-labelledby={`cine-${item.id}-heading`}
          >
            <p className="cine-chapter-number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")} <span>/ {String(chapters.length).padStart(2, "0")}</span>
            </p>
            <h2
              id={`cine-${item.id}-heading`}
              tabIndex={-1}
              ref={(node) => {
                readingHeading.current[index] = node
              }}
            >
              {item.title}
            </h2>
            {index === 0 && (
              <>
                <p className="cine-lead">{c.profile.headline}</p>
                {experiences.length > 0 ? (
                  <ol className="cine-entry-list cine-roles">
                    {experiences.map((item) => (
                      <li key={item.id}>
                        {item.logo ? (
                          <img
                            className="cine-role-logo"
                            src={item.logo}
                            alt=""
                            width="40"
                            height="40"
                            loading="lazy"
                          />
                        ) : (
                          <span className="cine-role-logo" aria-hidden="true" />
                        )}
                        <div>
                          <h3>
                            {item.role}{" "}
                            <span className="cine-role-at">
                              @{" "}
                              {item.url ? (
                                <a href={item.url} target="_blank" rel="noreferrer">
                                  {item.organization}
                                </a>
                              ) : (
                                item.organization
                              )}
                            </span>
                          </h3>
                          <p className="cine-entry-meta">{item.dates}</p>
                          <p>{item.summary}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </>
            )}
            {index === 1 && (
              <>
                <ol className="cine-entry-list cine-project-list">
                  {projects.map((item) => (
                    <li key={item.id}>
                      <h3>{item.title}</h3>
                      {isFilled(item.summary) && <p>{item.summary}</p>}
                      {item.image && (
                        <img src={item.image} alt="" loading="lazy" />
                      )}
                      {/* Clips play only while this chapter is open. */}
                      {item.video &&
                        reading &&
                        story.segment === 1 &&
                        (item.demo === "ascii" ? (
                          <AsciiPreview src={item.video} />
                        ) : (
                          <video
                            className="cine-project-video"
                            src={item.video}
                            poster={item.poster}
                            aria-label={item.mediaLabel}
                            muted
                            loop
                            playsInline
                            autoPlay
                            preload="metadata"
                          />
                        ))}
                      {item.technologies.filter(isFilled).length > 0 && (
                        <p className="cine-project-tech">
                          {item.technologies.filter(isFilled).join(" / ")}
                        </p>
                      )}
                      <div className="cine-project-links">
                        {item.repoUrl && (
                          <a
                            href={item.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View source ↗
                          </a>
                        )}
                        {item.liveUrl && (
                          <a
                            href={item.liveUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Visit project ↗
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {index === 2 && (
              <>
                <ul className="cine-contact-list">
                  {contacts.map((contact) => (
                    <li key={contact.id}>
                      <a
                        href={contact.href}
                        {...(contact.id !== "email"
                          ? { target: "_blank", rel: "noreferrer" }
                          : {})}
                      >
                        {contact.label}
                        <span aria-hidden="true">↗</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        ))}
      </main>
      {story.phase === "aerial" && (
        <div className="cine-aerial-caption">
          <h2>Santes Creus</h2>
          <p>Drag to orbit. Scroll or pinch to zoom.</p>
          <button
            type="button"
            className="cine-text-button"
            onClick={() =>
              setStory((s) => ({ ...s, revision: s.revision + 1 }))
            }
          >
            Reset view ↺
          </button>
        </div>
      )}
      <footer className="cine-footer">
        {reading && (
          <button type="button" className="cine-continue" onClick={next}>
            {failed || !ready || (skipMotion && story.segment < LAST) ? (
              `Next: ${chapters[(story.segment + 1) % chapters.length].title}`
            ) : (
              <span>
                <span className="cine-continue-click">Click</span>
                <span className="cine-continue-tap">Tap</span>
                {story.segment === LAST ? " to explore" : " to continue"}
                {story.segment === LAST && (
                  <span className="cine-continue-long"> the cloister</span>
                )}
              </span>
            )}
            <span className="cine-continue-arrow" aria-hidden="true">
              →
            </span>
          </button>
        )}
        {(story.phase === "playing" || story.phase === "paused") && (
          <div className="cine-sequence-label" role="status">
            {story.segment === FINALE ? "The jump" : chapter.title}
            {story.phase === "paused" && " / Paused"}
          </div>
        )}
        <div className="cine-film-controls">
          {(story.phase === "playing" || story.phase === "paused") && (
            <>
              <button
                ref={pause}
                type="button"
                onClick={() =>
                  setStory((s) => ({
                    ...s,
                    phase: s.phase === "playing" ? "paused" : "playing",
                  }))
                }
              >
                {story.phase === "paused" ? "Resume" : "Pause"}
              </button>
              <button type="button" onClick={skip}>
                Skip scene ↗
              </button>
            </>
          )}
          {!failed && (
            <button type="button" onClick={replay}>
              {hasPlayed.current || story.phase === "playing" || story.phase === "paused" ? "Replay film ↺" : "Play film"}
            </button>
          )}
          <button
            ref={creditsTrigger}
            type="button"
            aria-expanded={credits}
            aria-controls="cine-credits"
            onClick={() => setCredits((value) => !value)}
          >
            Credits
          </button>
        </div>
      </footer>
      {credits && (
        <aside
          id="cine-credits"
          className="cine-credits"
          aria-label="Model credits"
        >
          <button
            ref={creditsClose}
            type="button"
            className="cine-credits-close"
            aria-label="Close credits"
            onClick={() => {
              setCredits(false)
              creditsTrigger.current?.focus({ preventScroll: true })
            }}
          >
            ×
          </button>
          <p className="cine-kicker">The film</p>
          <p>Inspired by Assassin’s Creed.</p>
          <p className="cine-kicker">The architecture</p>
          <p>
            <a
              href="https://sketchfab.com/3d-models/claustre-del-reial-monestir-de-santes-creus-66787ebf720f4687aa11a51d6e883de7"
              target="_blank"
              rel="noreferrer"
            >
              Claustre del Reial Monestir de Santes Creus ↗
            </a>
          </p>
          <p>
            Rubén González Candial / Giravolt.
            <br />
            Adapted for this portfolio.{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 4.0
            </a>
            .
          </p>
          <p className="cine-kicker">The runner</p>
          <p>
            <a
              href="https://sketchfab.com/3d-models/assassins-creed-altair-blend-1c9466cd5283403dace6991565b4a2cc"
              target="_blank"
              rel="noreferrer"
            >
              Altaïr by Nexus321 ↗
            </a>
            <br />
            CC BY 4.0. Rigged and outlined for this film.
          </p>
          <p className="cine-kicker">The movement</p>
          <p>
            Running, vault and jump animations by Quaternius.
          </p>
          <a
            className="cine-text-button"
            href="/models/cloister/credits.html"
            target="_blank"
            rel="noreferrer"
          >
            All credits & modifications ↗
          </a>
        </aside>
      )}
    </div>
  )
}
