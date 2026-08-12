import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import Shell from './Shell.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
)
