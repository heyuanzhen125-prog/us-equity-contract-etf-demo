const ACCESS_COOKIE = 'northstar_access'
const REFRESH_COOKIE = 'northstar_refresh'

function readCookie(req, name) {
  const pair = String(req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))
  if (!pair) return ''
  try { return decodeURIComponent(pair.slice(name.length + 1)) } catch { return '' }
}

function cookie(name, value, maxAge, secure) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

export function createSupabaseAuth({ getConfig, fetchImpl = fetch, secureCookies = process.env.NODE_ENV === 'production' }) {
  async function request(path, { method = 'GET', body, accessToken } = {}) {
    const config = getConfig()
    if (!config) throw new Error('Supabase Auth 尚未配置')
    const response = await fetchImpl(`${config.url}/auth/v1/${path}`, {
      method,
      headers: {
        apikey: config.secretKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const text = await response.text()
    let data = {}
    try { data = text ? JSON.parse(text) : {} } catch { data = {} }
    return { response, data }
  }

  function setSessionCookies(res, session) {
    if (!session?.access_token || !session?.refresh_token) return false
    const accessAge = Math.max(60, Number(session.expires_in) || 3600)
    res.setHeader('Set-Cookie', [
      cookie(ACCESS_COOKIE, session.access_token, accessAge, secureCookies),
      cookie(REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 30, secureCookies),
    ])
    return true
  }

  function clearSessionCookies(res) {
    res.setHeader('Set-Cookie', [
      cookie(ACCESS_COOKIE, '', 0, secureCookies),
      cookie(REFRESH_COOKIE, '', 0, secureCookies),
    ])
  }

  async function signUp(email, password, referralCode = '') {
    return request('signup', { method: 'POST', body: { email, password, data: { referral_code: referralCode } } })
  }

  async function signIn(email, password) {
    return request('token?grant_type=password', { method: 'POST', body: { email, password } })
  }

  async function currentUser(req, res) {
    let accessToken = readCookie(req, ACCESS_COOKIE)
    const refreshToken = readCookie(req, REFRESH_COOKIE)
    if (!accessToken && !refreshToken) return null

    let result = accessToken ? await request('user', { accessToken }) : { response: { status: 401 }, data: {} }
    if (result.response.status === 401 && refreshToken) {
      const refreshed = await request('token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } })
      if (!refreshed.response.ok) {
        clearSessionCookies(res)
        return null
      }
      setSessionCookies(res, refreshed.data)
      accessToken = refreshed.data.access_token
      result = await request('user', { accessToken })
    }
    if (!result.response.ok || typeof result.data.id !== 'string') return null
    return result.data
  }

  return { signUp, signIn, currentUser, setSessionCookies, clearSessionCookies }
}
