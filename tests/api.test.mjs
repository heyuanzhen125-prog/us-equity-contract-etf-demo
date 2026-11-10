import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { randomUUID } from 'node:crypto'

process.env.VERCEL = '1'
const { default: app } = await import('../server/index.mjs')

let server
let baseUrl
let adminKey

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`

  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ masterKey: process.env.ADMIN_REVIEW_KEY || 'local-demo-admin' }),
  })
  assert.equal(response.status, 200)
  adminKey = (await response.json()).token
})

after(() => {
  server.closeAllConnections?.()
  server.close()
})

async function request(path, { method = 'GET', body, admin = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (admin) headers['x-admin-key'] = adminKey
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { response, data: await response.json() }
}

async function setOutcome(kind, personalId, result) {
  const { response, data } = await request(`/api/admin/outcome-controls/${kind}`, {
    method: 'PUT',
    admin: true,
    body: { target: personalId, result },
  })
  assert.equal(response.status, 200, JSON.stringify(data))
}

async function changeOrderResult(kind, orderId, result) {
  const { response, data } = await request(`/api/admin/orders/${kind}/${orderId}/result`, {
    method: 'PATCH',
    admin: true,
    body: { result },
  })
  assert.equal(response.status, 200, JSON.stringify(data))
}

test('admin access is required and demo order settlements reconcile virtual balances', async () => {
  const unauthorized = await request('/api/admin/orders')
  assert.equal(unauthorized.response.status, 401)

  const personalId = `NST-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`
  const projectResponse = await request('/api/admin/projects', {
    method: 'POST',
    admin: true,
    body: { symbol: `SIM-${randomUUID().slice(0, 6).toUpperCase()}`, name: 'API test project', startPrice: 100, targetChangePct: 5 },
  })
  assert.equal(projectResponse.response.status, 201, JSON.stringify(projectResponse.data))
  const { id: projectId } = projectResponse.data.project

  await setOutcome('contracts', personalId, 'won')
  const contractResponse = await request('/api/time-contracts', {
    method: 'POST',
    body: { personalId, projectId, direction: 'up', durationSeconds: 10, stake: 100 },
  })
  assert.equal(contractResponse.response.status, 201, JSON.stringify(contractResponse.data))
  assert.equal(contractResponse.data.contract.status, 'pending')
  await changeOrderResult('contracts', contractResponse.data.contract.id, 'won')
  let balanceResponse = await request(`/api/time-contracts?personalId=${personalId}`)
  assert.equal(balanceResponse.data.balance, 10080)
  await changeOrderResult('contracts', contractResponse.data.contract.id, 'lost')
  balanceResponse = await request(`/api/time-contracts?personalId=${personalId}`)
  assert.equal(balanceResponse.data.balance, 9900)

  await setOutcome('forecasts', personalId, 'won')
  const forecastResponse = await request('/api/forecasts', {
    method: 'POST',
    body: { personalId, eventId: 'EVT-SPY-WEEKLY-CLOSE', probability: 60, rationale: 'API test', stake: 100 },
  })
  assert.equal(forecastResponse.response.status, 201, JSON.stringify(forecastResponse.data))
  assert.equal(forecastResponse.data.forecast.status, 'won')
  assert.equal(forecastResponse.data.balance, 9980)
  await changeOrderResult('forecasts', forecastResponse.data.forecast.id, 'lost')
  const forecastBalance = await request(`/api/forecasts?personalId=${personalId}`)
  assert.equal(forecastBalance.data.balance, 9800)

  await setOutcome('etfOrders', personalId, 'won')
  const etfResponse = await request('/api/etf-orders', {
    method: 'POST',
    body: { personalId, symbol: 'NVDA', side: 'buy', quantity: 1 },
  })
  assert.equal(etfResponse.response.status, 201, JSON.stringify(etfResponse.data))
  assert.equal(etfResponse.data.balance, 25114.3)
  await changeOrderResult('etfOrders', etfResponse.data.order.id, 'lost')
  const etfBalance = await request(`/api/etf-orders?personalId=${personalId}`)
  assert.equal(etfBalance.data.balance, 24857.13)
})
