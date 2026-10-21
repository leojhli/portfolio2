import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Track } from '../content/data'

export type Status = 'unavailable' | 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'
type AudioState = {
  tracks: Track[]
  track: Track | undefined
  index: number
  status: Status
  time: number
  duration: number
  volume: number
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (t: number) => void
  setVolume: (v: number) => void
}
const Ctx = createContext<AudioState | null>(null)
export const useAudio = () => useContext(Ctx)!

/** One audio instance for the whole app; settings changes never remount it. */
export function AudioProvider({ tracks: all, children }: { tracks: Track[]; children: ReactNode }) {
  const tracks = all.filter((t) => t.src)
  const ref = useRef<HTMLAudioElement | null>(null)
  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<Status>(tracks.length ? 'idle' : 'unavailable')
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVol] = useState(0.8)
  const onEnded = useRef<() => void>(() => {})

  const audio = () => {
    if (ref.current) return ref.current
    const a = new Audio()
    a.preload = 'none'
    a.volume = volume
    a.addEventListener('waiting', () => setStatus('loading'))
    a.addEventListener('playing', () => setStatus('playing'))
    a.addEventListener('pause', () => { if (!a.ended) setStatus('paused') })
    a.addEventListener('ended', () => { setStatus('ended'); onEnded.current() })
    a.addEventListener('error', () => setStatus('error'))
    a.addEventListener('timeupdate', () => setTime(a.currentTime))
    a.addEventListener('durationchange', () => setDuration(Number.isFinite(a.duration) ? a.duration : 0))
    ref.current = a
    return a
  }
  useEffect(() => () => ref.current?.pause(), [])

  const load = (i: number, autoplay: boolean) => {
    const a = audio()
    a.src = tracks[i].src!
    setIndex(i)
    setTime(0)
    setDuration(0)
    if (autoplay) { setStatus('loading'); a.play().catch(() => setStatus('error')) } else setStatus('idle')
  }
  // Continue to the next track when one finishes.
  onEnded.current = () => { if (tracks.length > 1) load((index + 1) % tracks.length, true) }

  const value: AudioState = {
    tracks,
    track: tracks[index] ?? all[0],
    index,
    status,
    time,
    duration,
    volume,
    toggle: () => {
      if (!tracks.length) return
      const a = audio()
      if (!a.src) return load(index, true)
      if (a.paused) { setStatus('loading'); a.play().catch(() => setStatus('error')) } else a.pause()
    },
    next: () => tracks.length > 1 && load((index + 1) % tracks.length, status === 'playing'),
    prev: () => tracks.length > 1 && load((index - 1 + tracks.length) % tracks.length, status === 'playing'),
    seek: (t) => { const a = ref.current; if (a) { a.currentTime = t; setTime(t) } },
    setVolume: (v) => { setVol(v); if (ref.current) ref.current.volume = v },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
