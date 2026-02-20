import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import StillHere from './StillHere.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StillHere />
  </StrictMode>,
)
