import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, Check, RefreshCw, Save, Settings2 } from 'lucide-react'

type Config = {
  marketAssets: any[]; marketIndices: any[]
  siteName: string; marketSubtitle: string; marketDelayMinutes: number
  showMarketOverview: boolean; showEquityContracts: boolean; showTimeContracts: boolean; showPrediction: boolean
  showDeposit: boolean; showWithdrawal: boolean; showKyc: boolean; demoOrdersEnabled: boolean
  depositNetworks: string[]; minimumWithdrawal: number; withdrawalFee: number
  contractDurations: number[]; contractPayoutPercent: number
}
type EventItem = { id: string; category: string; question: string; description: string; consensus: number; horizon: string; volume?: string }
const labels: Record<keyof Config, string> = {
  marketAssets: 'ETF 行情', marketIndices: '指数行情',
  siteName: '前台站点名称', marketSubtitle: '市场概览副标题', marketDelayMinutes: '行情延迟（分钟）',
  showMarketOverview: '市场概览', showEquityContracts: '合约 ETF', showTimeContracts: '时间合约', showPrediction: '预测系统',
  showDeposit: 'USDT 模拟充值', showWithdrawal: 'USDT 模拟提现', showKyc: 'KYC 入口', demoOrdersEnabled: '模拟下单',
  depositNetworks: '网络', minimumWithdrawal: '最低提现额', withdrawalFee: '提现演示手续费', contractDurations: '合约期限', contractPayoutPercent: '模拟结算比例',
}

export default function AdminFrontSettingsView({ adminKey }: { adminKey: string }) {
  const [config, setConfig] = useState<Config | null>(null)
  const [eventsJson, setEventsJson] = useState('[]')
  const [assetsJson, setAssetsJson] = useState('[]')
  const [indicesJson, setIndicesJson] = useState('[]')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const load = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/front-config', { headers: { 'x-admin-key': adminKey } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '读取前台配置失败')
      setConfig(result.config)
      setEventsJson(JSON.stringify(result.forecastEvents, null, 2))
      setAssetsJson(JSON.stringify(result.config.marketAssets, null, 2))
      setIndicesJson(JSON.stringify(result.config.marketIndices, null, 2))
    } catch (err) { setError(err instanceof Error ? err.message : '读取配置失败') }
    finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [adminKey])
  const update = <K extends keyof Config>(key: K, value: Config[K]) => setConfig(current => current ? { ...current, [key]: value } : current)
  const saveConfig = async (event: FormEvent) => {
    event.preventDefault(); if (!config) return
    setBusy(true); setError(''); setNotice('')
    try {
      const marketAssets = JSON.parse(assetsJson)
      const marketIndices = JSON.parse(indicesJson)
      const response = await fetch('/api/admin/front-config', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ ...config, marketAssets, marketIndices }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '保存配置失败')
      setConfig(result.config); setAssetsJson(JSON.stringify(result.config.marketAssets, null, 2)); setIndicesJson(JSON.stringify(result.config.marketIndices, null, 2)); setNotice('前台配置已保存，网页会在几秒内同步更新。')
    } catch (err) { setError(err instanceof Error ? err.message : '保存配置失败') }
    finally { setBusy(false) }
  }
  const saveEvents = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const events: EventItem[] = JSON.parse(eventsJson)
      const response = await fetch('/api/admin/forecast-events', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ events }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '保存事件失败')
      setEventsJson(JSON.stringify(result.events, null, 2)); setNotice('预测事件已发布到前台。')
    } catch (err) { setError(err instanceof Error ? err.message : '事件 JSON 格式有误') }
    finally { setBusy(false) }
  }
  if (!config) return <div className="admin-content"><div className="admin-title-row"><div><div className="admin-eyebrow"><i/> 前台运营</div><h1>前台配置</h1><p>管理前台模块、资金演示选项和合约参数。</p></div><button className="wallet-refresh" onClick={()=>void load()} disabled={busy}><RefreshCw size={14} className={busy?'spinning':''}/> 重试</button></div>{error&&<div className="project-error admin-error">{error}</div>}</div>

  const switchFields: (keyof Config)[] = ['showMarketOverview','showEquityContracts','showTimeContracts','showPrediction','showDeposit','showWithdrawal','showKyc','demoOrdersEnabled']
  const networks = ['TRC20','ERC20','Polygon']
  const toggleNetwork = (network: string) => update('depositNetworks', config.depositNetworks.includes(network) ? config.depositNetworks.filter(item=>item!==network) : [...config.depositNetworks,network])
  const toggleDuration = (duration: number) => update('contractDurations', config.contractDurations.includes(duration) ? config.contractDurations.filter(item=>item!==duration) : [...config.contractDurations,duration].sort((a,b)=>a-b))
  return <div className="admin-content front-config-content"><div className="admin-title-row"><div><div className="admin-eyebrow"><i/> 前台运营配置</div><h1>前台功能与内容</h1><p>保存后前台自动同步。关闭模块会隐藏对应入口，并由 API 一并拦截模拟操作。</p></div><button className="wallet-refresh" onClick={()=>void load()} disabled={busy}><RefreshCw size={14} className={busy?'spinning':''}/> 刷新</button></div>
    <div className="project-safety"><AlertTriangle size={15}/><span><b>模拟环境配置</b> · 充值、提现、ETF 下单和时间合约只作用于本地演示系统；这些开关不会连接真实钱包或券商。</span></div>
    <form onSubmit={saveConfig}>
      <div className="front-setting-grid"><section className="project-create-card"><div className="project-card-title"><div><span>站点显示</span><small>名称和首页文案</small></div><Settings2 size={16}/></div><label>{labels.siteName}<input maxLength={40} value={config.siteName} onChange={e=>update('siteName',e.target.value)}/></label><label>{labels.marketSubtitle}<input maxLength={140} value={config.marketSubtitle} onChange={e=>update('marketSubtitle',e.target.value)}/></label><label>{labels.marketDelayMinutes}<select value={config.marketDelayMinutes} onChange={e=>update('marketDelayMinutes',Number(e.target.value))}><option value={0}>0 分钟</option><option value={15}>15 分钟</option><option value={30}>30 分钟</option><option value={60}>60 分钟</option></select></label></section>
      <section className="project-create-card"><div className="project-card-title"><div><span>前台功能开关</span><small>立即控制入口与模拟操作</small></div></div><div className="front-toggle-list">{switchFields.map(key=><label key={key} className="front-toggle"><span>{labels[key]}</span><input type="checkbox" checked={Boolean(config[key])} onChange={e=>update(key,e.target.checked as Config[typeof key])}/></label>)}</div></section>
      <section className="project-create-card"><div className="project-card-title"><div><span>时间合约规则</span><small>仅虚拟积分，规则会在下单接口校验</small></div></div><div className="front-choice-label">可选期限</div><div className="front-choice-list">{[10,30,60].map(duration=><label key={duration}><input type="checkbox" checked={config.contractDurations.includes(duration)} onChange={()=>toggleDuration(duration)}/>{duration} 秒</label>)}</div><label>正确预测模拟返还比例（%）<input type="number" min="1" max="200" value={config.contractPayoutPercent} onChange={e=>update('contractPayoutPercent',Number(e.target.value))}/></label></section>
      <section className="project-create-card"><div className="project-card-title"><div><span>USDT 流程演示规则</span><small>只记录模拟流水，不发起链上交易</small></div></div><div className="front-choice-label">可选演示网络</div><div className="front-choice-list">{networks.map(network=><label key={network}><input type="checkbox" checked={config.depositNetworks.includes(network)} onChange={()=>toggleNetwork(network)}/>{network}</label>)}</div><div className="project-form-pair"><label>最低提现金额<input type="number" min="1" max="100000" value={config.minimumWithdrawal} onChange={e=>update('minimumWithdrawal',Number(e.target.value))}/></label><label>模拟提现手续费<input type="number" min="0" max="100" step="0.01" value={config.withdrawalFee} onChange={e=>update('withdrawalFee',Number(e.target.value))}/></label></div></section></div>
      <button className="admin-primary front-save" disabled={busy}><Save size={14}/> {busy?'保存中…':'保存前台配置'}</button>
    </form>
    <section className="project-list-card forecast-config-card"><div className="project-card-title"><div><span>合约 ETF 与指数行情</span><small>可添加、修改、删除前台标的及指数卡片。字段含 symbol、name、last、change、volume、type、color、spark。</small></div></div><label className="front-json-label">ETF 标的 JSON<textarea className="forecast-json-editor" spellCheck={false} value={assetsJson} onChange={e=>setAssetsJson(e.target.value)}/></label><label className="front-json-label">指数卡片 JSON<textarea className="forecast-json-editor front-json-short" spellCheck={false} value={indicesJson} onChange={e=>setIndicesJson(e.target.value)}/></label></section>
    <section className="project-list-card forecast-config-card"><div className="project-card-title"><div><span>预测事件管理</span><small>可新增、修改或删除前台预测问题。每条需包含 id、category、question、description、consensus、horizon。</small></div></div><textarea className="forecast-json-editor" spellCheck={false} value={eventsJson} onChange={e=>setEventsJson(e.target.value)}/><div className="forecast-json-hint">JSON 数组，最多 40 条；概率填写 1–99。修改后前台会自动刷新。</div><button className="project-create-button front-save" type="button" onClick={()=>void saveEvents()} disabled={busy}><Save size={14}/> 发布预测事件</button></section>
    {notice&&<div className="project-notice">{notice}</div>}{error&&<div className="project-error admin-error">{error}</div>}<div className="admin-footnote"><Check size={13}/> 配置暂存于本地 API 进程内存，服务重启后恢复默认值。</div>
  </div>
}
