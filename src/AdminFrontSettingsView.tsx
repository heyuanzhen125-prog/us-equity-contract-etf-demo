import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, Check, RefreshCw, Save, Settings2 } from 'lucide-react'

type Config = {
  marketAssets: any[]; marketIndices: any[]
  siteName: string; marketSubtitle: string; marketDelayMinutes: number
  homeTitle: string; equityContractTitle: string; equityContractSubtitle: string; timeContractTitle: string; timeContractSubtitle: string; predictionTitle: string; predictionSubtitle: string
  indexTitle: string; indexSubtitle: string; featuredTitle: string; featuredSubtitle: string
  demoProjectTitle: string; demoProjectSubtitle: string; orderDisclaimer: string
  showMarketOverview: boolean; showEquityContracts: boolean; showTimeContracts: boolean; showPrediction: boolean
  showDeposit: boolean; showWithdrawal: boolean; showKyc: boolean; demoOrdersEnabled: boolean
  showMarketPicks: boolean; showDemoProjects: boolean; showQuickOrder: boolean
  showWatchlistNav: boolean; showPositionsNav: boolean; showNewsNav: boolean; showCalendarNav: boolean; showHelpNav: boolean; showSettingsNav: boolean
  depositNetworks: string[]; minimumWithdrawal: number; withdrawalFee: number
  contractDurations: number[]; contractPayoutPercent: number; autoPayoutEnabled: boolean; payoutMinPercent: number; payoutMaxPercent: number; payoutSensitivity: number
}
type EventItem = { id: string; category: string; question: string; description: string; consensus: number; horizon: string; volume?: string; rewardPercent: number }
const labels: Record<keyof Config, string> = {
  marketAssets: 'ETF 行情', marketIndices: '指数行情',
  siteName: '前台站点名称', marketSubtitle: '市场概览副标题', marketDelayMinutes: '行情延迟（分钟）',
  homeTitle: '首页标题', equityContractTitle: '合约 ETF 标题', equityContractSubtitle: '合约 ETF 说明', timeContractTitle: '时间合约标题', timeContractSubtitle: '时间合约说明', predictionTitle: '预测系统标题', predictionSubtitle: '预测系统说明', indexTitle: '指数区标题', indexSubtitle: '指数区说明', featuredTitle: '市场精选标题', featuredSubtitle: '市场精选说明', demoProjectTitle: '模拟项目标题', demoProjectSubtitle: '模拟项目说明', orderDisclaimer: '下单风险提示',
  showMarketOverview: '市场概览', showEquityContracts: '合约 ETF', showTimeContracts: '时间合约', showPrediction: '预测系统',
  showDeposit: 'USDT 模拟充值', showWithdrawal: 'USDT 模拟提现', showKyc: 'KYC 入口', demoOrdersEnabled: '模拟下单',
  showMarketPicks: '首页市场精选区', showDemoProjects: '首页模拟项目区', showQuickOrder: '快速下单面板', showWatchlistNav: '自选列表入口', showPositionsNav: '持仓与订单入口', showNewsNav: '市场资讯入口', showCalendarNav: '经济日历入口', showHelpNav: '帮助中心入口', showSettingsNav: '设置入口',
  depositNetworks: '网络', minimumWithdrawal: '最低提现额', withdrawalFee: '提现演示手续费', contractDurations: '合约期限', contractPayoutPercent: '基础模拟收益比例', autoPayoutEnabled: '按订单自动调整收益比例', payoutMinPercent: '最低收益比例', payoutMaxPercent: '最高收益比例', payoutSensitivity: '订单量调整灵敏度',
}

export default function AdminFrontSettingsView({ adminKey }: { adminKey: string }) {
  const [config, setConfig] = useState<Config | null>(null)
  const [eventsJson, setEventsJson] = useState('[]')
  const [assetsJson, setAssetsJson] = useState('[]')
  const [indicesJson, setIndicesJson] = useState('[]')
  const [durationInput, setDurationInput] = useState('120')
  const [eventDraft, setEventDraft] = useState({ category: '美股', question: '', description: '', consensus: 50, horizon: '', rewardPercent: 80 })
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

  const switchFields: (keyof Config)[] = ['showMarketOverview','showEquityContracts','showTimeContracts','showPrediction','showDeposit','showWithdrawal','showKyc','demoOrdersEnabled','showMarketPicks','showDemoProjects','showQuickOrder','showWatchlistNav','showPositionsNav','showNewsNav','showCalendarNav','showHelpNav','showSettingsNav','autoPayoutEnabled']
  const networks = ['TRC20','ERC20','Polygon']
  const toggleNetwork = (network: string) => update('depositNetworks', config.depositNetworks.includes(network) ? config.depositNetworks.filter(item=>item!==network) : [...config.depositNetworks,network])
  const addEvent = () => {
    try {
      const current = JSON.parse(eventsJson) as EventItem[]
      if (current.length >= 40) { setError('预测问题最多添加 40 条。'); return }
      const id = `EVT-CUSTOM-${Date.now().toString(36).toUpperCase()}`
      const event: EventItem = { id, ...eventDraft, volume: '模拟参与 0 人' }
      setEventsJson(JSON.stringify([...current, event], null, 2)); setEventDraft({ category: '美股', question: '', description: '', consensus: 50, horizon: '', rewardPercent: 80 }); setError('')
    } catch { setError('当前预测列表 JSON 格式有误，请先修正后再添加。') }
  }
  const addDuration = () => {
    const duration = Number(durationInput)
    if (!Number.isInteger(duration) || duration < 5 || duration > 3600) { setError('期限需为 5–3600 秒之间的整数。'); return }
    if (config.contractDurations.includes(duration)) { setError('该期限已经添加。'); return }
    if (config.contractDurations.length >= 20) { setError('最多添加 20 个期限。'); return }
    setError(''); update('contractDurations', [...config.contractDurations, duration].sort((a,b)=>a-b))
  }
  return <div className="admin-content front-config-content"><div className="admin-title-row"><div><div className="admin-eyebrow"><i/> 前台运营配置</div><h1>前台功能与内容</h1><p>保存后前台自动同步。关闭模块会隐藏对应入口，并由 API 一并拦截模拟操作。</p></div><button className="wallet-refresh" onClick={()=>void load()} disabled={busy}><RefreshCw size={14} className={busy?'spinning':''}/> 刷新</button></div>
    <div className="project-safety"><AlertTriangle size={15}/><span><b>模拟环境配置</b> · 充值、提现、ETF 下单和时间合约只作用于本地演示系统；这些开关不会连接真实钱包或券商。</span></div>
    <form onSubmit={saveConfig}>
      <div className="front-setting-grid"><section className="project-create-card"><div className="project-card-title"><div><span>站点显示与页面文案</span><small>可修改站点、首页与各模块标题说明</small></div><Settings2 size={16}/></div><label>{labels.siteName}<input maxLength={40} value={config.siteName} onChange={e=>update('siteName',e.target.value)}/></label><label>{labels.homeTitle}<input maxLength={140} value={config.homeTitle} onChange={e=>update('homeTitle',e.target.value)}/></label><label>{labels.marketSubtitle}<input maxLength={140} value={config.marketSubtitle} onChange={e=>update('marketSubtitle',e.target.value)}/></label><label>{labels.equityContractTitle}<input maxLength={140} value={config.equityContractTitle} onChange={e=>update('equityContractTitle',e.target.value)}/></label><label>{labels.equityContractSubtitle}<input maxLength={140} value={config.equityContractSubtitle} onChange={e=>update('equityContractSubtitle',e.target.value)}/></label><label>{labels.timeContractTitle}<input maxLength={140} value={config.timeContractTitle} onChange={e=>update('timeContractTitle',e.target.value)}/></label><label>{labels.timeContractSubtitle}<input maxLength={140} value={config.timeContractSubtitle} onChange={e=>update('timeContractSubtitle',e.target.value)}/></label><label>{labels.predictionTitle}<input maxLength={140} value={config.predictionTitle} onChange={e=>update('predictionTitle',e.target.value)}/></label><label>{labels.predictionSubtitle}<input maxLength={140} value={config.predictionSubtitle} onChange={e=>update('predictionSubtitle',e.target.value)}/></label><label>{labels.indexTitle}<input maxLength={140} value={config.indexTitle} onChange={e=>update('indexTitle',e.target.value)}/></label><label>{labels.indexSubtitle}<input maxLength={140} value={config.indexSubtitle} onChange={e=>update('indexSubtitle',e.target.value)}/></label><label>{labels.featuredTitle}<input maxLength={140} value={config.featuredTitle} onChange={e=>update('featuredTitle',e.target.value)}/></label><label>{labels.featuredSubtitle}<input maxLength={140} value={config.featuredSubtitle} onChange={e=>update('featuredSubtitle',e.target.value)}/></label><label>{labels.demoProjectTitle}<input maxLength={140} value={config.demoProjectTitle} onChange={e=>update('demoProjectTitle',e.target.value)}/></label><label>{labels.demoProjectSubtitle}<input maxLength={140} value={config.demoProjectSubtitle} onChange={e=>update('demoProjectSubtitle',e.target.value)}/></label><label>{labels.orderDisclaimer}<input maxLength={180} value={config.orderDisclaimer} onChange={e=>update('orderDisclaimer',e.target.value)}/></label><label>{labels.marketDelayMinutes}<select value={config.marketDelayMinutes} onChange={e=>update('marketDelayMinutes',Number(e.target.value))}><option value={0}>0 分钟</option><option value={15}>15 分钟</option><option value={30}>30 分钟</option><option value={60}>60 分钟</option></select></label></section>
      <section className="project-create-card"><div className="project-card-title"><div><span>前台功能与栏目开关</span><small>控制页面区块、导航入口与模拟操作</small></div></div><div className="front-toggle-list">{switchFields.map(key=><label key={key} className="front-toggle"><span>{labels[key]}</span><input type="checkbox" checked={Boolean(config[key])} onChange={e=>update(key,e.target.checked as Config[typeof key])}/></label>)}</div></section>
      <section className="project-create-card"><div className="project-card-title"><div><span>时间合约规则</span><small>自定义期限；收益仅用于虚拟积分演示</small></div></div><div className="front-choice-label">当前可选期限（点击 × 删除）</div><div className="duration-chip-list">{config.contractDurations.map(duration=><button type="button" key={duration} onClick={()=>update('contractDurations',config.contractDurations.filter(item=>item!==duration))} disabled={config.contractDurations.length<=1}>{duration} 秒 <b>×</b></button>)}</div><label>添加期限（5–3600 秒）<div className="duration-add-row"><input type="number" min="5" max="3600" step="1" value={durationInput} onChange={e=>setDurationInput(e.target.value)}/><button type="button" onClick={addDuration}>添加期限</button></div></label><label>{labels.contractPayoutPercent}（%）<input type="number" min="1" max="200" value={config.contractPayoutPercent} onChange={e=>update('contractPayoutPercent',Number(e.target.value))}/></label><div className="project-form-pair"><label>{labels.payoutMinPercent}<input type="number" min="1" max="200" value={config.payoutMinPercent} onChange={e=>update('payoutMinPercent',Number(e.target.value))}/></label><label>{labels.payoutMaxPercent}<input type="number" min="1" max="200" value={config.payoutMaxPercent} onChange={e=>update('payoutMaxPercent',Number(e.target.value))}/></label></div><label>{labels.payoutSensitivity}（0–100）<input type="number" min="0" max="100" value={config.payoutSensitivity} onChange={e=>update('payoutSensitivity',Number(e.target.value))}/></label><div className="project-safety"><AlertTriangle size={14}/><span>自动模式按当前项目未结算订单的看涨/看跌虚拟积分分布调整下一笔订单的收益比例；少数方向比例上调、多数方向下调，并限制在最低/最高值内。</span></div></section>
      <section className="project-create-card"><div className="project-card-title"><div><span>USDT 流程演示规则</span><small>只记录模拟流水，不发起链上交易</small></div></div><div className="front-choice-label">可选演示网络</div><div className="front-choice-list">{networks.map(network=><label key={network}><input type="checkbox" checked={config.depositNetworks.includes(network)} onChange={()=>toggleNetwork(network)}/>{network}</label>)}</div><div className="project-form-pair"><label>最低提现金额<input type="number" min="1" max="100000" value={config.minimumWithdrawal} onChange={e=>update('minimumWithdrawal',Number(e.target.value))}/></label><label>模拟提现手续费<input type="number" min="0" max="100" step="0.01" value={config.withdrawalFee} onChange={e=>update('withdrawalFee',Number(e.target.value))}/></label></div></section></div>
      <button className="admin-primary front-save" disabled={busy}><Save size={14}/> {busy?'保存中…':'保存前台配置'}</button>
    </form>
    <section className="project-list-card forecast-config-card"><div className="project-card-title"><div><span>合约 ETF 与指数行情</span><small>可添加、修改、删除前台标的及指数卡片。字段含 symbol、name、last、change、volume、type、color、spark。</small></div></div><label className="front-json-label">ETF 标的 JSON<textarea className="forecast-json-editor" spellCheck={false} value={assetsJson} onChange={e=>setAssetsJson(e.target.value)}/></label><label className="front-json-label">指数卡片 JSON<textarea className="forecast-json-editor front-json-short" spellCheck={false} value={indicesJson} onChange={e=>setIndicesJson(e.target.value)}/></label></section>
    <section className="project-list-card forecast-config-card"><div className="project-card-title"><div><span>预测事件与收益比例</span><small>新增预测问题并设置每条的演示收益比例。预测系统记录概率判断，不扣虚拟积分或自动结算。</small></div></div><div className="front-event-builder"><label>分类<input value={eventDraft.category} onChange={e=>setEventDraft({...eventDraft,category:e.target.value})}/></label><label>预测问题<input value={eventDraft.question} onChange={e=>setEventDraft({...eventDraft,question:e.target.value})} placeholder="例如：某指数本周收涨？"/></label><label>说明<input value={eventDraft.description} onChange={e=>setEventDraft({...eventDraft,description:e.target.value})}/></label><label>结算时间<input value={eventDraft.horizon} onChange={e=>setEventDraft({...eventDraft,horizon:e.target.value})} placeholder="例如：本周五收盘"/></label><div className="front-event-numbers"><label>共识概率（%）<input type="number" min="1" max="99" value={eventDraft.consensus} onChange={e=>setEventDraft({...eventDraft,consensus:Number(e.target.value)})}/></label><label>演示收益比例（%）<input type="number" min="1" max="200" value={eventDraft.rewardPercent} onChange={e=>setEventDraft({...eventDraft,rewardPercent:Number(e.target.value)})}/></label></div><button className="project-create-button front-save" type="button" onClick={addEvent} disabled={!eventDraft.question.trim()||!eventDraft.horizon.trim()}><Settings2 size={14}/> 添加预测问题</button></div><textarea className="forecast-json-editor" spellCheck={false} value={eventsJson} onChange={e=>setEventsJson(e.target.value)}/><div className="forecast-json-hint">可在 JSON 中继续编辑或删除条目；最多 40 条。共识概率 1–99%，演示收益比例 1–200%。点发布后前台自动同步。</div><button className="project-create-button front-save" type="button" onClick={()=>void saveEvents()} disabled={busy}><Save size={14}/> 发布预测事件</button></section>
    {notice&&<div className="project-notice">{notice}</div>}{error&&<div className="project-error admin-error">{error}</div>}<div className="admin-footnote"><Check size={13}/> 配置暂存于本地 API 进程内存，服务重启后恢复默认值。</div>
  </div>
}
