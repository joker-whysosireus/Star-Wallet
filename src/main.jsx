import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Полифилы для Node.js API в браузере
import { Buffer } from 'buffer'

// Устанавливаем Buffer в глобальные объекты
window.Buffer = Buffer
global.Buffer = Buffer
global.process = global.process || { env: {} }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)