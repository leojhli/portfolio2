import Page from './components/Page'
import { getContent } from './content/data'
import { AudioProvider } from './state/audio'
import { PreferencesProvider } from './state/preferences'

export default function App() {
  return (
    <PreferencesProvider>
      <AudioProvider tracks={getContent().tracks}>
        <Page />
      </AudioProvider>
    </PreferencesProvider>
  )
}
