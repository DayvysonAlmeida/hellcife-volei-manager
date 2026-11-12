import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { z } from 'zod'
import './index.css'
import App from './App.tsx'

// O CSP do vercel.json não deixa rodar código montado em texto (new Function). Sem isso o zod ainda testaria se
// pode, e o navegador registraria o bloqueio como erro; os formulários validam igual.
z.config({ jitless: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
