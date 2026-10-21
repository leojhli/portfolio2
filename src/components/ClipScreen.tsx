import { useEffect, useRef, useState } from "react"
import type { Game } from "../content/data"
import { AsciiRaster } from "../effects/ascii"
import { usePrefs } from "../state/preferences"
import Icon from "./Icons"

const BARS = ["bg-s1", "bg-s2", "bg-s3", "bg-s4", "bg-s5"]

/**
 * Preview "TV" for the games grid. Plays a muted, looping clip when one exists;
 * otherwise shows palette colour bars and static. Reduced motion never autoplays:
 * the poster shows with an explicit Play button. ASCII mode renders the video
 * (or the static) as characters.
 */
export default function ClipScreen({
  game,
  channel,
}: {
  game: Game | null
  channel: number
}) {
  const { mode, motion, appearance } = usePrefs()
  const ascii = mode === "ascii"
  const inkIsDark = appearance === "light"
  const video = useRef<HTMLVideoElement>(null)
  const pre = useRef<HTMLPreElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [broken, setBroken] = useState<Record<string, true>>({})
  const [manual, setManual] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const clip = game?.clip && !broken[game.id] ? game.clip : undefined
  const want = !!clip && (motion || manual === game?.id)

  useEffect(() => {
    const v = video.current
    setBlocked(false)
    if (!v || !clip) return setPlaying(false)
    if (want)
      v.play().catch(() => {
        setPlaying(false)
        setBlocked(true)
      })
    else v.pause()
  }, [want, clip])

  // ASCII: sample the video (or generated static) into characters.
  useEffect(() => {
    if (!ascii || !pre.current || !box.current) return
    const el = pre.current,
      b = box.current
    const r = new AsciiRaster()
    const noise = document.createElement("canvas")
    const nctx = noise.getContext("2d")
    let raf = 0,
      last = 0,
      roll = 0
    const paintNoise = () => {
      if (!nctx || !r.cols) return
      noise.width = r.cols
      noise.height = r.rows
      const img = nctx.createImageData(r.cols, r.rows)
      roll = (roll + 1) % (r.rows + 8)
      for (let y = 0; y < r.rows; y++) {
        const band = Math.max(0, 1 - Math.abs(y - roll) / 3) * 0.5
        for (let x = 0; x < r.cols; x++) {
          const dens = Math.min(
            1,
            Math.random() ** 3 * 0.8 + band * Math.random(),
          )
          const lum = (inkIsDark ? 1 - dens : dens) * 255
          const i = (y * r.cols + x) * 4
          img.data[i] = img.data[i + 1] = img.data[i + 2] = lum
          img.data[i + 3] = 255
        }
      }
      nctx.putImageData(img, 0, 0)
    }
    const draw = () => {
      const v = video.current
      let txt = ""
      if (v && clip && v.readyState >= 2)
        txt = r.frame(v, v.videoWidth, v.videoHeight, inkIsDark)
      if (!txt) {
        paintNoise()
        txt = r.frame(noise, noise.width, noise.height, inkIsDark)
      }
      el.textContent = txt
    }
    const fit = () => {
      if (r.fit(el, b.clientWidth, b.clientHeight, 6)) draw()
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 70) return
      last = now
      draw()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(b)
    fit()
    const v = video.current
    v?.addEventListener("loadeddata", draw)
    v?.addEventListener("seeked", draw)
    if (motion || want) raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      v?.removeEventListener("loadeddata", draw)
      v?.removeEventListener("seeked", draw)
    }
  }, [ascii, motion, want, clip, inkIsDark, game?.id])

  const status = !game
    ? "Standby"
    : clip
      ? playing
        ? "Playing"
        : "Paused"
      : "No clip yet"
  const showBars = !clip || (!playing && !game?.poster)

  return (
    <figure
      aria-label={
        game ? `Clip preview: ${game.name}. ${status}.` : "Clip preview"
      }
      className="m-0"
    >
      <div
        ref={box}
        className={`relative aspect-video overflow-hidden ${
          ascii
            ? "border border-dashed border-muted"
            : "rounded-[14px] border-[1.5px] border-fg bg-ink text-on-ink shadow-[5px_5px_0_var(--c-fg)]"
        }`}
      >
        {clip && (
          <video
            key={clip}
            ref={video}
            src={clip}
            poster={game?.poster}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() =>
              game && setBroken((b) => ({ ...b, [game.id]: true }))
            }
            className={`absolute inset-0 size-full object-cover ${
              ascii ? "opacity-0" : ""
            }`}
          />
        )}
        {!ascii && showBars && (
          <div
            aria-hidden="true"
            className="absolute inset-0 grid grid-rows-[1fr_auto]"
          >
            <div className="grid grid-cols-5">
              {BARS.map((c) => (
                <span key={c} className={c} />
              ))}
            </div>
            <div className="grid h-[16%] grid-cols-5">
              {[...BARS].reverse().map((c) => (
                <span key={c} className={`${c} brightness-75`} />
              ))}
            </div>
            <span className="tv-static absolute inset-0" />
          </div>
        )}
        <pre
          ref={pre}
          aria-hidden="true"
          data-noscramble
          className="ascii-out"
        />
        {!ascii && (
          <span
            aria-hidden="true"
            className="tv-scan pointer-events-none absolute inset-0"
          />
        )}

        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-0 flex justify-between p-3 font-mono text-[11px] uppercase tracking-wider ${
            ascii ? "text-muted" : ""
          }`}
        >
          <span
            className={ascii ? "bg-bg px-1" : "rounded bg-ink/70 px-1.5 py-0.5"}
          >
            CH {String(channel).padStart(2, "0")}
          </span>
          {game && (
            <span
              className={
                ascii ? "bg-bg px-1" : "rounded bg-ink/70 px-1.5 py-0.5"
              }
            >
              {playing ? "● live" : status}
            </span>
          )}
        </div>

        {(!clip || (!playing && (!want || blocked))) && (
          <div className="absolute inset-0 grid place-items-center p-4">
            {clip ? (
              <button
                type="button"
                onClick={() => {
                  setManual(game!.id)
                  video.current?.play().catch(() => {})
                }}
                className="pop pop-accent"
              >
                <Icon name="play" size={16} /> Play clip
              </button>
            ) : (
              <p
                className={`px-3 py-2 text-center font-mono text-xs uppercase tracking-wider ${
                  ascii
                    ? "bg-bg"
                    : "rounded-md border-[1.5px] border-fg bg-paper text-on-paper shadow-[3px_3px_0_var(--c-fg)]"
                }`}
              >
                {game ? (
                  <>
                    {game.name}
                    <br />
                    {ascii ? "[ clip coming soon ]" : "Clip coming soon"}
                  </>
                ) : ascii ? (
                  "[ hover a game ]"
                ) : (
                  "Hover a game to preview"
                )}
              </p>
            )}
          </div>
        )}
        {clip && playing && !motion && (
          <button
            type="button"
            onClick={() => setManual(null)}
            className="pop pop-sm absolute bottom-3 right-3"
          >
            <Icon name="pause" size={14} /> Pause
          </button>
        )}
      </div>
      <figcaption className="mt-3 flex items-baseline justify-between gap-3 font-mono text-xs text-muted">
        <span className="truncate text-fg">
          {game?.name ?? "Nothing selected"}
        </span>
        <span className="shrink-0">{status}</span>
      </figcaption>
    </figure>
  )
}
