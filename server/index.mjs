import express from 'express'
import { randomUUID, timingSafeEqual } from 'node:crypto'

const app = express()
const submissions = new Map()
const walletTransactions = new Map()
const walletBalances = new Map()
const projects = new Map()
const predictions = new Map()
const virtualBalances = new Map()
const forecasts = new Map()
const frontendConfig = {
  marketAssets: [
    { symbol: 'NVDA', name: '英伟达', last: 142.87, change: 2.46, volume: '3.42B', type: '2× 多头', color: '#84d6b2', spark: [13,17,15,22,20,26,23,30,27,35,31,40,38,47] },
    { symbol: 'TSLA', name: '特斯拉', last: 338.11, change: -1.28, volume: '2.18B', type: '2× 多头', color: '#fc8082', spark: [44,39,42,35,38,31,34,28,32,24,27,21,25,20] },
    { symbol: 'SPY', name: '标普 500 ETF', last: 681.42, change: 0.74, volume: '1.76B', type: '指数', color: '#84d6b2', spark: [17,18,15,22,20,24,21,27,23,30,28,34,32,39] },
    { symbol: 'AAPL', name: '苹果', last: 258.34, change: 0.32, volume: '1.24B', type: '2× 多头', color: '#84d6b2', spark: [18,16,21,20,23,19,25,24,29,26,31,30,35,37] },
    { symbol: 'MSTR', name: 'Strategy', last: 406.53, change: -3.12, volume: '928M', type: '2× 多头', color: '#fc8082', spark: [46,42,47,36,41,31,36,28,33,23,28,19,23,15] },
  ],
  marketIndices: [{s:'S&P 500',v:'6,812.34',c:'+0.74%'},{s:'纳斯达克',v:'23,104.61',c:'+1.12%'},{s:'道琼斯',v:'47,862.19',c:'+0.28%'},{s:'VIX',v:'18.42',c:'−2.16%',down:true}],
  siteName: 'Northstar Markets',
  marketSubtitle: '查看指数概况与后台发布的模拟项目。',
  marketDelayMinutes: 15,
  showMarketOverview: true,
  showEquityContracts: true,
  showTimeContracts: true,
  showPrediction: true,
  showDeposit: true,
  showWithdrawal: true,
  showKyc: true,
  demoOrdersEnabled: true,
  depositNetworks: ['TRC20', 'ERC20', 'Polygon'],
  minimumWithdrawal: 10,
  withdrawalFee: 0.5,
  contractDurations: [10, 30, 60],
  contractPayoutPercent: 80,
}
const forecastEvents = [
  { id: 'EVT-SPY-WEEKLY-CLOSE', category: '美股', question: '标普 500 本周收盘高于本周开盘？', description: '按模拟指数的周线起点与周五收盘价判断。', consensus: 58, horizon: '本周五 16:00 ET', volume: '模拟参与 1,284 人' },
  { id: 'EVT-NVDA-NEXT-SESSION', category: '个股', question: '英伟达下一交易日收涨？', description: '比较下一交易日收盘价与前一交易日收盘价。', consensus: 54, horizon: '下一交易日收盘', volume: '模拟参与 962 人' },
  { id: 'EVT-VIX-BELOW-20', category: '宏观', question: 'VIX 指数本周保持在 20 以下？', description: '以周内收盘数据为准；本卡片目前仅用于记录判断。', consensus: 67, horizon: '本周五 16:00 ET', volume: '模拟参与 731 人' },
  { id: 'EVT-QQQ-ABOVE-LEVEL', category: '指数', question: '纳斯达克 100 本周站上周初水平？', description: '依照模拟行情的周初基准价核对。', consensus: 51, horizon: '本周五 16:00 ET', volume: '模拟参与 588 人' },
]
const adminKey = process.env.ADMIN_REVIEW_KEY || 'local-demo-admin'
const port = Number(process.env.API_PORT || 8787)

if (process.env.NODE_ENV === 'production' && adminKey === 'local-demo-admin') {
  throw new Error('Set ADMIN_REVIEW_KEY before starting the API in production.')
}

app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))

function requireAdmin(req, res, next) {
  const supplied = Buffer.from(req.get('x-admin-key') || '')
  const expected = Buffer.from(adminKey)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ error: '后台密钥无效' })
  }
  next()
}

function safeSubmission(item) {
  return {
    id: item.id,
    personalId: item.personalId,
    email: item.email,
    legalName: item.legalName,
    country: item.country,
    birthDate: item.birthDate,
    documentType: item.documentType,
    documentLast4: item.documentLast4,
    documents: item.documents,
    status: item.status,
    reason: item.reason,
    submittedAt: item.submittedAt,
    reviewedAt: item.reviewedAt,
  }
}

const validPersonalId = value => typeof value === 'string' && /^NST-[A-Z0-9]{8}$/.test(value)
const latestKyc = personalId => [...submissions.values()].filter(row => row.personalId === personalId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]
const rounded = value => Math.round(value * 100) / 100
const addressMask = address => address.length < 12 ? '••••' : `${address.slice(0, 6)}••••${address.slice(-5)}`
function safeTransaction(item) {
  return {
    id: item.id, personalId: item.personalId, type: item.type, amount: item.amount, fee: item.fee,
    network: item.network, addressMasked: item.address ? addressMask(item.address) : '',
    status: item.status, reason: item.reason, createdAt: item.createdAt, reviewedAt: item.reviewedAt,
  }
}

function verifyWalletRequest(req, res) {
  const { personalId } = req.body || {}
  if (!validPersonalId(personalId)) {
    res.status(400).json({ error: '个人 ID 无效' })
    return false
  }
  const account = latestKyc(personalId)
  if (!account || account.status !== 'approved') {
    res.status(403).json({ error: '该个人 ID 尚未通过 KYC 后台审核' })
    return false
  }
  return true
}

function buildCurve(startPrice, targetChangePct, seed = 0) {
  const endPrice = startPrice * (1 + targetChangePct / 100)
  return Array.from({ length: 20 }, (_, index) => {
    if (index === 0) return rounded(startPrice)
    if (index === 19) return rounded(endPrice)
    const progress = index / 19
    const drift = startPrice + (endPrice - startPrice) * progress
    const wave = Math.sin(index * 1.47 + seed) * startPrice * 0.004 * Math.sin(progress * Math.PI)
    return rounded(Math.max(0.01, drift + wave))
  })
}

function publicProject(project) {
  return { id: project.id, symbol: project.symbol, name: project.name, startPrice: project.startPrice, lastPrice: project.curve.at(-1), targetChangePct: project.targetChangePct, curve: project.curve, simulated: true, updatedAt: project.updatedAt }
}

function publicPrediction(item) {
  return {
    id: item.id, personalId: item.personalId, projectSymbol: item.projectSymbol, direction: item.direction,
    durationSeconds: item.durationSeconds, stake: item.stake, status: item.status,
    result: item.status === 'pending' ? null : item.result, entryPrice: item.entryPrice,
    exitPrice: item.status === 'pending' ? null : item.exitPrice, payout: item.status === 'pending' ? null : item.payout,
    profit: item.status === 'pending' ? null : item.profit, createdAt: item.createdAt, settledAt: item.settledAt,
  }
}

function validProjectInput({ symbol, name, startPrice, targetChangePct }) {
  return typeof symbol === 'string' && /^SIM-[A-Z0-9]{2,8}$/.test(symbol)
    && typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 60
    && Number.isFinite(Number(startPrice)) && Number(startPrice) > 0 && Number(startPrice) <= 1000000
    && Number.isFinite(Number(targetChangePct)) && Math.abs(Number(targetChangePct)) <= 20
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'northstar-local-api' }))
app.get('/api/public-config', (_req, res) => res.json({ config: frontendConfig, forecastEvents }))
app.get('/api/forecast-events', (_req, res) => res.json({ events: forecastEvents }))
app.get('/api/admin/front-config', requireAdmin, (_req, res) => res.json({ config: frontendConfig, forecastEvents }))
app.patch('/api/admin/front-config', requireAdmin, (req, res) => {
  const input = req.body || {}
  const textFields = ['siteName', 'marketSubtitle']
  for (const field of textFields) {
    if (typeof input[field] !== 'string' || !input[field].trim() || input[field].length > (field === 'siteName' ? 40 : 140)) return res.status(400).json({ error: `${field} 内容无效` })
    frontendConfig[field] = input[field].trim()
  }
  if (!Array.isArray(input.marketAssets) || input.marketAssets.length < 1 || input.marketAssets.length > 40) return res.status(400).json({ error: 'ETF 列表需要 1–40 个标的' })
  const assetSymbols = new Set()
  for (const asset of input.marketAssets) {
    if (!asset || typeof asset.symbol !== 'string' || !/^[A-Z0-9.]{1,12}$/.test(asset.symbol) || assetSymbols.has(asset.symbol) || typeof asset.name !== 'string' || !asset.name.trim() || asset.name.length > 60 || !Number.isFinite(Number(asset.last)) || Number(asset.last) <= 0 || !Number.isFinite(Number(asset.change)) || Math.abs(Number(asset.change)) > 500 || typeof asset.volume !== 'string' || asset.volume.length > 20 || typeof asset.type !== 'string' || asset.type.length > 30 || typeof asset.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(asset.color) || !Array.isArray(asset.spark) || asset.spark.length < 2 || asset.spark.length > 50 || asset.spark.some(point => !Number.isFinite(Number(point)) || Number(point) < 0 || Number(point) > 100)) return res.status(400).json({ error: 'ETF 字段无效：检查代码、名称、价格、涨幅、类型、颜色和走势图点' })
    assetSymbols.add(asset.symbol)
  }
  if (!Array.isArray(input.marketIndices) || input.marketIndices.length > 10 || input.marketIndices.some(index => !index || typeof index.s !== 'string' || !index.s.trim() || index.s.length > 30 || typeof index.v !== 'string' || index.v.length > 24 || typeof index.c !== 'string' || index.c.length > 24 || (index.down !== undefined && typeof index.down !== 'boolean'))) return res.status(400).json({ error: '指数卡片字段无效（最多 10 项）' })
  frontendConfig.marketAssets = input.marketAssets.map(asset => ({ ...asset, symbol: asset.symbol.toUpperCase(), name: asset.name.trim(), last: rounded(Number(asset.last)), change: Number(asset.change), spark: asset.spark.map(Number) }))
  frontendConfig.marketIndices = input.marketIndices.map(index => ({ ...index, s: index.s.trim() }))
  for (const field of ['showMarketOverview', 'showEquityContracts', 'showTimeContracts', 'showPrediction', 'showDeposit', 'showWithdrawal', 'showKyc', 'demoOrdersEnabled']) {
    if (typeof input[field] !== 'boolean') return res.status(400).json({ error: `${field} 必须为开关` })
    frontendConfig[field] = input[field]
  }
  const delay = Number(input.marketDelayMinutes)
  const minimumWithdrawal = Number(input.minimumWithdrawal)
  const withdrawalFee = Number(input.withdrawalFee)
  const payout = Number(input.contractPayoutPercent)
  if (![0, 15, 30, 60].includes(delay) || !Number.isFinite(minimumWithdrawal) || minimumWithdrawal < 1 || minimumWithdrawal > 100000 || !Number.isFinite(withdrawalFee) || withdrawalFee < 0 || withdrawalFee > 100 || !Number.isInteger(payout) || payout < 1 || payout > 200) return res.status(400).json({ error: '行情延迟、提现限额或模拟结算参数无效' })
  if (!Array.isArray(input.depositNetworks) || !input.depositNetworks.length || input.depositNetworks.some(network => !frontendConfig.depositNetworks.includes(network))) return res.status(400).json({ error: '请选择至少一个支持的演示网络' })
  if (!Array.isArray(input.contractDurations) || !input.contractDurations.length || input.contractDurations.some(duration => ![10, 30, 60].includes(Number(duration)))) return res.status(400).json({ error: '合约期限只允许 10、30、60 秒' })
  frontendConfig.marketDelayMinutes = delay
  frontendConfig.minimumWithdrawal = rounded(minimumWithdrawal)
  frontendConfig.withdrawalFee = rounded(withdrawalFee)
  frontendConfig.contractPayoutPercent = payout
  frontendConfig.depositNetworks = [...new Set(input.depositNetworks)]
  frontendConfig.contractDurations = [...new Set(input.contractDurations.map(Number))].sort((a, b) => a - b)
  res.json({ config: frontendConfig })
})
app.put('/api/admin/forecast-events', requireAdmin, (req, res) => {
  const events = req.body?.events
  if (!Array.isArray(events) || events.length > 40) return res.status(400).json({ error: '预测事件列表格式无效（最多 40 条）' })
  const normalized = []
  for (const [index, event] of events.entries()) {
    const { id, category, question, description, consensus, horizon } = event || {}
    if (typeof id !== 'string' || !/^EVT-[A-Z0-9-]{3,30}$/.test(id) || typeof category !== 'string' || !category.trim() || category.length > 24 || typeof question !== 'string' || question.trim().length < 5 || question.length > 120 || typeof description !== 'string' || description.length > 280 || !Number.isInteger(Number(consensus)) || Number(consensus) < 1 || Number(consensus) > 99 || typeof horizon !== 'string' || horizon.length > 80) return res.status(400).json({ error: `第 ${index + 1} 条事件字段无效` })
    normalized.push({ id, category: category.trim(), question: question.trim(), description: description.trim(), consensus: Number(consensus), horizon: horizon.trim(), volume: event.volume || '模拟参与 0 人' })
  }
  if (new Set(normalized.map(event => event.id)).size !== normalized.length) return res.status(400).json({ error: '预测事件 ID 不能重复' })
  forecastEvents.splice(0, forecastEvents.length, ...normalized)
  res.json({ events: forecastEvents })
})

app.get('/api/projects', (_req, res) => {
  res.json({ projects: [...projects.values()].map(publicProject) })
})

app.get('/api/admin/projects', requireAdmin, (_req, res) => {
  res.json({ projects: [...projects.values()].map(publicProject) })
})

app.post('/api/admin/projects', requireAdmin, (req, res) => {
  const values = req.body || {}
  if (!validProjectInput(values)) return res.status(400).json({ error: '项目代码须为 SIM- 前缀，价格须大于 0，模拟曲线变化限制在 ±20%' })
  const symbol = values.symbol.trim().toUpperCase()
  if ([...projects.values()].some(project => project.symbol === symbol)) return res.status(409).json({ error: '该模拟项目代码已存在' })
  const startPrice = rounded(Number(values.startPrice))
  const targetChangePct = Number(values.targetChangePct)
  const project = { id: randomUUID(), symbol, name: values.name.trim(), startPrice, targetChangePct, curve: buildCurve(startPrice, targetChangePct, projects.size), updatedAt: new Date().toISOString() }
  projects.set(project.id, project)
  res.status(201).json({ project: publicProject(project) })
})

app.patch('/api/admin/projects/:id', requireAdmin, (req, res) => {
  const project = projects.get(req.params.id)
  if (!project) return res.status(404).json({ error: '未找到演示项目' })
  const { startPrice = project.startPrice, targetChangePct = project.targetChangePct, name = project.name } = req.body || {}
  if (!validProjectInput({ symbol: project.symbol, name, startPrice, targetChangePct })) return res.status(400).json({ error: '模拟价格或曲线变化无效（变化范围 ±20%）' })
  project.name = name.trim()
  project.startPrice = rounded(Number(startPrice))
  project.targetChangePct = Number(targetChangePct)
  project.curve = buildCurve(project.startPrice, project.targetChangePct, projects.size + Date.now() % 11)
  project.updatedAt = new Date().toISOString()
  res.json({ project: publicProject(project) })
})

app.get('/api/time-contracts', (req, res) => {
  if (!frontendConfig.showTimeContracts) return res.status(403).json({ error: '后台已关闭时间合约模块' })
  const personalId = String(req.query.personalId || '')
  if (!validPersonalId(personalId)) return res.status(400).json({ error: '请先注册并绑定个人 ID' })
  const items = [...predictions.values()].filter(item => item.personalId === personalId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  res.json({ personalId, balance: virtualBalances.get(personalId) ?? 10000, contracts: items.slice(0, 20).map(publicPrediction) })
})

app.get('/api/forecasts', (req, res) => {
  if (!frontendConfig.showPrediction) return res.status(403).json({ error: '后台已关闭预测系统' })
  const personalId = String(req.query.personalId || '')
  if (!validPersonalId(personalId)) return res.status(400).json({ error: '请先注册并绑定个人 ID' })
  const items = [...forecasts.values()].filter(item => item.personalId === personalId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  res.json({ personalId, forecasts: items.slice(0, 50) })
})

app.post('/api/forecasts', (req, res) => {
  if (!frontendConfig.showPrediction) return res.status(403).json({ error: '后台已关闭预测系统' })
  const { personalId, eventId, probability, rationale = '' } = req.body || {}
  if (!validPersonalId(personalId)) return res.status(400).json({ error: '请先注册并绑定个人 ID' })
  if (typeof eventId !== 'string' || !/^EVT-[A-Z0-9-]{3,30}$/.test(eventId)) return res.status(400).json({ error: '预测事件无效' })
  const value = Number(probability)
  if (!Number.isInteger(value) || value < 1 || value > 99 || typeof rationale !== 'string' || rationale.length > 280) return res.status(400).json({ error: '概率范围为 1–99%，说明最多 280 字' })
  const item = { id: randomUUID(), personalId, eventId, probability: value, rationale: rationale.trim(), updatedAt: new Date().toISOString() }
  forecasts.set(`${personalId}:${eventId}`, item)
  res.status(201).json({ forecast: item })
})

app.post('/api/time-contracts', (req, res) => {
  if (!frontendConfig.showTimeContracts) return res.status(403).json({ error: '后台已关闭时间合约模块' })
  const { personalId, projectId, direction, durationSeconds, stake } = req.body || {}
  if (!validPersonalId(personalId)) return res.status(400).json({ error: '请先注册并绑定个人 ID' })
  const project = projects.get(projectId)
  if (!project) return res.status(404).json({ error: '请选择一个后台已发布的 SIM 演示项目' })
  const duration = Number(durationSeconds)
  const amount = Number(stake)
  if (!['up', 'down'].includes(direction) || !frontendConfig.contractDurations.includes(duration) || !Number.isInteger(amount) || amount < 10 || amount > 1000) {
    return res.status(400).json({ error: '预测方向、期限或虚拟积分金额无效' })
  }
  const balance = virtualBalances.get(personalId) ?? 10000
  if (balance < amount) return res.status(400).json({ error: '虚拟积分余额不足' })
  virtualBalances.set(personalId, balance - amount)
  const item = {
    id: randomUUID(), personalId, projectId, projectSymbol: project.symbol, direction, durationSeconds: duration, stake: amount,
    status: 'pending', result: null, payoutPercent: frontendConfig.contractPayoutPercent, entryPrice: project.curve[0], targetPrice: project.curve.at(-1), exitPrice: null, payout: null, profit: null,
    createdAt: new Date().toISOString(), settledAt: null,
  }
  predictions.set(item.id, item)
  setTimeout(() => {
    if (item.status !== 'pending') return
    const exitPrice = item.targetPrice
    const delta = exitPrice - item.entryPrice
    const result = Math.abs(delta) < item.entryPrice * 0.0001 ? 'draw' : ((delta > 0) === (item.direction === 'up') ? 'won' : 'lost')
    const payout = result === 'won' ? rounded(item.stake * (1 + item.payoutPercent / 100)) : result === 'draw' ? item.stake : 0
    item.status = result
    item.result = result
    item.exitPrice = exitPrice
    item.payout = payout
    item.profit = rounded(payout - item.stake)
    item.settledAt = new Date().toISOString()
    virtualBalances.set(item.personalId, rounded((virtualBalances.get(item.personalId) ?? 10000) + payout))
  }, duration * 1000)
  while (predictions.size > 1000) predictions.delete(predictions.keys().next().value)
  res.status(201).json({ contract: publicPrediction(item), balance: virtualBalances.get(personalId) })
})

app.post('/api/kyc-submissions', (req, res) => {
  const { personalId, email, legalName, country, birthDate, documentType, documentNumber, documents } = req.body || {}
  const required = [personalId, email, legalName, country, birthDate, documentType, documentNumber]
  if (required.some(value => typeof value !== 'string' || !value.trim())) {
    return res.status(400).json({ error: '请完整填写 KYC 资料' })
  }
  if (!/^NST-[A-Z0-9]{8}$/.test(personalId) || email.length > 254 || legalName.length > 120 || documentNumber.length > 80) {
    return res.status(400).json({ error: '提交资料格式无效' })
  }
  const fileMetadata = ['front', 'back'].map(side => documents?.[side]).filter(Boolean)
  if (fileMetadata.length !== 2 || fileMetadata.some(file => typeof file.name !== 'string' || file.name.length > 200)) {
    return res.status(400).json({ error: '请附上证件正反面的文件信息' })
  }

  const item = {
    id: randomUUID(), personalId, email: email.trim().toLowerCase(), legalName: legalName.trim(), country,
    birthDate, documentType, documentLast4: documentNumber.slice(-4),
    documents: { front: fileMetadata[0].name, back: fileMetadata[1].name },
    status: 'pending', reason: '', submittedAt: new Date().toISOString(), reviewedAt: null,
  }
  submissions.set(item.id, item)
  while (submissions.size > 500) submissions.delete(submissions.keys().next().value)
  res.status(201).json({ id: item.id, personalId: item.personalId, status: item.status, submittedAt: item.submittedAt })
})

app.get('/api/kyc-status', (req, res) => {
  const personalId = String(req.query.personalId || '')
  const item = [...submissions.values()].filter(row => row.personalId === personalId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]
  if (!item) return res.json({ status: 'unverified' })
  res.json({ status: item.status, reason: item.reason, submittedAt: item.submittedAt })
})

app.get('/api/wallet', (req, res) => {
  const personalId = String(req.query.personalId || '')
  if (!validPersonalId(personalId)) return res.status(400).json({ error: '个人 ID 无效' })
  const transactions = [...walletTransactions.values()].filter(row => row.personalId === personalId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  res.json({ personalId, balance: walletBalances.get(personalId) || 0, transactions: transactions.map(safeTransaction) })
})

app.post('/api/wallet/deposits', (req, res) => {
  if (!frontendConfig.showDeposit) return res.status(403).json({ error: '后台已关闭演示充值' })
  if (!verifyWalletRequest(req, res)) return
  const { personalId, amount, network } = req.body
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0 || value > 100000 || !['TRC20', 'ERC20', 'Polygon'].includes(network)) {
    return res.status(400).json({ error: '充值金额或网络无效' })
  }
  const item = { id: randomUUID(), personalId, type: 'deposit', amount: rounded(value), fee: 0, network, address: '', status: 'completed', reason: '', createdAt: new Date().toISOString(), reviewedAt: new Date().toISOString() }
  walletBalances.set(personalId, rounded((walletBalances.get(personalId) || 0) + item.amount))
  walletTransactions.set(item.id, item)
  res.status(201).json({ transaction: safeTransaction(item), balance: walletBalances.get(personalId) })
})

app.post('/api/wallet/withdrawals', (req, res) => {
  if (!frontendConfig.showWithdrawal) return res.status(403).json({ error: '后台已关闭演示提现' })
  if (!verifyWalletRequest(req, res)) return
  const { personalId, amount, network, address } = req.body
  const value = Number(amount)
  if (!Number.isFinite(value) || value < frontendConfig.minimumWithdrawal || value > 100000 || !frontendConfig.depositNetworks.includes(network)) {
    return res.status(400).json({ error: '提现金额或演示网络无效，请检查后台配置' })
  }
  if (typeof address !== 'string' || address.trim().length < 12 || address.trim().length > 160) {
    return res.status(400).json({ error: '请输入有效的演示收款地址' })
  }
  const fee = frontendConfig.withdrawalFee
  const total = rounded(value + fee)
  const balance = walletBalances.get(personalId) || 0
  if (balance < total) return res.status(400).json({ error: 'USDT 可用余额不足（提现金额另计演示手续费）' })
  const item = { id: randomUUID(), personalId, type: 'withdrawal', amount: rounded(value), fee, network, address: address.trim(), status: 'pending', reason: '', createdAt: new Date().toISOString(), reviewedAt: null }
  walletBalances.set(personalId, rounded(balance - total))
  walletTransactions.set(item.id, item)
  res.status(201).json({ transaction: safeTransaction(item), balance: walletBalances.get(personalId) })
})

app.get('/api/admin/kyc-submissions', requireAdmin, (req, res) => {
  const status = req.query.status
  const items = [...submissions.values()].filter(row => !status || row.status === status).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  res.json({ submissions: items.map(safeSubmission) })
})

app.get('/api/admin/wallet-transactions', requireAdmin, (_req, res) => {
  const transactions = [...walletTransactions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  res.json({ transactions: transactions.map(safeTransaction) })
})

app.patch('/api/admin/wallet-transactions/:id', requireAdmin, (req, res) => {
  const item = walletTransactions.get(req.params.id)
  if (!item) return res.status(404).json({ error: '未找到该资金流水' })
  if (item.type !== 'withdrawal' || item.status !== 'pending') return res.status(400).json({ error: '仅可审核待处理的提现申请' })
  const { status, reason = '' } = req.body || {}
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: '审核状态无效' })
  if (status === 'rejected' && (typeof reason !== 'string' || !reason.trim() || reason.length > 300)) {
    return res.status(400).json({ error: '驳回时请填写原因（最多 300 字）' })
  }
  item.status = status
  item.reason = status === 'rejected' ? reason.trim() : ''
  item.reviewedAt = new Date().toISOString()
  if (status === 'rejected') {
    walletBalances.set(item.personalId, rounded((walletBalances.get(item.personalId) || 0) + item.amount + item.fee))
  }
  res.json({ transaction: safeTransaction(item), balance: walletBalances.get(item.personalId) || 0 })
})

app.patch('/api/admin/kyc-submissions/:id', requireAdmin, (req, res) => {
  const item = submissions.get(req.params.id)
  if (!item) return res.status(404).json({ error: '未找到该 KYC 申请' })
  const { status, reason = '' } = req.body || {}
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: '审核状态无效' })
  if (status === 'rejected' && (typeof reason !== 'string' || !reason.trim() || reason.length > 300)) {
    return res.status(400).json({ error: '驳回时请填写原因（最多 300 字）' })
  }
  item.status = status
  item.reason = status === 'rejected' ? reason.trim() : ''
  item.reviewedAt = new Date().toISOString()
  res.json({ submission: safeSubmission(item) })
})

export default app

if (!process.env.VERCEL) {
  app.listen(port, '127.0.0.1', () => {
    console.log(`Northstar local API listening on http://127.0.0.1:${port}`)
    if (process.env.NODE_ENV !== 'production') console.log('Local-only admin key: local-demo-admin (set ADMIN_REVIEW_KEY to override)')
  })
}
