import { lazy, Suspense, useEffect, type CSSProperties } from "react"
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
import AsciiDecorations from "./AsciiDecorations"
import { AsciiArt, ContactLinks, Kinetic, Panel } from "./ui"

const EffectsLayer = lazy(() => import("../effects/EffectsLayer"))
const c = getContent()

const PORTRAIT = [
  "+------------------------+",
  "|                        |",
  '|       .-""""""-.       |',
  "|      /  .    .  \\      |",
  "|     |     __     |     |",
  "|      \\   '--'   /      |",
  "|       '-......-'       |",
  "|                        |",
  "|   [ portrait soon ]    |",
  "+------------------------+",
].join("\n")

const NAV: Array<[string, string]> = [
  ["experience", "Experience"],
  ["projects", "Projects"],
  ["about", "About"],
  ["contact", "Contact"],
]
const INTERESTS = ["Swimming", "Coaching", "Music", "Books", "Games"]
const d = (n: number) => ({ "--d": n }) as CSSProperties
const SWATCH = [
  "bg-s1 text-on-s1",
  "bg-s2 text-on-s2",
  "bg-s3 text-on-s3",
  "bg-s4 text-on-s4",
  "bg-s5 text-on-s5",
]
const vivid = (i: number) => `var(--c-v${(i % 3) + 1})`

export default function Page() {
  const { mode, motion } = usePrefs()
  const ascii = mode === "ascii"
  useEffect(() => {
    document.title = `${c.profile.displayName} — ${c.profile.chineseName}`
  }, [])

  return (
    <>
      {ascii && <AsciiDecorations />}
      <a
        href="#main"
        className="sr-only z-50 rounded bg-accent px-4 py-2 text-on-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      {motion && (
        <Suspense fallback={null}>
          <EffectsLayer />
        </Suspense>
      )}

      <header className="site-header relative z-30 bg-bg/85 px-5 py-3 backdrop-blur sm:px-8 hz:fixed hz:inset-x-0 hz:top-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="#intro"
              aria-label={`${c.profile.displayName}, back to start`}
              className="brand-home"
            >
              <Logo />
            </a>
            <nav aria-label="Sections" className="hz:hidden">
              <ul className="flex flex-wrap">
                {NAV.map(([id, label]) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="nav-link inline-flex min-h-11 items-center px-2.5 font-sans text-xs text-muted"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <Controls />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        <Deck nav={NAV}>
          {/* ---------- HERO ---------- */}
          <section
            id="intro"
            data-panel="Intro"
            data-anchor
            tabIndex={-1}
            aria-labelledby="intro-h"
            className="panel outline-none"
          >
            <div className="grid gap-14 lg:grid-cols-[1.25fr_1fr] lg:items-center">
              <div>
                <p data-reveal className="font-sans text-sm text-accent">
                  {c.profile.headline}
                </p>
                <h1
                  id="intro-h"
                  tabIndex={-1}
                  data-reveal
                  style={d(1)}
                  className="mt-5 font-display text-[clamp(4rem,10vw,8.75rem)] font-normal leading-[0.88] tracking-[-0.065em]"
                >
                  <Kinetic text={c.profile.displayName} />
                  <span aria-hidden="true" className="text-accent">
                    .
                  </span>
                  <span
                    lang="zh-Hans"
                    className="mt-4 block font-sans text-[0.34em] font-medium tracking-[0.12em] text-muted"
                  >
                    {ascii ? (
                      <>
                        <span aria-hidden="true">LI JIA HE</span>
                        <span className="sr-only">{c.profile.chineseName}</span>
                      </>
                    ) : (
                      c.profile.chineseName
                    )}
                  </span>
                </h1>
                <p
                  data-reveal
                  style={d(2)}
                  className="mt-8 max-w-[50ch] text-lg leading-relaxed text-muted"
                >
                  {c.profile.intro}
                </p>
                <div data-reveal style={d(3)} className="mt-9">
                  <ContactLinks contacts={c.contacts} />
                </div>
              </div>

              <div
                data-reveal
                style={d(2)}
                className="mx-auto w-full max-w-[360px]"
              >
                {ascii ? (
                  <AsciiArt
                    art={PORTRAIT}
                    fallback="[ portrait coming soon ]"
                    label="Portrait placeholder — image not yet added"
                  />
                ) : (
                  <div data-fx data-spring className="card p-2">
                    {c.profile.portrait ? (
                      <img
                        src={c.profile.portrait}
                        alt={`Portrait of ${c.profile.displayName}`}
                        className="aspect-[4/5] max-h-[48vh] w-full rounded-[9px] object-cover"
                      />
                    ) : (
                      <div
                        role="img"
                        aria-label="Portrait placeholder — image not yet added"
                        className="hatch grid aspect-[4/5] max-h-[48vh] w-full place-items-center rounded-[9px]"
                      >
                        <span className="font-sans text-xs text-muted">
                          Portrait coming soon
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-6 font-sans text-xs text-muted">Off-screen</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {INTERESTS.map((t, i) => (
                    <li
                      key={t}
                      className={`rounded-full border-[1.5px] border-fg px-3 py-1 text-sm font-medium ${SWATCH[i % 5]}`}
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ---------- EXPERIENCE ---------- */}
          <Panel
            id="experience"
            index="01"
            kicker="Experience"
            title="Where I've"
            accent="worked."
          >
            <ol className="relative grid gap-8 md:grid-cols-3">
              <li
                aria-hidden="true"
                className="absolute -top-6 left-0 right-0 hidden h-px bg-fg hz:block"
              />
              {c.experience.map((e, i) => (
                <li
                  key={e.id}
                  data-reveal
                  style={d(i + 1)}
                  className="relative"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -top-[30px] left-6 hidden size-3 rounded-full border-[1.5px] border-fg hz:block"
                    style={{ background: vivid(i) }}
                  />
                  <article
                    className="card h-full overflow-hidden p-6"
                    style={{ "--hover": vivid(i) } as CSSProperties}
                  >
                    <div
                      aria-hidden="true"
                      className="-mx-6 -mt-6 mb-5 h-3 border-b-[1.5px] border-fg"
                      style={{ background: vivid(i) }}
                    />
                    <div className="flex items-center justify-between gap-3 font-sans text-xs text-muted">
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <span className="rounded-md border border-fg px-2 py-0.5 text-fg">
                        {e.dates}
                      </span>
                    </div>
                    <h3 className="mt-5 text-2xl font-semibold tracking-tight">
                      {e.role}
                    </h3>
                    <p className="text-muted">{e.organization}</p>
                    <ul className="mt-5 space-y-2 text-[15px]">
                      {e.points.map((pt, j) => (
                        <li key={j} className="flex gap-3">
                          <span aria-hidden="true" className="text-accent">
                            ›
                          </span>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </article>
                </li>
              ))}
              <li data-reveal style={d(3)} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -top-[30px] left-6 hidden size-3 rounded-full border-[1.5px] border-dashed border-fg bg-bg hz:block"
                />
                <div className="grid h-full min-h-40 place-items-center rounded-[14px] border-[1.5px] border-dashed border-muted p-6 text-center text-sm text-muted">
                  Swim coaching
                  <br />
                  Details coming soon
                </div>
              </li>
            </ol>
          </Panel>

          {/* ---------- PROJECTS ---------- */}
          <Panel
            id="projects"
            index="02"
            kicker="Projects"
            title="Things I've"
            accent="built."
          >
            <Projects projects={c.projects} />
          </Panel>

          {/* ---------- ABOUT ---------- */}
          <Panel
            id="about"
            index="03"
            kicker="About"
            title="Beyond the"
            accent="screen."
          >
            <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-14">
              <div>
                <p
                  data-reveal
                  style={d(1)}
                  className="max-w-[24ch] text-[clamp(1.5rem,2.4vw,2.2rem)] font-medium leading-tight tracking-tight"
                >
                  {c.beyond.intro}
                </p>
                <dl
                  data-reveal
                  style={d(2)}
                  className="card mt-8 divide-y divide-line px-6"
                >
                  {([
                    ["Swimming", c.beyond.swimming],
                    ["Coaching", c.beyond.coaching],
                    ["Fun fact", c.beyond.funFact],
                  ] as const).map(([k, v], i) => (
                    <div
                      key={k}
                      className="grid gap-1 py-4 sm:grid-cols-[120px_1fr] sm:gap-6"
                    >
                      <dt className="flex items-center gap-2 font-sans text-xs uppercase tracking-wider text-accent sm:pt-0.5">
                        <span
                          aria-hidden="true"
                          className="size-2.5 shrink-0 rounded-full border border-fg"
                          style={{ background: vivid(i) }}
                        />
                        {k}
                      </dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div data-reveal style={d(3)}>
                <Pool />
              </div>
            </div>
          </Panel>

          {/* ---------- MEDIA ---------- */}
          <Panel
            id="listening"
            index="04"
            kicker="Listening & reading"
            title="On repeat,"
            accent="on the shelf."
          >
            <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:items-end lg:gap-16">
              <div data-reveal style={d(1)}>
                <p className="mb-4 font-sans text-xs text-muted">Now playing</p>
                <CDPlayer />
              </div>
              <div data-reveal style={d(2)}>
                <p className="mb-4 font-sans text-xs text-muted">Bookshelf</p>
                <Bookshelf books={c.books} />
              </div>
            </div>
          </Panel>

          {/* ---------- GAMES ---------- */}
          <Panel
            id="games"
            index="05"
            kicker="Games"
            title="hmu if u want to"
            accent="play."
          >
            <div data-reveal style={d(1)}>
              <Games games={c.games} />
            </div>
          </Panel>

          {/* ---------- CONTACT ---------- */}
          <Panel
            id="contact"
            index="06"
            kicker="Contact"
            title="Say"
            accent="hi."
          >
            <p
              data-reveal
              style={d(1)}
              className="mb-10 max-w-[44ch] text-lg text-muted"
            >
              Links go live once destinations are confirmed.
            </p>
            <div data-reveal style={d(2)}>
              <ContactLinks contacts={c.contacts} size="lg" />
            </div>
            <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 pt-6 font-sans text-xs text-muted">
              <p>
                © {c.profile.displayName} ·{" "}
                <span lang="zh-Hans">{c.profile.chineseName}</span>
              </p>
              <a
                href="#intro"
                className="nav-link inline-flex min-h-11 items-center"
              >
                ← back to start
              </a>
            </footer>
          </Panel>
        </Deck>
      </main>
    </>
  )
}
