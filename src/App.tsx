import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Logo from './components/Logo'
import { getContent } from './content/data'
import { AudioProvider } from './state/audio'
import { PreferencesProvider } from './state/preferences'
import './modes.css'

type Mode = 'film' | 'quick'
// Each mode loads only its own code: Quickview visitors never download the film.
const loaders = {
  film: () => import('./components/CinematicPortfolio'),
  quick: () => import('./components/ResumePage'),
}
const views = { film: lazy(loaders.film), quick: lazy(loaders.quick) }
const paths: Record<Mode, string> = { film: '/', quick: '/quickview' }
const modeOf = (pathname: string): Mode =>
  /^\/(quickview|resume)\/?$/.test(pathname) ? 'quick' : 'film'
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function App() {
  const [mode, setMode] = useState<Mode>(() =>
    typeof window === 'undefined' ? 'film' : modeOf(window.location.pathname),
  )
  // The curtain rises from below, holds while the other mode loads, then
  // leaves through the top.
  const [curtain, setCurtain] = useState<'idle' | 'in' | 'out'>('idle')
  const [heading, setHeading] = useState<Mode>(mode)
  const current = useRef(mode)
  const busy = useRef(false)

  const go = useCallback(async (target: Mode, push: boolean) => {
    if (busy.current || target === current.current) return
    busy.current = true
    setHeading(target)
    setCurtain('in')
    // Cover the page and fetch the other mode at the same time.
    await Promise.all([loaders[target]().catch(() => {}), wait(560)])
    if (push) window.history.pushState(null, '', paths[target])
    current.current = target
    setMode(target)
    window.scrollTo?.(0, 0)
    await wait(380)
    setCurtain('out')
    await wait(560)
    setCurtain('idle')
    busy.current = false
  }, [])

  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return
      const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin || url.hash) return
      if (url.pathname !== '/' && modeOf(url.pathname) !== 'quick') return
      event.preventDefault()
      void go(modeOf(url.pathname), true)
    }
    const back = () => void go(modeOf(window.location.pathname), false)
    document.addEventListener('click', click)
    window.addEventListener('popstate', back)
    return () => {
      document.removeEventListener('click', click)
      window.removeEventListener('popstate', back)
    }
  }, [go])

  const View = views[mode]
  return (
    <PreferencesProvider>
      <AudioProvider tracks={getContent().tracks}>
        <Suspense fallback={null}>
          <View />
        </Suspense>
        <div className="mode-curtain" data-state={curtain} aria-hidden={curtain === 'idle'}>
          <Logo />
          <p role="status">
            {curtain === 'idle' ? '' : heading === 'quick' ? 'Opening Quickview' : 'Entering the film'}
          </p>
          <span className="mode-curtain-bar" />
        </div>
      </AudioProvider>
    </PreferencesProvider>
  )
}
