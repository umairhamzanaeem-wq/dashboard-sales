import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from './App'
import './index.css'

const guestTheme = localStorage.getItem('bd-theme-pref')
if (guestTheme === 'light' || guestTheme === 'dark') {
  document.documentElement.classList.toggle('dark', guestTheme === 'dark')
  document.documentElement.classList.toggle('light', guestTheme === 'light')
}

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
