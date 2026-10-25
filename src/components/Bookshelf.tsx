import { useEffect, useRef, useState } from "react"
import type { Book } from "../content/data"
import { usePrefs } from "../state/preferences"
import Icon from "./Icons"
import { assemble, disperse } from "../effects/coordinator"

const yearLabel = (y: number) => (y < 0 ? `c. ${-y} BC` : String(y))

export default function Bookshelf({ books }: { books: Book[] }) {
  const { mode } = usePrefs()
  const ascii = mode === "ascii"
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const [active, setActive] = useState<Book | null>(null)
  const closing = useRef(false)
  useEffect(() => {
    if (active && dialog.current?.open) assemble(dialog.current)
  }, [active])
  const close = () => {
    const el = dialog.current
    if (!el?.open || closing.current) return
    closing.current = true
    disperse(el, () => {
      el.close()
      closing.current = false
    })
  }

  const open = (b: Book, el: HTMLButtonElement) => {
    trigger.current = el
    setActive(b)
    dialog.current?.showModal()
  }
  const shelves = [
    { title: "On my desk", books: books.filter(book => book.status === "Reading") },
    { title: "The library", books: books.filter(book => book.status !== "Reading") },
  ].filter(shelf => shelf.books.length)
  return (
    <div className="cover-library">
      <p className="mb-5 text-sm text-muted">{books.length} books · select a cover for a closer look</p>
      <ul aria-label="Books" className="cover-shelves">
        {shelves.map((shelf, index) => (
          <li key={shelf.title} className="cover-shelf">
            <div className="cover-shelf-heading">
              <h4 id={`shelf-title-${index}`}>{shelf.title} <span>/ {String(shelf.books.length).padStart(2, "0")}</span></h4>
              <div className="cover-shelf-controls">
                <button type="button" aria-label={`Previous books in ${shelf.title}`} onClick={event => event.currentTarget.closest(".cover-shelf")?.querySelector(".cover-rail")?.scrollBy({ left: -320, behavior: "smooth" })}><Icon name="prev" size={14} /></button>
                <button type="button" aria-label={`Next books in ${shelf.title}`} onClick={event => event.currentTarget.closest(".cover-shelf")?.querySelector(".cover-rail")?.scrollBy({ left: 320, behavior: "smooth" })}><Icon name="next" size={14} /></button>
              </div>
            </div>
            <div className="cover-rail" role="region" aria-labelledby={`shelf-title-${index}`} tabIndex={0}>
              <ul className="cover-row">
                {shelf.books.map(book => (
                  <li key={book.id}>
                    <button type="button" className="book-display" onClick={event => open(book, event.currentTarget)}
                      aria-haspopup="dialog" aria-label={`${book.title} by ${book.author}, ${book.status.toLowerCase()}`}>
                      {ascii ? <pre className="book-ascii" aria-hidden="true">{`+--------------+\n|              |\n|    BOOK      |\n|              |\n+--------------+`}</pre> :
                        <span className="book-jacket">
                          <span className="book-cover-fallback" aria-hidden="true">{book.title}<small>{book.author}</small></span>
                          {book.cover && <img src={book.cover} alt="" loading="lazy" decoding="async" width="160" height="240" onError={event => { event.currentTarget.hidden = true }} />}
                          {book.status === "Reading" && <span className="book-ribbon" aria-hidden="true" />}
                        </span>}
                      <span className="book-caption"><strong>{book.title}</strong><span>{book.author}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-labelledby="book-title"
        onClose={() => {
          setActive(null)
          closing.current = false
          trigger.current?.focus()
        }}
        onCancel={(e) => {
          e.preventDefault()
          close()
        }}
        onClick={(e) => {
          if (e.target === dialog.current) close()
        }}
        className="box m-auto w-[min(92vw,520px)] rounded-xl border-[1.5px] border-fg p-0 text-fg shadow-[8px_8px_0_var(--c-accent)] backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        {active && (
          <div className="p-6">
            <div className="flex items-start gap-5">
              {active.cover && !ascii && (
                <img
                  src={active.cover}
                  alt={`Cover of ${active.title}`}
                  className="w-24 shrink-0 rounded-[4px] border-[1.5px] border-fg shadow-[3px_3px_0_var(--c-fg)] sm:w-28"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-sans text-xs uppercase tracking-wide text-muted">
                  {active.status}
                </p>
                <h3 id="book-title" className="mt-1 text-xl font-medium">
                  {active.title}
                </h3>
                <p className="text-sm text-muted">{active.author}</p>
                {active.tags && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {active.tags.map((t) => (
                      <li
                        key={t}
                        className="rounded-md border border-line px-2 py-0.5 font-sans text-[11px] text-muted"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="pop pop-sm size-11 shrink-0 justify-center !p-0"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            {active.synopsis && (
              <p className="mt-5 text-[15px] leading-relaxed">
                {active.synopsis}
              </p>
            )}
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {active.year !== undefined && (
                <>
                  <dt className="text-muted">Published</dt>
                  <dd>{yearLabel(active.year)}</dd>
                </>
              )}
              {active.pages && (
                <>
                  <dt className="text-muted">Pages</dt>
                  <dd>{active.pages}</dd>
                </>
              )}
              {active.note && (
                <>
                  <dt className="text-muted">Note</dt>
                  <dd>{active.note}</dd>
                </>
              )}
            </dl>
          </div>
        )}
      </dialog>
    </div>
  )
}
