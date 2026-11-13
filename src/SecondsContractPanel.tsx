import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDown, ArrowUp, Clock3, Sparkles } from 'lucide-react'
import { useVisiblePolling } from './useVisiblePolling'

type DemoProject = { id: string; symbol: string; name: string; startPrice: number; lastPrice: number; targetChangePct: number; curve: number[]; simulated: true; tradable?: boolean; referenceType?: string; sourceExchange?: string; sourceUrl?: string; sourceExpiry?: string; sourceTicker?: string }
type Prediction = { id: string; projectSymbol: string; direction: 'up' | 'down'; durationSeconds: number; stake: number; payoutPercent: number; status: 'pending' | 'won' | 'lost' | 'draw'; result: 'won' | 'lost' | 'draw' | null; entryPrice: number; exitPrice: number | null; payout: number | null; profit: number | null; createdAt: string; expiresAt?: string; settlementSource?: string }
const money = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function SecondsContractPanel({ projects, personalId, onRegister, notify, durations, payoutPercent, autoPayoutEnabled, title, subtitle }: { projects: DemoProject[]; personalId: string; onRegister: () => void; notify: (message: string) => void; durations: number[]; payoutPercent: number; autoPayoutEnabled: boolean; title: string; subtitle: string }) {
  const [projectId, setProjectId] = useState('')
  const [direction, setDirection] = useState<'up' | 'down'>('up')
  const [duration, setDuration] = useState(10)
  const [stake, setStake] = useState('100')
  const [balance, setBalance] = useState(10000)
  const [history, setHistory] = useState<Prediction[]>([])
  const [busy, setBusy] = useState(false)
  const [quotedPayout, setQuotedPayout] = useState(payoutPercent)
  const selected = projects.find(project => project.id === projectId) || projects[0]
  const pendingCount = history.filter(item => item.status === 'pending').length
  const normalized = useMemo(() => {
    if (!selected) return []
    const values = selected.curve
    const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1
    return values.map(value => 8 + ((value - min) / range) * 38)
  }, [selected])

  useEffect(() => {
    if (projects.length && !projects.some(project => project.id === projectId)) setProjectId(projects[0].id)
  }, [projects, projectId])
  useEffect(() => { if (durations.length && !durations.includes(duration)) setDuration(durations[0]) }, [durations, duration])
  useEffect(() => { setQuotedPayout(payoutPercent) }, [payoutPercent])
  useVisiblePolling(async signal => {
    try {
      const query = new URLSearchParams({ direction, projectId: selected?.id || '' })
      const response = await fetch(`/api/time-contracts/quote?${query}`, { signal })
      if (!response.ok) return
      const result = await response.json()
      if (Number.isFinite(result.payoutPercent)) setQuotedPayout(result.payoutPercent)
    } catch (error) {
      if (!signal.aborted) console.error('Unable to refresh contract quote', error)
    }
  }, autoPayoutEnabled ? 1500 : 5000, true, [direction, selected?.id, autoPayoutEnabled])
  useVisiblePolling(async signal => {
    if (!personalId) return
    try {
      const identityQuery = import.meta.env.DEV ? `?personalId=${encodeURIComponent(personalId)}` : ''
      const response = await fetch(`/api/time-contracts${identityQuery}`, { signal })
      if (!response.ok) return
      const result = await response.json()
      setBalance(result.balance)
      setHistory(result.contracts)
    } catch (error) {
      if (!signal.aborted) console.error('Unable to refresh time contracts', error)
    }
  }, pendingCount ? 1000 : 5000, Boolean(personalId), [personalId])

  const submit = async () => {
    if (!personalId) { onRegister(); notify('请先注册账户，为虚拟合约绑定个人 ID'); return }
    if (!selected) { notify('请先由后台添加 SIM 虚拟项目'); return }
    if (selected.tradable === false || selected.sourceExchange) { notify('交易所同步的 YES/NO 概率只作参考，请选择后台发布的 SIM 价格项目'); return }
    setBusy(true)
    try {
      const response = await fetch('/api/time-contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(import.meta.env.DEV ? { personalId } : {}), projectId: selected.id, direction, durationSeconds: duration, stake: Number(stake) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '虚拟合约提交失败')
      setBalance(result.balance)
      setHistory(items => [result.contract, ...items].slice(0, 20))
      notify(`已提交 ${duration} 秒虚拟合约，结算会同步到本地后台曲线`)
    } catch (error) { notify(error instanceof Error ? error.message : '虚拟合约服务不可用') }
    finally { setBusy(false) }
  }

  return <section className="seconds-panel"><div className="seconds-header"><div><div className="seconds-kicker"><Sparkles size={13}/> EXCHANGE TIME MARKETS</div><h2>{title}</h2><p>{subtitle}</p></div><div className="virtual-balance"><small>账户积分余额</small><b>{money(balance)} <span>PTS</span></b></div></div><div className="seconds-disclaimer"><Activity size={14}/> 行情参考 Kalshi / Polymarket 短周期合约概率；本平台订单使用虚拟 PTS，未向交易所提交订单。概率参考不可下单或用于结算。</div>{projects.length===0?<div className="seconds-empty"><div><Clock3 size={20}/></div><b>暂未同步到开放的短周期项目</b><p>交易所提供 5 / 15 分钟标的时，项目会自动同步；也可在后台「项目与曲线」发布 SIM 虚拟标的。</p></div>:<div className="seconds-body"><div className="seconds-chart-card"><div className="seconds-market-line"><div><b>{selected?.symbol}</b><small>{selected?.name} · {selected?.sourceExchange ? `${selected.sourceExchange} 实时概率参考` : '虚拟标的'}</small></div><span className={selected&&selected.targetChangePct<0?'negative':'positive'}>{selected&&selected.targetChangePct>0?'+':''}{selected?.targetChangePct.toFixed(2)}%</span></div><div className="seconds-price">{selected?.sourceExchange?`${selected.lastPrice.toFixed(1)}%`:`$${selected?money(selected.lastPrice):'—'}`} <small>{selected?.sourceExchange || 'SIM'}</small></div><svg className="seconds-chart" viewBox="0 0 800 60" preserveAspectRatio="none"><polyline points={normalized.map((value,index)=>`${(index/Math.max(1,normalized.length-1))*800},${55-value}`).join(' ')} fill="none" stroke={selected&&selected.targetChangePct<0?'#f18b8f':'#6bd5a2'} strokeWidth="2.5" vectorEffect="non-scaling-stroke"/></svg><div className="seconds-chart-foot"><span>{selected?.sourceExchange?'初始概率':'起始价格'} {selected?.sourceExchange?`${selected?money(selected.startPrice):'—'}%`:`$${selected?money(selected.startPrice):'—'}`}</span><span>{selected?.sourceExchange?'最新概率':'结束价格'} {selected?.sourceExchange?`${selected?money(selected.lastPrice):'—'}%`:`$${selected?money(selected.lastPrice):'—'}`}</span>{selected?.sourceExpiry&&<span className="time-source-expiry">来源市场截止 {new Date(selected.sourceExpiry).toLocaleTimeString()}</span>}</div></div><div className="seconds-controls"><label className="seconds-field">合约项目<select value={selected?.id||''} onChange={event=>setProjectId(event.target.value)}>{projects.map(project=><option key={project.id} value={project.id}>{project.symbol} · {project.name}{project.tradable===false?' · 仅参考':''}</option>)}</select></label><div className="seconds-control-row"><label className="seconds-field">期限<select value={duration} onChange={event=>setDuration(Number(event.target.value))}>{durations.map(seconds=><option key={seconds} value={seconds}>{seconds} 秒</option>)}</select></label><label className="seconds-field">投入虚拟积分<input type="number" min="10" max="1000" step="10" value={stake} onChange={event=>setStake(event.target.value)}/></label></div><div className="predict-buttons"><button className={direction==='up'?'predict-up active-predict':''} onClick={()=>setDirection('up')} disabled={selected?.tradable===false}><ArrowUp size={15}/> {selected?.sourceExchange?'概率上升':'看涨'}</button><button className={direction==='down'?'predict-down active-predict':''} onClick={()=>setDirection('down')} disabled={selected?.tradable===false}><ArrowDown size={15}/> {selected?.sourceExchange?'概率下降':'看跌'}</button></div>{selected?.tradable===false&&<div className="payout-note">该同步市场仅显示 YES/NO 概率。请选择后台发布的 SIM 价格项目进行虚拟合约。</div>}<div className="payout-note"><span>{autoPayoutEnabled?'订单动态收益比例':'固定收益比例（虚拟积分）'}</span><b>正确 +{quotedPayout}% · 错误 −100%</b></div><button className="predict-submit" onClick={()=>void submit()} disabled={busy||!selected||selected.tradable===false}>{busy?'提交中…':`提交 ${duration} 秒虚拟合约`}</button></div></div>}<div className="prediction-history"><div className="prediction-history-head"><b>时间合约记录</b><span>{history.length} 条 · {pendingCount} 条进行中</span></div>{history.length===0?<div className="prediction-no-history">暂无虚拟记录</div>:history.slice(0,5).map(item=><div className="prediction-row" key={item.id}><div className={`prediction-direction ${item.direction}`}>{item.direction==='up'?<ArrowUp size={13}/>:<ArrowDown size={13}/>}</div><div className="prediction-info"><b>{item.projectSymbol} · {item.direction==='up'?'看涨':'看跌'} · {item.durationSeconds} 秒</b><small>{new Date(item.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · {item.stake} PTS · 到期 {item.expiresAt?new Date(item.expiresAt).toLocaleTimeString('zh-CN'):'—'} · {item.settlementSource||'SIM'} · 收益 +{item.payoutPercent}%</small></div><span className={`prediction-status ${item.status}`}>{item.status==='pending'?'进行中':item.status==='won'?`+${money(item.profit||0)} PTS`:item.status==='draw'?'平局':'未命中'}</span></div>)}</div></section>
}
