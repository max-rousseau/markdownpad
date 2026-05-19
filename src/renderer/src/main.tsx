import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme } from './lib/theme'
import './index.css'

async function bootstrap() {
  const [theme, themePack] = await Promise.all([
    window.api.getTheme(),
    window.api.getThemePack(),
  ])
  applyTheme(theme, themePack)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App initialTheme={theme} initialThemePack={themePack} />
    </StrictMode>,
  )
}

void bootstrap()
