import { lazy, Suspense, useEffect, type ReactNode } from "react"
import { getContent } from "../content/data"
import { usePrefs } from "../state/preferences"
import Controls from "./Controls"
import CDPlayer from "./CDPlayer"
import Bookshelf from "./Bookshelf"
import Games from "./Games"
import Projects from "./Projects"
import Pool from "./Pool"
import Deck from "./Deck"
import Logo from "./Logo"
import Photo from "./Photo"
import Signature from "./Signature"
import ContourBackground from "./ContourBackground"
import OverlayScrollbar from "./OverlayScrollbar"
import Garganta from "./Garganta"
import NameDrawing from "./NameDrawing"
import AsciiDecorations from "./AsciiDecorations"
import { ContactLinks } from "./ui"

const EffectsLayer = lazy(() => import("../effects/EffectsLayer"))
const c = getContent()
const NAV: Array<[string, string]> = [
  ["experience", "Experience"],
  ["projects", "Projects"],
  ["about", "About"],
  ["contact", "Contact"],
]

function ChapterTitle({
  number,
  label,
  children,
}: {
  number: string
  label: string
  children: ReactNode
}) {
  return (
    <div className="chapter-title" data-reveal>
      <p className="eyebrow">
        <span>{number} /</span> {label}
      </p>
      <h2>{children}</h2>
    </div>
  )
}
function ProjectDrawing({ index }: { index: number }) {
  const { mode } = usePrefs()
  if (mode === "ascii")
    return (
      <pre className="project-ascii" aria-hidden="true">
        {index % 2 === 0
          ? "      .----.\n   .-' /  / '-.\n  /   /  /    /\n +---+--+----+\n |  /  /    |\n +-/--/-----+\n  '----'"
          : "      /\\\n     /  \\\n    / /\\ \\\n   / /  \\ \\\n  /_/____\\_\\\n  +----------+"}
      </pre>
    )
  return (
    <svg
      viewBox="0 0 500 320"
      className={`project-drawing drawing-${index}`}
      aria-hidden="true"
      fill="none"
    >
      <defs>
        <radialGradient id={`project-light-${index}`}>
          <stop stopColor="currentColor" stopOpacity=".18" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx="250"
        cy="160"
        rx="220"
        ry="160"
        fill={`url(#project-light-${index})`}
      />
      <g stroke="currentColor" strokeWidth="1.2">
        {Array.from({ length: 7 }, (_, i) => (
          <ellipse
            key={i}
            cx="250"
            cy="160"
            rx={130 - i * 13}
            ry="96"
            transform={`rotate(${index * 22 + i * 12} 250 160)`}
          />
        ))}
        <path d="M52 160H448M250 38V282" strokeDasharray="3 8" opacity=".4" />
        <circle cx="250" cy="160" r="142" opacity=".2" />
        <circle
          cx={index === 1 ? 250 : 380}
          cy={index === 1 ? 64 : 160}
          r="5"
          fill="currentColor"
        />
      </g>
    </svg>
  )
}

export default function Page() {
  const { mode, motion } = usePrefs()
  const ascii = mode === "ascii"
  useEffect(() => {
    document.title = `${c.profile.displayName} — ${c.profile.chineseName}`
  }, [])
  return (
    <>
      <ContourBackground />
      <OverlayScrollbar />
      {ascii && <AsciiDecorations />}
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {motion && (
        <Suspense fallback={null}>
          <EffectsLayer />
        </Suspense>
      )}
      <header className="site-header story-header">
        <a
          href="#intro"
          aria-label={`${c.profile.displayName}, back to start`}
          className="brand-home"
        >
          <Logo />
        </a>
        <span className="header-location">
          LEO LI <span>/</span> WATERLOO, CA
        </span>
        <Controls />
      </header>
      <main id="main" tabIndex={-1} className="outline-none">
        <Deck nav={NAV}>
          <section
            id="intro"
            data-panel="Intro"
            data-anchor
            tabIndex={-1}
            aria-labelledby="intro-h"
            className="hero-chapter"
          >
            <div className="hero-sticky">
              <Photo
                name="city"
                alt="A colorful illuminated bridge over the city at night"
                className="hero-scenery"
                eager
              />
              <div className="hero-shade" aria-hidden="true" />
              <div className="hero-copy">
                <p className="eyebrow">{c.profile.headline}</p>
                <h1 id="intro-h" tabIndex={-1}>
                  <NameDrawing />
                </h1>
                <div className="hero-byline">
                  <span>Engineering. Exploring. Always curious.</span>
                </div>
                <div className="hero-bottom">
                  <span className="eyebrow">
                    A little work.
                    <br />A little off-screen.
                  </span>
                  <Signature hero />
                </div>
              </div>
              <figure className="hero-portrait">
                <Photo
                  name="fairground"
                  alt="Leo at a fairground at night, wearing headphones"
                  eager
                />
                <figcaption>Somewhere between work & play.</figcaption>
              </figure>
              <a href="#experience" className="hero-scroll">
                <span>Keep exploring</span>
                <span aria-hidden="true">↓</span>
              </a>
            </div>
          </section>

          <section
            id="experience"
            data-panel="Experience"
            data-anchor
            tabIndex={-1}
            aria-labelledby="experience-h"
            className="chapter experience-chapter"
          >
            <div className="chapter-layout">
              <div>
                <ChapterTitle number="01" label="Experience">
                  <span id="experience-h" tabIndex={-1}>
                    Learning by
                    <br />
                    <em>building.</em>
                  </span>
                </ChapterTitle>
                <p className="chapter-note" data-reveal>
                  {c.profile.intro}
                </p>
              </div>
              <ol className="experience-list">
                {c.experience.map((e, i) => (
                  <li key={e.id} data-reveal>
                    <span className="entry-index">0{i + 1}</span>
                    <article>
                      <p className="eyebrow">{e.dates}</p>
                      <h3>{e.role}</h3>
                      <p className="experience-org">{e.organization}</p>
                      <ul>
                        {e.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </article>
                  </li>
                ))}
                <li data-reveal>
                  <span className="entry-index">
                    0{c.experience.length + 1}
                  </span>
                  <article>
                    <p className="eyebrow">Beyond engineering</p>
                    <h3>Swim coaching</h3>
                    <p className="experience-org">{c.beyond.coaching}</p>
                  </article>
                </li>
              </ol>
            </div>
          </section>

          <section
            id="projects"
            data-panel="Projects"
            data-horizontal
            data-anchor
            tabIndex={-1}
            aria-labelledby="projects-h"
            className="rail-section"
          >
            <div className="rail-sticky">
              <div className="rail-track">
                <div className="rail-lead">
                  <ChapterTitle number="02" label="Selected work">
                    <span id="projects-h" tabIndex={-1}>
                      Ideas into
                      <br />
                      <em>something real.</em>
                    </span>
                  </ChapterTitle>
                  <p className="chapter-note">
                    Experiments, projects, and things I’m figuring out along the
                    way.
                  </p>
                  <span className="rail-direction" aria-hidden="true">
                    Continue scrolling ↗
                  </span>
                </div>
                {c.projects.map((p, i) => (
                  <article
                    key={p.id}
                    className="project-panel"
                    data-reveal
                    data-artwork
                  >
                    <div className="project-visual">
                      <ProjectDrawing index={i} />
                      <span className="project-count">
                        0{i + 1} / EXPLORATION
                      </span>
                    </div>
                    <div className="project-caption">
                      <span className="eyebrow">Project / 0{i + 1}</span>
                      <h3>{p.title}</h3>
                      <p>{p.summary}</p>
                      <details>
                        <summary>
                          Project details <span aria-hidden="true">+</span>
                        </summary>
                        <ul className="technology-list">
                          {p.technologies.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                        <div className="project-links">
                          {p.repoUrl && (
                            <a
                              className="text-link"
                              href={p.repoUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Repository ↗
                            </a>
                          )}
                          {p.liveUrl && (
                            <a
                              className="text-link"
                              href={p.liveUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Live project ↗
                            </a>
                          )}
                          {!p.repoUrl && !p.liveUrl && (
                            <span className="text-muted">
                              Links coming soon.
                            </span>
                          )}
                        </div>
                      </details>
                    </div>
                  </article>
                ))}
                <div className="rail-end" aria-hidden="true" />
              </div>
            </div>
          </section>

          <section
            id="about"
            data-panel="About"
            data-anchor
            tabIndex={-1}
            aria-labelledby="about-h"
            className="chapter about-chapter"
          >
            <div className="chapter-layout">
              <ChapterTitle number="03" label="Off-screen">
                <span id="about-h" tabIndex={-1}>
                  More than
                  <br />
                  <em>a screen.</em>
                </span>
              </ChapterTitle>
              <div className="about-copy" data-reveal>
                <p>{c.beyond.intro}</p>
                <p className="chapter-note">
                  Swimming, coaching, music, books, and a few games in between.
                </p>
                <ul className="interest-list">
                  {["Swimming", "Coaching", "Music", "Books", "Games"].map(
                    (t, i) => (
                      <li key={t}>
                        <span>0{i + 1}</span>
                        {t}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </section>

          <section
            id="gallery"
            data-panel="Moments"
            data-horizontal
            aria-label="A few moments off-screen"
            className="rail-section gallery-section"
          >
            <div className="rail-sticky">
              <div className="rail-track">
                <div className="rail-lead gallery-lead">
                  <p className="eyebrow">Collected moments</p>
                  <h2>
                    Life in
                    <br />
                    <em>between.</em>
                  </h2>
                  <p className="chapter-note">
                    Places, people, and the little detours.
                  </p>
                </div>
                <figure className="photo-panel" data-reveal data-artwork>
                  <Photo
                    name="school"
                    alt="Leo wearing headphones outdoors after school"
                  />
                  <figcaption>
                    <span>01 / On the way</span>
                    <span>September 2024</span>
                  </figcaption>
                </figure>
                <figure
                  className="photo-panel photo-panel-tall"
                  data-reveal
                  data-artwork
                >
                  <Photo
                    name="hallway"
                    alt="Leo exploring a warmly lit yellow hallway"
                  />
                  <figcaption>
                    <span>02 / A change of scenery</span>
                    <span>Off-screen</span>
                  </figcaption>
                </figure>
                <figure className="photo-panel" data-reveal data-artwork>
                  <Photo
                    name="fairground"
                    alt="Leo among the colorful lights at a nighttime fairground"
                  />
                  <figcaption>
                    <span>03 / After hours</span>
                    <span>Out exploring</span>
                  </figcaption>
                </figure>
                <div className="rail-end" aria-hidden="true" />
              </div>
            </div>
          </section>

          <section
            id="playground"
            data-panel="Playground"
            data-anchor
            tabIndex={-1}
            className="chapter collection-chapter"
            aria-labelledby="playground-h"
          >
            <ChapterTitle number="04" label="A little interaction">
              <span id="playground-h">
                Room to <em>play.</em>
              </span>
            </ChapterTitle>
            <div className="collection-world">
              <div className="collection-heading">
                <span className="eyebrow">01 / A small world</span>
                <span className="chapter-note">
                  Drag to explore. Pick a landmark.
                </span>
              </div>
              <Projects projects={c.projects} />
            </div>
            <div className="collection-pool">
              <div data-reveal>
                <p className="eyebrow">02 / In my element</p>
                <h3>
                  Just keep
                  <br />
                  <em>swimming.</em>
                </h3>
                <p className="chapter-note">{c.beyond.swimming}</p>
                <p className="chapter-note">{c.beyond.funFact}</p>
              </div>
              <div data-reveal data-artwork>
                <Pool />
              </div>
            </div>
            <div
              id="listening"
              data-panel="Listening & reading"
              className="collection-media"
            >
              <div data-reveal>
                <p className="eyebrow">03 / On repeat</p>
                <h3>The soundtrack.</h3>
                <CDPlayer />
              </div>
              <div data-reveal>
                <p className="eyebrow">04 / On the shelf</p>
                <h3>A different perspective.</h3>
                <Bookshelf books={c.books} />
              </div>
            </div>
            <div id="games" data-panel="Games" className="collection-games">
              <div data-reveal>
                <p className="eyebrow">05 / After hours</p>
                <h3>One more round?</h3>
              </div>
              <Games games={c.games} />
            </div>
          </section>

          <section
            id="contact"
            data-panel="Contact"
            data-anchor
            tabIndex={-1}
            aria-labelledby="contact-h"
            className="chapter contact-chapter"
          >
            <p className="eyebrow" data-reveal>
              05 / Keep in touch
            </p>
            <h2 id="contact-h" tabIndex={-1} data-reveal>
              Let’s make
              <br />
              <em>something.</em>
            </h2>
            <div className="contact-bottom">
              <div data-reveal>
                <ContactLinks contacts={c.contacts} size="lg" />
                <p className="chapter-note">
                  Links go live once destinations are confirmed.
                </p>
              </div>
              <Signature />
            </div>
            <Garganta />
            <footer>
              <span>
                © {c.profile.displayName}{" "}
                <span lang="zh-Hans">{c.profile.chineseName}</span>
              </span>
              <a href="#intro" className="text-link">
                Back to the beginning ↑
              </a>
            </footer>
          </section>
        </Deck>
      </main>
    </>
  )
}
