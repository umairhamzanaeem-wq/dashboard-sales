import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import { applyTheme, readStoredTheme } from '@/lib/theme'
import App from './App'
import './index.css'

applyTheme(readStoredTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider delayDuration={200}>
          <App />
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
