import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, Check, RefreshCw, Save, Settings2 } from 'lucide-react'

type Asset = { symbol: string; name: string; last: number; change: number; volume: string; type: string; color: string; spark: number[] }
type MarketIndex = { s: string; v: string; c: string; down?: boolean }
type UiText = Record<string, string>
type Config = {
  marketAssets: Asset[]; marketIndices: MarketIndex[]; uiText: UiText
  siteName: string; marketSubtitle: string; marketDelayMinutes: number
  homeTitle: string; equityContractTitle: string; equityContractSubtitle: string; timeContractTitle: string; timeContractSubtitle: string; predictionTitle: string; predictionSubtitle: string
  indexTitle: string; indexSubtitle: string; featuredTitle: string; featuredSubtitle: string
  demoProjectTitle: string; demoProjectSubtitle: string; orderDisclaimer: string
  showMarketOverview: boolean; showEquityContracts: boolean; showTimeContracts: boolean; showPrediction: boolean
  showDeposit: boolean; showWithdrawal: boolean; showKyc: boolean; demoOrdersEnabled: boolean
  showMarketPicks: boolean; showDemoProjects: boolean; showQuickOrder: boolean
  showWatchlistNav: boolean; showPositionsNav: boolean; showNewsNav: boolean; showCalendarNav: boolean; showHelpNav: boolean; showSettingsNav: boolean
  depositNetworks: string[]; minimumWithdrawal: number; withdrawalFee: number; maxEtfLeverage: number
  contractDurations: number[]; contractPayoutPercent: number; autoPayoutEnabled: boolean; payoutMinPercent: number; payoutMaxPercent: number; payoutSensitivity: number
}
type EventItem = { id: string; category: string; question: string; description: string; consensus: number; horizon: string; volume?: string; rewardPercent: number }
const labels: Record<keyof Config, string> = {
  marketAssets: 'ETF 行情', marketIndices: '指数行情', uiText: '前台导航和按钮文案',
  siteName: '前台站点名称', marketSubtitle: '市场概览副标题', marketDelayMinutes: '行情延迟（分钟）',
  homeTitle: '首页标题', equityContractTitle: '合约 ETF 标题', equityContractSubtitle: '合约 ETF 说明', timeContractTitle: '时间合约标题', timeContractSubtitle: '时间合约说明', predictionTitle: '预测系统标题', predictionSubtitle: '预测系统说明', indexTitle: '指数区标题', indexSubtitle: '指数区说明', featuredTitle: '市场精选标题', featuredSubtitle: '市场精选说明', demoProjectTitle: '模拟项目标题', demoProjectSubtitle: '模拟项目说明', orderDisclaimer: '下单风险提示',
  showMarketOverview: '市场概览', showEquityContracts: '合约 ETF', showTimeContracts: '时间合约', showPrediction: '预测系统',
  showDeposit: 'USDT 模拟充值', showWithdrawal: 'USDT 模拟提现', showKyc: 'KYC 入口', demoOrdersEnabled: '模拟下单',
  showMarketPicks: '首页市场精选区', showDemoProjects: '首页模拟项目区', showQuickOrder: '快速下单面板', showWatchlistNav: '自选列表入口', showPositionsNav: '持仓与订单入口', showNewsNav: '市场资讯入口', showCalendarNav: '经济日历入口', showHelpNav: '帮助中心入口', showSettingsNav: '设置入口',
  depositNetworks: '网络', minimumWithdrawal: '最低提现额', withdrawalFee: '提现演示手续费', maxEtfLeverage: '合约 ETF 最大杠杆', contractDurations: '合约期限', contractPayoutPercent: '基础模拟收益比例', autoPayoutEnabled: '按订单自动调整收益比例', payoutMinPercent: '最低收益比例', payoutMaxPercent: '最高收益比例', payoutSensitivity: '订单量调整灵敏度',
}
const uiTextLabels: Record<keyof Config['uiText'], string> = {
  workspaceTitle: '工作区标题', navMarket: '市场概览入口', navEquity: '合约 ETF 入口', navTime: '时间合约入口',
  navPrediction: '预测系统入口', navWatchlist: '自选列表入口', navPositions: '持仓与订单入口', navKyc: '身份认证入口',
  marketNavTitle: '市场分组标题', navNews: '市场资讯入口', navCalendar: '经济日历入口',
  riskTitle: '风险提示标题', riskText: '风险提示说明', riskAction: '风险提示按钮',
  navHelp: '帮助中心入口', navSettings: '设置入口', tradingStatus: '顶部交易状态',
  registerAction: '注册按钮', depositAction: '充值按钮', withdrawalAction: '提现按钮', netWorthAction: '账户净值按钮',
  temperatureTitle: '市场温度标签', featuredAction: '进入合约按钮', popularContracts: '热门合约标题',
  quickOrder: '快速下单标题', buyAction: '买入按钮', sellAction: '卖出按钮', riskDisclosure: '风险披露按钮',
}

export default function AdminFrontSettingsView({ adminKey }: { adminKey: string }) {
  const [config, setConfig] = useState<Config | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
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
      setEvents(result.forecastEvents)
    } catch (err) { setError(err instanceof Error ? err.message : '读取配置失败') }
    finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [adminKey])
  const update = <K extends keyof Config>(key: K, value: Config[K]) => setConfig(current => current ? { ...current, [key]: value } : current)
  const saveConfig = async (event: FormEvent) => {
    event.preventDefault(); if (!config) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/admin/front-config', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify(config) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '保存配置失败')
      setConfig(result.config); setNotice('前台配置已保存，网页会在几秒内同步更新。')
    } catch (err) { setError(err instanceof Error ? err.message : '保存配置失败') }
    finally { setBusy(false) }
  }
  const saveEvents = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/admin/forecast-events', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ events }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '保存事件失败')
      setEvents(result.events); setNotice('预测事件已发布到前台。')
    } catch (err) { setError(err instanceof Error ? err.message : '事件 JSON 格式有误') }
    finally { setBusy(false) }
  }
  if (!config) return <div className="admin-content"><div className="admin-title-row"><div><div className="admin-eyebrow"><i/> 前台运营</div><h1>前台配置</h1><p>管理前台模块、资金演示选项和合约参数。</p></div><button className="wallet-refresh" onClick={()=>void load()} disabled={busy}><RefreshCw size={14} className={busy?'spinning':''}/> 重试</button></div>{error&&<div className="project-error admin-error">{error}</div>}</div>

  const switchFields: (keyof Config)[] = ['showMarketOverview','showEquityContracts','showTimeContracts','showPrediction','showDeposit','showWithdrawal','showKyc','demoOrdersEnabled','showMarketPicks','showDemoProjects','showQuickOrder','showWatchlistNav','showPositionsNav','showNewsNav','showCalendarNav','showHelpNav','showSettingsNav','autoPayoutEnabled']
  const networks = ['TRC20','ERC20','Polygon']
  const toggleNetwork = (network: string) => update('depositNetworks', config.depositNetworks.includes(network) ? config.depositNetworks.filter(item=>item!==network) : [...config.depositNetworks,network])
  const addEvent = () => {
    if (events.length >= 40) { setError('预测问题最多添加 40 条。'); return }
    const id = `EVT-CUSTOM-${Date.now().toString(36).toUpperCase()}`
    const event: EventItem = { id, ...eventDraft, volume: '模拟参与 0 人' }
    setEvents(current => [...current, event])
    setEventDraft({ category: '美股', question: '', description: '', consensus: 50, horizon: '', rewardPercent: 80 })
    setError('')
  }
  const addDuration = () => {
    const duration = Number(durationInput)
    if (!Number.isInteger(duration) || duration < 5 || duration > 3600) { setError('期限需为 5–3600 秒之间的整数。'); return }
    if (config.contractDurations.includes(duration)) { setError('该期限已经添加。'); return }
    if (config.contractDurations.length >= 20) { setError('最多添加 20 个期限。'); return }
    setError(''); update('contractDurations', [...config.contractDurations, duration].sort((a,b)=>a-b))
  }
  const updateAsset = (index: number, patch: Partial<Asset>) => update('marketAssets', config.marketAssets.map((asset, itemIndex) => itemIndex === index ? { ...asset, ...patch } : asset))
  const updateIndex = (index: number, patch: Partial<MarketIndex>) => update('marketIndices', config.marketIndices.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  const addAsset = () => {
    if (config.marketAssets.length >= 40) { setError('前台标的最多 40 项。'); return }
    update('marketAssets', [...config.marketAssets, { symbol: `SIM${config.marketAssets.length + 1}`, name: '新标的', last: 100, change: 0, volume: '0', type: '模拟', color: '#84d6b2', spark: [20, 25, 30, 28, 35] }])
    setError('')
  }
  const addIndex = () => {
    if (config.marketIndices.length >= 10) { setError('指数卡片最多 10 项。'); return }
    update('marketIndices', [...config.marketIndices, { s: '新指数', v: '0.00', c: '+0.00%' }])
    setError('')
  }
  return <div className="admin-content front-config-content"><div className="admin-title-row"><div><div className="admin-eyebrow"><i/> 前台运营配置</div><h1>前台功能与内容</h1><p>保存后前台自动同步。关闭模块会隐藏对应入口，并由 API 一并拦截模拟操作。</p></div><button className="wallet-refresh" onClick={()=>void load()} disabled={busy}><RefreshCw size={14} className={busy?'spinning':''}/> 刷新</button></div>
    <div className="project-safety"><AlertTriangle size={15}/><span><b>模拟环境配置</b> · 行情快照可通过 Massive API Key 接入；充值、提现、ETF 下单和时间合约仍仅作用于本地演示系统，不会提交真实订单。</span></div>
    <form onSubmit={saveConfig}>
      <section className="project-create-card front-copy-card"><div className="project-card-title"><div><span>前台导航和按钮文案</span><small>直接填写前台显示的入口和按钮文字</small></div></div><div className="front-copy-grid">{Object.entries(uiTextLabels).map(([key,label])=><label key={key}>{label}<input maxLength={120} value={config.uiText[key]} onChange={event=>update('uiText',{...config.uiText,[key]:event.target.value})}/></label>)}</div></section>
      <div className="front-setting-grid"><section className="project-create-card"><div className="project-card-title"><div><span>站点显示与页面文案</span><small>可修改站点、首页与各模块标题说明</small></div><Settings2 size={16}/></div><label>{labels.siteName}<input maxLength={40} value={config.siteName} onChange={e=>update('siteName',e.target.value)}/></label><label>{labels.homeTitle}<input maxLength={140} value={config.homeTitle} onChange={e=>update('homeTitle',e.target.value)}/></label><label>{labels.marketSubtitle}<input maxLength={140} value={config.marketSubtitle} onChange={e=>update('marketSubtitle',e.target.value)}/></label><label>{labels.equityContractTitle}<input maxLength={140} value={config.equityContractTitle} onChange={e=>update('equityContractTitle',e.target.value)}/></label><label>{labels.equityContractSubtitle}<input maxLength={140} value={config.equityContractSubtitle} onChange={e=>update('equityContractSubtitle',e.target.value)}/></label><label>{labels.timeContractTitle}<input maxLength={140} value={config.timeContractTitle} onChange={e=>update('timeContractTitle',e.target.value)}/></label><label>{labels.timeContractSubtitle}<input maxLength={140} value={config.timeContractSubtitle} onChange={e=>update('timeContractSubtitle',e.target.value)}/></label><label>{labels.predictionTitle}<input maxLength={140} value={config.predictionTitle} onChange={e=>update('predictionTitle',e.target.value)}/></label><label>{labels.predictionSubtitle}<input maxLength={140} value={config.predictionSubtitle} onChange={e=>update('predictionSubtitle',e.target.value)}/></label><label>{labels.indexTitle}<input maxLength={140} value={config.indexTitle} onChange={e=>update('indexTitle',e.target.value)}/></label><label>{labels.indexSubtitle}<input maxLength={140} value={config.indexSubtitle} onChange={e=>update('indexSubtitle',e.target.value)}/></label><label>{labels.featuredTitle}<input maxLength={140} value={config.featuredTitle} onChange={e=>update('featuredTitle',e.target.value)}/></label><label>{labels.featuredSubtitle}<input maxLength={140} value={config.featuredSubtitle} onChange={e=>update('featuredSubtitle',e.target.value)}/></label><label>{labels.demoProjectTitle}<input maxLength={140} value={config.demoProjectTitle} onChange={e=>update('demoProjectTitle',e.target.value)}/></label><label>{labels.demoProjectSubtitle}<input maxLength={140} value={config.demoProjectSubtitle} onChange={e=>update('demoProjectSubtitle',e.target.value)}/></label><label>{labels.orderDisclaimer}<input maxLength={180} value={config.orderDisclaimer} onChange={e=>update('orderDisclaimer',e.target.value)}/></label><label>{labels.marketDelayMinutes}<select value={config.marketDelayMinutes} onChange={e=>update('marketDelayMinutes',Number(e.target.value))}><option value={0}>0 分钟</option><option value={15}>15 分钟</option><option value={30}>30 分钟</option><option value={60}>60 分钟</option></select></label></section>
      <section className="project-create-card"><div className="project-card-title"><div><span>前台功能与栏目开关</span><small>控制页面区块、导航入口与模拟操作</small></div></div><div className="front-toggle-list">{switchFields.map(key=><label key={key} className="front-toggle"><span>{labels[key]}</span><input type="checkbox" checked={Boolean(config[key])} onChange={e=>update(key,e.target.checked as Config[typeof key])}/></label>)}</div></section>
      <section className="project-create-card"><div className="project-card-title"><div><span>合约 ETF 杠杆</span><small>前台用户可在 1× 至后台上限之间自行调节</small></div></div><label>{labels.maxEtfLeverage}（1–100×）<input type="number" min="1" max="100" step="1" value={config.maxEtfLeverage} onChange={e=>update('maxEtfLeverage',Number(e.target.value))}/></label><div className="project-safety"><AlertTriangle size={14}/><span>仅影响模拟订单：下单保证金按数量与价格计算；名义金额及判赢后的模拟收益按所选倍数放大。</span></div></section>
      <section className="project-create-card"><div className="project-card-title"><div><span>时间合约规则</span><small>自定义期限；收益仅用于虚拟积分演示</small></div></div><div className="front-choice-label">当前可选期限（点击 × 删除）</div><div className="duration-chip-list">{config.contractDurations.map(duration=><button type="button" key={duration} onClick={()=>update('contractDurations',config.contractDurations.filter(item=>item!==duration))} disabled={config.contractDurations.length<=1}>{duration} 秒 <b>×</b></button>)}</div><label>添加期限（5–3600 秒）<div className="duration-add-row"><input type="number" min="5" max="3600" step="1" value={durationInput} onChange={e=>setDurationInput(e.target.value)}/><button type="button" onClick={addDuration}>添加期限</button></div></label><label>{labels.contractPayoutPercent}（%）<input type="number" min="1" max="200" value={config.contractPayoutPercent} onChange={e=>update('contractPayoutPercent',Number(e.target.value))}/></label><div className="project-form-pair"><label>{labels.payoutMinPercent}<input type="number" min="1" max="200" value={config.payoutMinPercent} onChange={e=>update('payoutMinPercent',Number(e.target.value))}/></label><label>{labels.payoutMaxPercent}<input type="number" min="1" max="200" value={config.payoutMaxPercent} onChange={e=>update('payoutMaxPercent',Number(e.target.value))}/></label></div><label>{labels.payoutSensitivity}（0–100）<input type="number" min="0" max="100" value={config.payoutSensitivity} onChange={e=>update('payoutSensitivity',Number(e.target.value))}/></label><div className="project-safety"><AlertTriangle size={14}/><span>自动模式按当前项目未结算订单的看涨/看跌虚拟积分分布调整下一笔订单的收益比例；少数方向比例上调、多数方向下调，并限制在最低/最高值内。</span></div></section>
      <section className="project-create-card"><div className="project-card-title"><div><span>USDT 流程演示规则</span><small>只记录模拟流水，不发起链上交易</small></div></div><div className="front-choice-label">可选演示网络</div><div className="front-choice-list">{networks.map(network=><label key={network}><input type="checkbox" checked={config.depositNetworks.includes(network)} onChange={()=>toggleNetwork(network)}/>{network}</label>)}</div><div className="project-form-pair"><label>最低提现金额<input type="number" min="1" max="100000" value={config.minimumWithdrawal} onChange={e=>update('minimumWithdrawal',Number(e.target.value))}/></label><label>模拟提现手续费<input type="number" min="0" max="100" step="0.01" value={config.withdrawalFee} onChange={e=>update('withdrawalFee',Number(e.target.value))}/></label></div></section></div>
      <button className="admin-primary front-save" disabled={busy}><Save size={14}/> {busy?'保存中…':'保存前台配置'}</button>
    </form>
    <section className="project-list-card forecast-config-card"><div className="project-card-title"><div><span>前台行情卡片</span><small>添加 ETF 代码；配置 Massive API Key 后价格自动同步，未配置时仅显示演示价格。</small></div><button type="button" className="project-create-button" onClick={addAsset}>添加标的</button></div><div className="front-managed-items">{config.marketAssets.map((asset,index)=><article className="front-managed-item" key={`${asset.symbol}-${index}`}><div className="project-form-pair"><label>代码<input value={asset.symbol} maxLength={12} onChange={e=>updateAsset(index,{symbol:e.target.value.toUpperCase()})}/></label><label>名称<input value={asset.name} maxLength={60} onChange={e=>updateAsset(index,{name:e.target.value})}/></label></div><div className="project-form-pair"><label>价格<input type="number" min="0.01" value={asset.last} onChange={e=>updateAsset(index,{last:Number(e.target.value)})}/></label><label>涨跌幅 %<input type="number" min="-500" max="500" step="0.01" value={asset.change} onChange={e=>updateAsset(index,{change:Number(e.target.value)})}/></label></div><div className="project-form-pair"><label>类型标签<input value={asset.type} maxLength={30} onChange={e=>updateAsset(index,{type:e.target.value})}/></label><label>成交量文案<input value={asset.volume} maxLength={20} onChange={e=>updateAsset(index,{volume:e.target.value})}/></label></div><div className="project-form-pair"><label>卡片颜色<input type="color" value={asset.color} onChange={e=>updateAsset(index,{color:e.target.value})}/></label><label>走势图点位（逗号分隔）<input value={asset.spark.join(',')} onChange={e=>updateAsset(index,{spark:e.target.value.split(',').map(Number).filter(Number.isFinite)})}/></label></div><button type="button" className="project-delete-button" disabled={config.marketAssets.length<=1} onClick={()=>update('marketAssets',config.marketAssets.filter((_,itemIndex)=>itemIndex!==index))}>移除标的</button></article>)}</div><div className="project-card-title front-index-title"><div><span>首页指数卡片</span><small>修改指数名称、显示值、涨跌文案和颜色方向。</small></div><button type="button" className="project-create-button" onClick={addIndex}>添加指数</button></div><div className="front-managed-items">{config.marketIndices.map((item,index)=><article className="front-managed-item" key={`${item.s}-${index}`}><div className="project-form-pair"><label>指数名称<input value={item.s} maxLength={30} onChange={e=>updateIndex(index,{s:e.target.value})}/></label><label>显示值<input value={item.v} maxLength={24} onChange={e=>updateIndex(index,{v:e.target.value})}/></label></div><div className="project-form-pair"><label>涨跌文案<input value={item.c} maxLength={24} onChange={e=>updateIndex(index,{c:e.target.value})}/></label><label className="front-toggle"><span>显示为下跌</span><input type="checkbox" checked={Boolean(item.down)} onChange={e=>updateIndex(index,{down:e.target.checked})}/></label></div><button type="button" className="project-delete-button" onClick={()=>update('marketIndices',config.marketIndices.filter((_,itemIndex)=>itemIndex!==index))}>移除指数</button></article>)}</div></section>
    <section className="project-list-card forecast-config-card"><div className="project-card-title"><div><span>预测事件与收益比例</span><small>表单编辑预测内容；最多 40 条，保存后同步到前台。</small></div></div><div className="front-event-builder"><label>分类<input value={eventDraft.category} onChange={e=>setEventDraft({...eventDraft,category:e.target.value})}/></label><label>预测问题<input value={eventDraft.question} onChange={e=>setEventDraft({...eventDraft,question:e.target.value})} placeholder="例如：某指数本周收涨？"/></label><label>说明<input value={eventDraft.description} onChange={e=>setEventDraft({...eventDraft,description:e.target.value})}/></label><label>结算时间<input value={eventDraft.horizon} onChange={e=>setEventDraft({...eventDraft,horizon:e.target.value})} placeholder="例如：本周五收盘"/></label><div className="front-event-numbers"><label>共识概率（%）<input type="number" min="1" max="99" value={eventDraft.consensus} onChange={e=>setEventDraft({...eventDraft,consensus:Number(e.target.value)})}/></label><label>演示收益比例（%）<input type="number" min="1" max="200" value={eventDraft.rewardPercent} onChange={e=>setEventDraft({...eventDraft,rewardPercent:Number(e.target.value)})}/></label></div><button className="project-create-button front-save" type="button" onClick={addEvent} disabled={!eventDraft.question.trim()||!eventDraft.horizon.trim()}><Settings2 size={14}/> 添加预测问题</button></div><div className="front-managed-items">{events.map((item,index)=><article className="front-managed-item" key={item.id}><div className="project-form-pair"><label>分类<input value={item.category} onChange={e=>setEvents(current=>current.map((event,i)=>i===index?{...event,category:e.target.value}:event))}/></label><label>结算时间<input value={item.horizon} onChange={e=>setEvents(current=>current.map((event,i)=>i===index?{...event,horizon:e.target.value}:event))}/></label></div><label>预测问题<input value={item.question} maxLength={120} onChange={e=>setEvents(current=>current.map((event,i)=>i===index?{...event,question:e.target.value}:event))}/></label><label>说明<input value={item.description} maxLength={280} onChange={e=>setEvents(current=>current.map((event,i)=>i===index?{...event,description:e.target.value}:event))}/></label><div className="project-form-pair"><label>共识概率 %<input type="number" min="1" max="99" value={item.consensus} onChange={e=>setEvents(current=>current.map((event,i)=>i===index?{...event,consensus:Number(e.target.value)}:event))}/></label><label>演示收益比例 %<input type="number" min="1" max="200" value={item.rewardPercent} onChange={e=>setEvents(current=>current.map((event,i)=>i===index?{...event,rewardPercent:Number(e.target.value)}:event))}/></label></div><button type="button" className="project-delete-button" onClick={()=>setEvents(current=>current.filter((_,i)=>i!==index))}>删除预测事件</button></article>)}</div><button className="project-create-button front-save" type="button" onClick={()=>void saveEvents()} disabled={busy}><Save size={14}/> 保存预测事件</button></section>
    {notice&&<div className="project-notice">{notice}</div>}{error&&<div className="project-error admin-error">{error}</div>}<div className="admin-footnote"><Check size={13}/> 配置暂存于本地 API 进程内存，服务重启后恢复默认值。</div>
  </div>
}
