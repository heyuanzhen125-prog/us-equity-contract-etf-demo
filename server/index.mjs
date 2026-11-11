import express from 'express'
import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { calculateCpmmPurchase, getCpmmProbability } from './prediction-market.mjs'
import { getDirectWalletStatus } from './wallet-chain.mjs'

const app = express()
const submissions = new Map()
const walletTransactions = new Map()
const walletBalances = new Map()
const projects = new Map()
const syncedTimeContractProjects = new Map()
let timeContractProjectCache = { expiresAt: 0, projects: [] }
const predictions = new Map()
const contractSettlementTimers = new Map()
const virtualBalances = new Map()
const forecasts = new Map()
const etfOrders = new Map()
const etfBalances = new Map()
const outcomePolicies = {
  contracts: { all: null, users: new Map() },
  forecasts: { all: null, users: new Map() },
  etfOrders: { all: null, users: new Map() },
}
const staffUsers = new Map()
const adminSessions = new Map()
const agents = new Map()
const agentRegistrations = new Map()
const userReferralRegistrations = new Map()
// Demo account directory shared by the public registration flow and admin member list.
// This in-memory store is suitable only for the current demo runtime; use a durable DB for production.
const userAccounts = new Map()
let exchangeEventsCache = { expiresAt: 0, payload: null }
const syncedExchangeEvents = new Map()
let marketQuotesCache = { expiresAt: 0, payload: null }
const permissionModules = [
  { id: 'kyc', name: 'KYC 身份审核' },
  { id: 'members', name: '成员列表' },
  { id: 'wallet', name: 'USDT 资金流水' },
  { id: 'deposits', name: 'USDT / USDC 充值配置' },
  { id: 'projects', name: '项目与曲线' },
  { id: 'prediction-preview', name: '输赢结果控制' },
  { id: 'front-config', name: '前台配置' },
  { id: 'agents', name: '代理系统' },
  { id: 'permissions', name: '权限与账号' },
]
const permissionModuleIds = permissionModules.map(item => item.id)
const permissionRoles = new Map([
  ['superadmin', { id: 'superadmin', name: '超级管理员', permissions: permissionModuleIds }],
  ['operations', { id: 'operations', name: '运营管理员', permissions: ['projects', 'prediction-preview', 'front-config'] }],
  ['compliance', { id: 'compliance', name: '审核员', permissions: ['kyc'] }],
  ['finance', { id: 'finance', name: '财务人员', permissions: ['wallet', 'deposits'] }],
  ['agent-manager', { id: 'agent-manager', name: '代理管理', permissions: ['agents'] }],
])
const depositCurrencies = ['USDT', 'USDC']
const depositNetworks = ['TRC20', 'ERC20', 'Polygon']
const frontendConfig = {
  marketAssets: [
    { symbol: 'NVDA', name: '英伟达', last: 142.87, change: 2.46, volume: '3.42B', type: '2× 多头', color: '#84d6b2', spark: [13,17,15,22,20,26,23,30,27,35,31,40,38,47] },
    { symbol: 'TSLA', name: '特斯拉', last: 338.11, change: -1.28, volume: '2.18B', type: '2× 多头', color: '#fc8082', spark: [44,39,42,35,38,31,34,28,32,24,27,21,25,20] },
    { symbol: 'SPY', name: '标普 500 ETF', last: 681.42, change: 0.74, volume: '1.76B', type: '指数', color: '#84d6b2', spark: [17,18,15,22,20,24,21,27,23,30,28,34,32,39] },
    { symbol: 'AAPL', name: '苹果', last: 258.34, change: 0.32, volume: '1.24B', type: '2× 多头', color: '#84d6b2', spark: [18,16,21,20,23,19,25,24,29,26,31,30,35,37] },
    { symbol: 'MSTR', name: 'Strategy', last: 406.53, change: -3.12, volume: '928M', type: '2× 多头', color: '#fc8082', spark: [46,42,47,36,41,31,36,28,33,23,28,19,23,15] },
    { symbol: 'QQQ', name: '纳斯达克 100 ETF', last: 100, change: 0, volume: '—', type: '指数 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'IWM', name: '罗素 2000 ETF', last: 100, change: 0, volume: '—', type: '指数 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'DIA', name: '道琼斯 ETF', last: 100, change: 0, volume: '—', type: '指数 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'TQQQ', name: '纳指 3× 做多 ETF', last: 100, change: 0, volume: '—', type: '3× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'SQQQ', name: '纳指 3× 做空 ETF', last: 100, change: 0, volume: '—', type: '3× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'SOXL', name: '半导体 3× 做多 ETF', last: 100, change: 0, volume: '—', type: '3× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'SOXS', name: '半导体 3× 做空 ETF', last: 100, change: 0, volume: '—', type: '3× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'NVDL', name: 'NVDA 2× 做多 ETF', last: 100, change: 0, volume: '—', type: '2× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'TSLL', name: 'TSLA 2× 做多 ETF', last: 100, change: 0, volume: '—', type: '2× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'UPRO', name: '标普 500 3× 做多 ETF', last: 100, change: 0, volume: '—', type: '3× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'SPXU', name: '标普 500 3× 做空 ETF', last: 100, change: 0, volume: '—', type: '3× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'QLD', name: '纳指 100 2× 做多 ETF', last: 100, change: 0, volume: '—', type: '2× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'QID', name: '纳指 100 2× 做空 ETF', last: 100, change: 0, volume: '—', type: '2× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'TNA', name: '罗素 2000 3× 做多 ETF', last: 100, change: 0, volume: '—', type: '3× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'TZA', name: '罗素 2000 3× 做空 ETF', last: 100, change: 0, volume: '—', type: '3× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'TECL', name: '科技板块 3× 做多 ETF', last: 100, change: 0, volume: '—', type: '3× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'TECS', name: '科技板块 3× 做空 ETF', last: 100, change: 0, volume: '—', type: '3× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'LABU', name: '生物科技 3× 做多 ETF', last: 100, change: 0, volume: '—', type: '3× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'LABD', name: '生物科技 3× 做空 ETF', last: 100, change: 0, volume: '—', type: '3× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'FAS', name: '金融板块 3× 做多 ETF', last: 100, change: 0, volume: '—', type: '3× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'FAZ', name: '金融板块 3× 做空 ETF', last: 100, change: 0, volume: '—', type: '3× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'SSO', name: '标普 500 2× 做多 ETF', last: 100, change: 0, volume: '—', type: '2× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'SDS', name: '标普 500 2× 做空 ETF', last: 100, change: 0, volume: '—', type: '2× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'UDOW', name: '道琼斯 3× 做多 ETF', last: 100, change: 0, volume: '—', type: '3× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'SDOW', name: '道琼斯 3× 做空 ETF', last: 100, change: 0, volume: '—', type: '3× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'DRN', name: '房地产板块 3× 做多 ETF', last: 100, change: 0, volume: '—', type: '3× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'DRV', name: '房地产板块 3× 做空 ETF', last: 100, change: 0, volume: '—', type: '3× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'ERX', name: '能源板块 2× 做多 ETF', last: 100, change: 0, volume: '—', type: '2× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'ERY', name: '能源板块 2× 做空 ETF', last: 100, change: 0, volume: '—', type: '2× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'DPST', name: '区域银行 3× 做多 ETF', last: 100, change: 0, volume: '—', type: '3× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'AIBU', name: 'AI 与大数据 2× 做多 ETF', last: 100, change: 0, volume: '—', type: '2× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'AIBD', name: 'AI 与大数据 2× 做空 ETF', last: 100, change: 0, volume: '—', type: '2× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'GUSH', name: '油气勘探 2× 做多 ETF', last: 100, change: 0, volume: '—', type: '2× 多头 ETF', color: '#84d6b2', spark: [25,25,25,25,25,25,25,25] },
    { symbol: 'DRIP', name: '油气勘探 2× 做空 ETF', last: 100, change: 0, volume: '—', type: '2× 空头 ETF', color: '#fc8082', spark: [25,25,25,25,25,25,25,25] },
  ],
  marketIndices: [{s:'S&P 500',v:'6,812.34',c:'+0.74%'},{s:'纳斯达克',v:'23,104.61',c:'+1.12%'},{s:'道琼斯',v:'47,862.19',c:'+0.28%'},{s:'VIX',v:'18.42',c:'−2.16%',down:true}],
  siteName: 'Northstar Markets',
  marketSubtitle: '查看指数概况与后台发布的模拟项目。',
  uiText: {
    workspaceTitle: '工作区', navMarket: '市场概览', navEquity: '合约 ETF', navTime: '时间合约', navPrediction: '预测系统',
    navWatchlist: '自选列表', navPositions: '持仓与订单', navKyc: '身份认证', marketNavTitle: '市场',
    navNews: '市场资讯', navCalendar: '经济日历', riskTitle: '风险先行', riskText: '了解杠杆产品风险，理性管理仓位。',
    riskAction: '查看风险说明', navHelp: '帮助中心', navSettings: '设置', tradingStatus: '美股盘中',
    registerAction: '注册账户', depositAction: '充值 USDT / USDC', withdrawalAction: '提现 USDT', netWorthAction: '账户净值',
    temperatureTitle: '市场温度', featuredAction: '进入合约市场', popularContracts: '热门合约', quickOrder: '快速下单',
    buyAction: '买入', sellAction: '卖出', riskDisclosure: '风险披露',
  },
  homeTitle: '市场概览',
  equityContractTitle: '合约 ETF',
  equityContractSubtitle: '浏览美股与杠杆 ETF 模拟行情，并使用虚拟账户体验下单。',
  timeContractTitle: '时间合约',
  timeContractSubtitle: '参考交易所短周期合约概率；使用虚拟 PTS 体验独立的 10 / 30 / 60 秒时间合约。',
  predictionTitle: '预测系统',
  predictionSubtitle: '围绕事件问题记录概率判断，查看个人预测，不与时间合约共用订单。',
  indexTitle: '美股主要指数',
  indexSubtitle: '延时行情 · 仅供展示',
  featuredTitle: '市场精选',
  featuredSubtitle: '查看热门标的与当日表现',
  demoProjectTitle: '模拟项目',
  demoProjectSubtitle: '由后台发布的虚拟标的 · SIM 前缀 · 非实盘行情',
  orderDisclaimer: '杠杆 ETF 可能放大损失 · 本平台为原型演示',
  marketDelayMinutes: 15,
  showMarketOverview: true,
  showEquityContracts: true,
  showTimeContracts: true,
  showPrediction: true,
  showDeposit: true,
  showWithdrawal: true,
  showKyc: true,
  demoOrdersEnabled: true,
  showMarketPicks: true,
  showDemoProjects: true,
  showQuickOrder: true,
  showWatchlistNav: true,
  showPositionsNav: true,
  showNewsNav: true,
  showCalendarNav: true,
  showHelpNav: true,
  showSettingsNav: true,
  depositNetworks: ['TRC20', 'ERC20', 'Polygon'],
  depositAssets: {
    USDT: { minimumAmount: 10, instruction: '仅供演示，请勿向此页面提供真实资金。', networks: depositNetworks.map(network => ({ network, address: '', qrUrl: '' })) },
    USDC: { minimumAmount: 10, instruction: '仅供演示，请勿向此页面提供真实资金。', networks: depositNetworks.map(network => ({ network, address: '', qrUrl: '' })) },
  },
  minimumWithdrawal: 10,
  withdrawalFee: 0.5,
  maxEtfLeverage: 100,
  contractDurations: [10, 30, 60],
  contractPayoutPercent: 80,
  autoPayoutEnabled: false,
  payoutMinPercent: 50,
  payoutMaxPercent: 120,
  payoutSensitivity: 30,
}
const forecastEvents = [
  { id: 'EVT-SPY-WEEKLY-CLOSE', category: '美股', question: '标普 500 本周收盘高于本周开盘？', description: '按模拟指数的周线起点与周五收盘价判断。', consensus: 58, horizon: '本周五 16:00 ET', volume: '模拟参与 1,284 人', rewardPercent: 80 },
  { id: 'EVT-NVDA-NEXT-SESSION', category: '个股', question: '英伟达下一交易日收涨？', description: '比较下一交易日收盘价与前一交易日收盘价。', consensus: 54, horizon: '下一交易日收盘', volume: '模拟参与 962 人', rewardPercent: 75 },
  { id: 'EVT-VIX-BELOW-20', category: '宏观', question: 'VIX 指数本周保持在 20 以下？', description: '以周内收盘数据为准；本卡片目前仅用于记录判断。', consensus: 67, horizon: '本周五 16:00 ET', volume: '模拟参与 731 人', rewardPercent: 65 },
  { id: 'EVT-QQQ-ABOVE-LEVEL', category: '指数', question: '纳斯达克 100 本周站上周初水平？', description: '依照模拟行情的周初基准价核对。', consensus: 51, horizon: '本周五 16:00 ET', volume: '模拟参与 588 人', rewardPercent: 80 },
]
const adminKey = process.env.ADMIN_REVIEW_KEY || 'local-demo-admin'
const port = Number(process.env.API_PORT || 8787)

if (process.env.NODE_ENV === 'production' && adminKey === 'local-demo-admin') {
  throw new Error('Set ADMIN_REVIEW_KEY before starting the API in production.')
}

app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))

app.post('/api/admin/login', (req, res) => {
  const { masterKey, username, password } = req.body || {}
  let session
  if (typeof masterKey === 'string') {
    const supplied = Buffer.from(masterKey)
    const expected = Buffer.from(adminKey)
    if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) {
      session = { roleId: 'superadmin', expiresAt: Date.now() + 12 * 60 * 60 * 1000 }
    }
  } else if (typeof username === 'string' && typeof password === 'string') {
    const user = [...staffUsers.values()].find(item => item.username.toLowerCase() === username.trim().toLowerCase())
    if (user?.active) {
      const { hash } = hashPassword(password, user.passwordSalt)
      const supplied = Buffer.from(hash, 'hex')
      const expected = Buffer.from(user.passwordHash, 'hex')
      if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) {
        session = { roleId: user.roleId, userId: user.id, expiresAt: Date.now() + 12 * 60 * 60 * 1000 }
      }
    }
  }
  if (!session) return res.status(401).json({ error: '后台账号或密码无效' })
  let token
  if (session.roleId === 'superadmin' && !session.userId) {
    const payloadText = Buffer.from(JSON.stringify({ roleId: 'superadmin', expiresAt: session.expiresAt })).toString('base64url')
    const signatureText = createHmac('sha256', adminKey).update(payloadText).digest('base64url')
    token = `${payloadText}.${signatureText}`
  } else {
    token = randomBytes(32).toString('hex')
    adminSessions.set(token, session)
  }
  const user = session.userId ? staffUsers.get(session.userId) : null
  res.json({
    token,
    role: permissionRoles.get(session.roleId),
    user: user ? safeStaffUser(user) : null,
    mustChangePassword: user?.mustChangePassword || false,
  })
})

app.get('/api/admin/session', requireAdmin, (req, res) => {
  const user = req.admin.userId ? staffUsers.get(req.admin.userId) : null
  res.json({
    role: permissionRoles.get(req.admin.roleId),
    user: user ? safeStaffUser(user) : null,
    mustChangePassword: req.admin.mustChangePassword || false,
  })
})

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  if (req.admin.token) adminSessions.delete(req.admin.token)
  res.json({ ok: true })
})

app.patch('/api/admin/change-password', requireAdmin, (req, res) => {
  if (req.admin.root || !req.admin.userId) return res.status(400).json({ error: '仅后台人员账号需要修改密码' })
  const user = staffUsers.get(req.admin.userId)
  const { currentPassword, newPassword } = req.body || {}
  if (!user || typeof currentPassword !== 'string') return res.status(400).json({ error: '当前密码无效' })
  const { hash: currentHash } = hashPassword(currentPassword, user.passwordSalt)
  const supplied = Buffer.from(currentHash, 'hex')
  const expected = Buffer.from(user.passwordHash, 'hex')
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(401).json({ error: '当前密码不正确' })
  if (!validPassword(newPassword)) return res.status(400).json({ error: '新密码需为 12–128 个字符' })
  const credential = hashPassword(newPassword)
  user.passwordSalt = credential.salt
  user.passwordHash = credential.hash
  user.mustChangePassword = false
  res.json({ ok: true })
})

app.get('/api/admin/permissions', requireRootAdmin, (_req, res) => {
  res.json({
    modules: permissionModules,
    roles: [...permissionRoles.values()],
    users: [...staffUsers.values()].map(safeStaffUser),
  })
})

app.put('/api/admin/permissions', requireRootAdmin, (req, res) => {
  const roles = req.body?.roles
  if (!Array.isArray(roles) || roles.length > 30) return res.status(400).json({ error: '角色列表无效（最多 30 个）' })
  const normalized = []
  for (const [index, role] of roles.entries()) {
    if (!role || typeof role.id !== 'string' || !/^[a-z][a-z0-9-]{1,39}$/.test(role.id) || role.id === 'superadmin' ||
      typeof role.name !== 'string' || !role.name.trim() || role.name.length > 40 ||
      !Array.isArray(role.permissions) || role.permissions.some(id => !permissionModuleIds.includes(id)) ||
      new Set(role.permissions).size !== role.permissions.length) {
      return res.status(400).json({ error: `第 ${index + 1} 个角色信息无效` })
    }
    if (normalized.some(item => item.id === role.id)) return res.status(400).json({ error: '角色标识不能重复' })
    normalized.push({ id: role.id, name: role.name.trim(), permissions: role.permissions })
  }
  const nextIds = new Set(normalized.map(role => role.id))
  const assignedRole = [...staffUsers.values()].find(user => !nextIds.has(user.roleId))
  if (assignedRole) return res.status(409).json({ error: `角色仍分配给后台账号 ${assignedRole.username}，请先调整账号角色` })
  for (const id of permissionRoles.keys()) if (id !== 'superadmin' && !nextIds.has(id)) permissionRoles.delete(id)
  for (const role of normalized) permissionRoles.set(role.id, role)
  res.json({ roles: [...permissionRoles.values()] })
})

app.post('/api/admin/staff-users', requireRootAdmin, (req, res) => {
  const { username, password, roleId } = req.body || {}
  const normalizedUsername = typeof username === 'string' ? username.trim() : ''
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(normalizedUsername)) return res.status(400).json({ error: '账号需为 3–32 位字母、数字、点、下划线或连字符' })
  if (!validPassword(password)) return res.status(400).json({ error: '初始密码需为 12–128 个字符' })
  if (typeof roleId !== 'string' || roleId === 'superadmin' || !permissionRoles.has(roleId)) return res.status(400).json({ error: '请选择有效的后台角色' })
  if ([...staffUsers.values()].some(user => user.username.toLowerCase() === normalizedUsername.toLowerCase())) return res.status(409).json({ error: '该后台账号已存在' })
  const credential = hashPassword(password)
  const user = { id: randomUUID(), username: normalizedUsername, roleId, active: true, mustChangePassword: true, passwordSalt: credential.salt, passwordHash: credential.hash, createdAt: new Date().toISOString() }
  staffUsers.set(user.id, user)
  res.status(201).json({ user: safeStaffUser(user) })
})

app.patch('/api/admin/staff-users/:id', requireRootAdmin, (req, res) => {
  const user = staffUsers.get(req.params.id)
  if (!user) return res.status(404).json({ error: '未找到后台账号' })
  const { roleId, active, password } = req.body || {}
  if (roleId !== undefined) {
    if (typeof roleId !== 'string' || roleId === 'superadmin' || !permissionRoles.has(roleId)) return res.status(400).json({ error: '请选择有效的后台角色' })
    user.roleId = roleId
  }
  if (active !== undefined) {
    if (typeof active !== 'boolean') return res.status(400).json({ error: '账号状态无效' })
    user.active = active
    if (!active) for (const [token, session] of adminSessions) if (session.userId === user.id) adminSessions.delete(token)
  }
  if (password !== undefined) {
    if (!validPassword(password)) return res.status(400).json({ error: '初始密码需为 12–128 个字符' })
    const credential = hashPassword(password)
    user.passwordSalt = credential.salt
    user.passwordHash = credential.hash
    user.mustChangePassword = true
    for (const [token, session] of adminSessions) if (session.userId === user.id) adminSessions.delete(token)
  }
  res.json({ user: safeStaffUser(user) })
})

function requireAdmin(req, res, next) {
  const suppliedText = req.get('x-admin-key') || ''
  const supplied = Buffer.from(suppliedText)
  const expected = Buffer.from(adminKey)
  if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) {
    req.admin = { roleId: 'superadmin', root: true, token: '' }
    return next()
  }
  const [payloadText, signatureText, extra] = suppliedText.split('.')
  if (payloadText && signatureText && !extra) {
    const expectedSignature = createHmac('sha256', adminKey).update(payloadText).digest()
    let payload
    try {
      const suppliedSignature = Buffer.from(signatureText, 'base64url')
      if (suppliedSignature.length === expectedSignature.length && timingSafeEqual(suppliedSignature, expectedSignature)) {
        payload = JSON.parse(Buffer.from(payloadText, 'base64url').toString('utf8'))
      }
    } catch { /* malformed stateless token */ }
    if (payload?.roleId === 'superadmin' && Number.isFinite(payload.expiresAt) && payload.expiresAt > Date.now()) {
      req.admin = { roleId: 'superadmin', root: true, token: suppliedText, mustChangePassword: false }
      return next()
    }
  }
  const session = adminSessions.get(suppliedText)
  if (!session || session.expiresAt <= Date.now()) {
    adminSessions.delete(suppliedText)
    return res.status(401).json({ error: '后台登录已失效，请重新登录' })
  }
  if (session.roleId !== 'superadmin') {
    const user = staffUsers.get(session.userId)
    if (!user || !user.active) {
      adminSessions.delete(suppliedText)
      return res.status(401).json({ error: '后台账号已停用，请联系超级管理员' })
    }
    session.roleId = user.roleId
    req.admin = { roleId: user.roleId, root: false, token: suppliedText, userId: user.id, mustChangePassword: user.mustChangePassword }
  } else {
    req.admin = { roleId: 'superadmin', root: true, token: suppliedText, mustChangePassword: false }
  }
  next()
}

function requireRootAdmin(req, res, next) {
  requireAdmin(req, res, error => {
    if (error) return next(error)
    if (!req.admin.root) return res.status(403).json({ error: '只有超级管理员可以管理角色和后台账号' })
    next()
  })
}

function requirePermission(permission) {
  return (req, res, next) => {
    requireAdmin(req, res, error => {
      if (error) return next(error)
      if (req.admin.mustChangePassword && !req.path.endsWith('/change-password')) {
        return res.status(403).json({ error: '首次登录请先修改临时密码' })
      }
      const role = permissionRoles.get(req.admin.roleId)
      if (!role || !role.permissions.includes(permission)) {
        return res.status(403).json({ error: '当前后台角色没有此栏目权限' })
      }
      next()
    })
  }
}

function safeStaffUser(user) {
  return { id: user.id, username: user.username, roleId: user.roleId, active: user.active, mustChangePassword: user.mustChangePassword, createdAt: user.createdAt }
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') }
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128
}

function publicAgent(agent) {
  return { id: agent.id, code: agent.code, name: agent.name, contact: agent.contact, commissionRate: agent.commissionRate, members: agent.members, active: agent.active, createdAt: agent.createdAt }
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
const formatTurnover = value => {
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${Math.round(value / 1e3)}K`
}
function simulatedMarketQuote(asset) {
  const dateKey = new Date().toISOString().slice(0, 10)
  const seed = createHash('sha256').update(`${asset.symbol}:${dateKey}`).digest().readUInt32BE(0)
  let change = (seed % 701 - 350) / 100
  if (Math.abs(change) < 0.15) change = seed % 2 ? 0.22 : -0.22
  const baseline = Number(asset.last) > 0 ? Number(asset.last) : 100
  const turnoverBase = ['SPY', 'QQQ'].includes(asset.symbol) ? 4e9 : ['IWM', 'DIA'].includes(asset.symbol) ? 500e6 : ['TQQQ', 'SQQQ', 'SOXL', 'UPRO', 'SSO', 'SDS', 'QLD', 'QID'].includes(asset.symbol) ? 600e6 : asset.type?.includes('ETF') ? 90e6 : 180e6
  const turnover = turnoverBase * (0.55 + (seed % 1000) / 1000)
  return {
    last: rounded(baseline * (1 + change / 100)),
    change: rounded(change),
    volume: formatTurnover(turnover),
    updatedAt: new Date().toISOString(),
  }
}
const addressMask = address => address.length < 12 ? '••••' : `${address.slice(0, 6)}••••${address.slice(-5)}`
const walletBalanceKey = (personalId, currency = 'USDT') => `${personalId}:${currency}`
function safeTransaction(item) {
  return {
    id: item.id, personalId: item.personalId, type: item.type, currency: item.currency || 'USDT', amount: item.amount, fee: item.fee,
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
  if (project.sourceExchange) return {
    id: project.id, symbol: project.symbol, name: project.name, startPrice: project.startPrice,
    lastPrice: project.lastPrice, targetChangePct: rounded((project.lastPrice / project.startPrice - 1) * 100),
    curve: project.marketCurve, simulated: true, visible: true, sortOrder: project.sortOrder,
    updatedAt: project.updatedAt, sourceExchange: project.sourceExchange, sourceUrl: project.sourceUrl,
    sourceExpiry: project.sourceExpiry, sourceTicker: project.sourceTicker,
  }
  const marketPoints = project.marketCurve || project.curve
  const intervalSeconds = project.marketPointIntervalSeconds || 5
  const elapsedSteps = Math.max(0, (Date.now() - (project.marketStartedAt || Date.now())) / (intervalSeconds * 1000))
  const currentIndex = Math.min(Math.floor(elapsedSteps), marketPoints.length - 1)
  const nextIndex = Math.min(currentIndex + 1, marketPoints.length - 1)
  const progress = currentIndex === nextIndex ? 0 : elapsedSteps - currentIndex
  const lastPrice = rounded(marketPoints[currentIndex] + (marketPoints[nextIndex] - marketPoints[currentIndex]) * progress)
  const curve = marketPoints.map((point, index) => index <= currentIndex ? point : lastPrice)
  if (currentIndex < marketPoints.length - 1) curve[currentIndex + 1] = lastPrice
  else curve[currentIndex] = lastPrice
  return { id: project.id, symbol: project.symbol, name: project.name, startPrice: project.startPrice, lastPrice, targetChangePct: rounded((lastPrice / project.startPrice - 1) * 100), curve, simulated: true, visible: project.visible, sortOrder: project.sortOrder, updatedAt: project.updatedAt }
}

function adminProject(project) {
  return { ...publicProject(project), marketPoints: project.marketCurve || project.curve, marketPointIntervalSeconds: project.marketPointIntervalSeconds || 5, previewPoints: project.previewPoints || project.curve }
}

function publicPrediction(item) {
  return {
    id: item.id, personalId: item.personalId, projectSymbol: item.projectSymbol, direction: item.direction,
    durationSeconds: item.durationSeconds, stake: item.stake, payoutPercent: item.payoutPercent, status: item.status,
    result: item.status === 'pending' ? null : item.result, entryPrice: item.entryPrice,
    exitPrice: item.status === 'pending' ? null : item.exitPrice, payout: item.status === 'pending' ? null : item.payout,
    profit: item.status === 'pending' ? null : item.profit, createdAt: item.createdAt, settledAt: item.settledAt,
  }
}

function settleContract(item, result) {
  const previousPayout = item.payout || 0
  const payout = result === 'won' ? rounded(item.stake * (1 + item.payoutPercent / 100)) : 0
  item.status = result
  item.result = result
  item.exitPrice = item.targetPrice
  item.payout = payout
  item.profit = rounded(payout - item.stake)
  item.settledAt = new Date().toISOString()
  virtualBalances.set(item.personalId, rounded((virtualBalances.get(item.personalId) ?? 10000) + payout - previousPayout))
}

function timePayoutPercent(direction, projectId) {
  const base = frontendConfig.contractPayoutPercent
  if (!frontendConfig.autoPayoutEnabled) return base
  const boundedBase = Math.min(frontendConfig.payoutMaxPercent, Math.max(frontendConfig.payoutMinPercent, base))
  const open = [...predictions.values()].filter(item => item.status === 'pending' && (!projectId || item.projectId === projectId))
  const upStake = open.filter(item => item.direction === 'up').reduce((sum, item) => sum + item.stake, 0)
  const downStake = open.filter(item => item.direction === 'down').reduce((sum, item) => sum + item.stake, 0)
  const total = upStake + downStake
  if (!total) return boundedBase
  const selectedStake = direction === 'up' ? upStake : downStake
  const otherStake = direction === 'up' ? downStake : upStake
  const adjusted = boundedBase + ((otherStake - selectedStake) / total) * frontendConfig.payoutSensitivity
  return Math.round(Math.min(frontendConfig.payoutMaxPercent, Math.max(frontendConfig.payoutMinPercent, adjusted)))
}

function getOutcomePolicy(kind, personalId) {
  return outcomePolicies[kind].users.get(personalId) || outcomePolicies[kind].all
}

function settleForecast(item, result) {
  const previousPayout = item.payout || 0
  const payout = result === 'won' ? rounded(item.stake * (1 + item.rewardPercent / 100)) : 0
  item.status = result
  item.result = result
  item.payout = payout
  item.profit = rounded(payout - item.stake)
  item.settledAt = new Date().toISOString()
  virtualBalances.set(item.personalId, rounded((virtualBalances.get(item.personalId) ?? 10000) + payout - previousPayout))
  return true
}

function settleEtfOrder(item, result) {
  const previousPayout = item.payout || 0
  const payout = result === 'won' ? rounded(item.amount * (1 + item.payoutPercent * (item.leverage || 1) / 100)) : 0
  item.status = result
  item.result = result
  item.payout = payout
  item.profit = rounded(payout - item.amount)
  item.settledAt = new Date().toISOString()
  etfBalances.set(item.personalId, rounded((etfBalances.get(item.personalId) ?? 25000) + payout - previousPayout))
  return true
}

function validProjectInput({ symbol, name, startPrice, targetChangePct }) {
  return typeof symbol === 'string' && /^SIM-[A-Z0-9]{2,8}$/.test(symbol)
    && typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 60
    && Number.isFinite(Number(startPrice)) && Number(startPrice) > 0 && Number(startPrice) <= 1000000
    && Number.isFinite(Number(targetChangePct)) && Math.abs(Number(targetChangePct)) <= 20
}

function publicForecastEvents() {
  return forecastEvents.map(event => {
    const submissions = [...forecasts.values()].filter(item => item.eventId === event.id)
    const liquidity = 10000
    let pool = {
      YES: liquidity * (1 - event.consensus / 100),
      NO: liquidity * (event.consensus / 100),
    }
    for (const item of submissions.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))) {
      try {
        pool = calculateCpmmPurchase(pool, 0.5, item.stake, item.choice || (item.probability >= 50 ? 'YES' : 'NO')).newPool
      } catch {
        // If an extreme sequence exhausts floating-point precision, keep the
        // last valid quote so one thin event does not break the public config.
        break
      }
    }
    const marketProbability = Math.round(getCpmmProbability(pool, 0.5) * 100)
    return { ...event, marketProbability: Math.max(1, Math.min(99, marketProbability)), predictionCount: submissions.length }
  })
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'northstar-local-api' }))
// Keep external discovery separate from this platform's own prediction orders.
async function syncExchangeEvents() {
  if (exchangeEventsCache.payload && exchangeEventsCache.expiresAt > Date.now()) return exchangeEventsCache.payload
  const fetchJson = async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }
  const adapters = [
    async () => {
      const data = await fetchJson('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=40&order=volume24hr&ascending=false')
      const rows = Array.isArray(data) ? data : data.markets || []
      return rows.map(market => {
        let outcomes = []; let prices = []
        try { outcomes = Array.isArray(market.outcomes) ? market.outcomes : JSON.parse(market.outcomes || '[]') } catch {}
        try { prices = Array.isArray(market.outcomePrices) ? market.outcomePrices : JSON.parse(market.outcomePrices || '[]') } catch {}
        const yesIndex = outcomes.findIndex(value => /^yes$/i.test(String(value)))
        const probability = Number(prices[yesIndex])
        const binaryYesNo = outcomes.length === 2 && yesIndex >= 0 && outcomes.some(value => /^no$/i.test(String(value)))
        return { id: `polymarket:${market.id}`, exchange: 'Polymarket', category: market.category || '事件市场', question: market.question || market.title || '', probability: Number.isFinite(probability) ? Math.round(probability * 100) : null, volume: Number(market.volume24hr || market.volume || 0), endTime: market.endDate || null, url: market.slug ? `https://polymarket.com/event/${market.slug}` : 'https://polymarket.com', binaryYesNo }
      }).filter(item => item.binaryYesNo && item.question && /\?$/.test(item.question.trim()) && item.probability !== null && item.probability > 0 && item.probability < 100 && Number.isFinite(item.volume))
    },
    async () => {
      const data = await fetchJson('https://api.elections.kalshi.com/trade-api/v2/events?limit=200&status=open&with_nested_markets=true')
      return (data.events || []).flatMap(event => (event.markets || []).map(market => {
        let title = typeof market.title === 'string' ? market.title.trim() : ''
        const yesSubtitle = typeof market.yes_sub_title === 'string' ? market.yes_sub_title.trim() : ''
        const whoMatch = title.match(/^Who will (.+) be\?$/i)
        const whenMatch = title.match(/^When will (.+)\?$/i)
        if (whoMatch && yesSubtitle) title = `Will ${yesSubtitle} be ${whoMatch[1]}?`
        else if (whenMatch && /^before\s+/i.test(yesSubtitle)) title = `Will ${whenMatch[1]} ${yesSubtitle.toLowerCase()}?`
        const bid = Number(market.yes_bid_dollars)
        const ask = Number(market.yes_ask_dollars)
        const last = Number(market.last_price_dollars)
        const probability = Number.isFinite(bid) && bid > 0 && Number.isFinite(ask) && ask > 0 ? (bid + ask) / 2 : ask > 0 ? ask : bid > 0 ? bid : last
        return { id: `kalshi:${market.ticker}`, exchange: 'Kalshi', category: event.category || '事件市场', question: title, probability: Number.isFinite(probability) ? Math.round(probability * 100) : null, volume: Number(market.volume_24h_fp || market.volume_24h || 0), endTime: market.close_time || market.expiration_time || null, url: `https://kalshi.com/markets/${market.ticker}`, marketType: market.market_type }
      })).filter(item => item.marketType === 'binary' && item.question && /\?$/.test(item.question) && item.probability !== null && item.probability > 0 && item.probability < 100 && Number.isFinite(item.volume) && !item.id.includes('CROSSCATEGORY'))
    },
  ]
  const settled = await Promise.all(adapters.map(async adapter => {
    try { return { ok: true, items: await adapter() } }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'provider unavailable', items: [] } }
  }))
  const seenQuestions = new Set()
  const items = settled.flatMap(result => result.items).sort((a, b) => b.volume - a.volume).filter(item => {
    const key = `${item.exchange}:${item.question.trim().toLowerCase()}`
    if (seenQuestions.has(key)) return false
    seenQuestions.add(key)
    return true
  }).slice(0, 20).map(({ marketType: _marketType, binaryYesNo: _binaryYesNo, ...item }) => ({
    ...item,
    platformEventId: `EVT-X-${createHash('sha256').update(item.id).digest('hex').slice(0, 12).toUpperCase()}`,
  }))
  syncedExchangeEvents.clear()
  for (const item of items) syncedExchangeEvents.set(item.platformEventId, {
    id: item.platformEventId,
    category: item.category,
    question: item.question,
    description: `同步自 ${item.exchange}；此平台的下单与余额使用本平台模拟积分。交易所参考概率 ${item.probability}%。`,
    consensus: item.probability,
    horizon: item.endTime ? new Date(item.endTime).toLocaleString('zh-CN') : '交易所市场开放中',
    volume: `${Math.round(item.volume).toLocaleString('en-US')}（交易所）`,
    rewardPercent: 80,
    sourceExchange: item.exchange,
    sourceUrl: item.url,
    sourceProbability: item.probability,
    externalMarketId: item.id,
  })
  const payload = { items, sources: { Polymarket: settled[0]?.ok || false, Kalshi: settled[1]?.ok || false }, updatedAt: new Date().toISOString(), readOnly: true }
  exchangeEventsCache = { payload, expiresAt: Date.now() + 30000 }
  return payload
}
app.get('/api/exchange-events', async (_req, res) => res.json(await syncExchangeEvents()))
async function syncMarketQuotes() {
  // Twelve Data's free Basic tier is for testing/internal use. Keep it
  // unavailable to public production deployments and cap usage at 8 symbols
  // refreshed every 15 minutes (8 × 96 = 768 requests/day).
  const twelveDataKey = process.env.TWELVE_DATA_API_KEY?.trim()
  if (twelveDataKey && process.env.NODE_ENV !== 'production') {
    if (marketQuotesCache.payload?.provider === 'Twelve Data' && marketQuotesCache.expiresAt > Date.now()) return marketQuotesCache.payload
    const symbols = frontendConfig.marketAssets.map(asset => asset.symbol).filter(Boolean).slice(0, 8)
    const quotes = {}
    try {
      const results = await Promise.all(symbols.map(async symbol => {
        const url = new URL('https://api.twelvedata.com/quote')
        url.searchParams.set('symbol', symbol)
        url.searchParams.set('apikey', twelveDataKey)
        const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { accept: 'application/json' } })
        if (!response.ok) throw new Error(`Twelve Data 返回 HTTP ${response.status}`)
        const quote = await response.json()
        const last = Number(quote.close)
        if (!Number.isFinite(last) || last <= 0) return null
        const turnover = Number(quote.volume) * last
        return { symbol, last: rounded(last), change: rounded(Number(quote.percent_change) || 0), volume: formatTurnover(turnover), updatedAt: quote.timestamp ? new Date(Number(quote.timestamp) * 1000).toISOString() : new Date().toISOString() }
      }))
      for (const quote of results) if (quote) quotes[quote.symbol] = quote
      if (!Object.keys(quotes).length) throw new Error('行情源没有返回可用标的报价')
      const payload = { provider: 'Twelve Data', configured: true, connected: true, message: 'Twelve Data 免费测试行情已连接（仅本地开发；最多 8 个标的，每 15 分钟刷新）。', updatedAt: new Date().toISOString(), quotes }
      marketQuotesCache = { payload, expiresAt: Date.now() + 15 * 60 * 1000 }
      return payload
    } catch (error) {
      return { provider: 'Twelve Data', configured: true, connected: false, message: error instanceof Error ? `Twelve Data 行情连接失败：${error.message}` : 'Twelve Data 行情连接失败；当前显示演示价格。', updatedAt: marketQuotesCache.payload?.updatedAt || null, quotes: marketQuotesCache.payload?.quotes || {} }
    }
  }
  const apiKey = process.env.MASSIVE_API_KEY?.trim()
  const publicDisplayLicensed = process.env.MASSIVE_PUBLIC_DISPLAY_LICENSED === 'true'
  if (!apiKey || !publicDisplayLicensed) return { provider: 'SIM', configured: Boolean(apiKey), connected: false, message: !apiKey ? 'Massive 行情 API Key 尚未配置；当前为演示价格。' : '已配置行情 API Key，但公网展示授权未启用；当前为演示价格。', updatedAt: null, quotes: {} }
  if (marketQuotesCache.payload && marketQuotesCache.expiresAt > Date.now()) return marketQuotesCache.payload
  const symbols = frontendConfig.marketAssets.map(asset => asset.symbol).filter(Boolean)
  const url = new URL('https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers')
  url.searchParams.set('tickers', symbols.join(','))
  url.searchParams.set('apiKey', apiKey)
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`Massive 返回 HTTP ${response.status}`)
    const data = await response.json()
    const quotes = {}
    for (const ticker of data.tickers || []) {
      const last = Number(ticker.lastTrade?.p ?? ticker.min?.c ?? ticker.day?.c)
      const previousClose = Number(ticker.prevDay?.c)
      if (!Number.isFinite(last) || last <= 0) continue
      const change = Number.isFinite(previousClose) && previousClose > 0 ? ((last - previousClose) / previousClose) * 100 : 0
      const asset = frontendConfig.marketAssets.find(item => item.symbol === ticker.ticker)
      const shareVolume = Number(ticker.day?.v)
      const averagePrice = Number(ticker.day?.vw)
      quotes[ticker.ticker] = {
        last: rounded(last), change: rounded(change),
        volume: Number.isFinite(shareVolume) && shareVolume > 0 ? formatTurnover(shareVolume * (Number.isFinite(averagePrice) && averagePrice > 0 ? averagePrice : last)) : asset?.volume || '—',
        updatedAt: Number.isFinite(Number(ticker.updated)) ? new Date(Number(ticker.updated) / 1e6).toISOString() : new Date().toISOString(),
      }
    }
    if (!Object.keys(quotes).length) throw new Error('行情源没有返回可用标的报价')
    const payload = { provider: 'Massive', configured: true, connected: true, message: 'Massive 行情已连接；延迟时效由账户数据权限决定。', updatedAt: new Date().toISOString(), quotes }
    marketQuotesCache = { payload, expiresAt: Date.now() + 60000 }
    return payload
  } catch (error) {
    return { provider: 'Massive', configured: true, connected: false, message: error instanceof Error ? `Massive 行情连接失败：${error.message}` : 'Massive 行情连接失败；当前显示演示价格。', updatedAt: marketQuotesCache.payload?.updatedAt || null, quotes: marketQuotesCache.payload?.quotes || {} }
  }
}

app.get('/api/public-config', async (_req, res) => {
  const marketData = await syncMarketQuotes()
  const config = {
    ...frontendConfig,
    marketAssets: frontendConfig.marketAssets.map(asset => {
      const liveQuote = marketData.quotes[asset.symbol]
      const quote = liveQuote || simulatedMarketQuote(asset)
      return { ...asset, last: quote.last, change: quote.change, volume: quote.volume, quoteSource: liveQuote ? marketData.provider : 'SIM' }
    }),
  }
  const { quotes: _quotes, ...marketDataStatus } = marketData
  res.json({ config, forecastEvents: publicForecastEvents(), marketData: marketDataStatus })
})
app.get('/api/forecast-events', (_req, res) => res.json({ events: publicForecastEvents() }))
app.get('/api/admin/front-config', requirePermission('front-config'), (_req, res) => res.json({ config: frontendConfig, forecastEvents }))
app.patch('/api/admin/front-config', requirePermission('front-config'), (req, res) => {
  const input = req.body || {}
  const textFields = ['siteName', 'marketSubtitle', 'homeTitle', 'equityContractTitle', 'equityContractSubtitle', 'timeContractTitle', 'timeContractSubtitle', 'predictionTitle', 'predictionSubtitle', 'indexTitle', 'indexSubtitle', 'featuredTitle', 'featuredSubtitle', 'demoProjectTitle', 'demoProjectSubtitle', 'orderDisclaimer']
  for (const field of textFields) {
    if (typeof input[field] !== 'string' || !input[field].trim() || input[field].length > (field === 'siteName' ? 40 : field === 'orderDisclaimer' ? 180 : 140)) return res.status(400).json({ error: `${field} 内容无效` })
    frontendConfig[field] = input[field].trim()
  }
  const uiTextKeys = Object.keys(frontendConfig.uiText)
  if (!input.uiText || typeof input.uiText !== 'object' || Array.isArray(input.uiText) || uiTextKeys.some(key => typeof input.uiText[key] !== 'string' || input.uiText[key].length > 120)) {
    return res.status(400).json({ error: '前台导航和按钮文案无效；每项最多 120 字' })
  }
  frontendConfig.uiText = Object.fromEntries(uiTextKeys.map(key => [key, input.uiText[key].trim()]))
  if (!Array.isArray(input.marketAssets) || input.marketAssets.length < 1 || input.marketAssets.length > 40) return res.status(400).json({ error: 'ETF 列表需要 1–40 个标的' })
  const assetSymbols = new Set()
  for (const asset of input.marketAssets) {
    if (!asset || typeof asset.symbol !== 'string' || !/^[A-Z0-9.]{1,12}$/.test(asset.symbol) || assetSymbols.has(asset.symbol) || typeof asset.name !== 'string' || !asset.name.trim() || asset.name.length > 60 || !Number.isFinite(Number(asset.last)) || Number(asset.last) <= 0 || !Number.isFinite(Number(asset.change)) || Math.abs(Number(asset.change)) > 500 || typeof asset.volume !== 'string' || asset.volume.length > 20 || typeof asset.type !== 'string' || asset.type.length > 30 || typeof asset.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(asset.color) || !Array.isArray(asset.spark) || asset.spark.length < 2 || asset.spark.length > 50 || asset.spark.some(point => !Number.isFinite(Number(point)) || Number(point) < 0 || Number(point) > 100)) return res.status(400).json({ error: 'ETF 字段无效：检查代码、名称、价格、涨幅、类型、颜色和走势图点' })
    assetSymbols.add(asset.symbol)
  }
  if (!Array.isArray(input.marketIndices) || input.marketIndices.length > 10 || input.marketIndices.some(index => !index || typeof index.s !== 'string' || !index.s.trim() || index.s.length > 30 || typeof index.v !== 'string' || index.v.length > 24 || typeof index.c !== 'string' || index.c.length > 24 || (index.down !== undefined && typeof index.down !== 'boolean'))) return res.status(400).json({ error: '指数卡片字段无效（最多 10 项）' })
  frontendConfig.marketAssets = input.marketAssets.map(asset => ({ ...asset, symbol: asset.symbol.toUpperCase(), name: asset.name.trim(), last: rounded(Number(asset.last)), change: Number(asset.change), spark: asset.spark.map(Number) }))
  marketQuotesCache.expiresAt = 0
  frontendConfig.marketIndices = input.marketIndices.map(index => ({ ...index, s: index.s.trim() }))
  for (const field of ['showMarketOverview', 'showEquityContracts', 'showTimeContracts', 'showPrediction', 'showDeposit', 'showWithdrawal', 'showKyc', 'demoOrdersEnabled', 'showMarketPicks', 'showDemoProjects', 'showQuickOrder', 'showWatchlistNav', 'showPositionsNav', 'showNewsNav', 'showCalendarNav', 'showHelpNav', 'showSettingsNav', 'autoPayoutEnabled']) {
    if (typeof input[field] !== 'boolean') return res.status(400).json({ error: `${field} 必须为开关` })
    frontendConfig[field] = input[field]
  }
  const delay = Number(input.marketDelayMinutes)
  const minimumWithdrawal = Number(input.minimumWithdrawal)
  const withdrawalFee = Number(input.withdrawalFee)
  const payout = Number(input.contractPayoutPercent)
  const maxEtfLeverage = Number(input.maxEtfLeverage)
  const payoutMin = Number(input.payoutMinPercent)
  const payoutMax = Number(input.payoutMaxPercent)
  const payoutSensitivity = Number(input.payoutSensitivity)
  if (![0, 15, 30, 60].includes(delay) || !Number.isFinite(minimumWithdrawal) || minimumWithdrawal < 1 || minimumWithdrawal > 100000 || !Number.isFinite(withdrawalFee) || withdrawalFee < 0 || withdrawalFee > 100 || !Number.isInteger(maxEtfLeverage) || maxEtfLeverage < 1 || maxEtfLeverage > 100 || !Number.isInteger(payout) || payout < 1 || payout > 200 || !Number.isInteger(payoutMin) || payoutMin < 1 || payoutMin > 200 || !Number.isInteger(payoutMax) || payoutMax < payoutMin || payoutMax > 200 || !Number.isInteger(payoutSensitivity) || payoutSensitivity < 0 || payoutSensitivity > 100) return res.status(400).json({ error: '行情延迟、杠杆上限或模拟结算参数无效' })
  if (!Array.isArray(input.depositNetworks) || !input.depositNetworks.length || input.depositNetworks.some(network => !frontendConfig.depositNetworks.includes(network))) return res.status(400).json({ error: '请选择至少一个支持的演示网络' })
  if (!Array.isArray(input.contractDurations) || !input.contractDurations.length || input.contractDurations.length > 20 || input.contractDurations.some(duration => !Number.isInteger(Number(duration)) || Number(duration) < 5 || Number(duration) > 3600)) return res.status(400).json({ error: '合约期限需为 5–3600 秒之间的整数，最多 20 项' })
  frontendConfig.marketDelayMinutes = delay
  frontendConfig.minimumWithdrawal = rounded(minimumWithdrawal)
  frontendConfig.withdrawalFee = rounded(withdrawalFee)
  frontendConfig.maxEtfLeverage = maxEtfLeverage
  frontendConfig.contractPayoutPercent = payout
  frontendConfig.payoutMinPercent = payoutMin
  frontendConfig.payoutMaxPercent = payoutMax
  frontendConfig.payoutSensitivity = payoutSensitivity
  frontendConfig.depositNetworks = [...new Set(input.depositNetworks)]
  frontendConfig.contractDurations = [...new Set(input.contractDurations.map(Number))].sort((a, b) => a - b)
  res.json({ config: frontendConfig })
})
app.get('/api/admin/deposit-config', requirePermission('deposits'), (_req, res) => {
  res.json({ currencies: frontendConfig.depositAssets })
})
app.get('/api/admin/direct-wallet-status', requirePermission('deposits'), (_req, res) => {
  res.json(getDirectWalletStatus())
})
app.patch('/api/admin/deposit-config', requirePermission('deposits'), (req, res) => {
  const input = req.body?.currencies
  if (!input || typeof input !== 'object' || Array.isArray(input)) return res.status(400).json({ error: '充值币种配置格式无效' })
  const normalized = {}
  for (const currency of depositCurrencies) {
    const item = input[currency]
    const minimumAmount = Number(item?.minimumAmount)
    if (!Number.isFinite(minimumAmount) || minimumAmount < 0.01 || minimumAmount > 100000) {
      return res.status(400).json({ error: `${currency} 最低充值金额需为 0.01–100000` })
    }
    if (typeof item.instruction !== 'string' || item.instruction.length > 280) {
      return res.status(400).json({ error: `${currency} 充值说明最多 280 字` })
    }
    if (!Array.isArray(item.networks) || !item.networks.length) {
      return res.status(400).json({ error: `${currency} 至少需要启用一个网络` })
    }
    const seenNetworks = new Set()
    const networks = []
    for (const network of item.networks) {
      if (!depositNetworks.includes(network?.network) || seenNetworks.has(network.network)) {
        return res.status(400).json({ error: `${currency} 网络无效或重复` })
      }
      if (typeof network.address !== 'string' || network.address.length > 160) {
        return res.status(400).json({ error: `${currency} ${network.network} 演示地址最多 160 字` })
      }
      if (typeof network.qrUrl !== 'string' || network.qrUrl.length > 2048 || (network.qrUrl && !/^https:\/\//i.test(network.qrUrl))) {
        return res.status(400).json({ error: `${currency} ${network.network} 二维码链接必须为空或 HTTPS 地址` })
      }
      seenNetworks.add(network.network)
      networks.push({ network: network.network, address: network.address.trim(), qrUrl: network.qrUrl.trim() })
    }
    normalized[currency] = { minimumAmount: rounded(minimumAmount), instruction: item.instruction.trim(), networks }
  }
  frontendConfig.depositAssets = normalized
  res.json({ currencies: frontendConfig.depositAssets })
})
app.put('/api/admin/forecast-events', requirePermission('front-config'), (req, res) => {
  const events = req.body?.events
  if (!Array.isArray(events) || events.length > 40) return res.status(400).json({ error: '预测事件列表格式无效（最多 40 条）' })
  const normalized = []
  for (const [index, event] of events.entries()) {
    const { id, category, question, description, consensus, horizon } = event || {}
    const rewardPercent = Number(event.rewardPercent ?? 80)
    if (typeof id !== 'string' || !/^EVT-[A-Z0-9-]{3,30}$/.test(id) || typeof category !== 'string' || !category.trim() || category.length > 24 || typeof question !== 'string' || question.trim().length < 5 || question.length > 120 || typeof description !== 'string' || description.length > 280 || !Number.isInteger(Number(consensus)) || Number(consensus) < 1 || Number(consensus) > 99 || !Number.isInteger(rewardPercent) || rewardPercent < 1 || rewardPercent > 200 || typeof horizon !== 'string' || horizon.length > 80) return res.status(400).json({ error: `第 ${index + 1} 条事件字段无效` })
    normalized.push({ id, category: category.trim(), question: question.trim(), description: description.trim(), consensus: Number(consensus), horizon: horizon.trim(), volume: event.volume || '模拟参与 0 人', rewardPercent })
  }
  if (new Set(normalized.map(event => event.id)).size !== normalized.length) return res.status(400).json({ error: '预测事件 ID 不能重复' })
  forecastEvents.splice(0, forecastEvents.length, ...normalized)
  res.json({ events: forecastEvents })
})

async function syncTimeContractProjects(force = false) {
  if (!force && timeContractProjectCache.expiresAt > Date.now()) return timeContractProjectCache.projects
  const now = Date.now()
  const items = []
  const fetchJson = async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }
  const kalshiSeries = [
    { ticker: 'KXBTC15M', symbol: 'BTC', label: '比特币' },
    { ticker: 'KXETH15M', symbol: 'ETH', label: '以太坊' },
    { ticker: 'KXSOL15M', symbol: 'SOL', label: 'Solana' },
    { ticker: 'KXXRP15M', symbol: 'XRP', label: 'XRP' },
  ]
  const kalshiRequests = kalshiSeries.map(async series => {
    const data = await fetchJson(`https://api.elections.kalshi.com/trade-api/v2/markets?limit=1&status=open&series_ticker=${series.ticker}`)
    const market = (data.markets || []).find(row => row.status === 'active' && Date.parse(row.close_time || row.expiration_time || '') > now)
    if (!market) return
    const quote = Number(market.yes_ask_dollars ?? market.last_price_dollars ?? (Number(market.yes_ask ?? market.last_price ?? 0) / 100))
    if (!Number.isFinite(quote) || quote <= 0 || quote >= 1) return
    items.push({ group: `kalshi-${series.symbol}-15m`, sourceExchange: 'Kalshi', symbol: `KALSHI-${series.symbol}-15M`, name: `Kalshi ${series.label} 15 分钟合约概率`, quote: quote * 100, sourceTicker: market.ticker, sourceExpiry: market.close_time || market.expiration_time, sourceUrl: `https://kalshi.com/markets/${market.ticker}` })
  })
  const polymarketAssets = [{ symbol: 'BTC', label: 'Bitcoin' }, { symbol: 'ETH', label: 'Ethereum' }, { symbol: 'SOL', label: 'Solana' }, { symbol: 'XRP', label: 'XRP' }]
  const currentFiveMinuteEpoch = Math.floor(now / 300000) * 300
  const polymarketRequests = polymarketAssets.map(async asset => {
    const slug = `${asset.symbol.toLowerCase()}-updown-5m-${currentFiveMinuteEpoch}`
    const data = await fetchJson(`https://gamma-api.polymarket.com/events/slug/${slug}`)
    const event = Array.isArray(data) ? data[0] : data
    const market = event?.markets?.find(row => row.active !== false && row.closed !== true) || event?.markets?.[0]
    if (!market) return
    let outcomes = []; let prices = []
    try { outcomes = Array.isArray(market.outcomes) ? market.outcomes : JSON.parse(market.outcomes || '[]') } catch {}
    try { prices = Array.isArray(market.outcomePrices) ? market.outcomePrices : JSON.parse(market.outcomePrices || '[]') } catch {}
    const upIndex = outcomes.findIndex(value => /^(up|yes)$/i.test(String(value)))
    const quote = Number(prices[upIndex >= 0 ? upIndex : 0])
    if (!Number.isFinite(quote) || quote <= 0 || quote >= 1) return
    items.push({ group: `polymarket-${asset.symbol}-5m`, sourceExchange: 'Polymarket', symbol: `POLY-${asset.symbol}-5M`, name: `Polymarket ${asset.label} 5 分钟涨跌概率`, quote: quote * 100, sourceTicker: market.id || event.id || slug, sourceExpiry: market.endDate || event.endDate, sourceUrl: event.slug ? `https://polymarket.com/event/${event.slug}` : `https://polymarket.com/event/${slug}` })
  })
  const [kalshiResults, polymarketResults] = await Promise.all([Promise.allSettled(kalshiRequests), Promise.allSettled(polymarketRequests)])
  const providerStatuses = { Kalshi: kalshiResults.some(item => item.status === 'fulfilled'), Polymarket: polymarketResults.some(item => item.status === 'fulfilled') }
  for (const [index, item] of items.entries()) {
    const id = `TIME-X-${createHash('sha256').update(item.group).digest('hex').slice(0, 12).toUpperCase()}`
    const previous = syncedTimeContractProjects.get(id)
    const history = [...(previous?.marketCurve || []), rounded(item.quote)].slice(-20)
    syncedTimeContractProjects.set(id, {
      id, symbol: item.symbol, name: item.name, startPrice: previous?.startPrice || rounded(item.quote), lastPrice: rounded(item.quote),
      targetChangePct: 0, curve: history, marketCurve: history, marketStartedAt: now, marketPointIntervalSeconds: 1,
      visible: true, sortOrder: projects.size + index, updatedAt: new Date(now).toISOString(),
      sourceExchange: item.sourceExchange, sourceUrl: item.sourceUrl, sourceExpiry: item.sourceExpiry, sourceTicker: item.sourceTicker,
    })
  }
  for (const [id, project] of syncedTimeContractProjects) {
    if (project.sourceExpiry && Date.parse(project.sourceExpiry) <= now) syncedTimeContractProjects.delete(id)
  }
  const synced = [...syncedTimeContractProjects.values()]
  timeContractProjectCache = { expiresAt: now + 15000, projects: synced, sources: providerStatuses }
  return synced
}

app.get('/api/projects', async (_req, res) => {
  const synced = await syncTimeContractProjects()
  res.json({ projects: [...projects.values()].filter(project => project.visible).sort((a, b) => a.sortOrder - b.sortOrder).map(publicProject).concat(synced.map(publicProject)), sources: timeContractProjectCache.sources || {} })
})

app.get('/api/admin/projects', requirePermission('projects'), (_req, res) => {
  res.json({ projects: [...projects.values()].sort((a, b) => a.sortOrder - b.sortOrder).map(adminProject) })
})

app.get('/api/admin/outcome-controls', requirePermission('prediction-preview'), (_req, res) => {
  const serialize = policy => ({ all: policy.all, users: Object.fromEntries(policy.users) })
  res.json({
    policies: { contracts: serialize(outcomePolicies.contracts), forecasts: serialize(outcomePolicies.forecasts), etfOrders: serialize(outcomePolicies.etfOrders) },
    pendingContracts: [...predictions.values()].filter(item => item.status === 'pending').length,
    pendingForecasts: [...forecasts.values()].filter(item => item.status === 'pending').length,
    pendingEtfOrders: [...etfOrders.values()].filter(item => item.status === 'pending').length,
  })
})

app.put('/api/admin/outcome-controls/:kind', requirePermission('prediction-preview'), (req, res) => {
  const { kind } = req.params
  if (!['contracts', 'forecasts', 'etfOrders'].includes(kind)) return res.status(404).json({ error: '输赢控制类型无效' })
  const { target, result } = req.body || {}
  if ((result !== null && !['won', 'lost'].includes(result)) || (target !== 'all' && !validPersonalId(target))) {
    return res.status(400).json({ error: '请选择全体或有效个人 ID，并选择赢、输或清除规则' })
  }

  const policy = outcomePolicies[kind]
  if (target === 'all') {
    policy.all = result
    policy.users.clear()
  } else if (result === null) {
    policy.users.delete(target)
  } else {
    policy.users.set(target, result)
  }

  let affected = 0
  if (kind === 'contracts') {
    for (const item of predictions.values()) {
      if (item.status !== 'pending' || (target !== 'all' && item.personalId !== target)) continue
      item.forcedResult = getOutcomePolicy(kind, item.personalId) || null
      affected += 1
    }
  } else if (kind === 'forecasts' && result !== null) {
    for (const item of forecasts.values()) {
      if (item.status !== 'pending' || (target !== 'all' && item.personalId !== target)) continue
      const forcedResult = getOutcomePolicy(kind, item.personalId)
      if (forcedResult && settleForecast(item, forcedResult)) affected += 1
    }
  } else if (kind === 'etfOrders' && result !== null) {
    for (const item of etfOrders.values()) {
      if (item.status !== 'pending' || (target !== 'all' && item.personalId !== target)) continue
      const forcedResult = getOutcomePolicy(kind, item.personalId)
      if (forcedResult && settleEtfOrder(item, forcedResult)) affected += 1
    }
  }

  const serialize = current => ({ all: current.all, users: Object.fromEntries(current.users) })
  res.json({
    ok: true,
    affected,
    policies: { contracts: serialize(outcomePolicies.contracts), forecasts: serialize(outcomePolicies.forecasts), etfOrders: serialize(outcomePolicies.etfOrders) },
    pendingContracts: [...predictions.values()].filter(item => item.status === 'pending').length,
    pendingForecasts: [...forecasts.values()].filter(item => item.status === 'pending').length,
    pendingEtfOrders: [...etfOrders.values()].filter(item => item.status === 'pending').length,
  })
})

app.get('/api/admin/orders', requirePermission('prediction-preview'), (_req, res) => {
  const contracts = [...predictions.values()].map(item => ({
    id: item.id, kind: 'contracts', personalId: item.personalId, symbol: item.projectSymbol,
    direction: item.direction, durationSeconds: item.durationSeconds, stake: item.stake,
    payoutPercent: item.payoutPercent, status: item.status, result: item.result,
    profit: item.profit, createdAt: item.createdAt,
  }))
  const forecastOrders = [...forecasts.values()].map(item => {
    const event = forecastEvents.find(candidate => candidate.id === item.eventId)
    return {
      id: item.id, kind: 'forecasts', personalId: item.personalId, symbol: event?.question || item.eventId,
      probability: item.probability, stake: item.stake, payoutPercent: item.rewardPercent,
      status: item.status, result: item.result, profit: item.profit, createdAt: item.updatedAt,
    }
  })
  const equityOrders = [...etfOrders.values()].map(item => ({
    id: item.id, kind: 'etfOrders', personalId: item.personalId, symbol: item.symbol,
    direction: item.side, quantity: item.quantity, leverage: item.leverage || 1, exposureAmount: item.exposureAmount || item.amount, stake: item.amount, payoutPercent: item.payoutPercent,
    status: item.status, result: item.result, profit: item.profit, createdAt: item.createdAt,
  }))
  const orders = [...contracts, ...forecastOrders, ...equityOrders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 300)
  res.json({ orders })
})

app.patch('/api/admin/orders/:kind/:id/result', requirePermission('prediction-preview'), (req, res) => {
  const { kind, id } = req.params
  const { result } = req.body || {}
  if (!['contracts', 'forecasts', 'etfOrders'].includes(kind)) return res.status(404).json({ error: '订单类型无效' })
  if (!['won', 'lost'].includes(result)) return res.status(400).json({ error: '订单结果必须为赢或输' })

  let order
  if (kind === 'contracts') order = predictions.get(id)
  else if (kind === 'etfOrders') order = etfOrders.get(id)
  else order = [...forecasts.values()].find(item => item.id === id)
  if (!order) return res.status(404).json({ error: '未找到该模拟订单' })

  if (kind === 'contracts') {
    const timer = contractSettlementTimers.get(id)
    if (timer) clearTimeout(timer)
    contractSettlementTimers.delete(id)
    settleContract(order, result)
  }
  else if (kind === 'forecasts') settleForecast(order, result)
  else settleEtfOrder(order, result)
  res.json({ ok: true, order })
})

app.post('/api/admin/projects', requirePermission('projects'), (req, res) => {
  const values = req.body || {}
  if (!validProjectInput(values)) return res.status(400).json({ error: '项目代码须为 SIM- 前缀，价格须大于 0，模拟曲线变化限制在 ±20%' })
  const symbol = values.symbol.trim().toUpperCase()
  if ([...projects.values()].some(project => project.symbol === symbol)) return res.status(409).json({ error: '该模拟项目代码已存在' })
  const startPrice = rounded(Number(values.startPrice))
  const targetChangePct = Number(values.targetChangePct)
  const curve = buildCurve(startPrice, targetChangePct, projects.size)
  const project = { id: randomUUID(), symbol, name: values.name.trim(), startPrice, targetChangePct, curve, marketCurve: curve, marketStartedAt: Date.now(), marketPointIntervalSeconds: 5, previewPoints: curve, visible: true, sortOrder: projects.size, updatedAt: new Date().toISOString() }
  projects.set(project.id, project)
  res.status(201).json({ project: publicProject(project) })
})

app.patch('/api/admin/projects/:id', requirePermission('projects'), (req, res) => {
  const project = projects.get(req.params.id)
  if (!project) return res.status(404).json({ error: '未找到演示项目' })
  const { startPrice = project.startPrice, targetChangePct = project.targetChangePct, name = project.name, symbol = project.symbol, visible = project.visible, sortOrder = project.sortOrder } = req.body || {}
  if (!validProjectInput({ symbol, name, startPrice, targetChangePct }) || typeof visible !== 'boolean' || !Number.isInteger(Number(sortOrder)) || Number(sortOrder) < 0 || Number(sortOrder) > 999) return res.status(400).json({ error: '项目信息无效：检查 SIM 代码、名称、价格、显示状态和排序（0–999）' })
  const normalizedSymbol = symbol.trim().toUpperCase()
  if ([...projects.values()].some(item => item.id !== project.id && item.symbol === normalizedSymbol)) return res.status(409).json({ error: '该模拟项目代码已存在' })
  project.symbol = normalizedSymbol
  project.name = name.trim()
  const startPriceChanged = Number(startPrice) !== project.startPrice
  project.startPrice = rounded(Number(startPrice))
  project.targetChangePct = Number(targetChangePct)
  project.visible = visible
  project.sortOrder = Number(sortOrder)
  if (startPriceChanged) {
    project.marketCurve = buildCurve(project.startPrice, project.targetChangePct, projects.size + Date.now() % 11)
    project.marketStartedAt = Date.now()
  }
  project.updatedAt = new Date().toISOString()
  res.json({ project: publicProject(project) })
})

app.delete('/api/admin/projects/:id', requirePermission('projects'), (req, res) => {
  if (!projects.has(req.params.id)) return res.status(404).json({ error: '未找到演示项目' })
  projects.delete(req.params.id)
  res.json({ ok: true })
})

app.patch('/api/admin/projects/:id/preview-points', requirePermission('projects'), (req, res) => {
  const project = projects.get(req.params.id)
  if (!project) return res.status(404).json({ error: '未找到演示项目' })
  const points = req.body?.points
  const minimum = project.startPrice * 0.8
  const maximum = project.startPrice * 1.2
  if (!Array.isArray(points) || points.length !== 20 || points.some(point => !Number.isFinite(Number(point)) || Number(point) < minimum || Number(point) > maximum)) {
    return res.status(400).json({ error: `点位必须为 20 个数值，且每个点需在起始价的 ±20% 范围内（${rounded(minimum)}–${rounded(maximum)}）` })
  }
  project.previewPoints = points.map(value => rounded(Number(value)))
  project.updatedAt = new Date().toISOString()
  res.json({ project: adminProject(project) })
})

app.patch('/api/admin/projects/:id/market-points', requirePermission('projects'), (req, res) => {
  const project = projects.get(req.params.id)
  if (!project) return res.status(404).json({ error: '未找到演示项目' })
  const points = req.body?.points
  const intervalSeconds = Number(req.body?.intervalSeconds ?? 5)
  const minimum = project.startPrice * 0.8
  const maximum = project.startPrice * 1.2
  if (!Array.isArray(points) || points.length !== 20 || points.some(point => !Number.isFinite(Number(point)) || Number(point) < minimum || Number(point) > maximum) || !Number.isInteger(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 60) {
    return res.status(400).json({ error: `须填写 20 个有效点位（起始价 ±20% 范围）及 1–60 秒的点位间隔` })
  }
  project.marketCurve = points.map(value => rounded(Number(value)))
  project.marketPointIntervalSeconds = intervalSeconds
  project.marketStartedAt = Date.now()
  project.updatedAt = new Date().toISOString()
  res.json({ project: adminProject(project) })
})

function normalizeAgentInput(input, existingAgentId = '') {
  const { code, name, contact = '', commissionRate, members = [], active = true } = input || {}
  const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : ''
  const rate = Number(commissionRate)
  if (!/^AG-[A-Z0-9-]{2,24}$/.test(normalizedCode) || typeof name !== 'string' || !name.trim() || name.length > 80 ||
    typeof contact !== 'string' || contact.length > 120 || !Number.isFinite(rate) || rate < 0 || rate > 100 ||
    !Array.isArray(members) || members.length > 500 || typeof active !== 'boolean') return null
  const normalizedMembers = []
  for (const member of members) {
    if (!member || !validPersonalId(member.personalId) || typeof member.name !== 'string' || member.name.trim().length > 80) return null
    normalizedMembers.push({ personalId: member.personalId, name: member.name.trim() || member.personalId })
  }
  if (new Set(normalizedMembers.map(member => member.personalId)).size !== normalizedMembers.length) return null
  const duplicateCode = [...agents.values()].some(agent => agent.id !== existingAgentId && agent.code === normalizedCode)
  const assignedElsewhere = [...agents.values()].some(agent => agent.id !== existingAgentId && agent.members.some(member => normalizedMembers.some(next => next.personalId === member.personalId)))
  if (duplicateCode || assignedElsewhere) return null
  return { code: normalizedCode, name: name.trim(), contact: contact.trim(), commissionRate: rounded(rate), members: normalizedMembers, active }
}

app.get('/api/admin/agents', requirePermission('agents'), (_req, res) => {
  res.json({
    agents: [...agents.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(publicAgent),
    commissionStatus: { enabled: false, note: '尚未接入真实入金数据源；返佣比例仅为配置，当前不会自动计算或结算佣金。' },
  })
})

app.post('/api/admin/agents', requirePermission('agents'), (req, res) => {
  const values = normalizeAgentInput(req.body)
  if (!values) return res.status(400).json({ error: '代理资料无效；请检查 AG- 编号、返佣比例、下级个人 ID，且确保编号和下级未重复' })
  const agent = { id: randomUUID(), ...values, createdAt: new Date().toISOString() }
  agents.set(agent.id, agent)
  res.status(201).json({ agent: publicAgent(agent) })
})

app.patch('/api/admin/agents/:id', requirePermission('agents'), (req, res) => {
  const agent = agents.get(req.params.id)
  if (!agent) return res.status(404).json({ error: '未找到代理' })
  const values = normalizeAgentInput({ ...agent, ...req.body }, agent.id)
  if (!values) return res.status(400).json({ error: '代理资料无效；请检查 AG- 编号、返佣比例、下级个人 ID，且确保编号和下级未重复' })
  Object.assign(agent, values)
  res.json({ agent: publicAgent(agent) })
})

app.delete('/api/admin/agents/:id', requirePermission('agents'), (req, res) => {
  if (!agents.has(req.params.id)) return res.status(404).json({ error: '未找到代理' })
  agents.delete(req.params.id)
  res.json({ ok: true })
})

// Public referral registration endpoint. It intentionally lives under the same
// Vercel function route as admin agent management so both paths share agent state.
app.post('/api/admin/agents/register', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const personalId = typeof req.body?.personalId === 'string' ? req.body.personalId.trim().toUpperCase() : ''
  const code = typeof req.body?.referralCode === 'string' ? req.body.referralCode.trim().toUpperCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !validPersonalId(personalId) || !/^AG-[A-Z0-9-]{2,24}$/.test(code)) {
    return res.status(400).json({ error: '注册链接或注册资料无效，请重新打开代理邀请链接' })
  }
  if (agentRegistrations.has(personalId) || [...agentRegistrations.values()].some(registration => registration.email === email)) {
    return res.status(409).json({ error: '该演示账户已登记，请勿重复注册' })
  }
  const agent = [...agents.values()].find(item => item.code === code && item.active)
  if (!agent) return res.status(404).json({ error: '代理邀请链接无效或代理已停用' })
  if ([...agents.values()].some(item => item.members.some(member => member.personalId === personalId))) {
    return res.status(409).json({ error: '该个人 ID 已关联其他代理' })
  }
  const member = { personalId, name: email }
  agent.members.push(member)
  agentRegistrations.set(personalId, { email, agentId: agent.id, createdAt: new Date().toISOString() })
  userAccounts.set(personalId, { personalId, email, agentId: agent.id, createdAt: new Date().toISOString() })
  res.status(201).json({ ok: true, agent: { id: agent.id, code: agent.code, name: agent.name }, member })
})

// Public demo registration records account metadata only. Passwords are never accepted or stored.
app.post('/api/register', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const personalId = typeof req.body?.personalId === 'string' ? req.body.personalId.trim().toUpperCase() : ''
  const referralCode = typeof req.body?.referralCode === 'string' ? req.body.referralCode.trim().toUpperCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !validPersonalId(personalId)) {
    return res.status(400).json({ error: '注册资料无效' })
  }
  if (userAccounts.has(personalId) || [...userAccounts.values()].some(item => item.email === email)) {
    return res.status(409).json({ error: '该邮箱或个人 ID 已注册' })
  }
  let inviterId = ''
  let agent = null
  if (referralCode.startsWith('NST-')) {
    inviterId = referralCode
    if (!validPersonalId(inviterId) || inviterId === personalId) return res.status(400).json({ error: '邀请链接无效' })
  } else if (referralCode.startsWith('AG-')) {
    agent = [...agents.values()].find(item => item.code === referralCode && item.active)
    if (!agent) return res.status(404).json({ error: '代理邀请链接无效或代理已停用' })
  } else if (referralCode) {
    return res.status(400).json({ error: '邀请链接无效' })
  }
  const createdAt = new Date().toISOString()
  const account = { personalId, email, createdAt, inviterId, agentId: agent?.id || '' }
  userAccounts.set(personalId, account)
  if (inviterId) userReferralRegistrations.set(personalId, { email, inviterId, createdAt })
  if (agent) {
    agent.members.push({ personalId, name: email })
    agentRegistrations.set(personalId, { email, agentId: agent.id, createdAt })
  }
  res.status(201).json({ ok: true, personalId })
})

app.get('/api/admin/members', requirePermission('members'), (_req, res) => {
  const members = new Map(userAccounts)
  for (const [personalId, item] of userReferralRegistrations.entries()) {
    if (!members.has(personalId)) members.set(personalId, { personalId, email: item.email, createdAt: item.createdAt, inviterId: item.inviterId })
  }
  for (const item of agentRegistrations.entries()) {
    const [personalId, registration] = item
    const member = members.get(personalId) || { personalId, email: registration.email, createdAt: registration.createdAt }
    member.agentId = registration.agentId
    members.set(personalId, member)
  }
  for (const submission of submissions.values()) {
    const member = members.get(submission.personalId) || { personalId: submission.personalId, email: submission.email, createdAt: submission.submittedAt }
    member.email ||= submission.email
    if (!member.kycStatus || submission.submittedAt > (member.kycSubmittedAt || '')) {
      member.kycStatus = submission.status === 'approved' ? 'verified' : submission.status === 'rejected' ? 'rejected' : 'pending'
      member.kycSubmittedAt = submission.submittedAt
    }
    members.set(member.personalId, member)
  }
  const rows = [...members.values()].map(member => ({
    personalId: member.personalId,
    email: member.email || '',
    createdAt: member.createdAt,
    inviterId: member.inviterId || '',
    agentId: member.agentId || '',
    kycStatus: member.kycStatus || 'unverified',
    walletTransactions: [...walletTransactions.values()].filter(item => item.personalId === member.personalId).length,
    orderCount: [...etfOrders.values()].filter(item => item.personalId === member.personalId).length + [...predictions.values()].filter(item => item.personalId === member.personalId).length + [...forecasts.values()].filter(item => item.personalId === member.personalId).length,
  })).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  res.json({ members: rows, persistence: 'ephemeral-demo' })
})

app.get('/api/referrals/:personalId', (req, res) => {
  const personalId = String(req.params.personalId || '').trim().toUpperCase()
  if (!validPersonalId(personalId)) return res.status(400).json({ error: '个人 ID 无效' })
  const inviteCount = [...userReferralRegistrations.values()].filter(item => item.inviterId === personalId).length
  res.json({ personalId, inviteCount })
})

app.post('/api/referrals/register', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const personalId = typeof req.body?.personalId === 'string' ? req.body.personalId.trim().toUpperCase() : ''
  const inviterId = typeof req.body?.referralCode === 'string' ? req.body.referralCode.trim().toUpperCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !validPersonalId(personalId) || !validPersonalId(inviterId) || personalId === inviterId) {
    return res.status(400).json({ error: '个人邀请链接或注册资料无效' })
  }
  if (userReferralRegistrations.has(personalId) || [...userReferralRegistrations.values()].some(item => item.email === email)) {
    return res.status(409).json({ error: '该演示账户已登记邀请关系' })
  }
  userReferralRegistrations.set(personalId, { email, inviterId, createdAt: new Date().toISOString() })
  res.status(201).json({ ok: true, inviterId, personalId })
})

app.get('/api/time-contracts/quote', (req, res) => {
  if (!frontendConfig.showTimeContracts) return res.status(403).json({ error: '后台已关闭时间合约模块' })
  const direction = String(req.query.direction || '')
  if (!['up', 'down'].includes(direction)) return res.status(400).json({ error: '方向参数无效' })
  res.json({ payoutPercent: timePayoutPercent(direction, String(req.query.projectId || '')), autoAdjusted: frontendConfig.autoPayoutEnabled })
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
  res.json({ personalId, balance: virtualBalances.get(personalId) ?? 10000, forecasts: items.slice(0, 50) })
})

app.post('/api/forecasts', async (req, res) => {
  if (!frontendConfig.showPrediction) return res.status(403).json({ error: '后台已关闭预测系统' })
  const { personalId, eventId, probability, choice: requestedChoice, rationale = '' } = req.body || {}
  const stake = Number(req.body?.stake)
  if (!validPersonalId(personalId)) return res.status(400).json({ error: '请先注册并绑定个人 ID' })
  if (typeof eventId !== 'string' || !/^EVT-[A-Z0-9-]{3,30}$/.test(eventId)) return res.status(400).json({ error: '预测事件无效' })
  let event = forecastEvents.find(item => item.id === eventId) || syncedExchangeEvents.get(eventId)
  if (!event && /^EVT-X-[A-F0-9]{12}$/.test(eventId)) {
    try { await syncExchangeEvents() } catch {}
    event = syncedExchangeEvents.get(eventId)
  }
  if (!event) return res.status(404).json({ error: '未找到该模拟预测事件' })
  const choice = requestedChoice === 'YES' || requestedChoice === 'NO' ? requestedChoice : null
  const value = choice ? (choice === 'YES' ? 75 : 25) : Number(probability)
  if (!Number.isInteger(value) || value < 1 || value > 99 || !Number.isInteger(stake) || stake < 10 || stake > 1000 || typeof rationale !== 'string' || rationale.length > 280) return res.status(400).json({ error: '概率范围为 1–99%，虚拟积分投入为 10–1000，说明最多 280 字' })
  const key = `${personalId}:${eventId}`
  const existing = forecasts.get(key)
  if (existing && existing.status !== 'pending') return res.status(409).json({ error: '该预测已结算，不能修改或重复投入' })
  const balance = virtualBalances.get(personalId) ?? 10000
  if (!existing && balance < stake) return res.status(400).json({ error: '虚拟积分余额不足' })
  if (!existing) virtualBalances.set(personalId, rounded(balance - stake))
  const item = {
    ...(existing || {}),
    id: existing?.id || randomUUID(),
    personalId,
    eventId,
    probability: value,
    choice: choice || (value >= 50 ? 'YES' : 'NO'),
    rationale: rationale.trim(),
    stake: existing?.stake ?? stake,
    rewardPercent: existing?.rewardPercent ?? event.rewardPercent,
    status: 'pending',
    result: null,
    payout: null,
    profit: null,
    updatedAt: new Date().toISOString(),
    settledAt: null,
  }
  forecasts.set(key, item)
  const forcedResult = getOutcomePolicy('forecasts', personalId)
  if (forcedResult) settleForecast(item, forcedResult)
  res.status(existing ? 200 : 201).json({ forecast: item, balance: virtualBalances.get(personalId) ?? 10000 })
})

app.get('/api/etf-orders', (req, res) => {
  const personalId = String(req.query.personalId || '')
  if (!validPersonalId(personalId)) return res.status(400).json({ error: '请先注册并绑定个人 ID' })
  const orders = [...etfOrders.values()].filter(item => item.personalId === personalId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  res.json({ personalId, balance: etfBalances.get(personalId) ?? 25000, orders: orders.slice(0, 30) })
})

app.post('/api/etf-orders', async (req, res) => {
  if (!frontendConfig.showEquityContracts) return res.status(403).json({ error: '后台已关闭合约 ETF 模块' })
  if (!frontendConfig.demoOrdersEnabled) return res.status(403).json({ error: '后台已暂停模拟下单' })
  const { personalId, symbol, side, orderType = 'market' } = req.body || {}
  const quantity = Number(req.body?.quantity)
  const leverage = Number(req.body?.leverage ?? 1)
  if (!validPersonalId(personalId)) return res.status(400).json({ error: '请先注册并绑定个人 ID' })
  if (typeof symbol !== 'string' || typeof side !== 'string' || !['buy', 'sell'].includes(side) ||
      !['market', 'limit'].includes(orderType) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000 || !Number.isInteger(leverage) || leverage < 1 || leverage > frontendConfig.maxEtfLeverage) {
    return res.status(400).json({ error: '模拟订单代码、方向、类型或股数无效' })
  }
  const asset = frontendConfig.marketAssets.find(item => item.symbol === symbol)
  if (!asset) return res.status(404).json({ error: '未找到该模拟标的' })
  if (process.env.MASSIVE_API_KEY?.trim()) await syncMarketQuotes()
  const executionPrice = marketQuotesCache.payload?.quotes?.[symbol]?.last ?? asset.last
  const amount = rounded(quantity * executionPrice)
  const balance = etfBalances.get(personalId) ?? 25000
  if (balance < amount) return res.status(400).json({ error: '虚拟美元余额不足' })
  etfBalances.set(personalId, rounded(balance - amount))
  const item = {
    id: randomUUID(), personalId, symbol: asset.symbol, name: asset.name, side, orderType, quantity,
    price: executionPrice, amount, leverage, exposureAmount: rounded(amount * leverage), payoutPercent: frontendConfig.contractPayoutPercent,
    status: 'pending', result: null, payout: null, profit: null,
    createdAt: new Date().toISOString(), settledAt: null,
  }
  etfOrders.set(item.id, item)
  const forcedResult = getOutcomePolicy('etfOrders', personalId)
  if (forcedResult) settleEtfOrder(item, forcedResult)
  res.status(201).json({ order: item, balance: etfBalances.get(personalId) ?? 25000 })
})

app.post('/api/time-contracts', async (req, res) => {
  if (!frontendConfig.showTimeContracts) return res.status(403).json({ error: '后台已关闭时间合约模块' })
  const { personalId, projectId, direction, durationSeconds, stake } = req.body || {}
  if (!validPersonalId(personalId)) return res.status(400).json({ error: '请先注册并绑定个人 ID' })
  let project = projects.get(projectId) || syncedTimeContractProjects.get(projectId)
  if (!project && typeof projectId === 'string' && projectId.startsWith('TIME-X-')) {
    try { await syncTimeContractProjects(true) } catch {}
    project = syncedTimeContractProjects.get(projectId)
  }
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
    status: 'pending', result: null, forcedResult: getOutcomePolicy('contracts', personalId), payoutPercent: timePayoutPercent(direction, projectId), entryPrice: project.sourceExchange ? project.lastPrice : project.curve[0], targetPrice: project.sourceExchange ? project.lastPrice : project.curve.at(-1), exitPrice: null, payout: null, profit: null,
    createdAt: new Date().toISOString(), settledAt: null,
  }
  predictions.set(item.id, item)
  const settlementTimer = setTimeout(async () => {
    contractSettlementTimers.delete(item.id)
    if (item.status !== 'pending') return
    if (project.sourceExchange && !item.forcedResult) {
      try {
        await syncTimeContractProjects(true)
        item.targetPrice = syncedTimeContractProjects.get(projectId)?.lastPrice ?? item.entryPrice
      } catch { item.targetPrice = item.entryPrice }
    }
    const exitPrice = item.targetPrice
    const delta = exitPrice - item.entryPrice
    const result = item.forcedResult || (Math.abs(delta) < item.entryPrice * 0.0001 ? 'draw' : ((delta > 0) === (item.direction === 'up') ? 'won' : 'lost'))
    if (result === 'draw') {
      const previousPayout = item.payout || 0
      item.status = result
      item.result = result
      item.exitPrice = exitPrice
      item.payout = item.stake
      item.profit = 0
      item.settledAt = new Date().toISOString()
      virtualBalances.set(item.personalId, rounded((virtualBalances.get(item.personalId) ?? 10000) + item.stake - previousPayout))
    } else {
      settleContract(item, result)
    }
  }, duration * 1000)
  contractSettlementTimers.set(item.id, settlementTimer)
  while (predictions.size > 1000) {
    const oldestId = predictions.keys().next().value
    const oldestTimer = contractSettlementTimers.get(oldestId)
    if (oldestTimer) clearTimeout(oldestTimer)
    contractSettlementTimers.delete(oldestId)
    predictions.delete(oldestId)
  }
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
  const balances = Object.fromEntries(depositCurrencies.map(currency => [currency, walletBalances.get(walletBalanceKey(personalId, currency)) || 0]))
  res.json({ personalId, balance: balances.USDT, balances, transactions: transactions.map(safeTransaction) })
})

app.post('/api/wallet/deposits', (req, res) => {
  if (!frontendConfig.showDeposit) return res.status(403).json({ error: '后台已关闭演示充值' })
  if (!verifyWalletRequest(req, res)) return
  const { personalId, amount, network } = req.body
  const currency = req.body.currency || 'USDT'
  const value = Number(amount)
  const currencyConfig = frontendConfig.depositAssets[currency]
  if (!currencyConfig || !Number.isFinite(value) || value < currencyConfig.minimumAmount || value > 100000 || !currencyConfig.networks.some(item => item.network === network)) {
    return res.status(400).json({ error: '充值币种、金额或网络无效，请检查后台演示配置' })
  }
  const item = { id: randomUUID(), personalId, type: 'deposit', currency, amount: rounded(value), fee: 0, network, address: '', status: 'completed', reason: '', createdAt: new Date().toISOString(), reviewedAt: new Date().toISOString() }
  const balanceKey = walletBalanceKey(personalId, currency)
  walletBalances.set(balanceKey, rounded((walletBalances.get(balanceKey) || 0) + item.amount))
  walletTransactions.set(item.id, item)
  res.status(201).json({ transaction: safeTransaction(item), balance: walletBalances.get(balanceKey), currency })
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
  const balanceKey = walletBalanceKey(personalId)
  const balance = walletBalances.get(balanceKey) || 0
  if (balance < total) return res.status(400).json({ error: 'USDT 可用余额不足（提现金额另计演示手续费）' })
  const item = { id: randomUUID(), personalId, type: 'withdrawal', currency: 'USDT', amount: rounded(value), fee, network, address: address.trim(), status: 'pending', reason: '', createdAt: new Date().toISOString(), reviewedAt: null }
  walletBalances.set(balanceKey, rounded(balance - total))
  walletTransactions.set(item.id, item)
  res.status(201).json({ transaction: safeTransaction(item), balance: walletBalances.get(balanceKey) })
})

app.get('/api/admin/kyc-submissions', requirePermission('kyc'), (req, res) => {
  const status = req.query.status
  const items = [...submissions.values()].filter(row => !status || row.status === status).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  res.json({ submissions: items.map(safeSubmission) })
})

app.get('/api/admin/wallet-transactions', requirePermission('wallet'), (_req, res) => {
  const transactions = [...walletTransactions.values()].filter(item => item.currency === 'USDT' || item.type === 'withdrawal').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  res.json({ transactions: transactions.map(safeTransaction) })
})

app.patch('/api/admin/wallet-transactions/:id', requirePermission('wallet'), (req, res) => {
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
    const balanceKey = walletBalanceKey(item.personalId, item.currency || 'USDT')
    walletBalances.set(balanceKey, rounded((walletBalances.get(balanceKey) || 0) + item.amount + item.fee))
  }
  res.json({ transaction: safeTransaction(item), balance: walletBalances.get(item.personalId) || 0 })
})

app.patch('/api/admin/kyc-submissions/:id', requirePermission('kyc'), (req, res) => {
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
