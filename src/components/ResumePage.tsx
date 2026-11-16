import { useEffect, type CSSProperties } from "react"
import { getContent, type Experience } from "../content/data"
import Logo from "./Logo"
import QuickviewBackdrop from "./QuickviewBackdrop"
import PickemBracket from "./PickemBracket"
import Rich from "./Rich"
import ContactIcon from "./ContactIcon"
import PreviewLink from "./PreviewLink"
import "../resume.css"

const c = getContent()
const filled = (value: string | undefined) =>
  !!value?.trim() && !value.trim().startsWith("[")
const contacts = c.contacts.filter((item) => item.href && item.id !== "resume")

const UW_GOLD = "#d9a400"
const tint = (accent?: string) => (accent ? ({ "--accent": accent } as CSSProperties) : undefined)
const SKILL_COLOURS: Record<string, string> = { Languages: "#3d7bff", Frameworks: "#7c5cff", Platforms: "#1f9d6b" }
// Each link wears its own brand's colour.
const CONTACT_COLOURS: Record<string, string> = {
  email: "#d9a400",
  linkedin: "#0a66c2",
  github: "#6e5494",
  x: "var(--rs-fg)",
  instagram: "#e1306c",
}

function Org({ item }: { item: Pick<Experience, "organization" | "logo" | "url" | "accent" | "preview"> }) {
  const body = (
    <>
      {item.logo && <img src={item.logo} alt="" width="16" height="16" />}
      {item.organization}
    </>
  )
  return item.url ? (
    <PreviewLink className="rs-org" style={tint(item.accent)} href={item.url} preview={item.preview}>
      {body}
    </PreviewLink>
  ) : (
    <span className="rs-org" style={tint(item.accent)}>
      {body}
    </span>
  )
}

/** Quickview: everything on one quiet page, with no film, sound or waiting. */
export default function ResumePage() {
  useEffect(() => {
    document.title = `${c.profile.displayName} — Quickview`
  }, [])
  const current = c.experience.filter((item) => /present/i.test(item.dates))

  return (
    <div className="rs-page">
      <QuickviewBackdrop />
      <header className="rs-top">
        <a className="rs-brand" href="/" aria-label="Leo Li, watch the film">
          <Logo />
        </a>
        <nav aria-label="Modes">
          <a href="/">Film</a>
          <a href="/quickview" aria-current="page">
            Quickview
          </a>
          <a href="/Leo_Li_Resume.pdf" target="_blank" rel="noreferrer">
            PDF ↗
          </a>
        </nav>
      </header>

      <main className="rs-main">
        <h1>
          <span className="rs-name">{c.profile.displayName}</span> <span lang="zh">{c.profile.chineseName}</span>
        </h1>
        <p className="rs-lead">
          I study{" "}
          <PreviewLink className="rs-hl rs-hl-link" style={tint(UW_GOLD)} href={c.education.programUrl} preview={c.education.programPreview}>
            computer engineering
          </PreviewLink>{" "}
          at{" "}
          <Org
            item={{
              organization: c.education.school,
              logo: c.education.logo,
              url: c.education.programUrl,
              accent: UW_GOLD,
              preview: c.education.programPreview,
            }}
          />
          , and I like building things people can see and touch.
        </p>

        <section aria-labelledby="rs-now">
          <h2 id="rs-now">Currently</h2>
          <ul className="rs-dash">
            {current.map((item) => (
              <li key={item.id} style={tint(item.accent)}>
                {item.role.toLowerCase()} @ <Org item={item} />
                <span className="rs-muted">
                  , <Rich text={item.summary.charAt(0).toLowerCase() + item.summary.slice(1)} accent={item.accent} />
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="rs-experience">
          <h2 id="rs-experience">Experience</h2>
          <ol className="rs-entries">
            {c.experience.map((item) => (
              <li key={item.id} style={tint(item.accent)}>
                <div className="rs-entry-head">
                  <h3>
                    {item.role} @ <Org item={item} />
                  </h3>
                  <span className="rs-date">{item.dates}</span>
                </div>
                {(item.points.length ? item.points : [item.summary])
                  .filter(filled)
                  .map((point) => (
                    <p key={point}>
                      <Rich text={point} accent={item.accent} />
                    </p>
                  ))}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="rs-projects">
          <h2 id="rs-projects">Projects</h2>
          <ol className="rs-entries">
            {c.projects.map((item) => (
              <li key={item.id} style={tint(item.accent)}>
                <div className="rs-entry-head">
                  <h3>
                    {item.repoUrl ? (
                      <PreviewLink href={item.repoUrl} preview={item.preview}>
                        {item.title} ↗
                      </PreviewLink>
                    ) : (
                      item.title
                    )}
                  </h3>
                  <span className="rs-date rs-tech">
                    {item.technologies.join(" · ")}
                  </span>
                </div>
                {(item.points?.length ? item.points : [item.summary]).map((point) => (
                  <p key={point}>
                    <Rich text={point} accent={item.accent} />
                  </p>
                ))}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="rs-pickems">
          <h2 id="rs-pickems">Off the clock</h2>
          <p className="rs-pk-lead" style={tint("#d9a400")}>
            Lifelong <span className="rs-term" style={tint("#22b8e6")}>BLG</span> fan. At Worlds 2026 I called{" "}
            <mark className="rs-hl">every knockout series</mark>, including their run to the title, and backed the LPL
            on Polymarket before it happened.
          </p>
          <PickemBracket />
        </section>

        <section aria-labelledby="rs-education">
          <h2 id="rs-education">Education</h2>
          <div className="rs-entry-head">
            <h3>
              <Org
                item={{
                  organization: c.education.school,
                  logo: c.education.logo,
                  url: "https://uwaterloo.ca/",
                  accent: UW_GOLD,
                }}
              />
            </h3>
            <span className="rs-date">{c.education.dates}</span>
          </div>
          <p>{c.education.degree}</p>
          <p className="rs-muted">
            Coursework: {c.education.coursework.join(", ")}
          </p>
        </section>

        <section aria-labelledby="rs-skills">
          <h2 id="rs-skills">Skills</h2>
          <dl className="rs-skills">
            {c.skills.map((group) => (
              <div key={group.label} style={tint(SKILL_COLOURS[group.label])}>
                <dt>{group.label}</dt>
                <dd>
                  {group.items.map((skill) => (
                    <span key={skill} className="rs-skill">
                      {skill}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="rs-contact">
          <h2 id="rs-contact">Contact</h2>
          <p className="rs-links">
            {contacts.map((item) => (
              <a
                key={item.id}
                style={tint(CONTACT_COLOURS[item.id])}
                href={item.href}
                {...(item.id === "email" ? {} : { target: "_blank", rel: "noreferrer" })}
              >
                <ContactIcon id={item.id} />
                {item.label}
              </a>
            ))}
          </p>
        </section>
      </main>

      <footer className="rs-foot">
        <span>© {new Date().getFullYear()} Leo Li</span>
        <a href="/">Watch the film →</a>
      </footer>
    </div>
  )
}
