import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import App from './App'
import AdminApp from './AdminApp'
import DepositOverlay from './DepositOverlay'
import { ADMIN_SITE_URL, IS_ADMIN_HOST } from './siteRouting'
import './styles.css'

const path = window.location.pathname
const isLegacyAdminPath = path === '/admin' || path.startsWith('/admin/')
const adminSubpath = isLegacyAdminPath ? path.slice('/admin'.length) || '/' : ''

if (isLegacyAdminPath && ADMIN_SITE_URL && !IS_ADMIN_HOST) {
  window.location.replace(`${ADMIN_SITE_URL}${adminSubpath}${window.location.search}${window.location.hash}`)
} else if (isLegacyAdminPath && IS_ADMIN_HOST) {
  window.history.replaceState(null, '', `${adminSubpath}${window.location.search}${window.location.hash}`)
}

const Page = IS_ADMIN_HOST || isLegacyAdminPath ? AdminApp : App
createRoot(document.getElementById('root')!).render(<StrictMode><><Page /><DepositOverlay /></></StrictMode>)
