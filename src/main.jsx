import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Debug logs
console.log('Debug: main.jsx is executing')
console.log('Debug: root element exists?', !!document.getElementById('root'))

// Clear any existing content in root
const rootElement = document.getElementById('root')
if (rootElement) {
  rootElement.innerHTML = ''
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
) 