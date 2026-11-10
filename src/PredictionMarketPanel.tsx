import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowUpRight, Check, CircleHelp, Clock3, LockKeyhole, TrendingUp } from 'lucide-react'
import { useVisiblePolling } from './useVisiblePolling'

type Forecast = { id: string; personalId: string; eventId: string; probability: number; rationale: string; stake: number; rewardPercent: number; status: 'pending' | 'won' | 'lost'; result: 'won' | 'lost' | null; payout: number | null; profit: number | null; updatedAt: string; settledAt: string | null }
type Event = { id: string; category: string; question: string; description: string; consensus: number; horizon: string; volume: string; rewardPercent: number }


export default function PredictionMarketPanel({ personalId, onRegister, notify, events, title, subtitle }: { personalId: string; onRegister: () => void; notify: (message: string) => void; events: Event[]; title: string; subtitle: string }) {
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [values, setValues] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [stakes, setStakes] = useState<Record<string, number>>({})
  const [balance, setBalance] = useState(10000)
  const [saving, setSaving] = useState<string | null>(null)
  const [category, setCategory] = useState('全部')
  const initialized = useRef(false)
  const categories = ['全部', ...new Set(events.map(event => event.category))]
  const visible = category === '全部' ? events : events.filter(event => event.category === category)

  useEffect(() => { setValues(current => Object.fromEntries(events.map(event => [event.id, current[event.id] ?? event.consensus]))); setNotes(current => Object.fromEntries(events.map(event => [event.id, current[event.id] ?? '']))) }, [events])

  useEffect(() => {
    initialized.current = false
    if (!personalId) { setForecasts([]); setBalance(10000) }
  }, [personalId])
  useVisiblePolling(async signal => {
    if (!personalId) return
    try {
      const response = await fetch(`/api/forecasts?personalId=${encodeURIComponent(personalId)}`, { signal })
      if (!response.ok) return
      const result = await response.json()
      const rows: Forecast[] = result.forecasts || []
      setForecasts(rows)
      setBalance(result.balance ?? 10000)
      if (!initialized.current) {
        setValues(current => ({ ...current, ...Object.fromEntries(rows.map(row => [row.eventId, row.probability])) }))
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
    const saved = forecasts.find(row => row.eventId === event.id)
    if (saved && saved.status !== 'pending') { notify('该预测已结算，不能修改或重复投入'); return }
    setSaving(event.id)
    try {
      const response = await fetch('/api/forecasts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personalId, eventId: event.id, probability: values[event.id], rationale: notes[event.id] || '', stake: saved?.stake ?? stakes[event.id] ?? 100 }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '保存预测失败')
      setForecasts(current => [result.forecast, ...current.filter(row => row.eventId !== event.id)])
      setBalance(result.balance)
      setStakes(current => ({ ...current, [event.id]: result.forecast.stake }))
      notify(result.forecast.status === 'pending' ? '预测已保存，投入的虚拟积分等待后台结算' : `预测已由后台演示规则结算：${result.forecast.status === 'won' ? '赢' : '输'}`)
    } catch (error) { notify(error instanceof Error ? error.message : '预测服务暂不可用') }
    finally { setSaving(null) }
  }

  return <section className="forecast-panel">
    <div className="forecast-intro"><div><div className="forecast-kicker"><Activity size={13}/> FORECAST WORKSPACE</div><h2>{title}</h2><p>{subtitle} 此模块使用虚拟积分，不涉及真实资金。</p></div><div className="forecast-account"><LockKeyhole size={14}/><span>{personalId ? `绑定个人 ID · ${personalId}` : '注册后可保存个人预测'}</span></div></div>
    <div className="forecast-disclaimer"><CircleHelp size={15}/><span>本地演示：事件、共识概率与参与人数均为虚构样例。结果由后台演示规则控制；虚拟积分不具备现金价值。</span></div>
    {personalId && <div className="forecast-balance">虚拟积分余额 <b>{balance.toLocaleString('en-US')} PTS</b></div>}
    <div className="forecast-toolbar"><div className="forecast-filters">{categories.map(item => <button className={category===item?'selected':''} key={item} onClick={()=>setCategory(item)}>{item}</button>)}</div><span><Clock3 size={12}/> 更新于本地演示</span></div>
    {events.length===0?<div className="forecast-empty">后台尚未发布预测事件，请在「前台配置」中添加。</div>:<div className="forecast-grid">{visible.map(event => { const value = values[event.id] ?? event.consensus; const saved = forecasts.find(row => row.eventId === event.id); return <article className="forecast-card" key={event.id}>
      <div className="forecast-card-top"><span>{event.category}</span><small><TrendingUp size={12}/> 共识 {event.consensus}%</small></div><h3>{event.question}</h3><p>{event.description}</p><div className="forecast-reward"><span>演示收益比例</span><b>+{event.rewardPercent}%</b></div><div className="forecast-progress"><div><span>市场模拟共识</span><b>{event.consensus}%</b></div><div className="forecast-track"><i style={{ width: `${event.consensus}%` }}/></div></div>
      <label className="forecast-range-label">我的概率判断 <strong>{value}%</strong><input aria-label={`${event.question} 概率`} type="range" min="1" max="99" value={value} disabled={saved?.status !== undefined && saved.status !== 'pending'} onChange={e=>setValues(current=>({...current,[event.id]:Number(e.target.value)}))}/></label>
      <label className="forecast-note-label">判断依据（选填）<textarea rows={2} maxLength={280} value={notes[event.id]||''} disabled={saved?.status !== undefined && saved.status !== 'pending'} onChange={e=>setNotes(current=>({...current,[event.id]:e.target.value}))} placeholder="记录你参考的数据或理由，最多 280 字"/></label>
      <label className="forecast-stake">投入虚拟积分{saved && <span>{saved.stake} PTS 已投入</span>}<input type="number" min="10" max="1000" step="10" value={saved?.stake ?? stakes[event.id] ?? 100} disabled={Boolean(saved)} onChange={e=>setStakes(current=>({...current,[event.id]:Number(e.target.value)}))}/></label>
      <div className="forecast-card-footer"><span><Clock3 size={12}/> {event.horizon}{saved && <strong className={`forecast-result ${saved.status}`}>{saved.status==='pending'?'待结算':saved.status==='won'?'已赢':'已输'}</strong>}</span><button onClick={()=>void save(event)} disabled={saving===event.id||saved?.status==='won'||saved?.status==='lost'}>{saving===event.id?'保存中…':saved?<><Check size={13}/> 已保存</>:'保存并投入'} <ArrowUpRight size={13}/></button></div>
      <small className="forecast-meta">{event.volume}{saved?` · 投入 ${saved.stake} PTS · ${saved.status==='pending'?'等待后台结果':`${saved.status==='won'?'赢':'输'} · ${saved.profit && saved.profit > 0 ? '+' : ''}${saved.profit ?? 0} PTS`}`:''}</small>
    </article>})}</div>}
  </section>
}
