import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme } from './lib/theme'
import './index.css'

async function bootstrap() {
  const [theme, appTheme, codeTheme] = await Promise.all([
    window.api.getTheme(),
    window.api.getAppTheme(),
    window.api.getCodeTheme(),
  ])
  applyTheme(theme, appTheme, codeTheme)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App initialTheme={theme} initialAppTheme={appTheme} initialCodeTheme={codeTheme} />
    </StrictMode>,
  )
}

void bootstrap()
