import CinematicPortfolio from './components/CinematicPortfolio'
import { getContent } from './content/data'
import { AudioProvider } from './state/audio'
import { PreferencesProvider } from './state/preferences'

export default function App() {
  return (
    <PreferencesProvider>
      <AudioProvider tracks={getContent().tracks}>
        <CinematicPortfolio />
      </AudioProvider>
    </PreferencesProvider>
  )
}
