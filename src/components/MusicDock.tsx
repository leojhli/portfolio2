import { useEffect, useRef, useState } from "react"
import { useAudio } from "../state/audio"
import { usePrefs } from "../state/preferences"
import CDPlayer from "./CDPlayer"
import Icon from "./Icons"

/** A second control surface for the existing, app-wide audio instance. */
export default function MusicDock() {
  const audio = useAudio()
  const { mode } = usePrefs()
  const [open, setOpen] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const playing = audio.status === "playing"
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("keydown", escape)
    }
  }, [open])
  return (
    <div className="music-dock" ref={host} role="region" aria-label="Taskbar music player">
      <button ref={trigger} type="button" className="music-dock-track"
        aria-label="Music player details" aria-expanded={open} aria-controls="taskbar-music-panel"
        onClick={() => setOpen(value => !value)}>
        {mode === "ascii" ? <span aria-hidden="true" className="music-dock-ascii">((o))</span> :
          <span className="music-dock-disc disc" data-playing={playing} aria-hidden="true"
            style={audio.track?.artwork ? { backgroundImage: `url(${audio.track.artwork})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />}
        <span className="music-dock-copy"><strong>{audio.track?.title ?? "Music"}</strong><span>{audio.status === "error" ? "Track unavailable" : audio.track?.artist ?? "Select a track"}</span></span>
      </button>
      <button type="button" className="music-dock-control" aria-label={playing ? "Pause music" : "Play music"}
        disabled={audio.status === "unavailable"} onClick={audio.toggle}>
        <Icon name={playing ? "pause" : "play"} size={16} />
      </button>
      <button type="button" className="music-dock-control" aria-label="Skip music track"
        disabled={audio.tracks.length < 2} onClick={audio.next}><Icon name="next" size={15} /></button>
      {open && <section id="taskbar-music-panel" className="music-dock-panel" aria-label="Playback controls">
        <div className="music-dock-panel-heading"><span>ON REPEAT</span><button type="button" aria-label="Close music player" onClick={() => { setOpen(false); trigger.current?.focus() }}><Icon name="close" size={16} /></button></div>
        <CDPlayer />
      </section>}
    </div>
  )
}
