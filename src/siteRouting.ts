function readOrigin(value: string | undefined) {
  if (!value?.trim()) return ''
  try {
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol)) return ''
    return url.origin
  } catch {
    return ''
  }
}

export const ADMIN_SITE_URL = readOrigin(import.meta.env.VITE_ADMIN_URL)
export const FRONTEND_SITE_URL = readOrigin(import.meta.env.VITE_FRONTEND_URL)
export const IS_ADMIN_HOST = Boolean(
  ADMIN_SITE_URL && window.location.hostname === new URL(ADMIN_SITE_URL).hostname,
)
export const ADMIN_LINK_HREF = ADMIN_SITE_URL || '/admin'
export const FRONTEND_LINK_HREF = FRONTEND_SITE_URL || '/'
