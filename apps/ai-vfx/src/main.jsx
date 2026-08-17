import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

const mount = document.getElementById('ai-vfx-mount') || document.getElementById('root')
if (mount) {
  ReactDOM.createRoot(mount).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
