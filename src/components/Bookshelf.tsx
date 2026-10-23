import { useEffect, useRef, useState } from "react"
import type { Book } from "../content/data"
import { usePrefs } from "../state/preferences"
import Icon from "./Icons"
import { assemble, disperse } from "../effects/coordinator"

const PER_SHELF = 10
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
  const shelves = Array.from(
    { length: Math.ceil(books.length / PER_SHELF) },
    (_, i) => books.slice(i * PER_SHELF, (i + 1) * PER_SHELF),
  )
  const reading = books.filter((b) => b.status === "Reading").length
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        {books.length} books · {reading} reading now
      </p>
      <ul aria-label="Books" className="space-y-4">
        {shelves.map((row, s) => (
          <li key={s}>
            <ul className="flex snap-x items-end gap-1.5 overflow-x-auto px-1 pb-2 pt-2">
              {row.map((b, j) => (
                <li
                  key={b.id}
                  className={
                    ascii
                      ? "shrink-0 snap-start"
                      : "shrink-0 snap-start sm:min-w-0 sm:max-w-10 sm:flex-1"
                  }
                >
                  <button
                    type="button"
                    onClick={(e) => open(b, e.currentTarget)}
                    aria-haspopup="dialog"
                    aria-label={`${b.title} by ${b.author}, ${b.status.toLowerCase()}`}
                    className={
                      ascii
                        ? "min-h-11 border border-dashed border-muted px-2 py-2 font-sans text-xs hover:text-accent"
                        : "spine relative flex w-10 flex-col items-center justify-between overflow-hidden rounded-[4px] border-[1.5px] border-fg pb-2 pt-2.5 sm:w-full"
                    }
                    style={
                      ascii
                        ? undefined
                        : {
                            height: `${b.height * 2}px`,
                            background: `linear-gradient(90deg, rgba(0,0,0,.10), transparent 22%, rgba(255,255,255,.08) 55%, rgba(0,0,0,.12)), var(--c-s${((s * PER_SHELF + j) % 5) + 1})`,
                            color: `var(--c-on-s${((s * PER_SHELF + j) % 5) + 1})`,
                          }
                    }
                  >
                    {ascii ? (
                      `|${
                        b.title.length > 14
                          ? `${b.title.slice(0, 13)}…`
                          : b.title
                      }|`
                    ) : (
                      <>
                        <span className="min-h-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium [writing-mode:vertical-rl]">
                          {b.title}
                        </span>
                        {b.status === "Reading" && (
                          <span
                            aria-hidden="true"
                            className="mt-1.5 size-2 shrink-0 rounded-full border border-current bg-accent-fill"
                          />
                        )}
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {!ascii && (
              <div
                aria-hidden="true"
                data-fx
                className="h-2.5 rounded-sm border-[1.5px] border-fg bg-fg"
              />
            )}
            {ascii && (
              <p
                aria-hidden="true"
                className="overflow-hidden whitespace-nowrap font-mono text-muted"
              >
                {"=".repeat(120)}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 font-sans text-xs text-muted sm:hidden">
        Scroll the shelf sideways →
      </p>

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
