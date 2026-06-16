import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { installApiBase } from './utils/apiBase'
import i18n from './i18n'
import App from './App'
import './index.css'

// 跨站部署（EdgeOne 等）：在任何请求发出前装好 API 基址改写。
// VITE_API_BASE 未设置时为 no-op，同源部署行为完全不变。
installApiBase()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </I18nextProvider>
  </React.StrictMode>,
)
