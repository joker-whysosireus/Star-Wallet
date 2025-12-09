import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // <-- ДОБАВЬТЕ ЭТОТ ИМПОРТ
import App from './App.jsx'

// Полифилы для Node.js API в браузере
import { Buffer } from 'buffer'

window.Buffer = Buffer
global.Buffer = Buffer
global.process = global.process || { env: {} }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter> {/* <-- ОБЕРНИТЕ App В BrowserRouter */}
      <App />
    </BrowserRouter>
  </StrictMode>,
)