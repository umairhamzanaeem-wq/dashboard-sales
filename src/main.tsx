import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from '@/context/AppContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <TooltipProvider delayDuration={200}>
          <App />
        </TooltipProvider>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
)
