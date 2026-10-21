import { useEffect, useState } from 'react'
import { useAudio, type Status } from '../state/audio'
import { usePrefs } from '../state/preferences'
import Icon from './Icons'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const LABEL: Record<Status, string> = {
  unavailable: 'Audio coming soon',
  idle: 'Ready',
  loading: 'Loading…',
  playing: 'Playing',
  paused: 'Paused',
  ended: 'Ended',
  error: 'Could not play this track',
}
const SPIN = ['|', '/', '-', '\\']
const disc = (hub: string) =>
  [
    "    _.-----._",
    "  .'  .---.  '.",
    ' /   /     \\   \\',
    ` |   |  ${hub}  |   |`,
    ' \\   \\     /   /',
    "  '.  '---'  .'",
    "    '-.....-'",
  ].join('\n')

export default function CDPlayer() {
  const a = useAudio()
  const { mode, motion } = usePrefs()
  const ascii = mode === 'ascii'
  const off = a.status === 'unavailable'
  const playing = a.status === 'playing'
  const spinning = playing && motion
  const [f, setF] = useState(0)
  useEffect(() => {
    if (!ascii || !spinning) return
    const id = window.setInterval(() => setF((x) => (x + 1) % 4), 160)
    return () => window.clearInterval(id)
  }, [ascii, spinning])

  const btn = 'pop size-12 justify-center !p-0'
  const single = a.tracks.length <= 1
  return (
    <div className="box cd-shell grid gap-6 !border-[1.5px] !border-fg bg-surface p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-7">
      <div data-fx data-spring className="mx-auto">
        {ascii ? (
          <pre aria-hidden="true" className="font-mono text-[12px] leading-[1.15] text-muted">{disc(spinning ? SPIN[f] : 'o')}</pre>
        ) : (
          <div
            aria-hidden="true"
            className="disc relative size-36 rounded-full shadow-[inset_0_0_0_1px_var(--c-line),0_6px_18px_-8px_rgba(0,0,0,.35)] sm:size-40"
            data-playing={spinning}
            style={{ background: a.track?.artwork ? `center/cover url(${a.track.artwork})` : 'repeating-radial-gradient(circle at center, var(--c-surface) 0 2px, var(--c-line) 2px 3px), var(--c-surface)' }}
          >
            <div className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 30deg, transparent 0 15%, color-mix(in oklab, var(--c-fx) 30%, transparent) 20%, transparent 32% 62%, color-mix(in oklab, var(--c-fg) 12%, transparent) 68%, transparent 78%)' }} />
            <div className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-accent/80" />
            <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg shadow-[inset_0_0_0_1px_var(--c-line)]" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="flex justify-between gap-3 font-mono text-xs uppercase tracking-wide text-muted">
          <span aria-live="polite">{LABEL[a.status]}</span>
          {a.tracks.length > 1 && <span className="tabular-nums">{a.index + 1} / {a.tracks.length}</span>}
        </p>
        <p className="mt-1 truncate text-lg font-medium">{a.track?.title ?? '[Track title]'}</p>
        <p className="truncate text-sm text-muted">{a.track?.artist ?? '[Artist]'}</p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className={btn} disabled={off || single} onClick={a.prev} aria-label="Previous track"><Icon name="prev" size={16} /></button>
          <button type="button" className={`${btn} pop-accent size-14`} disabled={off} onClick={a.toggle} aria-label={playing ? 'Pause' : 'Play'}>
            <Icon name={playing ? 'pause' : 'play'} size={18} />
          </button>
          <button type="button" className={btn} disabled={off || single} onClick={a.next} aria-label="Next track"><Icon name="next" size={16} /></button>
        </div>
        <div className="mt-4 flex items-center gap-3 font-mono text-xs text-muted">
          <span className="w-10 text-right">{fmt(a.time)}</span>
          <input type="range" aria-label="Seek" min={0} max={a.duration || 0} step={0.1} value={Math.min(a.time, a.duration || 0)} disabled={off || !a.duration} onChange={(e) => a.seek(Number(e.target.value))} className="min-h-11 min-w-0 flex-1 accent-[var(--c-accent)] disabled:opacity-40" />
          <span className="w-10">{a.duration ? fmt(a.duration) : '--:--'}</span>
        </div>
        <label className="mt-1 flex items-center gap-3 text-xs text-muted">
          <Icon name="volume" size={16} />
          <span className="sr-only">Volume</span>
          <input type="range" min={0} max={1} step={0.05} value={a.volume} disabled={off} onChange={(e) => a.setVolume(Number(e.target.value))} className="min-h-11 w-32 accent-[var(--c-accent)] disabled:opacity-40" />
        </label>
        {off && <p className="mt-2 text-sm text-muted">No audio files have been added yet, so the controls are disabled.</p>}
      </div>
    </div>
  )
}
