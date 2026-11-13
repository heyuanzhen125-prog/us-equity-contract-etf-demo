import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ArrowUpRight, Check, CircleHelp, Clock3, LockKeyhole, TrendingUp } from 'lucide-react'
import { useVisiblePolling } from './useVisiblePolling'

type Forecast = { id: string; personalId: string; eventId: string; probability: number; choice?: 'YES' | 'NO'; rationale: string; stake: number; rewardPercent: number; status: 'pending' | 'won' | 'lost'; result: 'won' | 'lost' | null; payout: number | null; profit: number | null; updatedAt: string; settledAt: string | null }
type Event = { id: string; category: string; question: string; description: string; consensus: number; marketProbability?: number | null; predictionCount?: number; horizon: string; volume: string; rewardPercent: number; sourceExchange?: string; sourceUrl?: string; sourceProbability?: number; externalMarketId?: string }
type ExchangeEvent = { id: string; platformEventId: string; exchange: string; category: string; question: string; probability: number; volume: number; endTime: string | null; url: string }

async function readPredictionJson<T>(response: Response, label: string): Promise<T> {
  const text = await response.text()
  let data: T
  try { data = JSON.parse(text) as T }
  catch { throw new Error(`${label}接口返回非 JSON（HTTP ${response.status}，${window.location.hostname}），请刷新后重试`) }
  if (!response.ok) throw new Error((data as { error?: string })?.error || `${label}请求失败（HTTP ${response.status}）`)
  return data
}


export default function PredictionMarketPanel({ personalId, onRegister, notify, events, title, subtitle }: { personalId: string; onRegister: () => void; notify: (message: string) => void; events: Event[]; title: string; subtitle: string }) {
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [choices, setChoices] = useState<Record<string, 'YES' | 'NO' | null>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [stakes, setStakes] = useState<Record<string, number>>({})
  const [balance, setBalance] = useState(10000)
  const [saving, setSaving] = useState<string | null>(null)
  const [category, setCategory] = useState('全部')
  const [exchangeEvents, setExchangeEvents] = useState<ExchangeEvent[]>([])
  const [exchangeSources, setExchangeSources] = useState<Record<string, boolean>>({})
  const [exchangeUpdatedAt, setExchangeUpdatedAt] = useState('')
  const [exchangeUnavailable, setExchangeUnavailable] = useState(false)
  const [showAllEvents, setShowAllEvents] = useState(false)
  const initialized = useRef(false)
  const allEvents = useMemo(() => {
    const synced: Event[] = exchangeEvents.map(item => ({ id: item.platformEventId, category: item.category, question: item.question, description: `同步自 ${item.exchange} · 参考概率 ${item.probability}% · 本平台虚拟积分交易`, consensus: item.probability, marketProbability: item.probability, predictionCount: 0, horizon: item.endTime ? new Date(item.endTime).toLocaleString() : '交易所市场开放中', volume: `交易所 24h ${Math.round(item.volume).toLocaleString()}`, rewardPercent: 80, sourceExchange: item.exchange, sourceUrl: item.url, sourceProbability: item.probability, externalMarketId: item.id }))
    const localIds = new Set(events.map(event => event.id))
    return [...events, ...synced.filter(item => !localIds.has(item.id))]
  }, [events, exchangeEvents])
  const categories = ['全部', ...new Set(allEvents.map(event => event.category))]
  const visible = category === '全部' ? allEvents : allEvents.filter(event => event.category === category)
  const displayedEvents = showAllEvents ? visible : visible.slice(0, 6)

  useEffect(() => { setNotes(current => ({ ...Object.fromEntries(allEvents.map(event => [event.id, current[event.id] ?? ''])), ...current })) }, [allEvents])

  useEffect(() => {
    initialized.current = false
    if (!personalId) { setForecasts([]); setBalance(10000) }
  }, [personalId])
  useVisiblePolling(async signal => {
    try {
      const response = await fetch('/api/exchange-events', { signal })
      const result = await readPredictionJson<{ items?: ExchangeEvent[]; sources?: Record<string, boolean>; updatedAt?: string }>(response, '交易所事件行情')
      setExchangeEvents(Array.isArray(result.items) ? result.items : [])
      setExchangeSources(result.sources || {})
      setExchangeUpdatedAt(result.updatedAt || '')
      setExchangeUnavailable(!Object.values(result.sources || {}).some(Boolean))
    } catch (error) {
      if (!signal.aborted) { setExchangeUnavailable(true); console.warn('Unable to refresh exchange event feed', error) }
    }
  }, 60000, true, [])
  useVisiblePolling(async signal => {
    if (!personalId) return
    try {
      const identityQuery = import.meta.env.DEV ? `?personalId=${encodeURIComponent(personalId)}` : ''
      const response = await fetch(`/api/forecasts${identityQuery}`, { signal })
      const result = await readPredictionJson<{ forecasts?: Forecast[]; balance?: number }>(response, '个人预测记录')
      const rows: Forecast[] = result.forecasts || []
      setForecasts(rows)
      setBalance(result.balance ?? 10000)
      if (!initialized.current) {
        setChoices(current => ({ ...current, ...Object.fromEntries(rows.map(row => [row.eventId, row.choice || (row.probability >= 50 ? 'YES' : 'NO')])) }))
        setNotes(current => ({ ...current, ...Object.fromEntries(rows.map(row => [row.eventId, row.rationale])) }))
        setStakes(current => ({ ...current, ...Object.fromEntries(rows.map(row => [row.eventId, row.stake])) }))
        initialized.current = true
      }
    } catch (error) {
      if (!signal.aborted) console.error('Unable to refresh forecasts', error)
    }
  }, 2000, Boolean(personalId), [personalId])

  const save = async (event: Event) => {
    if (!personalId) { onRegister(); notify('请先注册账户，预测将绑定到个人 ID'); return }
    const choice = choices[event.id]
    if (!choice) { notify('请先选择 YES 或 NO'); return }
    const saved = forecasts.find(row => row.eventId === event.id)
    if (saved && saved.status !== 'pending') { notify('该预测已结算，不能修改或重复投入'); return }
    setSaving(event.id)
    try {
      const response = await fetch('/api/forecasts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(import.meta.env.DEV ? { personalId } : {}), eventId: event.id, choice, probability: choice === 'YES' ? 75 : 25, rationale: notes[event.id] || '', stake: saved?.stake ?? stakes[event.id] ?? 100 }) })
      const result = await readPredictionJson<{ forecast: Forecast; balance: number }>(response, '保存事件预测')
      setForecasts(current => [result.forecast, ...current.filter(row => row.eventId !== event.id)])
      setChoices(current => ({ ...current, [event.id]: result.forecast.choice || choice }))
      setBalance(result.balance)
      setStakes(current => ({ ...current, [event.id]: result.forecast.stake }))
      notify(result.forecast.status === 'pending' ? '预测已保存，投入的虚拟积分等待后台结算' : `预测已由后台虚拟规则结算：${result.forecast.status === 'won' ? '赢' : '输'}`)
    } catch (error) { notify(error instanceof Error ? error.message : '预测服务暂不可用') }
    finally { setSaving(null) }
  }

  return <section className="forecast-panel">
    <div className="forecast-intro"><div><div className="forecast-kicker"><Activity size={13}/> FORECAST WORKSPACE</div><h2>{title}</h2><p>{subtitle} 此模块使用虚拟积分，不涉及真实资金。</p></div><div className="forecast-account"><LockKeyhole size={14}/><span>{personalId ? `绑定个人 ID · ${personalId}` : '注册后可保存个人预测'}</span></div></div>
    <div className="forecast-disclaimer"><CircleHelp size={15}/><span>本地事件按 CPMM 模型随虚拟积分参与更新概率；交易所同步事件显示其 YES 市场概率。平台内订单使用 PTS，由后台虚拟规则结算，不会发往交易所。</span></div>
    {personalId && <div className="forecast-balance">虚拟积分余额 <b>{balance.toLocaleString('en-US')} PTS</b></div>}
    <div className="forecast-toolbar"><div className="forecast-filters">{categories.map(item => <button className={category===item?'selected':''} key={item} onClick={()=>{setCategory(item);setShowAllEvents(false)}}>{item}</button>)}</div><span><Clock3 size={12}/>{['Kalshi','Polymarket'].map(source=>`${source}${exchangeSources[source]?'已同步':'同步中'}`).join(' · ')} · {exchangeUpdatedAt?new Date(exchangeUpdatedAt).toLocaleTimeString():'每分钟刷新'}</span></div>
    {allEvents.length===0?<div className="forecast-empty">{exchangeUnavailable?'交易所暂时无法同步，后台发布的虚拟事件仍可用。':'正在同步二元事件；后台发布的虚拟事件也会显示在这里。'}</div>:<><div className="forecast-grid">{displayedEvents.map(event => { const saved = forecasts.find(row => row.eventId === event.id); const predictionCount = event.predictionCount ?? 0; const marketProbability = event.marketProbability ?? event.consensus; return <article className="forecast-card" key={event.id}>
      <div className="forecast-card-top"><span>{event.sourceExchange ? `${event.sourceExchange} · ${event.category}` : event.category}</span><small><TrendingUp size={12}/> {predictionCount ? `${predictionCount} 人已预测` : event.sourceExchange ? '交易所同步事件' : '后台起始概率'}</small></div><h3>{event.question}</h3><p>{event.description}</p><div className="forecast-reward"><span>{event.sourceExchange ? '本平台虚拟收益比例' : '虚拟收益比例'}</span><b>+{event.rewardPercent}%</b></div><div className="forecast-progress"><div><span>{event.sourceExchange ? `${event.sourceExchange} 参考概率` : predictionCount ? 'CPMM 市场概率' : '后台起始概率'}</span><b>{marketProbability}%</b></div><div className="forecast-track"><i style={{ width: `${marketProbability}%` }}/></div></div>
      <div className="forecast-choice-field"><span>我的方向选择</span><div className="forecast-choice-buttons"><button type="button" className={choices[event.id]==='YES'?'yes selected':''} disabled={saved?.status !== undefined && saved.status !== 'pending'} onClick={()=>setChoices(current=>({...current,[event.id]:'YES'}))}>YES</button><button type="button" className={choices[event.id]==='NO'?'no selected':''} disabled={saved?.status !== undefined && saved.status !== 'pending'} onClick={()=>setChoices(current=>({...current,[event.id]:'NO'}))}>NO</button></div></div>
      <label className="forecast-note-label">判断依据（选填）<textarea rows={2} maxLength={280} value={notes[event.id]||''} disabled={saved?.status !== undefined && saved.status !== 'pending'} onChange={e=>setNotes(current=>({...current,[event.id]:e.target.value}))} placeholder="记录你参考的数据或理由，最多 280 字"/></label>
      <label className="forecast-stake">投入虚拟积分{saved && <span>{saved.stake} PTS 已投入</span>}<input type="number" min="10" max="1000" step="10" value={saved?.stake ?? stakes[event.id] ?? 100} disabled={Boolean(saved)} onChange={e=>setStakes(current=>({...current,[event.id]:Number(e.target.value)}))}/></label>
      <div className="forecast-card-footer"><span><Clock3 size={12}/> {event.horizon}{saved && <strong className={`forecast-result ${saved.status}`}>{saved.status==='pending'?'待结算':saved.status==='won'?'已赢':'已输'}</strong>}</span><button onClick={()=>void save(event)} disabled={saving===event.id||saved?.status==='won'||saved?.status==='lost'}>{saving===event.id?'保存中…':saved?<><Check size={13}/> 已保存</>:'保存并投入'} <ArrowUpRight size={13}/></button></div>
      <small className="forecast-meta">{event.sourceExchange ? `来源：${event.sourceExchange} · 交易发生在本平台虚拟积分账户 · 外部事件结果由后台结算` : predictionCount ? `CPMM 虚拟报价 · ${predictionCount} 笔预测` : '暂无用户交易，显示后台设置的起始概率'}{saved?` · 投入 ${saved.stake} PTS · ${saved.status==='pending'?'等待后台结果':`${saved.status==='won'?'赢':'输'} · ${saved.profit && saved.profit > 0 ? '+' : ''}${saved.profit ?? 0} PTS`}`:''}</small>
    </article>})}</div>{visible.length>6&&<button className="forecast-more" onClick={()=>setShowAllEvents(value=>!value)}>{showAllEvents?'收起':'查看更多事件'} · {visible.length} 个市场</button>}</>}
  </section>
}
