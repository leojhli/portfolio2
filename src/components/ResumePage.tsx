import { useEffect } from "react"
import { getContent, type Experience } from "../content/data"
import Logo from "./Logo"
import "../resume.css"

const c = getContent()
const filled = (value: string | undefined) =>
  !!value?.trim() && !value.trim().startsWith("[")
const contacts = c.contacts.filter((item) => item.href && item.id !== "resume")

function Org({ item }: { item: Pick<Experience, "organization" | "logo" | "url"> }) {
  const body = (
    <>
      {item.logo && <img src={item.logo} alt="" width="16" height="16" />}
      {item.organization}
    </>
  )
  return item.url ? (
    <a className="rs-org" href={item.url} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    <span className="rs-org">{body}</span>
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
          {c.profile.displayName} <span lang="zh">{c.profile.chineseName}</span>
        </h1>
        <p className="rs-lead">
          I study computer engineering at{" "}
          <Org
            item={{
              organization: c.education.school,
              logo: c.education.logo,
              url: "https://uwaterloo.ca/",
            }}
          />
          .
        </p>

        <section aria-labelledby="rs-now">
          <h2 id="rs-now">Currently</h2>
          <ul className="rs-dash">
            {current.map((item) => (
              <li key={item.id}>
                {item.role.toLowerCase()} @ <Org item={item} />
                <span className="rs-muted">, {item.summary.charAt(0).toLowerCase() + item.summary.slice(1)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="rs-experience">
          <h2 id="rs-experience">Experience</h2>
          <ol className="rs-entries">
            {c.experience.map((item) => (
              <li key={item.id}>
                <div className="rs-entry-head">
                  <h3>
                    {item.role} @ <Org item={item} />
                  </h3>
                  <span className="rs-date">{item.dates}</span>
                </div>
                {(item.points.length ? item.points : [item.summary])
                  .filter(filled)
                  .map((point) => (
                    <p key={point}>{point}</p>
                  ))}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="rs-projects">
          <h2 id="rs-projects">Projects</h2>
          <ol className="rs-entries">
            {c.projects.map((item) => (
              <li key={item.id}>
                <div className="rs-entry-head">
                  <h3>
                    {item.repoUrl ? (
                      <a href={item.repoUrl} target="_blank" rel="noreferrer">
                        {item.title} ↗
                      </a>
                    ) : (
                      item.title
                    )}
                  </h3>
                  <span className="rs-date rs-tech">
                    {item.technologies.join(" · ")}
                  </span>
                </div>
                {(item.points?.length ? item.points : [item.summary]).map((point) => (
                  <p key={point}>{point}</p>
                ))}
              </li>
            ))}
          </ol>
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
              <div key={group.label}>
                <dt>{group.label}</dt>
                <dd>{group.items.join(", ")}</dd>
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
                href={item.href}
                {...(item.id === "email" ? {} : { target: "_blank", rel: "noreferrer" })}
              >
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
