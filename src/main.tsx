import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installAppRecovery } from './lib/app-recovery'

installAppRecovery()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
