import { useEffect, useState } from 'react'
import { Activity, ArrowUpRight, Check, CircleHelp, Clock3, LockKeyhole, TrendingUp } from 'lucide-react'

type Forecast = { id: string; personalId: string; eventId: string; probability: number; rationale: string; updatedAt: string }
type Event = { id: string; category: string; question: string; description: string; consensus: number; horizon: string; volume: string; rewardPercent: number }


export default function PredictionMarketPanel({ personalId, onRegister, notify, events, title, subtitle }: { personalId: string; onRegister: () => void; notify: (message: string) => void; events: Event[]; title: string; subtitle: string }) {
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [values, setValues] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [category, setCategory] = useState('全部')
  const categories = ['全部', ...new Set(events.map(event => event.category))]
  const visible = category === '全部' ? events : events.filter(event => event.category === category)

  useEffect(() => { setValues(current => Object.fromEntries(events.map(event => [event.id, current[event.id] ?? event.consensus]))); setNotes(current => Object.fromEntries(events.map(event => [event.id, current[event.id] ?? '']))) }, [events])

  useEffect(() => {
    if (!personalId) { setForecasts([]); return }
    let active = true
    const load = async () => {
      try {
        const response = await fetch(`/api/forecasts?personalId=${encodeURIComponent(personalId)}`)
        if (!response.ok) return
        const result = await response.json()
        if (!active) return
        const rows: Forecast[] = result.forecasts || []
        setForecasts(rows)
        setValues(current => ({ ...current, ...Object.fromEntries(rows.map(row => [row.eventId, row.probability])) }))
        setNotes(current => ({ ...current, ...Object.fromEntries(rows.map(row => [row.eventId, row.rationale])) }))
      } catch { /* local demo API may still be starting */ }
    }
    void load()
    return () => { active = false }
  }, [personalId])

  const save = async (event: Event) => {
    if (!personalId) { onRegister(); notify('请先注册账户，预测将绑定到个人 ID'); return }
    setSaving(event.id)
    try {
      const response = await fetch('/api/forecasts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personalId, eventId: event.id, probability: values[event.id], rationale: notes[event.id] || '' }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '保存预测失败')
      setForecasts(current => [result.forecast, ...current.filter(row => row.eventId !== event.id)])
      notify('预测判断已保存到独立的预测系统')
    } catch (error) { notify(error instanceof Error ? error.message : '预测服务暂不可用') }
    finally { setSaving(null) }
  }

  return <section className="forecast-panel">
    <div className="forecast-intro"><div><div className="forecast-kicker"><Activity size={13}/> FORECAST WORKSPACE</div><h2>{title}</h2><p>{subtitle} 此模块独立于时间合约，不扣虚拟积分。</p></div><div className="forecast-account"><LockKeyhole size={14}/><span>{personalId ? `绑定个人 ID · ${personalId}` : '注册后可保存个人预测'}</span></div></div>
    <div className="forecast-disclaimer"><CircleHelp size={15}/><span>本地演示：事件、共识概率与参与人数均为虚构样例。不会影响账户余额，也不会自动产生交易或奖金。</span></div>
    <div className="forecast-toolbar"><div className="forecast-filters">{categories.map(item => <button className={category===item?'selected':''} key={item} onClick={()=>setCategory(item)}>{item}</button>)}</div><span><Clock3 size={12}/> 更新于本地演示</span></div>
    {events.length===0?<div className="forecast-empty">后台尚未发布预测事件，请在「前台配置」中添加。</div>:<div className="forecast-grid">{visible.map(event => { const value = values[event.id] ?? event.consensus; const saved = forecasts.find(row => row.eventId === event.id); return <article className="forecast-card" key={event.id}>
      <div className="forecast-card-top"><span>{event.category}</span><small><TrendingUp size={12}/> 共识 {event.consensus}%</small></div><h3>{event.question}</h3><p>{event.description}</p><div className="forecast-reward"><span>演示收益比例</span><b>+{event.rewardPercent}%</b></div><div className="forecast-progress"><div><span>市场模拟共识</span><b>{event.consensus}%</b></div><div className="forecast-track"><i style={{ width: `${event.consensus}%` }}/></div></div>
      <label className="forecast-range-label">我的概率判断 <strong>{value}%</strong><input aria-label={`${event.question} 概率`} type="range" min="1" max="99" value={value} onChange={e=>setValues(current=>({...current,[event.id]:Number(e.target.value)}))}/></label>
      <label className="forecast-note-label">判断依据（选填）<textarea rows={2} maxLength={280} value={notes[event.id]||''} onChange={e=>setNotes(current=>({...current,[event.id]:e.target.value}))} placeholder="记录你参考的数据或理由，最多 280 字"/></label>
      <div className="forecast-card-footer"><span><Clock3 size={12}/> {event.horizon}</span><button onClick={()=>void save(event)} disabled={saving===event.id}>{saving===event.id?'保存中…':saved?<><Check size={13}/> 已保存 · 更新</>:'保存预测'} <ArrowUpRight size={13}/></button></div>
      <small className="forecast-meta">{event.volume}{saved?` · 我的记录 ${new Date(saved.updatedAt).toLocaleString('zh-CN')}`:''}</small>
    </article>})}</div>}
  </section>
}
