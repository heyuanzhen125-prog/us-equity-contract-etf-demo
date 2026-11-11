import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, ArrowDownLeft, ArrowUpRight, Bell, BookOpen, CandlestickChart, ChevronDown, CircleHelp, Clock3, Command, Compass, CreditCard, Eye, Menu, MoreHorizontal, Search, Settings2, ShieldCheck, Star, Wallet, X, TriangleAlert, Coins, Fingerprint, BadgeCheck, Copy, UserRound, LogIn } from 'lucide-react'
import SecondsContractPanel from './SecondsContractPanel'
import PredictionMarketPanel from './PredictionMarketPanel'
import { useVisiblePolling } from './useVisiblePolling'
import { ADMIN_LINK_HREF, FRONTEND_SITE_URL } from './siteRouting'
import './etf-orders.css'

type Asset = { symbol: string; name: string; last: number; change: number; volume: string; type: string; color: string; spark: number[]; quoteSource?: string }
type MarketDataMeta = { provider: string; configured: boolean; connected: boolean; message: string; updatedAt: string | null }
type DemoProject = { id: string; symbol: string; name: string; startPrice: number; lastPrice: number; targetChangePct: number; curve: number[]; simulated: true; sourceExchange?: string; sourceUrl?: string; sourceExpiry?: string; sourceTicker?: string }
type EtfOrder = { id: string; symbol: string; name: string; side: 'buy' | 'sell'; quantity: number; price: number; amount: number; leverage?: number; exposureAmount?: number; status: 'pending' | 'won' | 'lost'; result: 'won' | 'lost' | null; payout: number | null; profit: number | null; createdAt: string }
type WalletTransaction = { id: string; personalId: string; type: 'deposit' | 'withdrawal'; amount: number; fee: number; network: string; addressMasked: string; status: 'completed' | 'pending' | 'rejected'; reason: string; createdAt: string; reviewedAt: string | null }
type TimeContractBill = { id: string; projectSymbol: string; direction: 'up' | 'down'; durationSeconds: number; stake: number; payoutPercent: number; status: 'pending' | 'won' | 'lost' | 'draw'; profit: number | null; createdAt: string; settledAt: string | null }
type ForecastBill = { id: string; eventId: string; choice: 'YES' | 'NO'; probability: number; stake: number; rewardPercent: number; status: 'pending' | 'won' | 'lost'; profit: number | null; updatedAt: string; settledAt: string | null }
type LedgerCategory = 'all' | 'deposit' | 'withdrawal' | 'etf' | 'time' | 'forecast'
type LedgerBill = { id: string; category: Exclude<LedgerCategory, 'all'>; title: string; description: string; amount: number; currency: 'USDT' | 'USD' | 'PTS'; status: string; createdAt: string; profit?: number | null }
const assets: Asset[] = [
  { symbol: 'NVDA', name: '英伟达', last: 142.87, change: 2.46, volume: '3.42B', type: '2× 多头', color: '#84d6b2', spark: [13, 17, 15, 22, 20, 26, 23, 30, 27, 35, 31, 40, 38, 47] },
  { symbol: 'TSLA', name: '特斯拉', last: 338.11, change: -1.28, volume: '2.18B', type: '2× 多头', color: '#fc8082', spark: [44, 39, 42, 35, 38, 31, 34, 28, 32, 24, 27, 21, 25, 20] },
  { symbol: 'SPY', name: '标普 500 ETF', last: 681.42, change: 0.74, volume: '1.76B', type: '指数', color: '#84d6b2', spark: [17, 18, 15, 22, 20, 24, 21, 27, 23, 30, 28, 34, 32, 39] },
  { symbol: 'AAPL', name: '苹果', last: 258.34, change: 0.32, volume: '1.24B', type: '2× 多头', color: '#84d6b2', spark: [18, 16, 21, 20, 23, 19, 25, 24, 29, 26, 31, 30, 35, 37] },
  { symbol: 'MSTR', name: 'Strategy', last: 406.53, change: -3.12, volume: '928M', type: '2× 多头', color: '#fc8082', spark: [46, 42, 47, 36, 41, 31, 36, 28, 33, 23, 28, 19, 23, 15] },
  { symbol: 'QQQ', name: '纳斯达克 100 ETF', last: 100, change: 0, volume: '—', type: '指数 ETF', color: '#84d6b2', spark: [25, 25, 25, 25, 25, 25, 25, 25] },
  { symbol: 'IWM', name: '罗素 2000 ETF', last: 100, change: 0, volume: '—', type: '指数 ETF', color: '#84d6b2', spark: [25, 25, 25, 25, 25, 25, 25, 25] },
  { symbol: 'DIA', name: '道琼斯 ETF', last: 100, change: 0, volume: '—', type: '指数 ETF', color: '#84d6b2', spark: [25, 25, 25, 25, 25, 25, 25, 25] },
  { symbol: 'TQQQ', name: '纳指 3× 做多 ETF', last: 100, change: 0, volume: '—', type: '3× 多头 ETF', color: '#84d6b2', spark: [25, 25, 25, 25, 25, 25, 25, 25] },
  { symbol: 'SQQQ', name: '纳指 3× 做空 ETF', last: 100, change: 0, volume: '—', type: '3× 空头 ETF', color: '#fc8082', spark: [25, 25, 25, 25, 25, 25, 25, 25] },
  { symbol: 'SOXL', name: '半导体 3× 做多 ETF', last: 100, change: 0, volume: '—', type: '3× 多头 ETF', color: '#84d6a4', spark: [25, 25, 25, 25, 25, 25, 25, 25] },
  { symbol: 'SOXS', name: '半导体 3× 做空 ETF', last: 100, change: 0, volume: '—', type: '3× 空头 ETF', color: '#fc8082', spark: [25, 25, 25, 25, 25, 25, 25, 25] },
  { symbol: 'NVDL', name: 'NVDA 2× 做多 ETF', last: 100, change: 0, volume: '—', type: '2× 多头 ETF', color: '#84d6b2', spark: [25, 25, 25, 25, 25, 25, 25, 25] },
  { symbol: 'TSLL', name: 'TSLA 2× 做多 ETF', last: 100, change: 0, volume: '—', type: '2× 多头 ETF', color: '#84d6b2', spark: [25, 25, 25, 25, 25, 25, 25, 25] },
]
const tabs = ['全部', '热门', '科技', '指数', '行业 ETF', '加密概念']
const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const createPersonalId = () => `NST-${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected'
type WorkspaceView = 'market' | 'equity-contract' | 'time-contract' | 'prediction' | 'account'
type MarketIndex = { s: string; v: string; c: string; down?: boolean }
type ForecastEvent = { id: string; category: string; question: string; description: string; consensus: number; horizon: string; volume: string; rewardPercent: number }
const defaultUiText = {
  workspaceTitle: '工作区', navMarket: '市场概览', navEquity: '合约 ETF', navTime: '时间合约', navPrediction: '预测系统',
  navWatchlist: '自选列表', navPositions: '持仓与订单', navKyc: '身份认证', marketNavTitle: '市场',
  navNews: '市场资讯', navCalendar: '经济日历', riskTitle: '风险先行', riskText: '了解杠杆产品风险，理性管理仓位。',
  riskAction: '查看风险说明', navHelp: '帮助中心', navSettings: '设置', tradingStatus: '美股盘中',
  registerAction: '注册账户', depositAction: '充值 USDT / USDC', withdrawalAction: '提现 USDT', netWorthAction: '账户净值',
  temperatureTitle: '市场温度', featuredAction: '进入合约市场', popularContracts: '热门合约', quickOrder: '快速下单',
  buyAction: '买入', sellAction: '卖出', riskDisclosure: '风险披露',
}
type UiText = typeof defaultUiText
type FrontConfig = { uiText: UiText; marketAssets: Asset[]; marketIndices: MarketIndex[]; siteName: string; marketSubtitle: string; marketDelayMinutes: number; homeTitle: string; equityContractTitle: string; equityContractSubtitle: string; timeContractTitle: string; timeContractSubtitle: string; predictionTitle: string; predictionSubtitle: string; indexTitle: string; indexSubtitle: string; featuredTitle: string; featuredSubtitle: string; demoProjectTitle: string; demoProjectSubtitle: string; orderDisclaimer: string; showMarketOverview: boolean; showEquityContracts: boolean; showTimeContracts: boolean; showPrediction: boolean; showDeposit: boolean; showWithdrawal: boolean; showKyc: boolean; demoOrdersEnabled: boolean; showMarketPicks: boolean; showDemoProjects: boolean; showQuickOrder: boolean; showWatchlistNav: boolean; showPositionsNav: boolean; showNewsNav: boolean; showCalendarNav: boolean; showHelpNav: boolean; showSettingsNav: boolean; depositNetworks: string[]; minimumWithdrawal: number; withdrawalFee: number; maxEtfLeverage: number; contractDurations: number[]; contractPayoutPercent: number; autoPayoutEnabled: boolean; payoutMinPercent: number; payoutMaxPercent: number; payoutSensitivity: number }
const defaultFrontConfig: FrontConfig = { uiText: defaultUiText, marketAssets: assets, marketIndices: [{s:'S&P 500',v:'6,812.34',c:'+0.74%'},{s:'纳斯达克',v:'23,104.61',c:'+1.12%'},{s:'道琼斯',v:'47,862.19',c:'+0.28%'},{s:'VIX',v:'18.42',c:'−2.16%',down:true}], siteName: 'Northstar Markets', marketSubtitle: '查看指数概况与后台发布的模拟项目。', homeTitle: '市场概览', equityContractTitle: '合约 ETF', equityContractSubtitle: '浏览美股与杠杆 ETF 模拟行情，并使用虚拟账户体验下单。', timeContractTitle: '时间合约', timeContractSubtitle: '参考交易所短周期合约概率；使用虚拟 PTS 体验独立的 10 / 30 / 60 秒时间合约。', predictionTitle: '预测系统', predictionSubtitle: '围绕事件问题记录概率判断，查看个人预测，不与时间合约共用订单。', indexTitle: '美股主要指数', indexSubtitle: '延时行情 · 仅供展示', featuredTitle: '市场精选', featuredSubtitle: '查看热门标的与当日表现', demoProjectTitle: '模拟项目', demoProjectSubtitle: '由后台发布的虚拟标的 · SIM 前缀 · 非实盘行情', orderDisclaimer: '杠杆 ETF 可能放大损失 · 本平台为原型演示', marketDelayMinutes: 15, showMarketOverview: true, showEquityContracts: true, showTimeContracts: true, showPrediction: true, showDeposit: true, showWithdrawal: true, showKyc: true, demoOrdersEnabled: true, showMarketPicks: true, showDemoProjects: true, showQuickOrder: true, showWatchlistNav: true, showPositionsNav: true, showNewsNav: true, showCalendarNav: true, showHelpNav: true, showSettingsNav: true, depositNetworks: ['TRC20', 'ERC20', 'Polygon'], minimumWithdrawal: 10, withdrawalFee: 0.5, maxEtfLeverage: 100, contractDurations: [10, 30, 60], contractPayoutPercent: 80, autoPayoutEnabled: false, payoutMinPercent: 50, payoutMaxPercent: 120, payoutSensitivity: 30 }

function Spark({ points, color, large = false }: { points: number[]; color: string; large?: boolean }) {
  const coords = points.map((n, i) => `${(i / (points.length - 1)) * 800},${large ? 160 - n * 2.8 : 50 - n}`).join(' ')
  return <svg className={large ? 'chart-svg large-chart' : 'spark'} viewBox={large ? '0 0 800 180' : '0 0 100 50'} preserveAspectRatio="none"><polyline points={coords} fill="none" stroke={color} strokeWidth={large ? 2.5 : 2} vectorEffect="non-scaling-stroke" />{large && <><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".19"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs><polygon points={`0,180 ${coords} 800,180`} fill="url(#area)"/></>}</svg>
}

function KycModal({ personalId, email, status, reason, onClose, onSubmit }: { personalId: string; email: string; status: KycStatus; reason: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="kyc-modal" role="dialog" aria-modal="true" aria-labelledby="kyc-title"><div className="kyc-head"><div className="kyc-icon"><Fingerprint size={20}/></div><div><h2 id="kyc-title">身份认证 · KYC</h2><p>个人信息验证</p></div><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={18}/></button></div><div className="kyc-bound-account"><span>绑定账户 · 个人 ID</span><b>{personalId || '请先注册账户'}</b><small>{email || '认证申请将绑定到该账户'}</small></div>{status==='pending'&&<div className="kyc-result"><div className="result-icon pending-result"><Clock3 size={23}/></div><h3>后台审核中</h3><p>申请已进入运营后台审核队列。审核结果会同步到前台账户。</p><div className="queue-badge">已提交至 KYC 审核队列</div></div>}{status==='verified'&&<div className="kyc-result"><div className="result-icon verified-result"><BadgeCheck size={23}/></div><h3>后台审核已通过</h3><p>该状态由当前本地后台返回，不代表真实身份核验或监管认证。</p></div>}{(status==='unverified'||status==='rejected')&&<form className="kyc-form" onSubmit={onSubmit}>{status==='rejected'&&<div className="kyc-rejection"><b>申请被驳回</b><span>{reason || '请检查资料后重新提交。'}</span></div>}<div className="kyc-step-title"><span>01</span><b>身份资料</b><small>请按证件信息填写</small></div><div className="kyc-fields"><label>法定姓名<input name="legalName" autoComplete="name" placeholder="与身份证件一致" required/></label><label>国家 / 地区<select name="country" defaultValue="" required><option value="" disabled>请选择</option><option value="US">美国</option><option value="CN">中国</option><option value="VN">越南</option><option value="OTHER">其他</option></select></label><label>出生日期<input name="birthDate" type="date" autoComplete="bday" required/></label><label>证件类型<select name="documentType" defaultValue="passport" required><option value="passport">护照</option><option value="national-id">身份证</option><option value="license">驾驶证</option></select></label><label className="kyc-wide">证件号码<input name="documentNumber" autoComplete="off" placeholder="请输入证件号码" required/></label><label className="kyc-wide">证件正面（图片或 PDF）<input className="kyc-file" name="frontDocument" type="file" accept="image/*,.pdf" required/></label><label className="kyc-wide">证件反面（图片或 PDF）<input className="kyc-file" name="backDocument" type="file" accept="image/*,.pdf" required/></label></div><div className="kyc-local-warning"><TriangleAlert size={16}/><span><b>本地后台仅接收虚构演示资料和文件名，不接收证件文件。</b>请勿填写真实个人信息或选择真实证件；正式 KYC 需配置受保护的文件存储与身份核验服务。</span></div><button className="kyc-submit" type="submit">提交至后台审核</button></form>}<div className="kyc-footer"><ShieldCheck size={13}/> KYC 实际字段、流程和保留期限需按运营地区与服务商配置</div></section></div>
}

export default function App() {
  const [selected, setSelected] = useState(defaultFrontConfig.marketAssets[0])
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('market')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [frontConfig, setFrontConfig] = useState<FrontConfig>(defaultFrontConfig)
  const [marketDataMeta, setMarketDataMeta] = useState<MarketDataMeta>({ provider: 'SIM', configured: false, connected: false, message: '当前为演示行情', updatedAt: null })
  const [forecastEvents, setForecastEvents] = useState<ForecastEvent[]>([])
  const [activeTab, setActiveTab] = useState('全部')
  const [period, setPeriod] = useState('1日')
  const [search, setSearch] = useState('')
  const [side, setSide] = useState<'买入' | '卖出'>('买入')
  const [qty, setQty] = useState('10')
  const [etfLeverage, setEtfLeverage] = useState(1)
  const [price, setPrice] = useState('市价')
  const [toast, setToast] = useState('')
  const [watch, setWatch] = useState<string[]>(['NVDA', 'SPY'])
  const [depositOpen, setDepositOpen] = useState(false)
  const [walletTab, setWalletTab] = useState<'deposit' | 'withdrawal'>('deposit')
  const [depositNetwork, setDepositNetwork] = useState('TRC20')
  const [depositAmount, setDepositAmount] = useState('100')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([])
  const [walletBusy, setWalletBusy] = useState(false)
  const [timeContractBills, setTimeContractBills] = useState<TimeContractBill[]>([])
  const [forecastBills, setForecastBills] = useState<ForecastBill[]>([])
  const [ledgerCategory, setLedgerCategory] = useState<LedgerCategory>('all')
  const [ledgerBusy, setLedgerBusy] = useState(false)
  const [etfBalance, setEtfBalance] = useState(25000)
  const [etfOrders, setEtfOrders] = useState<EtfOrder[]>([])
  const [etfOrderBusy, setEtfOrderBusy] = useState(false)
  const [demoProjects, setDemoProjects] = useState<DemoProject[]>([])
  const [authOpen, setAuthOpen] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState(() => localStorage.getItem('northstar.demo.registeredEmail') || '')
  const [referralCode, setReferralCode] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('ref')
    return (fromUrl || localStorage.getItem('northstar.demo.pendingReferral') || '').trim().toUpperCase()
  })
  useEffect(() => {
    if (referralCode) localStorage.setItem('northstar.demo.pendingReferral', referralCode)
    else localStorage.removeItem('northstar.demo.pendingReferral')
  }, [referralCode])
  const [personalId, setPersonalId] = useState(() => {
    const savedId = localStorage.getItem('northstar.demo.personalId')
    if (savedId) return savedId
    if (!localStorage.getItem('northstar.demo.registeredEmail')) return ''
    const migratedId = createPersonalId()
    localStorage.setItem('northstar.demo.personalId', migratedId)
    return migratedId
  })
  const [inviteCount, setInviteCount] = useState(0)
  const personalInviteLink = useMemo(() => {
    if (!personalId) return ''
    const url = new URL('/', FRONTEND_SITE_URL || window.location.origin)
    url.searchParams.set('ref', personalId)
    return url.toString()
  }, [personalId])
  useEffect(() => {
    if (!personalId) { setInviteCount(0); return }
    const controller = new AbortController()
    fetch(`/api/referrals/${encodeURIComponent(personalId)}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(result => { if (result && Number.isFinite(result.inviteCount)) setInviteCount(result.inviteCount) })
      .catch(() => {})
    return () => controller.abort()
  }, [personalId])
  const [authForDeposit, setAuthForDeposit] = useState(false)
  const [kycStatus, setKycStatus] = useState<KycStatus>('unverified')
  const [kycReason, setKycReason] = useState('')
  const [kycOpen, setKycOpen] = useState(false)
  const [kycForDeposit, setKycForDeposit] = useState(false)
  const [authPassword, setAuthPassword] = useState('')
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('')
  const [showAuthPassword, setShowAuthPassword] = useState(false)
  const [acceptDemoTerms, setAcceptDemoTerms] = useState(false)
  async function refreshWallet() {
    if (!personalId) return
    try {
      const response = await fetch(`/api/wallet?personalId=${encodeURIComponent(personalId)}`)
      if (!response.ok) return
      const result = await response.json()
      setWalletBalance(result.balance || 0)
      setWalletTransactions(result.transactions || [])
    } catch { /* the local API may still be starting */ }
  }
  async function refreshLedger() {
    if (!personalId) return
    setLedgerBusy(true)
    const read = async (path: string) => {
      const response = await fetch(`${path}${path.includes('?') ? '&' : '?'}personalId=${encodeURIComponent(personalId)}`)
      return response.ok ? response.json() : null
    }
    try {
      const [wallet, etf, time, forecast] = await Promise.all([
        read('/api/wallet'), read('/api/etf-orders'), read('/api/time-contracts'), read('/api/forecasts'),
      ])
      if (wallet) { setWalletBalance(wallet.balance || 0); setWalletTransactions(wallet.transactions || []) }
      if (etf) { setEtfOrders(etf.orders || []); setEtfBalance(etf.balance ?? 25000) }
      if (time) setTimeContractBills(time.contracts || [])
      if (forecast) setForecastBills(forecast.forecasts || [])
    } catch { notify('账单记录暂时无法刷新，请稍后重试') }
    finally { setLedgerBusy(false) }
  }
  useEffect(() => {
    if (workspaceView === 'account' && personalId) void refreshLedger()
  }, [workspaceView, personalId])
  useVisiblePolling(async signal => {
    if (!personalId) return
    try {
      const response = await fetch(`/api/kyc-status?personalId=${encodeURIComponent(personalId)}`, { signal })
      if (!response.ok) return
      const result = await response.json()
      const status: KycStatus = result.status === 'approved' ? 'verified' : result.status === 'rejected' ? 'rejected' : result.status === 'pending' ? 'pending' : 'unverified'
      setKycStatus(status)
      setKycReason(result.reason || '')
    } catch (error) {
      if (!signal.aborted) console.error('Unable to refresh KYC status', error)
    }
  }, 5000, Boolean(personalId), [personalId])
  useEffect(() => {
    if (personalId && kycStatus === 'verified') void refreshWallet()
  }, [personalId, kycStatus])
  useEffect(() => {
    if (!personalId) { setEtfOrders([]); setEtfBalance(25000) }
  }, [personalId])
  useVisiblePolling(async signal => {
    if (!personalId) return
    try {
      const response = await fetch(`/api/etf-orders?personalId=${encodeURIComponent(personalId)}`, { signal })
      if (!response.ok) return
      const result = await response.json()
      setEtfOrders(result.orders || [])
      setEtfBalance(result.balance ?? 25000)
    } catch (error) {
      if (!signal.aborted) console.error('Unable to refresh ETF orders', error)
    }
  }, 2000, Boolean(personalId), [personalId])
  useVisiblePolling(async signal => {
    try {
      const response = await fetch('/api/projects', { signal })
      if (!response.ok) return
      const result = await response.json()
      setDemoProjects(result.projects || [])
    } catch (error) {
      if (!signal.aborted) console.error('Unable to refresh projects', error)
    }
  }, 1000)
  useEffect(() => { if (frontConfig.depositNetworks.length && !frontConfig.depositNetworks.includes(depositNetwork)) setDepositNetwork(frontConfig.depositNetworks[0]) }, [frontConfig.depositNetworks, depositNetwork])
  useEffect(() => { if (walletTab==='deposit' && !frontConfig.showDeposit && frontConfig.showWithdrawal) setWalletTab('withdrawal'); else if (walletTab==='withdrawal' && !frontConfig.showWithdrawal && frontConfig.showDeposit) setWalletTab('deposit') }, [walletTab, frontConfig.showDeposit, frontConfig.showWithdrawal])
  useEffect(() => {
    if (!depositOpen || walletTab !== 'deposit') return
    setDepositOpen(false)
    window.dispatchEvent(new Event('northstar:deposit-open'))
  }, [depositOpen, walletTab])
  useVisiblePolling(async signal => {
    try {
      const response = await fetch('/api/public-config', { signal })
      if (!response.ok) return
      const result = await response.json()
      if (result.config) setFrontConfig({ ...defaultFrontConfig, ...result.config })
      if (result.marketData) setMarketDataMeta(result.marketData)
      if (Array.isArray(result.forecastEvents)) setForecastEvents(result.forecastEvents)
    } catch (error) {
      if (!signal.aborted) console.error('Unable to refresh public configuration', error)
    }
  }, 5000)
  useEffect(() => { document.title = `${frontConfig.siteName} · 模拟原型` }, [frontConfig.siteName])
  useEffect(() => {
    if (workspaceView === 'equity-contract' && !frontConfig.showEquityContracts) setWorkspaceView('market')
    else if (workspaceView === 'time-contract' && !frontConfig.showTimeContracts) setWorkspaceView('market')
    else if (workspaceView === 'prediction' && !frontConfig.showPrediction) setWorkspaceView('market')
    else if (workspaceView === 'market' && !frontConfig.showMarketOverview) setWorkspaceView(frontConfig.showEquityContracts ? 'equity-contract' : frontConfig.showTimeContracts ? 'time-contract' : frontConfig.showPrediction ? 'prediction' : 'market')
  }, [workspaceView, frontConfig.showMarketOverview, frontConfig.showEquityContracts, frontConfig.showTimeContracts, frontConfig.showPrediction])
  useEffect(() => {
    const current = frontConfig.marketAssets.find(asset => asset.symbol === selected.symbol)
    if (current && current !== selected) setSelected(current)
    else if (!current && frontConfig.marketAssets[0]) setSelected(frontConfig.marketAssets[0])
  }, [frontConfig.marketAssets, selected])
  useEffect(() => {
    if (kycStatus !== 'verified' || !kycForDeposit) return
    setKycForDeposit(false)
    setKycOpen(false)
    window.dispatchEvent(new Event('northstar:deposit-open'))
    notify(`后台审核已通过，个人 ID ${personalId} 可进行模拟充值`)
  }, [kycStatus, kycForDeposit, personalId])
  const simulatedProjects = useMemo(() => demoProjects.filter(project => !project.sourceExchange), [demoProjects])
  const visible = useMemo(() => frontConfig.marketAssets.filter(a => {
    const matchesSearch = (`${a.symbol} ${a.name}`).toLowerCase().includes(search.toLowerCase())
    const matchesTab = activeTab === '全部' || (activeTab === '热门' && ['NVDA', 'TSLA', 'SPY', 'QQQ', 'TQQQ', 'SOXL', 'UPRO', 'QLD'].includes(a.symbol)) || (activeTab === '科技' && ['NVDA', 'TSLA', 'AAPL', 'QQQ', 'TQQQ', 'SQQQ', 'SOXL', 'SOXS', 'NVDL', 'TSLL', 'TECL', 'TECS'].includes(a.symbol)) || (activeTab === '指数' && ['SPY', 'QQQ', 'IWM', 'DIA', 'TQQQ', 'SQQQ', 'UPRO', 'SPXU', 'QLD', 'QID', 'TNA', 'TZA'].includes(a.symbol)) || (activeTab === '行业 ETF' && ['SOXL', 'SOXS', 'TECL', 'TECS', 'LABU', 'LABD', 'FAS', 'FAZ'].includes(a.symbol)) || (activeTab === '加密概念' && a.symbol === 'MSTR')
    return matchesSearch && matchesTab
  }), [search, activeTab, frontConfig.marketAssets])
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const submitOrder = async () => {
    if (!frontConfig.demoOrdersEnabled) { notify('后台已暂停模拟下单'); return }
    if (!personalId) { setAuthOpen(true); notify('请先注册账户并绑定个人 ID'); return }
    const quantity = Number(qty)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) { notify('模拟订单股数须为 1–10000'); return }
    setEtfOrderBusy(true)
    try {
      const response = await fetch('/api/etf-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalId, symbol: selected.symbol, side: side === '买入' ? 'buy' : 'sell', orderType: price === '限价' ? 'limit' : 'market', quantity, leverage: Math.min(etfLeverage, frontConfig.maxEtfLeverage) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '模拟订单提交失败')
      setEtfBalance(result.balance)
      setEtfOrders(items => [result.order, ...items.filter(item => item.id !== result.order.id)].slice(0, 30))
      notify(result.order.status === 'pending' ? `模拟${side}单已提交：${selected.symbol} × ${quantity} · ${result.order.leverage}×，等待后台结果` : `模拟订单已按后台规则结算：${result.order.status === 'won' ? '赢' : '输'}`)
    } catch (error) {
      notify(error instanceof Error ? error.message : '模拟订单服务暂不可用')
    } finally {
      setEtfOrderBusy(false)
    }
  }
  const simulateDeposit = async () => {
    if (!registeredEmail || !personalId) { notify('请先注册账户并绑定个人 ID'); return }
    if (kycStatus !== 'verified') { setDepositOpen(false); notify('请先完成 KYC 身份认证'); return }
    const amount = Number(depositAmount)
    if (!Number.isFinite(amount) || amount <= 0) { notify('请输入大于 0 的 USDT 金额'); return }
    setWalletBusy(true)
    try {
      const response = await fetch('/api/wallet/deposits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personalId, amount, network: depositNetwork }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '充值请求失败')
      setWalletBalance(result.balance)
      await refreshWallet()
      setDepositOpen(false)
      notify(`模拟充值到账 +${fmt(amount)} USDT`)
    } catch (error) { notify(error instanceof Error ? error.message : '充值服务暂不可用') }
    finally { setWalletBusy(false) }
  }
  const requestWithdrawal = async () => {
    if (!registeredEmail || !personalId) { notify('请先注册账户并绑定个人 ID'); return }
    if (kycStatus !== 'verified') { setDepositOpen(false); notify('请先完成 KYC 身份认证'); return }
    const amount = Number(depositAmount)
    if (!Number.isFinite(amount) || amount < frontConfig.minimumWithdrawal) { notify(`提现金额最低为 ${frontConfig.minimumWithdrawal} USDT`); return }
    if (withdrawAddress.trim().length < 12) { notify('请输入有效的演示收款地址'); return }
    setWalletBusy(true)
    try {
      const response = await fetch('/api/wallet/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personalId, amount, network: depositNetwork, address: withdrawAddress.trim() }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '提现申请失败')
      setWalletBalance(result.balance)
      await refreshWallet()
      setWithdrawAddress('')
      setDepositOpen(false)
      notify(`提现申请已提交后台审核：${fmt(amount)} USDT`)
    } catch (error) { notify(error instanceof Error ? error.message : '提现服务暂不可用') }
    finally { setWalletBusy(false) }
  }
  const openWallet = (tab: 'deposit' | 'withdrawal') => {
    if (!registeredEmail || !personalId) {
      setAuthForDeposit(true)
      setAuthOpen(true)
      notify('请先创建账户以绑定个人 ID')
      return
    }
    if (kycStatus !== 'verified') {
      setKycForDeposit(true)
      setKycOpen(true)
      notify(kycStatus === 'pending' ? 'KYC 演示审核尚未完成' : '请先完成身份认证并绑定个人 ID')
      return
    }
    if (tab === 'deposit') {
      window.dispatchEvent(new Event('northstar:deposit-open'))
      return
    }
    setWalletTab(tab)
    setDepositOpen(true)
    void refreshWallet()
  }
  const openDeposit = () => openWallet('deposit')
  const openWithdrawal = () => openWallet('withdrawal')
  const openKyc = () => {
    if (!registeredEmail || !personalId) {
      setAuthForDeposit(false)
      setAuthOpen(true)
      notify('请先注册账户并生成个人 ID')
      return
    }
    setKycOpen(true)
  }
  const submitKyc = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const front = data.get('frontDocument') as File | null
    const back = data.get('backDocument') as File | null
    try {
      const response = await fetch('/api/kyc-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalId, email: registeredEmail, legalName: data.get('legalName'), country: data.get('country'),
          birthDate: data.get('birthDate'), documentType: data.get('documentType'), documentNumber: data.get('documentNumber'),
          documents: { front: front ? { name: front.name } : null, back: back ? { name: back.name } : null },
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '后台提交失败')
      setKycStatus('pending')
      setKycReason('')
      notify('KYC 申请已提交至本地后台审核队列')
    } catch (error) {
      notify(error instanceof Error ? error.message : '后台服务暂不可用，请稍后再试')
    }
  }
  const registerAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = new FormData(event.currentTarget).get('email')?.toString().trim().toLowerCase() || ''
    if (authPassword !== authPasswordConfirm) { notify('两次输入的密码不一致'); return }
    if (!acceptDemoTerms) { notify('请先确认模拟账户使用说明'); return }
    const id = createPersonalId()
    if (referralCode) {
      try {
        const response = await fetch(referralCode.startsWith('NST-') ? '/api/referrals/register' : '/api/admin/agents/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, personalId: id, referralCode }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || '代理邀请登记失败')
      } catch (error) {
        notify(error instanceof Error ? error.message : '代理邀请服务暂不可用，请稍后重试')
        return
      }
    }
    localStorage.setItem('northstar.demo.registeredEmail', email)
    localStorage.setItem('northstar.demo.personalId', id)
    localStorage.removeItem('northstar.demo.pendingReferral')
    setRegisteredEmail(email)
    setPersonalId(id)
    const continueToDeposit = authForDeposit
    setAuthForDeposit(false)
    setAuthOpen(false)
    setAuthPassword('')
    setAuthPasswordConfirm('')
    setAcceptDemoTerms(false)
    if (continueToDeposit) { setKycForDeposit(true); setKycOpen(true) }
    notify(referralCode ? `账户已创建并记录邀请来源与个人 ID：${id}` : `账户已创建并绑定个人 ID：${id}`)
    if (referralCode) setReferralCode('')
  }
  const kycStatusLabel = kycStatus === 'verified' ? '已认证' : kycStatus === 'pending' ? '审核中' : kycStatus === 'rejected' ? '需补充' : '未认证'
  const ledgerItems = useMemo<LedgerBill[]>(() => [
    ...walletTransactions.map(row => ({ id: row.id, category: row.type, title: row.type === 'deposit' ? 'USDT 充值' : 'USDT 提现', description: `${row.network}${row.addressMasked ? ` · ${row.addressMasked}` : ''}${row.fee ? ` · 手续费 ${fmt(row.fee)} USDT` : ''}`, amount: row.type === 'deposit' ? row.amount : -row.amount, currency: 'USDT' as const, status: row.status === 'completed' ? '已完成' : row.status === 'pending' ? '审核中' : '已驳回', createdAt: row.createdAt })),
    ...etfOrders.map(row => ({ id: row.id, category: 'etf' as const, title: `${row.side === 'buy' ? '买入' : '卖出'} ${row.symbol}`, description: `${row.quantity} 股 · ${row.leverage || 1}× 杠杆 · 保证金 ${fmt(row.amount)} USD`, amount: -row.amount, currency: 'USD' as const, status: row.status === 'pending' ? '待结算' : row.status === 'won' ? '已结算 · 判赢' : '已结算 · 判输', createdAt: row.createdAt, profit: row.profit })),
    ...timeContractBills.map(row => ({ id: row.id, category: 'time' as const, title: `${row.projectSymbol} · ${row.direction === 'up' ? '概率上升' : '概率下降'}`, description: `${row.durationSeconds} 秒 · 投入 ${fmt(row.stake)} PTS`, amount: -row.stake, currency: 'PTS' as const, status: row.status === 'pending' ? '进行中' : row.status === 'won' ? '已结算 · 判赢' : row.status === 'draw' ? '已结算 · 平局退款' : '已结算 · 判输', createdAt: row.createdAt, profit: row.profit })),
    ...forecastBills.map(row => ({ id: row.id, category: 'forecast' as const, title: `事件预测 · ${row.choice}`, description: `${row.eventId} · 判断概率 ${row.probability}% · 投入 ${fmt(row.stake)} PTS`, amount: -row.stake, currency: 'PTS' as const, status: row.status === 'pending' ? '待结算' : row.status === 'won' ? '已结算 · 判赢' : '已结算 · 判输', createdAt: row.updatedAt, profit: row.profit })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [walletTransactions, etfOrders, timeContractBills, forecastBills])
  const visibleLedgerItems = ledgerCategory === 'all' ? ledgerItems : ledgerItems.filter(item => item.category === ledgerCategory)
  const chartRange = selected.last * 0.035
  const chartTop = selected.last + chartRange
  const chartStep = (chartRange * 2) / 3
  const chartLabels = [chartTop, chartTop - chartStep, chartTop - chartStep * 2, selected.last - chartRange]

  return <div className="app-shell">
    {mobileNavOpen&&<button className="mobile-nav-backdrop" aria-label="关闭导航菜单" onClick={()=>setMobileNavOpen(false)}/>}
    <aside className={`sidebar ${mobileNavOpen?'mobile-sidebar-open':''}`}>
      <div className="brand"><div className="brand-mark"><CandlestickChart size={19}/></div><span>{frontConfig.siteName}</span><span className="brand-dot">.</span></div>
      <div className="workspace"><div className="workspace-icon">N</div><div><b>{registeredEmail ? '个人账户' : '游客账户'}</b><small>{registeredEmail ? `ID ${personalId}` : '模拟交易账户'}</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">{frontConfig.uiText.workspaceTitle}</div>
      <nav onClick={()=>setMobileNavOpen(false)}>{frontConfig.showMarketOverview&&<button className={`nav-item ${workspaceView==='market'?'active':''}`} title={frontConfig.uiText.navMarket} onClick={()=>setWorkspaceView('market')}><Compass size={17}/> {frontConfig.uiText.navMarket}</button>}{frontConfig.showEquityContracts&&<button className={`nav-item ${workspaceView==='equity-contract'?'active':''}`} title={frontConfig.uiText.navEquity} onClick={()=>setWorkspaceView('equity-contract')}><CandlestickChart size={17}/> {frontConfig.uiText.navEquity} <span className="nav-tag">Beta</span></button>}{frontConfig.showTimeContracts&&<button className={`nav-item ${workspaceView==='time-contract'?'active':''}`} title={frontConfig.uiText.navTime} onClick={()=>setWorkspaceView('time-contract')}><Clock3 size={17}/> {frontConfig.uiText.navTime}</button>}{frontConfig.showPrediction&&<button className={`nav-item ${workspaceView==='prediction'?'active':''}`} title={frontConfig.uiText.navPrediction} onClick={()=>setWorkspaceView('prediction')}><Activity size={17}/> {frontConfig.uiText.navPrediction}</button>}<button className={`nav-item ${workspaceView==='account'?'active':''}`} title="我的" onClick={()=>setWorkspaceView('account')}><UserRound size={17}/> 我的</button>{frontConfig.showWatchlistNav&&<button className="nav-item" title={frontConfig.uiText.navWatchlist}><Star size={17}/> {frontConfig.uiText.navWatchlist}</button>}{frontConfig.showPositionsNav&&<button className="nav-item" title={frontConfig.uiText.navPositions}><Activity size={17}/> {frontConfig.uiText.navPositions}</button>}{frontConfig.showKyc&&<button className="nav-item" title={frontConfig.uiText.navKyc} onClick={openKyc}><Fingerprint size={17}/> {frontConfig.uiText.navKyc} <span className={`nav-tag ${kycStatus==='verified'?'kyc-ok':''}`}>{kycStatusLabel}</span></button>}</nav>
      {(frontConfig.showNewsNav||frontConfig.showCalendarNav)&&<><div className="nav-label market-label">{frontConfig.uiText.marketNavTitle}</div><nav onClick={()=>setMobileNavOpen(false)}>{frontConfig.showNewsNav&&<button className="nav-item" title={frontConfig.uiText.navNews}><BookOpen size={17}/> {frontConfig.uiText.navNews}</button>}{frontConfig.showCalendarNav&&<button className="nav-item" title={frontConfig.uiText.navCalendar}><Clock3 size={17}/> {frontConfig.uiText.navCalendar}</button>}</nav></>}
      <div className="sidebar-bottom"><div className="promo"><div className="promo-icon"><ShieldCheck size={17}/></div><b>{frontConfig.uiText.riskTitle}</b><p>{frontConfig.uiText.riskText}</p><button onClick={() => notify(frontConfig.orderDisclaimer)}>{frontConfig.uiText.riskAction} <ArrowUpRight size={13}/></button></div>{frontConfig.showHelpNav&&<button className="nav-item" title={frontConfig.uiText.navHelp}><CircleHelp size={17}/> {frontConfig.uiText.navHelp}</button>}{frontConfig.showSettingsNav&&<button className="nav-item" title={frontConfig.uiText.navSettings}><Settings2 size={17}/> {frontConfig.uiText.navSettings}</button>}<button className="profile" onClick={() => registeredEmail ? setWorkspaceView('account') : setAuthOpen(true)}><div className="avatar">{registeredEmail ? registeredEmail[0].toUpperCase() : '访'}</div><div><b>{registeredEmail || '访客账户'}</b><small>{registeredEmail ? `个人 ID ${personalId}` : '点击创建账户'}</small></div><MoreHorizontal size={18}/></button></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="mobile-menu" aria-label="打开导航菜单" onClick={()=>setMobileNavOpen(true)}><Menu size={19}/></button><div className="breadcrumbs">{frontConfig.siteName} <span>/</span> {workspaceView==='market'?frontConfig.homeTitle:workspaceView==='equity-contract'?frontConfig.equityContractTitle:workspaceView==='time-contract'?frontConfig.timeContractTitle:workspaceView==='prediction'?frontConfig.predictionTitle:'我的'}</div><div className="top-actions"><div className="market-status"><i/> {frontConfig.uiText.tradingStatus} <span>·</span> 交易时段</div><button className="icon-button" aria-label="通知" onClick={() => notify('当前没有新通知')}><Bell size={17}/><i/></button><button className={registeredEmail?'register-trigger registered-trigger':'register-trigger'} onClick={() => registeredEmail ? setWorkspaceView('account') : setAuthOpen(true)}>{registeredEmail ? '我的账户' : frontConfig.uiText.registerAction}</button>{frontConfig.showDeposit&&<button className="deposit-trigger" onClick={openDeposit}><Coins size={15}/> {frontConfig.uiText.depositAction}</button>}{frontConfig.showWithdrawal&&<button className="withdrawal-trigger" onClick={openWithdrawal}><ArrowUpRight size={14}/> {frontConfig.uiText.withdrawalAction}</button>}<button className="wallet-button" onClick={() => setWorkspaceView('account')}><Wallet size={16}/> {frontConfig.uiText.netWorthAction} <b>${fmt(etfBalance)}</b></button></div></header>
      <div className="content"><div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> {workspaceView==='market'?marketDataMeta.connected?`市场数据 · ${marketDataMeta.provider} 行情`:'市场数据 · SIM 演示价格':workspaceView==='equity-contract'?'模拟交易 · 美股合约 ETF':workspaceView==='time-contract'?'交易所概率参考 · PTS 模拟':workspaceView==='prediction'?'二元事件同步 · PTS 模拟':'账户与资产'}</div><h1>{workspaceView==='market'?frontConfig.homeTitle:workspaceView==='equity-contract'?frontConfig.equityContractTitle:workspaceView==='time-contract'?frontConfig.timeContractTitle:workspaceView==='prediction'?frontConfig.predictionTitle:'我的'}</h1><p className="subtitle">{workspaceView==='market'?frontConfig.marketSubtitle:workspaceView==='equity-contract'?frontConfig.equityContractSubtitle:workspaceView==='time-contract'?frontConfig.timeContractSubtitle:workspaceView==='prediction'?frontConfig.predictionSubtitle:'查看个人资料、账户状态、模拟资产与近期记录。'}</p></div><div className="heading-right"><span className="date-label">{workspaceView==='time-contract'?'Kalshi / Polymarket 概率参考':workspaceView==='prediction'?'Kalshi / Polymarket 事件同步':workspaceView==='account'?'个人 ID 绑定账户':workspaceView==='market'||workspaceView==='equity-contract'?marketDataMeta.message:`行情延迟 ${frontConfig.marketDelayMinutes} 分钟`}</span>{frontConfig.showKyc&&<button className="outline-button kyc-status-button" onClick={openKyc}><Fingerprint size={14}/> KYC · {kycStatusLabel}</button>}<button className="outline-button" onClick={() => notify(workspaceView==='time-contract'?'行情参考交易所短周期合约概率；订单使用 PTS 模拟。':workspaceView==='prediction'?'只展示 YES / NO 二元事件行情；下单与结算使用平台模拟积分。':'行情数据为原型模拟数据')}><Clock3 size={14}/>{workspaceView==='time-contract'?'概率变化 · PTS 模拟':workspaceView==='prediction'?'YES / NO · PTS 模拟':workspaceView==='account'?'演示数据 · 非实盘':workspaceView==='market'||workspaceView==='equity-contract'?marketDataMeta.connected?`${marketDataMeta.provider} 行情 · 测试数据`:'SIM 演示价 · API 未配置':`${frontConfig.marketDelayMinutes} 分钟延时`}</button></div></div>
        {workspaceView==='account'&&<section className="account-page">
          <div className="account-profile-card"><div className="account-avatar"><UserRound size={22}/></div><div className="account-identity"><small>个人账户</small><b>{registeredEmail||'游客账户'}</b><span>{registeredEmail?`个人 ID：${personalId}`:'注册后生成并绑定个人 ID'}</span></div><span className={`account-kyc-badge ${kycStatus}`}>{kycStatusLabel}</span></div>
          {!registeredEmail&&<div className="account-register-prompt"><div><b>注册以保存账户信息</b><small>创建演示账户后，可查看绑定的个人 ID 和本机演示记录。</small></div><button onClick={()=>setAuthOpen(true)}><LogIn size={15}/> 注册账户</button></div>}
          <div className="account-stat-grid"><article><span>USDT 演示余额</span><b>{fmt(walletBalance)} <small>USDT</small></b><button onClick={openDeposit}>充值 / 提现 <ArrowUpRight size={13}/></button></article><article><span>模拟账户净值</span><b>{fmt(etfBalance)} <small>USD</small></b><button onClick={()=>setWorkspaceView('equity-contract')}>查看合约 ETF <ArrowUpRight size={13}/></button></article><article><span>模拟订单</span><b>{etfOrders.length} <small>笔</small></b><button onClick={()=>setWorkspaceView('equity-contract')}>查看订单记录 <ArrowUpRight size={13}/></button></article></div>
          <div className="account-content-grid"><section className="account-panel"><div className="account-panel-heading"><div><b>账户信息</b><small>身份与安全状态</small></div></div><div className="account-info-row"><span>注册邮箱</span><b>{registeredEmail||'尚未注册'}</b></div><div className="account-info-row"><span>个人 ID</span><b className="account-id-value">{personalId||'注册后生成'}{personalId&&<button aria-label="复制个人 ID" onClick={async()=>{try{await navigator.clipboard.writeText(personalId);notify('个人 ID 已复制')}catch{notify(`个人 ID：${personalId}`)}}}><Copy size={13}/></button>}</b></div><div className="account-info-row"><span>KYC 认证</span><button className="account-inline-action" onClick={openKyc}>{kycStatusLabel} · 管理认证 <ArrowUpRight size={12}/></button></div><div className="account-info-row"><span>账户类型</span><b>本地演示账户</b></div></section>
          <section className="account-panel"><div className="account-panel-heading"><div><b>快捷操作</b><small>资金操作均绑定此个人 ID</small></div></div><div className="account-action-grid"><button onClick={openDeposit}><Coins size={16}/>充值 USDT</button><button onClick={openWithdrawal}><ArrowUpRight size={16}/>提现 USDT</button><button onClick={openKyc}><Fingerprint size={16}/>身份认证</button><button onClick={()=>setWorkspaceView('prediction')}><Activity size={16}/>我的预测</button></div><p className="account-demo-note"><TriangleAlert size={13}/> 余额和订单为模拟数据，不具备现金价值；不发生链上转账。</p></section></div>
          <section className="account-panel account-invite-panel"><div className="account-panel-heading"><div><b>邀请好友</b><small>分享专属链接，新用户注册时会记录你的个人 ID</small></div><span className="account-invite-count">已邀请 {inviteCount} 人</span></div>{personalInviteLink?<><div className="account-invite-link"><span>{personalInviteLink}</span><button onClick={async()=>{try{await navigator.clipboard.writeText(personalInviteLink);notify('邀请链接已复制')}catch{notify('复制失败，请检查浏览器剪贴板权限')}}}><Copy size={14}/>复制链接</button></div><p className="account-invite-note"><ShieldCheck size={13}/> 邀请关系仅用于本平台演示记录；当前不会产生返佣或真实收益。</p></>:<div className="account-empty">注册账户后生成专属邀请链接</div>}</section>
          <section className="account-panel account-history-panel"><div className="account-panel-heading"><div><b>历史账单</b><small>充值、提现及各类模拟交易记录 · 按时间倒序</small></div><button className="account-text-action" onClick={()=>void refreshLedger()} disabled={ledgerBusy}>{ledgerBusy?'刷新中…':'刷新记录'} <ArrowUpRight size={13}/></button></div><div className="ledger-tabs">{([['all','全部'],['deposit','充值'],['withdrawal','提现'],['etf','合约 ETF'],['time','时间合约'],['forecast','预测']] as [LedgerCategory,string][]).map(([key,label])=><button key={key} className={ledgerCategory===key?'active-ledger-tab':''} onClick={()=>setLedgerCategory(key)}>{label}</button>)}</div>{visibleLedgerItems.length===0?<div className="account-empty">{personalId?'当前分类暂无账单记录':'注册并登录后查看个人账单'}</div>:<div className="ledger-list">{visibleLedgerItems.map(row=><article className="ledger-row" key={`${row.category}-${row.id}`}><div className="ledger-icon"><span>{row.category==='deposit'?'充':row.category==='withdrawal'?'提':row.category==='etf'?'ETF':row.category==='time'?'时':'测'}</span></div><div className="ledger-row-main"><b>{row.title}</b><small>{row.description}</small><time>{new Date(row.createdAt).toLocaleString('zh-CN')}</time></div><div className="ledger-row-values"><b className={row.amount>0?'positive':row.amount<0?'negative':''}>{row.amount>0?'+':''}{fmt(row.amount)} <small>{row.currency}</small></b>{row.profit!==null&&row.profit!==undefined&&<span className={row.profit>=0?'positive':'negative'}>盈亏 {row.profit>0?'+':''}{fmt(row.profit)} {row.currency==='USD'?'USD':'PTS'}</span>}<em className={row.status.includes('审核')||row.status.includes('进行')||row.status.includes('待结算')?'pending':row.status.includes('驳回')||row.status.includes('判输')?'failed':'settled'}>{row.status}</em></div></article>)}</div>}</section>
        </section>}
        {workspaceView==='market'&&frontConfig.showMarketOverview&&<>
        <section className="market-strip"><div className="market-intro"><span className="market-kicker">{frontConfig.uiText.temperatureTitle}</span><b>{frontConfig.indexTitle}</b><small>{frontConfig.indexSubtitle}</small></div>{frontConfig.marketIndices.map(item=><div className="index-stat" key={item.s}><span>{item.s}</span><b>{item.v}</b><small className={item.down?'negative':'positive'}>{item.c}</small></div>)}<div className="strip-decoration"><Activity size={21}/></div></section>
        {frontConfig.showMarketPicks&&<section className="market-picks"><div className="section-head"><div><h2>{frontConfig.featuredTitle}</h2><p>{frontConfig.featuredSubtitle}</p></div><button className="text-button" onClick={()=>setWorkspaceView('equity-contract')}>进入合约市场 <ArrowUpRight size={14}/></button></div><div className="instrument-grid">{frontConfig.marketAssets.slice(0,4).map((asset,index)=><button key={asset.symbol} className="instrument-card" onClick={()=>{setSelected(asset);setWorkspaceView('equity-contract')}}><div className="instrument-top"><div className={`ticker-icon ticker-${index}`}>{asset.symbol.slice(0,1)}</div><span className="leverage-pill">{asset.type}</span><Star size={15} className={`star ${watch.includes(asset.symbol)?'saved':''}`}/></div><div className="ticker-name">{asset.symbol}<small>{asset.name}</small></div><div className="instrument-bottom"><div><b>${fmt(asset.last)}</b><small className="quote-source-chip">{asset.quoteSource||'SIM'}</small><span className={asset.change<0?'negative':'positive'}>{asset.change>0?'+':''}{asset.change.toFixed(2)}%</span></div><Spark points={asset.spark} color={asset.color}/></div></button>)}</div></section>}
        {frontConfig.showDemoProjects&&<section className="demo-project-section"><div className="demo-project-section-head"><div><h2>{frontConfig.demoProjectTitle}</h2><p>{frontConfig.demoProjectSubtitle}</p></div><span><Activity size={12}/> 模拟数据</span></div>{simulatedProjects.length===0?<div className="demo-project-empty">后台尚未发布 SIM 模拟项目。交易所概率标的请在「时间合约」页面查看。</div>:<div className="demo-project-grid">{simulatedProjects.map(project=>{const min=Math.min(...project.curve);const max=Math.max(...project.curve);const range=max-min||1;const points=project.curve.map((value,index)=>`${(index/(project.curve.length-1))*100},${45-((value-min)/range)*35}`).join(' ');return <article className="demo-project-card" key={project.id}><div className="demo-project-card-top"><span className="sim-chip">SIM</span><span className={project.targetChangePct<0?'negative':'positive'}>{project.targetChangePct>0?'+':''}{project.targetChangePct.toFixed(2)}%</span></div><b>{project.symbol}</b><small>{project.name}</small><strong>${fmt(project.lastPrice)}</strong><svg viewBox="0 0 100 50" preserveAspectRatio="none"><polyline points={points} fill="none" stroke={project.targetChangePct<0?'#f18b8f':'#6bd5a2'} strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg><em>演示曲线 · 不代表真实市场</em></article>})}</div>}</section>}
        </>}{workspaceView==='equity-contract'&&frontConfig.showEquityContracts&&<>
        <div className="section-head"><div><h2>{frontConfig.uiText.popularContracts}</h2><p>{frontConfig.featuredSubtitle}</p></div><button className="text-button" onClick={()=>setWorkspaceView('equity-contract')}>{frontConfig.uiText.featuredAction} <ArrowUpRight size={14}/></button></div>
        <div className="instrument-grid">{frontConfig.marketAssets.slice(0,4).map((a, i)=><button key={a.symbol} className={`instrument-card ${selected.symbol===a.symbol?'chosen':''}`} onClick={()=>setSelected(a)}><div className="instrument-top"><div className={`ticker-icon ticker-${i}`}>{a.symbol.slice(0,1)}</div><span className="leverage-pill">{a.type}</span><Star size={15} className={`star ${watch.includes(a.symbol)?'saved':''}`} onClick={e=>{e.stopPropagation();setWatch(w=>w.includes(a.symbol)?w.filter(x=>x!==a.symbol):[...w,a.symbol])}}/></div><div className="ticker-name">{a.symbol}<small>{a.name}</small></div><div className="instrument-bottom"><div><b>${fmt(a.last)}</b><span className={a.change<0?'negative':'positive'}>{a.change>0?'+':''}{a.change.toFixed(2)}%</span></div><Spark points={a.spark} color={a.color}/></div></button>)}</div>
        <div className="lower-grid"><section className="panel markets-panel"><div className="panel-head"><div><h2>合约市场</h2><p>探索并筛选可交易标的</p></div><button className="filter-button" onClick={()=>notify('筛选条件：全部杠杆与方向')}><Settings2 size={15}/> 筛选</button></div><div className="market-controls"><div className="tabs">{tabs.map(t=><button key={t} onClick={()=>setActiveTab(t)} className={activeTab===t?'tab active-tab':'tab'}>{t}</button>)}</div><label className="search"><Search size={15}/><input placeholder="搜索代码或名称" value={search} onChange={e=>setSearch(e.target.value)}/><kbd><Command size={11}/> K</kbd></label></div><div className="table-wrap"><table><thead><tr><th>标的</th><th>类型</th><th>最新价 <ChevronDown size={12}/></th><th>涨跌幅</th><th>成交额</th><th></th></tr></thead><tbody>{visible.map(a=><tr key={a.symbol} className={selected.symbol===a.symbol?'selected-row':''} onClick={()=>setSelected(a)}><td><div className="table-symbol"><div className="mini-logo">{a.symbol.slice(0,1)}</div><div><b>{a.symbol}</b><small>{a.name}</small></div></div></td><td><span className="type-label">{a.type}</span></td><td className="price-cell">${fmt(a.last)} <small className="quote-source-chip">{a.quoteSource||'SIM'}</small></td><td className={a.change<0?'negative':'positive'}>{a.change>0?'+':''}{a.change.toFixed(2)}%</td><td className="volume-cell">{a.volume}</td><td><button className={`row-star ${watch.includes(a.symbol)?'saved':''}`} onClick={e=>{e.stopPropagation();setWatch(w=>w.includes(a.symbol)?w.filter(x=>x!==a.symbol):[...w,a.symbol])}}><Star size={15}/></button></td></tr>)}</tbody></table>{visible.length===0&&<div className="empty">没有找到相关标的</div>}</div><div className="table-foot">显示 {visible.length} 个标的 <span>{marketDataMeta.connected?`${marketDataMeta.provider} 快照 · ${marketDataMeta.updatedAt?new Date(marketDataMeta.updatedAt).toLocaleTimeString('zh-CN'):'已更新'} · 下单仍为模拟`: 'SIM 模拟价格 · 配置行情 API 后自动更新'}</span></div></section>
          <section className="panel detail-panel"><div className="detail-head"><div><div className="detail-title"><div className="detail-logo">{selected.symbol.slice(0,1)}</div><div><h2>{selected.symbol} <span className="leverage-pill">{selected.type}</span></h2><p>{selected.name} · 美股合约 ETF</p></div></div></div><button className="icon-button subtle" onClick={()=>setWatch(w=>watch.includes(selected.symbol)?w.filter(x=>x!==selected.symbol):[...w,selected.symbol])}><Star size={17} className={watch.includes(selected.symbol)?'saved':''}/></button></div><div className="quote"><div><span>最新价 <small>{selected.quoteSource&&selected.quoteSource!=='SIM'?`${selected.quoteSource} 报价`:'SIM 模拟价'}</small></span><strong>${fmt(selected.last)}</strong></div><div className={selected.change<0?'negative':'positive'}>{selected.change>0?'+':''}{selected.change.toFixed(2)}% <small>今日</small></div></div><div className="chart-meta"><span>价格走势 · {selected.quoteSource&&selected.quoteSource!=='SIM'?'行情走势示意':'SIM 模拟曲线'}</span><span>成交量 <b>{selected.volume}</b></span></div><div className="chart-area"><div className="y-labels">{chartLabels.map((label,index)=><span key={index}>{fmt(label)}</span>)}</div><div className="chart-inner"><div className="grid-lines"><i/><i/><i/><i/></div><Spark points={selected.spark} color={selected.color} large/><span className="chart-time">09:30</span><span className="chart-time mid">12:00</span><span className="chart-time end">16:00 ET</span></div></div><div className="periods">{['1日','1周','1月','3月','1年','全部'].map(p=><button key={p} className={period===p?'period active-period':'period'} onClick={()=>setPeriod(p)}>{p}</button>)}</div>
            {frontConfig.showQuickOrder&&<div className="order-box">
              <div className="order-heading"><b>{frontConfig.uiText.quickOrder}</b><span><i/> 虚拟美元账户</span></div>
              <div className="order-tabs">
                <button className={side==='买入'?'buy-active':''} onClick={()=>setSide('买入')}><ArrowDownLeft size={14}/> {frontConfig.uiText.buyAction}</button>
                <button className={side==='卖出'?'sell-active':''} onClick={()=>setSide('卖出')}><ArrowUpRight size={14}/> {frontConfig.uiText.sellAction}</button>
              </div>
              <label className="field-label">订单类型</label>
              <button className="select-field" onClick={()=>setPrice(price==='市价'?'限价':'市价')}>{price} <ChevronDown size={14}/></button>
              <div className="leverage-control"><label htmlFor="etf-leverage">杠杆倍数 <b>{Math.min(etfLeverage,frontConfig.maxEtfLeverage)}×</b></label><input id="etf-leverage" type="range" min="1" max={frontConfig.maxEtfLeverage} step="1" value={Math.min(etfLeverage,frontConfig.maxEtfLeverage)} onChange={event=>setEtfLeverage(Number(event.target.value))}/><div><span>1×</span><span>最高 {frontConfig.maxEtfLeverage}×</span></div></div>
              <div className="input-label"><span>数量</span><span>可用 ${fmt(etfBalance)}</span></div>
              <div className="qty-field"><input value={qty} onChange={e=>setQty(e.target.value.replace(/[^0-9]/g,''))}/><span>股</span><div><button onClick={()=>setQty(String(Math.max(1,Number(qty)-1)))}>−</button><button onClick={()=>setQty(String(Number(qty)+1))}>+</button></div></div>
              <div className="leverage-estimate"><div><span>订单保证金</span><b>${fmt((Number(qty)||0)*selected.last)}</b></div><div><span>模拟持仓名义金额</span><b>${fmt((Number(qty)||0)*selected.last*Math.min(etfLeverage,frontConfig.maxEtfLeverage))}</b></div><small>若按后台规则判赢，模拟收益约 ${fmt((Number(qty)||0)*selected.last*frontConfig.contractPayoutPercent/100*Math.min(etfLeverage,frontConfig.maxEtfLeverage))}；判输时扣除订单保证金。</small></div>
              <button className={`submit-order ${side==='卖出'?'submit-sell':''}`} onClick={() => void submitOrder()} disabled={!frontConfig.demoOrdersEnabled||etfOrderBusy}>{etfOrderBusy?'提交中…':frontConfig.demoOrdersEnabled?`${side} ${selected.symbol}`:'后台已暂停下单'}</button>
              <div className="order-note"><ShieldCheck size={13}/> {frontConfig.orderDisclaimer} · 杠杆与收益仅为模拟数值，订单结果由后台规则控制</div>
              {personalId&&<div className="etf-order-history">
                <div className="etf-order-history-head"><b>我的模拟订单</b><span>{etfOrders.length} 条</span></div>
                {etfOrders.length===0?<small>尚无模拟订单</small>:etfOrders.slice(0,5).map(order=><div className="etf-order-row" key={order.id}>
                  <div><b>{order.symbol} · {order.side==='buy'?'买入':'卖出'} × {order.quantity} · {order.leverage||1}×</b><small>{new Date(order.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} · 保证金 ${fmt(order.amount)} · 名义金额 ${fmt(order.exposureAmount||order.amount)}</small></div>
                  <span className={order.status}>{order.status==='pending'?'待处理':order.status==='won'?`赢 +$${fmt(order.profit||0)}`:`输 −$${fmt(order.amount)}`}</span>
                </div>)}
              </div>}
            </div>}
          </section></div>
        </>}{workspaceView==='time-contract'&&frontConfig.showTimeContracts&&<SecondsContractPanel projects={demoProjects} personalId={personalId} onRegister={()=>setAuthOpen(true)} notify={notify} durations={frontConfig.contractDurations} payoutPercent={frontConfig.contractPayoutPercent} autoPayoutEnabled={frontConfig.autoPayoutEnabled} title={frontConfig.timeContractTitle} subtitle={frontConfig.timeContractSubtitle}/ >}{workspaceView==='prediction'&&<PredictionMarketPanel personalId={personalId} onRegister={()=>setAuthOpen(true)} notify={notify} events={forecastEvents} title={frontConfig.predictionTitle} subtitle={frontConfig.predictionSubtitle}/>}
        <footer><span>© 2026 {frontConfig.siteName} · 产品原型</span><span><Eye size={13}/> 模拟行情与交易所参考行情会分别标注；PTS 不具备现金价值</span><a className="admin-entry" href={ADMIN_LINK_HREF}>后台系统</a><button onClick={()=>notify(frontConfig.orderDisclaimer)}>{frontConfig.uiText.riskDisclosure}</button></footer>
      </div>
    </main>{kycOpen&&<KycModal personalId={personalId} email={registeredEmail} status={kycStatus} reason={kycReason} onClose={()=>{setKycOpen(false);setKycForDeposit(false)}} onSubmit={submitKyc}/ >}{authOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setAuthOpen(false);setAuthForDeposit(false)}}}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="register-title"><div className="auth-top"><div className="auth-brand"><div className="brand-mark"><CandlestickChart size={18}/></div><span>{frontConfig.siteName}</span><span className="brand-dot">.</span></div><button className="icon-button" aria-label="关闭" onClick={()=>{setAuthOpen(false);setAuthForDeposit(false)}}><X size={18}/></button></div><div className="auth-intro"><div className="auth-icon"><ShieldCheck size={19}/></div><h2 id="register-title">创建账户</h2><p>注册 Northstar，开启模拟交易体验</p></div><form className="auth-form" onSubmit={registerAccount}><label htmlFor="register-email">邮箱地址</label><input id="register-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" required/><label htmlFor="register-password">设置密码</label><div className="password-input"><input id="register-password" type={showAuthPassword?'text':'password'} autoComplete="new-password" minLength={8} maxLength={64} placeholder="至少 8 位字符" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} required/><button type="button" aria-label={showAuthPassword?'隐藏密码':'显示密码'} onClick={()=>setShowAuthPassword(show=>!show)}><Eye size={15}/></button></div><label htmlFor="register-confirm">确认密码</label><input id="register-confirm" type={showAuthPassword?'text':'password'} autoComplete="new-password" minLength={8} maxLength={64} placeholder="再次输入密码" value={authPasswordConfirm} onChange={e=>setAuthPasswordConfirm(e.target.value)} required/><label className="terms-check"><input type="checkbox" checked={acceptDemoTerms} onChange={e=>setAcceptDemoTerms(e.target.checked)}/><span>我已了解这是本地模拟账户，不含真实交易或资金服务。</span></label><button className="register-submit" type="submit">创建演示账户</button></form><div className="auth-security"><ShieldCheck size={13}/> 密码仅用于本次表单校验，不会发送或保存</div><p className="auth-note">该注册流程只在当前浏览器保存邮箱和个人 ID，不会创建真实交易账户。</p></section></div>}{depositOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setDepositOpen(false)}}><section className="deposit-modal" role="dialog" aria-modal="true" aria-labelledby="deposit-title"><div className="deposit-modal-head"><div className="deposit-heading-icon"><Coins size={19}/></div><div><h2 id="deposit-title">USDT 资金</h2><p>充值、提现与资金记录</p></div><button className="icon-button" aria-label="关闭" onClick={()=>setDepositOpen(false)}><X size={18}/></button></div><div className="deposit-balance"><span>演示账户 USDT 余额</span><b>{fmt(walletBalance)} <small>USDT</small></b></div><div className="deposit-personal-id"><span>资金账户 · 已绑定个人 ID</span><b>{personalId}</b><small>充值和提现流水都关联此 ID</small></div><div className="wallet-mode-tabs">{frontConfig.showDeposit&&<button className={walletTab==='deposit'?'wallet-mode-active':''} onClick={()=>setWalletTab('deposit')}>充值 USDT</button>}{frontConfig.showWithdrawal&&<button className={walletTab==='withdrawal'?'wallet-mode-active':''} onClick={()=>setWalletTab('withdrawal')}>提现 USDT</button>}</div><div className="deposit-warning"><TriangleAlert size={17}/><span><b>本地演示资金功能</b> · 不会广播链上交易。请勿使用真实钱包地址或转入真实资产。</span></div><label className="deposit-label">选择网络</label><div className="network-options">{frontConfig.depositNetworks.map(network=><button key={network} className={depositNetwork===network?'network-option selected-network':'network-option'} onClick={()=>setDepositNetwork(network)}><span className={`network-dot ${network.toLowerCase()}`}/>{network}{depositNetwork===network&&<span className="network-check">✓</span>}</button>)}</div><label className="deposit-label" htmlFor="deposit-amount">{walletTab==='deposit'?'充值金额':'提现金额'}</label><div className="deposit-amount-wrap"><input id="deposit-amount" type="number" min={walletTab==='deposit'?'1':String(frontConfig.minimumWithdrawal)} step="0.01" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} placeholder={walletTab==='deposit'?'输入充值金额':`最低提现 ${frontConfig.minimumWithdrawal} USDT`}/><span>USDT</span></div><div className="amount-presets">{[100,500,1000].map(amount=><button key={amount} onClick={()=>setDepositAmount(String(amount))}>{amount} USDT</button>)}</div>{walletTab==='deposit'?<div className="demo-address"><div><span>演示充值网络 · {depositNetwork}</span><b>到账仅记录于本地模拟钱包</b></div><span className="demo-badge">无链上地址</span></div>:<label className="deposit-label" htmlFor="withdraw-address">收款地址（演示）<div className="withdraw-address-wrap"><input id="withdraw-address" value={withdrawAddress} onChange={e=>setWithdrawAddress(e.target.value)} placeholder="仅输入虚构测试地址" autoComplete="off"/></div></label>}<div className="deposit-summary"><span>{walletTab==='deposit'?'预计到账':`预计扣除（含 ${frontConfig.withdrawalFee.toFixed(2)} USDT 手续费）`}</span><b>{Number(depositAmount)>0?fmt(Number(depositAmount)+(walletTab==='withdrawal'?frontConfig.withdrawalFee:0)):'0.00'} USDT</b><small>{walletTab==='deposit'?'模拟充值即时记账':'提现申请提交后由后台审核，驳回时退回模拟余额'}</small></div><button className="simulate-deposit" disabled={walletBusy} onClick={walletTab==='deposit'?simulateDeposit:requestWithdrawal}>{walletBusy?'处理中…':walletTab==='deposit'?'模拟充值到账':'提交提现申请'}</button>{walletTransactions.length>0&&<div className="deposit-history"><div className="history-title">资金流水</div>{walletTransactions.slice(0,5).map(row=><div className="history-row" key={row.id}><span><b className={row.type==='deposit'?'':'withdrawal-amount'}>{row.type==='deposit'?'+':'−'}{fmt(row.amount)} USDT</b><small>{row.type==='deposit'?'充值':'提现'} · {row.network} · {row.addressMasked||row.personalId}</small></span><em className={row.status==='rejected'?'rejected-history':''}>{row.status==='completed'?'已完成':row.status==='pending'?'待后台审核':'已驳回'}</em></div>)}</div>}<div className="deposit-footnote"><ShieldCheck size={13}/> 正式充值需要接入合规的钱包与链上确认服务</div></section></div>}{toast&&<div className="toast"><CreditCard size={16}/>{toast}<button onClick={()=>setToast('')}><X size={14}/></button></div>}
  </div>
}
