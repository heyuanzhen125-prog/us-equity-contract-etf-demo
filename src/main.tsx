import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import App from './App'
import AdminApp from './AdminApp'
import DepositOverlay from './DepositOverlay'
import './styles.css'

const path = window.location.pathname
const Page = path.startsWith('/admin') ? AdminApp : App
createRoot(document.getElementById('root')!).render(<StrictMode><><Page /><DepositOverlay /></></StrictMode>)
