import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import DivineLifeShell from './DivineLifeShell.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DivineLifeShell />
  </StrictMode>,
)
