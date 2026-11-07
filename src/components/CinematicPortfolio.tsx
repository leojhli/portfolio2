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
import Photo from "./Photo"
import Bookshelf from "./Bookshelf"
import CDPlayer from "./CDPlayer"
import Games from "./Games"
import "../cinematic.css"

export type CinematicPhase = "loading" | "playing" | "paused" | "reading" | "aerial" | "fallback"

export type CloisterSceneProps = {
  phase: CinematicPhase
  segment: number
  revision: number
  onReady: () => void
  onComplete: (segment: number) => void
  onFailure: (message: string) => void
}
const CloisterView = lazy(() => import("../three/CloisterView"))

const chapters = [
  { id: "experience", title: "Experience" },
  { id: "projects", title: "Projects" },
  { id: "about", title: "About" },
  { id: "contact", title: "Contact" },
] as const

const c = getContent()
const isFilled = (value: string | undefined) =>
  !!value?.trim() && !value.trim().startsWith("[")
const experiences = c.experience.filter((item) => isFilled(item.role))
const projects: Project[] = c.projects.filter((item) => isFilled(item.title))
if (!projects.length)
  projects.push({
    id: "cloister-portfolio",
    title: "The cloister portfolio",
    summary:
      "I built a moving camera and parkour sequence inside a hand-drawn model of Santes Creus. Each stop opens a chapter of the portfolio.",
    technologies: ["React", "Three.js", "TypeScript"],
    repoUrl: "https://github.com/leojhli/portfolio2",
  })
const contacts = c.contacts.flatMap(({ id, label, href }) => {
  const url =
    href || (id === "github" ? "https://github.com/leojhli" : undefined)
  return url ? [{ id, label, href: url }] : []
})
const indexFromHash = () =>
  chapters.findIndex((chapter) => `#${chapter.id}` === window.location.hash)
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

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

function AboutContent() {
  return (
    <>
      <div className="cine-about-folds">
        <details>
          <summary>Photos</summary>
          <div className="cine-photo-grid">
            <figure>
              <Photo
                name="fairground"
                alt="Leo at a fairground at night, wearing headphones"
              />
              <figcaption>At the fairground</figcaption>
            </figure>
            <figure>
              <Photo
                name="school"
                alt="Leo wearing headphones outdoors after school"
              />
              <figcaption>On the way / September 2024</figcaption>
            </figure>
            <figure>
              <Photo
                name="hallway"
                alt="Leo exploring a warmly lit yellow hallway"
              />
              <figcaption>A change of scenery</figcaption>
            </figure>
            <figure>
              <Photo
                name="city"
                alt="A colorful illuminated bridge over the city at night"
              />
              <figcaption>After hours</figcaption>
            </figure>
          </div>
        </details>
        <details>
          <summary>Swimming & coaching</summary>
          <div className="cine-fold-content">
            <p>{c.beyond.intro}</p>
            {[c.beyond.swimming, c.beyond.coaching, c.beyond.funFact]
              .filter(isFilled)
              .map((text) => (
                <p key={text}>{text}</p>
              ))}
          </div>
        </details>
        <details>
          <summary>Books</summary>
          <div className="cine-fold-content">
            <Bookshelf books={c.books} />
          </div>
        </details>
        <details>
          <summary>Music</summary>
          <div className="cine-fold-content">
            <CDPlayer />
          </div>
        </details>
        <details>
          <summary>Games</summary>
          <div className="cine-fold-content cine-games">
            <Games games={c.games} />
          </div>
        </details>
      </div>
    </>
  )
}

export default function CinematicPortfolio() {
  const { mode, setMode } = usePrefs()
  const [skipMotion, setSkipMotion] = useState(prefersReducedMotion)
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
  const chapter = chapters[Math.min(story.segment, 3)]

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
            ? { ...s, phase: s.segment === 4 ? "aerial" : "reading" }
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
    if (skipMotion && story.segment < 3) {
      visit(story.segment + 1)
      return
    }
    setStory((s) => ({
      ...s,
      segment: Math.min(s.segment + 1, 4),
      phase: skipMotion ? "aerial" : "playing",
    }))
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    )
  }

  const replay = () => {
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
          ? { ...s, phase: segment === 4 ? "aerial" : "reading" }
          : s,
      )
    },
    [story.revision],
  )

  const sceneReady = useCallback(() => {
    setReady(true)
    setStory((s) =>
      s.phase === "loading"
        ? {
            ...s,
            phase: "playing",
          }
        : s,
    )
  }, [])

  const sceneFailed = useCallback(() => {
    setFailed(true)
    setStory((s) => ({
      ...s,
      segment: Math.min(s.segment, 3),
      phase: "fallback",
    }))
  }, [])

  const skip = () => {
    if (story.segment === 4) setStory((s) => ({ ...s, phase: "aerial" }))
    else visit(story.segment)
  }

  return (
    <div
      className="cine-portfolio"
      data-phase={story.phase}
      data-reading={reading}
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
      </header>
      {!ready && !failed && !reading && (
        <div className="cine-loading">
          <RunningSilhouette />
          <p role="status">
            Entering the cloister<span aria-hidden="true"> …</span>
          </p>
          <button
            type="button"
            className="cine-text-button"
            onClick={() => visit(0)}
          >
            Read the portfolio now ↗
          </button>
        </div>
      )}
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
              {String(index + 1).padStart(2, "0")} <span>/ 04</span>
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
                {isFilled(c.profile.intro) && <p>{c.profile.intro}</p>}
                {experiences.length > 0 ? (
                  <ol className="cine-entry-list">
                    {experiences.map((item) => (
                      <li key={item.id}>
                        {isFilled(item.dates) && (
                          <p className="cine-entry-meta">{item.dates}</p>
                        )}
                        <h3>{item.role}</h3>
                        {isFilled(item.organization) && (
                          <p>{item.organization}</p>
                        )}
                        <ul>
                          {item.points.filter(isFilled).map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                ) : null}
                <div className="cine-small-note">
                  <h3>Swim coaching</h3>
                  <p>{c.beyond.intro}</p>
                </div>
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
            {index === 2 && <AboutContent />}
            {index === 3 && (
              <>
                <ul className="cine-contact-list">
                  {contacts.map((contact) => (
                    <li key={contact.id}>
                      <a
                        href={contact.href}
                        {...(contact.id !== "email" &&
                        !contact.href.startsWith("/")
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
            <div className="cine-continue-row">
              <button type="button" className="cine-continue" onClick={next}>
                {index === 3
                  ? failed || !ready
                    ? "Back to Experience"
                    : "Explore the cloister"
                  : failed || !ready || skipMotion
                    ? `Next: ${chapters[index + 1].title}`
                    : "Continue"}
                <span aria-hidden="true">→</span>
              </button>
            </div>
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
        {(story.phase === "playing" || story.phase === "paused") && (
          <div className="cine-sequence-label" role="status">
            {story.segment === 4 ? "Aerial view" : chapter.title}
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
          {(reading || story.phase === "aerial") && !failed && (
            <button type="button" onClick={replay}>
              {hasPlayed.current ? "Replay film ↺" : "Play film"}
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
