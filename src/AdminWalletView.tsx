import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, BadgeCheck, CalendarDays, CircleAlert, Coins, RefreshCw, Search, UserRound } from 'lucide-react'

type WalletRow = { id: string; personalId: string; type: 'deposit' | 'withdrawal'; amount: number; fee: number; network: string; addressMasked: string; status: 'completed' | 'pending' | 'approved' | 'rejected'; reason: string; createdAt: string; reviewedAt: string | null }
const cash = (value: number) => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const date = (value: string) => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function AdminWalletView({ adminKey }: { adminKey: string }) {
  const [rows, setRows] = useState<WalletRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [filter, setFilter] = useState<'all' | 'deposit' | 'withdrawal'>('all')
  const [search, setSearch] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selected = rows.find(row => row.id === selectedId) || rows[0]

  const refresh = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/wallet-transactions', { headers: { 'x-admin-key': adminKey } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '无法读取资金流水')
      setRows(result.transactions)
      setSelectedId(current => result.transactions.some((row: WalletRow) => row.id === current) ? current : result.transactions[0]?.id || '')
    } catch (err) { setError(err instanceof Error ? err.message : '资金流水服务暂不可用') }
    finally { setBusy(false) }
  }
  const visibleRows = useMemo(() => rows.filter(row => {
    const matchesType = filter === 'all' || row.type === filter
    const matchesSearch = `${row.personalId} ${row.network} ${row.addressMasked}`.toLowerCase().includes(search.toLowerCase())
    return matchesType && matchesSearch
  }), [rows, filter, search])
  const decideWithdrawal = async (status: 'approved' | 'rejected') => {
    if (!selected) return
    if (status === 'rejected' && !reason.trim()) { setError('驳回提现时请填写原因'); return }
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/admin/wallet-transactions/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ status, reason }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '审核失败')
      setRows(current => current.map(row => row.id === selected.id ? result.transaction : row))
      setReason('')
    } catch (err) { setError(err instanceof Error ? err.message : '审核失败') }
    finally { setBusy(false) }
  }

  return <div className="admin-content wallet-admin-content"><div className="admin-title-row"><div><div className="admin-eyebrow"><i/> 后台资金管理</div><h1>USDT 充值 / 提现</h1><p>查看绑定个人 ID 的资金流水，并审核提现申请。</p></div><button className="wallet-refresh" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={14} className={busy?'spinning':''}/> 刷新流水</button></div><section className="admin-stats"><div><span>全部流水</span><b>{rows.length}</b><small><Coins size={13}/> 累计</small></div><div><span>充值到账</span><b className="stat-approved">{rows.filter(row=>row.type==='deposit').length}</b><small><ArrowDownToLine size={13}/> 已入账</small></div><div><span>待审提现</span><b className="stat-pending">{rows.filter(row=>row.type==='withdrawal'&&row.status==='pending').length}</b><small><CircleAlert size={13}/> 需要处理</small></div><div><span>提现已完成</span><b>{rows.filter(row=>row.type==='withdrawal'&&row.status==='approved').length}</b><small><ArrowUpFromLine size={13}/> 已审核</small></div></section><div className="admin-workspace wallet-workspace"><section className="review-list"><div className="review-list-head"><div><h2>资金流水</h2><span>{visibleRows.length} 条记录</span></div><label className="admin-search"><Search size={14}/><input placeholder="搜索个人 ID / 网络" value={search} onChange={event=>setSearch(event.target.value)}/></label></div><div className="review-filters">{([{key:'all',label:'全部'},{key:'deposit',label:'充值'},{key:'withdrawal',label:'提现'}] as const).map(item=><button key={item.key} className={filter===item.key?'filter-active':''} onClick={()=>setFilter(item.key)}>{item.label}{item.key==='withdrawal'&&<span>{rows.filter(row=>row.type==='withdrawal'&&row.status==='pending').length}</span>}</button>)}</div>{visibleRows.length===0?<div className="admin-empty"><div><Coins size={20}/></div><b>暂无 USDT 流水</b><p>前台提交虚拟充值或提现后会显示在这里。</p></div>:<div className="review-rows">{visibleRows.map(row=><button key={row.id} className={`review-row ${selected?.id===row.id?'review-selected':''}`} onClick={()=>setSelectedId(row.id)}><div className={`wallet-flow-icon ${row.type}`} >{row.type==='deposit'?<ArrowDownToLine size={14}/>:<ArrowUpFromLine size={14}/>}</div><div className="review-person"><b>{row.type==='deposit'?'充值':'提现'} · {cash(row.amount)} USDT</b><small>{row.personalId} · {row.network}</small></div><div className="review-row-meta"><span className={`status-pill ${row.status==='pending'?'pending':row.status==='rejected'?'rejected':'approved'}`}>{row.status==='pending'?'待审核':row.status==='rejected'?'已驳回':'已完成'}</span><small><CalendarDays size={11}/>{date(row.createdAt)}</small></div></button>)}</div>}</section><section className="review-detail">{selected?<><div className="detail-topline"><div><span className="detail-kicker">流水详情</span><h2>{selected.type==='deposit'?'USDT 充值':'USDT 提现'}</h2></div><span className={`status-pill ${selected.status==='pending'?'pending':selected.status==='rejected'?'rejected':'approved'}`}>{selected.status==='pending'?'待审核':selected.status==='rejected'?'已驳回':'已完成'}</span></div><div className="detail-id-card"><UserRound size={16}/><span><small>关联个人 ID</small><b>{selected.personalId}</b></span></div><div className="wallet-detail-amount"><span>{selected.type==='deposit'?'充值金额':'申请提现'}</span><b className={selected.type==='deposit'?'stat-approved':'wallet-amount-out'}>{selected.type==='deposit'?'+':'−'}{cash(selected.amount)} USDT</b></div><div className="detail-fields"><div><span>网络</span><b>{selected.network}</b></div><div><span>手续费</span><b>{cash(selected.fee)} USDT</b></div><div><span>收款地址</span><b>{selected.addressMasked||'—'}</b></div><div><span>创建时间</span><b>{date(selected.createdAt)}</b></div>{selected.reviewedAt&&<div><span>审核时间</span><b>{date(selected.reviewedAt)}</b></div>}</div>{selected.reason&&<div className="review-reason"><b>审核备注</b><p>{selected.reason}</p></div>}{selected.type==='withdrawal'&&selected.status==='pending'?<div className="review-actions"><label>驳回原因（驳回时必填）<input value={reason} onChange={event=>setReason(event.target.value)} placeholder="例如：地址或信息不匹配" maxLength={300}/></label><div><button className="reject-button" onClick={()=>void decideWithdrawal('rejected')} disabled={busy}>驳回并退回余额</button><button className="approve-button" onClick={()=>void decideWithdrawal('approved')} disabled={busy}><BadgeCheck size={14}/>通过虚拟提现</button></div></div>:selected.type==='withdrawal'?<div className="review-completed"><BadgeCheck size={15}/>{selected.status==='rejected'?'提现已驳回，虚拟余额已退回':'提现审核已通过（未广播链上交易）'}</div>:<div className="review-completed"><BadgeCheck size={15}/>虚拟充值已记账</div>}</>:<div className="admin-empty detail-empty"><div><Coins size={20}/></div><b>选择一笔流水</b><p>查看充值或提现的个人 ID、网络和状态。</p></div>}</section></div><div className="admin-footnote"><CircleAlert size={13}/> 资金仅作虚拟记账；提现审核不会发起区块链转账。</div>{error&&<div className="admin-toast">{error}</div>}</div>
}
