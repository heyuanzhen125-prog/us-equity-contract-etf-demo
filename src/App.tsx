import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, ArrowDownLeft, ArrowUpRight, Bell, BookOpen, CandlestickChart, ChevronDown, CircleHelp, Clock3, Command, Compass, CreditCard, Eye, Menu, MoreHorizontal, Search, Settings2, ShieldCheck, Star, Wallet, X, TriangleAlert, Coins, Fingerprint, BadgeCheck } from 'lucide-react'
import SecondsContractPanel from './SecondsContractPanel'
import PredictionMarketPanel from './PredictionMarketPanel'

type Asset = { symbol: string; name: string; last: number; change: number; volume: string; type: string; color: string; spark: number[] }
type DemoProject = { id: string; symbol: string; name: string; startPrice: number; lastPrice: number; targetChangePct: number; curve: number[]; simulated: true }
type WalletTransaction = { id: string; personalId: string; type: 'deposit' | 'withdrawal'; amount: number; fee: number; network: string; addressMasked: string; status: 'completed' | 'pending' | 'rejected'; reason: string; createdAt: string; reviewedAt: string | null }
const assets: Asset[] = [
  { symbol: 'NVDA', name: '英伟达', last: 142.87, change: 2.46, volume: '3.42B', type: '2× 多头', color: '#84d6b2', spark: [13, 17, 15, 22, 20, 26, 23, 30, 27, 35, 31, 40, 38, 47] },
  { symbol: 'TSLA', name: '特斯拉', last: 338.11, change: -1.28, volume: '2.18B', type: '2× 多头', color: '#fc8082', spark: [44, 39, 42, 35, 38, 31, 34, 28, 32, 24, 27, 21, 25, 20] },
  { symbol: 'SPY', name: '标普 500 ETF', last: 681.42, change: 0.74, volume: '1.76B', type: '指数', color: '#84d6b2', spark: [17, 18, 15, 22, 20, 24, 21, 27, 23, 30, 28, 34, 32, 39] },
  { symbol: 'AAPL', name: '苹果', last: 258.34, change: 0.32, volume: '1.24B', type: '2× 多头', color: '#84d6b2', spark: [18, 16, 21, 20, 23, 19, 25, 24, 29, 26, 31, 30, 35, 37] },
  { symbol: 'MSTR', name: 'Strategy', last: 406.53, change: -3.12, volume: '928M', type: '2× 多头', color: '#fc8082', spark: [46, 42, 47, 36, 41, 31, 36, 28, 33, 23, 28, 19, 23, 15] },
]
const tabs = ['全部', '热门', '科技', '指数', '加密概念']
const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const createPersonalId = () => `NST-${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected'
type WorkspaceView = 'market' | 'equity-contract' | 'time-contract' | 'prediction'
type MarketIndex = { s: string; v: string; c: string; down?: boolean }
type FrontConfig = { marketAssets: Asset[]; marketIndices: MarketIndex[]; siteName: string; marketSubtitle: string; marketDelayMinutes: number; showMarketOverview: boolean; showEquityContracts: boolean; showTimeContracts: boolean; showPrediction: boolean; showDeposit: boolean; showWithdrawal: boolean; showKyc: boolean; demoOrdersEnabled: boolean; depositNetworks: string[]; minimumWithdrawal: number; withdrawalFee: number; contractDurations: number[]; contractPayoutPercent: number }
const defaultFrontConfig: FrontConfig = { marketAssets: assets, marketIndices: [{s:'S&P 500',v:'6,812.34',c:'+0.74%'},{s:'纳斯达克',v:'23,104.61',c:'+1.12%'},{s:'道琼斯',v:'47,862.19',c:'+0.28%'},{s:'VIX',v:'18.42',c:'−2.16%',down:true}], siteName: 'Northstar Markets', marketSubtitle: '查看指数概况与后台发布的模拟项目。', marketDelayMinutes: 15, showMarketOverview: true, showEquityContracts: true, showTimeContracts: true, showPrediction: true, showDeposit: true, showWithdrawal: true, showKyc: true, demoOrdersEnabled: true, depositNetworks: ['TRC20', 'ERC20', 'Polygon'], minimumWithdrawal: 10, withdrawalFee: 0.5, contractDurations: [10, 30, 60], contractPayoutPercent: 80 }

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
  const [frontConfig, setFrontConfig] = useState<FrontConfig>(defaultFrontConfig)
  const [forecastEvents, setForecastEvents] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('全部')
  const [period, setPeriod] = useState('1日')
  const [search, setSearch] = useState('')
  const [side, setSide] = useState<'买入' | '卖出'>('买入')
  const [qty, setQty] = useState('10')
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
  const [demoProjects, setDemoProjects] = useState<DemoProject[]>([])
  const [authOpen, setAuthOpen] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState(() => localStorage.getItem('northstar.demo.registeredEmail') || '')
  const [personalId, setPersonalId] = useState(() => {
    const savedId = localStorage.getItem('northstar.demo.personalId')
    if (savedId) return savedId
    if (!localStorage.getItem('northstar.demo.registeredEmail')) return ''
    const migratedId = createPersonalId()
    localStorage.setItem('northstar.demo.personalId', migratedId)
    return migratedId
  })
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
  useEffect(() => {
    if (!personalId) return
    let active = true
    const refreshStatus = async () => {
      try {
        const response = await fetch(`/api/kyc-status?personalId=${encodeURIComponent(personalId)}`)
        if (!response.ok) return
        const result = await response.json()
        if (!active) return
        const status: KycStatus = result.status === 'approved' ? 'verified' : result.status === 'rejected' ? 'rejected' : result.status === 'pending' ? 'pending' : 'unverified'
        setKycStatus(status)
        setKycReason(result.reason || '')
      } catch { /* the local API may still be starting */ }
    }
    void refreshStatus()
    const timer = window.setInterval(refreshStatus, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [personalId])
  useEffect(() => {
    if (personalId && kycStatus === 'verified') void refreshWallet()
  }, [personalId, kycStatus])
  useEffect(() => {
    let active = true
    const refreshProjects = async () => {
      try {
        const response = await fetch('/api/projects')
        if (!response.ok) return
        const result = await response.json()
        if (active) setDemoProjects(result.projects || [])
      } catch { /* the local API may still be starting */ }
    }
    void refreshProjects()
    const timer = window.setInterval(refreshProjects, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  useEffect(() => { if (frontConfig.depositNetworks.length && !frontConfig.depositNetworks.includes(depositNetwork)) setDepositNetwork(frontConfig.depositNetworks[0]) }, [frontConfig.depositNetworks, depositNetwork])
  useEffect(() => { if (walletTab==='deposit' && !frontConfig.showDeposit && frontConfig.showWithdrawal) setWalletTab('withdrawal'); else if (walletTab==='withdrawal' && !frontConfig.showWithdrawal && frontConfig.showDeposit) setWalletTab('deposit') }, [walletTab, frontConfig.showDeposit, frontConfig.showWithdrawal])
  useEffect(() => {
    let active = true
    const refreshConfig = async () => {
      try {
        const response = await fetch('/api/public-config')
        if (!response.ok) return
        const result = await response.json()
        if (active && result.config) setFrontConfig({ ...defaultFrontConfig, ...result.config })
        if (active && Array.isArray(result.forecastEvents)) setForecastEvents(result.forecastEvents)
      } catch { /* local API may still be starting */ }
    }
    void refreshConfig()
    const timer = window.setInterval(refreshConfig, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  useEffect(() => { document.title = `${frontConfig.siteName} · 模拟原型` }, [frontConfig.siteName])
  useEffect(() => {
    const current = frontConfig.marketAssets.find(asset => asset.symbol === selected.symbol)
    if (current && current !== selected) setSelected(current)
    else if (!current && frontConfig.marketAssets[0]) setSelected(frontConfig.marketAssets[0])
  }, [frontConfig.marketAssets, selected])
  useEffect(() => {
    if (kycStatus !== 'verified' || !kycForDeposit) return
    setKycForDeposit(false)
    setKycOpen(false)
    setDepositOpen(true)
    notify(`后台审核已通过，个人 ID ${personalId} 可进行模拟充值`)
  }, [kycStatus, kycForDeposit, personalId])
  const visible = useMemo(() => frontConfig.marketAssets.filter(a => {
    const matchesSearch = (`${a.symbol} ${a.name}`).toLowerCase().includes(search.toLowerCase())
    const matchesTab = activeTab === '全部' || (activeTab === '热门' && ['NVDA', 'TSLA', 'SPY'].includes(a.symbol)) || (activeTab === '科技' && ['NVDA', 'TSLA', 'AAPL'].includes(a.symbol)) || (activeTab === '指数' && a.symbol === 'SPY') || (activeTab === '加密概念' && a.symbol === 'MSTR')
    return matchesSearch && matchesTab
  }), [search, activeTab, frontConfig.marketAssets])
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const submitOrder = () => frontConfig.demoOrdersEnabled ? notify(`模拟${side}单已提交：${selected.symbol} × ${qty}（仅原型演示）`) : notify('后台已暂停模拟下单')
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
  const registerAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = new FormData(event.currentTarget).get('email')?.toString().trim().toLowerCase() || ''
    if (authPassword !== authPasswordConfirm) { notify('两次输入的密码不一致'); return }
    if (!acceptDemoTerms) { notify('请先确认模拟账户使用说明'); return }
    const id = createPersonalId()
    localStorage.setItem('northstar.demo.registeredEmail', email)
    localStorage.setItem('northstar.demo.personalId', id)
    setRegisteredEmail(email)
    setPersonalId(id)
    const continueToDeposit = authForDeposit
    setAuthForDeposit(false)
    setAuthOpen(false)
    setAuthPassword('')
    setAuthPasswordConfirm('')
    setAcceptDemoTerms(false)
    if (continueToDeposit) { setKycForDeposit(true); setKycOpen(true) }
    notify(`账户已创建并绑定个人 ID：${id}`)
  }
  const kycStatusLabel = kycStatus === 'verified' ? '已认证' : kycStatus === 'pending' ? '审核中' : kycStatus === 'rejected' ? '需补充' : '未认证'

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><CandlestickChart size={19}/></div><span>{frontConfig.siteName}</span><span className="brand-dot">.</span></div>
      <div className="workspace"><div className="workspace-icon">N</div><div><b>{registeredEmail ? '个人账户' : '游客账户'}</b><small>{registeredEmail ? `ID ${personalId}` : '模拟交易账户'}</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">工作区</div>
      <nav>{frontConfig.showMarketOverview&&<button className={`nav-item ${workspaceView==='market'?'active':''}`} onClick={()=>setWorkspaceView('market')}><Compass size={17}/> 市场概览</button>}{frontConfig.showEquityContracts&&<button className={`nav-item ${workspaceView==='equity-contract'?'active':''}`} onClick={()=>setWorkspaceView('equity-contract')}><CandlestickChart size={17}/> 合约 ETF <span className="nav-tag">Beta</span></button>}{frontConfig.showTimeContracts&&<button className={`nav-item ${workspaceView==='time-contract'?'active':''}`} onClick={()=>setWorkspaceView('time-contract')}><Clock3 size={17}/> 时间合约</button>}{frontConfig.showPrediction&&<button className={`nav-item ${workspaceView==='prediction'?'active':''}`} onClick={()=>setWorkspaceView('prediction')}><Activity size={17}/> 预测系统</button>}<button className="nav-item"><Star size={17}/> 自选列表</button><button className="nav-item"><Activity size={17}/> 持仓与订单</button>{frontConfig.showKyc&&<button className="nav-item" onClick={openKyc}><Fingerprint size={17}/> 身份认证 <span className={`nav-tag ${kycStatus==='verified'?'kyc-ok':''}`}>{kycStatusLabel}</span></button>}</nav>
      <div className="nav-label market-label">市场</div><nav><button className="nav-item"><BookOpen size={17}/> 市场资讯</button><button className="nav-item"><Clock3 size={17}/> 经济日历</button></nav>
      <div className="sidebar-bottom"><div className="promo"><div className="promo-icon"><ShieldCheck size={17}/></div><b>风险先行</b><p>了解杠杆产品风险，理性管理仓位。</p><button onClick={() => notify('风险说明：杠杆 ETF 可能放大收益与损失')}>查看风险说明 <ArrowUpRight size={13}/></button></div><button className="nav-item"><CircleHelp size={17}/> 帮助中心</button><button className="nav-item"><Settings2 size={17}/> 设置</button><button className="profile" onClick={() => registeredEmail ? notify(`个人 ID：${personalId}`) : setAuthOpen(true)}><div className="avatar">{registeredEmail ? registeredEmail[0].toUpperCase() : '访'}</div><div><b>{registeredEmail || '访客账户'}</b><small>{registeredEmail ? `个人 ID ${personalId}` : '点击创建账户'}</small></div><MoreHorizontal size={18}/></button></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="mobile-menu"><Menu size={19}/></button><div className="breadcrumbs">{frontConfig.siteName} <span>/</span> {workspaceView==='market'?'市场概览':workspaceView==='equity-contract'?'合约 ETF':workspaceView==='time-contract'?'时间合约':'预测系统'}</div><div className="top-actions"><div className="market-status"><i/> 美股盘中 <span>·</span> 交易时段</div><button className="icon-button" aria-label="通知" onClick={() => notify('当前没有新通知')}><Bell size={17}/><i/></button><button className={registeredEmail?'register-trigger registered-trigger':'register-trigger'} onClick={() => registeredEmail ? notify(`个人 ID：${personalId}`) : setAuthOpen(true)}>{registeredEmail ? '个人 ID' : '注册账户'}</button>{frontConfig.showDeposit&&<button className="deposit-trigger" onClick={openDeposit}><Coins size={15}/> 充值 USDT</button>}{frontConfig.showWithdrawal&&<button className="withdrawal-trigger" onClick={openWithdrawal}><ArrowUpRight size={14}/> 提现 USDT</button>}<button className="wallet-button" onClick={() => notify('模拟账户净值：$25,000.00')}><Wallet size={16}/> 账户净值 <b>$25,000.00</b></button></div></header>
      <div className="content"><div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> {workspaceView==='market'?'市场数据 · 延时行情':workspaceView==='equity-contract'?'模拟交易 · 美股合约 ETF':workspaceView==='time-contract'?'独立交易模块 · 模拟': '独立研究模块 · 模拟'}</div><h1>{workspaceView==='market'?'市场概览':workspaceView==='equity-contract'?'合约 ETF':workspaceView==='time-contract'?'时间合约':'预测系统'}</h1><p className="subtitle">{workspaceView==='market'?frontConfig.marketSubtitle:workspaceView==='equity-contract'?'浏览美股与杠杆 ETF 模拟行情，并使用虚拟账户体验下单。':workspaceView==='time-contract'?'设定标的、方向与到期时间，体验独立的时间合约模拟。':'围绕事件问题记录概率判断，查看个人预测，不与时间合约共用订单。'}</p></div><div className="heading-right"><span className="date-label">行情延迟 {frontConfig.marketDelayMinutes} 分钟</span>{frontConfig.showKyc&&<button className="outline-button kyc-status-button" onClick={openKyc}><Fingerprint size={14}/> KYC · {kycStatusLabel}</button>}<button className="outline-button" onClick={() => notify('行情数据为原型模拟数据')}><Clock3 size={14}/>{frontConfig.marketDelayMinutes} 分钟延时</button></div></div>
        {workspaceView==='market'&&frontConfig.showMarketOverview&&<>
        <section className="market-strip"><div className="market-intro"><span className="market-kicker">市场温度</span><b>美股主要指数</b><small>延时行情 · 仅供展示</small></div>{frontConfig.marketIndices.map((item:any)=><div className="index-stat" key={item.s}><span>{item.s}</span><b>{item.v}</b><small className={item.down?'negative':'positive'}>{item.c}</small></div>)}<div className="strip-decoration"><Activity size={21}/></div></section>
        <section className="demo-project-section"><div className="demo-project-section-head"><div><h2>模拟项目</h2><p>由后台发布的虚拟标的 · SIM 前缀 · 非实盘行情</p></div><span><Activity size={12}/> 模拟数据</span></div>{demoProjects.length===0?<div className="demo-project-empty">后台尚未发布模拟项目。请到「后台系统 → 项目与曲线」添加 SIM- 标的。</div>:<div className="demo-project-grid">{demoProjects.map(project=>{const min=Math.min(...project.curve);const max=Math.max(...project.curve);const range=max-min||1;const points=project.curve.map((value,index)=>`${(index/(project.curve.length-1))*100},${45-((value-min)/range)*35}`).join(' ');return <article className="demo-project-card" key={project.id}><div className="demo-project-card-top"><span className="sim-chip">SIM</span><span className={project.targetChangePct<0?'negative':'positive'}>{project.targetChangePct>0?'+':''}{project.targetChangePct.toFixed(2)}%</span></div><b>{project.symbol}</b><small>{project.name}</small><strong>${fmt(project.lastPrice)}</strong><svg viewBox="0 0 100 50" preserveAspectRatio="none"><polyline points={points} fill="none" stroke={project.targetChangePct<0?'#f18b8f':'#6bd5a2'} strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg><em>演示曲线 · 不代表真实市场</em></article>})}</div>}</section>
        </>}{workspaceView==='equity-contract'&&frontConfig.showEquityContracts&&<>
        <div className="section-head"><div><h2>热门合约</h2><p>精选美股与指数杠杆 ETF</p></div><button className="text-button" onClick={() => notify('已展示全部合约')}>查看全部 <ArrowUpRight size={14}/></button></div>
        <div className="instrument-grid">{frontConfig.marketAssets.slice(0,4).map((a, i)=><button key={a.symbol} className={`instrument-card ${selected.symbol===a.symbol?'chosen':''}`} onClick={()=>setSelected(a)}><div className="instrument-top"><div className={`ticker-icon ticker-${i}`}>{a.symbol.slice(0,1)}</div><span className="leverage-pill">{a.type}</span><Star size={15} className={`star ${watch.includes(a.symbol)?'saved':''}`} onClick={e=>{e.stopPropagation();setWatch(w=>w.includes(a.symbol)?w.filter(x=>x!==a.symbol):[...w,a.symbol])}}/></div><div className="ticker-name">{a.symbol}<small>{a.name}</small></div><div className="instrument-bottom"><div><b>${fmt(a.last)}</b><span className={a.change<0?'negative':'positive'}>{a.change>0?'+':''}{a.change.toFixed(2)}%</span></div><Spark points={a.spark} color={a.color}/></div></button>)}</div>
        <div className="lower-grid"><section className="panel markets-panel"><div className="panel-head"><div><h2>合约市场</h2><p>探索并筛选可交易标的</p></div><button className="filter-button" onClick={()=>notify('筛选条件：全部杠杆与方向')}><Settings2 size={15}/> 筛选</button></div><div className="market-controls"><div className="tabs">{tabs.map(t=><button key={t} onClick={()=>setActiveTab(t)} className={activeTab===t?'tab active-tab':'tab'}>{t}</button>)}</div><label className="search"><Search size={15}/><input placeholder="搜索代码或名称" value={search} onChange={e=>setSearch(e.target.value)}/><kbd><Command size={11}/> K</kbd></label></div><div className="table-wrap"><table><thead><tr><th>标的</th><th>类型</th><th>最新价 <ChevronDown size={12}/></th><th>涨跌幅</th><th>成交额</th><th></th></tr></thead><tbody>{visible.map(a=><tr key={a.symbol} className={selected.symbol===a.symbol?'selected-row':''} onClick={()=>setSelected(a)}><td><div className="table-symbol"><div className="mini-logo">{a.symbol.slice(0,1)}</div><div><b>{a.symbol}</b><small>{a.name}</small></div></div></td><td><span className="type-label">{a.type}</span></td><td className="price-cell">${fmt(a.last)}</td><td className={a.change<0?'negative':'positive'}>{a.change>0?'+':''}{a.change.toFixed(2)}%</td><td className="volume-cell">{a.volume}</td><td><button className={`row-star ${watch.includes(a.symbol)?'saved':''}`} onClick={e=>{e.stopPropagation();setWatch(w=>w.includes(a.symbol)?w.filter(x=>x!==a.symbol):[...w,a.symbol])}}><Star size={15}/></button></td></tr>)}</tbody></table>{visible.length===0&&<div className="empty">没有找到相关标的</div>}</div><div className="table-foot">显示 {visible.length} 个标的 <span>行情延时，具体以交易所和券商数据为准</span></div></section>
          <section className="panel detail-panel"><div className="detail-head"><div><div className="detail-title"><div className="detail-logo">{selected.symbol.slice(0,1)}</div><div><h2>{selected.symbol} <span className="leverage-pill">{selected.type}</span></h2><p>{selected.name} · 美股合约 ETF</p></div></div></div><button className="icon-button subtle" onClick={()=>setWatch(w=>watch.includes(selected.symbol)?w.filter(x=>x!==selected.symbol):[...w,selected.symbol])}><Star size={17} className={watch.includes(selected.symbol)?'saved':''}/></button></div><div className="quote"><div><span>最新价 <small>延时</small></span><strong>${fmt(selected.last)}</strong></div><div className={selected.change<0?'negative':'positive'}>{selected.change>0?'+':''}{selected.change.toFixed(2)}% <small>今日</small></div></div><div className="chart-meta"><span>价格走势</span><span>成交量 <b>{selected.volume}</b></span></div><div className="chart-area"><div className="y-labels"><span>145.00</span><span>143.00</span><span>141.00</span><span>139.00</span></div><div className="chart-inner"><div className="grid-lines"><i/><i/><i/><i/></div><Spark points={selected.spark} color={selected.color} large/><span className="chart-time">09:30</span><span className="chart-time mid">12:00</span><span className="chart-time end">16:00 ET</span></div></div><div className="periods">{['1日','1周','1月','3月','1年','全部'].map(p=><button key={p} className={period===p?'period active-period':'period'} onClick={()=>setPeriod(p)}>{p}</button>)}</div>
            <div className="order-box"><div className="order-heading"><b>快速下单</b><span><i/> 模拟账户</span></div><div className="order-tabs"><button className={side==='买入'?'buy-active':''} onClick={()=>setSide('买入')}><ArrowDownLeft size={14}/> 买入</button><button className={side==='卖出'?'sell-active':''} onClick={()=>setSide('卖出')}><ArrowUpRight size={14}/> 卖出</button></div><label className="field-label">订单类型</label><button className="select-field" onClick={()=>setPrice(price==='市价'?'限价':'市价')}>{price} <ChevronDown size={14}/></button><div className="input-label"><span>数量</span><span>可用 $25,000.00</span></div><div className="qty-field"><input value={qty} onChange={e=>setQty(e.target.value.replace(/[^0-9]/g,''))}/><span>股</span><div><button onClick={()=>setQty(String(Math.max(1,Number(qty)-1)))}>−</button><button onClick={()=>setQty(String(Number(qty)+1))}>+</button></div></div><div className="estimate"><span>预估金额</span><b>${fmt((Number(qty)||0)*selected.last)}</b></div><button className={`submit-order ${side==='卖出'?'submit-sell':''}`} onClick={submitOrder} disabled={!frontConfig.demoOrdersEnabled}>{frontConfig.demoOrdersEnabled?`${side} ${selected.symbol}`:'后台已暂停下单'} </button><div className="order-note"><ShieldCheck size={13}/> 杠杆 ETF 可能放大损失 · 本平台为原型演示</div></div>
          </section></div>
        </>}{workspaceView==='time-contract'&&frontConfig.showTimeContracts&&<SecondsContractPanel projects={demoProjects} personalId={personalId} onRegister={()=>setAuthOpen(true)} notify={notify} durations={frontConfig.contractDurations} payoutPercent={frontConfig.contractPayoutPercent}/ >}{workspaceView==='prediction'&&<PredictionMarketPanel personalId={personalId} onRegister={()=>setAuthOpen(true)} notify={notify} events={forecastEvents}/>}
        <footer><span>© 2026 Northstar Markets · 产品原型</span><span><Eye size={13}/> 行情为模拟延时数据，不构成投资建议</span><a className="admin-entry" href="/admin">后台系统</a><button onClick={()=>notify('风险披露：杠杆产品适合了解其风险的投资者')}>风险披露</button></footer>
      </div>
    </main>{kycOpen&&<KycModal personalId={personalId} email={registeredEmail} status={kycStatus} reason={kycReason} onClose={()=>{setKycOpen(false);setKycForDeposit(false)}} onSubmit={submitKyc}/ >}{authOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setAuthOpen(false);setAuthForDeposit(false)}}}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="register-title"><div className="auth-top"><div className="auth-brand"><div className="brand-mark"><CandlestickChart size={18}/></div><span>{frontConfig.siteName}</span><span className="brand-dot">.</span></div><button className="icon-button" aria-label="关闭" onClick={()=>{setAuthOpen(false);setAuthForDeposit(false)}}><X size={18}/></button></div><div className="auth-intro"><div className="auth-icon"><ShieldCheck size={19}/></div><h2 id="register-title">创建账户</h2><p>注册 Northstar，开启模拟交易体验</p></div><form className="auth-form" onSubmit={registerAccount}><label htmlFor="register-email">邮箱地址</label><input id="register-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" required/><label htmlFor="register-password">设置密码</label><div className="password-input"><input id="register-password" type={showAuthPassword?'text':'password'} autoComplete="new-password" minLength={8} maxLength={64} placeholder="至少 8 位字符" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} required/><button type="button" aria-label={showAuthPassword?'隐藏密码':'显示密码'} onClick={()=>setShowAuthPassword(show=>!show)}><Eye size={15}/></button></div><label htmlFor="register-confirm">确认密码</label><input id="register-confirm" type={showAuthPassword?'text':'password'} autoComplete="new-password" minLength={8} maxLength={64} placeholder="再次输入密码" value={authPasswordConfirm} onChange={e=>setAuthPasswordConfirm(e.target.value)} required/><label className="terms-check"><input type="checkbox" checked={acceptDemoTerms} onChange={e=>setAcceptDemoTerms(e.target.checked)}/><span>我已了解这是本地模拟账户，不含真实交易或资金服务。</span></label><button className="register-submit" type="submit">创建演示账户</button></form><div className="auth-security"><ShieldCheck size={13}/> 密码仅用于本次表单校验，不会发送或保存</div><p className="auth-note">该注册流程只在当前浏览器保存邮箱和个人 ID，不会创建真实交易账户。</p></section></div>}{depositOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setDepositOpen(false)}}><section className="deposit-modal" role="dialog" aria-modal="true" aria-labelledby="deposit-title"><div className="deposit-modal-head"><div className="deposit-heading-icon"><Coins size={19}/></div><div><h2 id="deposit-title">USDT 资金</h2><p>充值、提现与资金记录</p></div><button className="icon-button" aria-label="关闭" onClick={()=>setDepositOpen(false)}><X size={18}/></button></div><div className="deposit-balance"><span>演示账户 USDT 余额</span><b>{fmt(walletBalance)} <small>USDT</small></b></div><div className="deposit-personal-id"><span>资金账户 · 已绑定个人 ID</span><b>{personalId}</b><small>充值和提现流水都关联此 ID</small></div><div className="wallet-mode-tabs">{frontConfig.showDeposit&&<button className={walletTab==='deposit'?'wallet-mode-active':''} onClick={()=>setWalletTab('deposit')}>充值 USDT</button>}{frontConfig.showWithdrawal&&<button className={walletTab==='withdrawal'?'wallet-mode-active':''} onClick={()=>setWalletTab('withdrawal')}>提现 USDT</button>}</div><div className="deposit-warning"><TriangleAlert size={17}/><span><b>本地演示资金功能</b> · 不会广播链上交易。请勿使用真实钱包地址或转入真实资产。</span></div><label className="deposit-label">选择网络</label><div className="network-options">{frontConfig.depositNetworks.map(network=><button key={network} className={depositNetwork===network?'network-option selected-network':'network-option'} onClick={()=>setDepositNetwork(network)}><span className={`network-dot ${network.toLowerCase()}`}/>{network}{depositNetwork===network&&<span className="network-check">✓</span>}</button>)}</div><label className="deposit-label" htmlFor="deposit-amount">{walletTab==='deposit'?'充值金额':'提现金额'}</label><div className="deposit-amount-wrap"><input id="deposit-amount" type="number" min={walletTab==='deposit'?'1':String(frontConfig.minimumWithdrawal)} step="0.01" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} placeholder={walletTab==='deposit'?'输入充值金额':`最低提现 ${frontConfig.minimumWithdrawal} USDT`}/><span>USDT</span></div><div className="amount-presets">{[100,500,1000].map(amount=><button key={amount} onClick={()=>setDepositAmount(String(amount))}>{amount} USDT</button>)}</div>{walletTab==='deposit'?<div className="demo-address"><div><span>演示充值网络 · {depositNetwork}</span><b>到账仅记录于本地模拟钱包</b></div><span className="demo-badge">无链上地址</span></div>:<label className="deposit-label" htmlFor="withdraw-address">收款地址（演示）<div className="withdraw-address-wrap"><input id="withdraw-address" value={withdrawAddress} onChange={e=>setWithdrawAddress(e.target.value)} placeholder="仅输入虚构测试地址" autoComplete="off"/></div></label>}<div className="deposit-summary"><span>{walletTab==='deposit'?'预计到账':`预计扣除（含 ${frontConfig.withdrawalFee.toFixed(2)} USDT 手续费）`}</span><b>{Number(depositAmount)>0?fmt(Number(depositAmount)+(walletTab==='withdrawal'?frontConfig.withdrawalFee:0)):'0.00'} USDT</b><small>{walletTab==='deposit'?'模拟充值即时记账':'提现申请提交后由后台审核，驳回时退回模拟余额'}</small></div><button className="simulate-deposit" disabled={walletBusy} onClick={walletTab==='deposit'?simulateDeposit:requestWithdrawal}>{walletBusy?'处理中…':walletTab==='deposit'?'模拟充值到账':'提交提现申请'}</button>{walletTransactions.length>0&&<div className="deposit-history"><div className="history-title">资金流水</div>{walletTransactions.slice(0,5).map(row=><div className="history-row" key={row.id}><span><b className={row.type==='deposit'?'':'withdrawal-amount'}>{row.type==='deposit'?'+':'−'}{fmt(row.amount)} USDT</b><small>{row.type==='deposit'?'充值':'提现'} · {row.network} · {row.addressMasked||row.personalId}</small></span><em className={row.status==='rejected'?'rejected-history':''}>{row.status==='completed'?'已完成':row.status==='pending'?'待后台审核':'已驳回'}</em></div>)}</div>}<div className="deposit-footnote"><ShieldCheck size={13}/> 正式充值需要接入合规的钱包与链上确认服务</div></section></div>}{toast&&<div className="toast"><CreditCard size={16}/>{toast}<button onClick={()=>setToast('')}><X size={14}/></button></div>}
  </div>
}
