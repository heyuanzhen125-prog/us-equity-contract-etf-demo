import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import App from './App'
import AdminApp from './AdminApp'
import './styles.css'

const Page = window.location.pathname === '/admin' ? AdminApp : App
createRoot(document.getElementById('root')!).render(<StrictMode><Page /></StrictMode>)
