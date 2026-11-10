import { useMemo, useState } from 'react'
import { Activity, ArrowLeft, BadgeCheck, CalendarDays, ChevronRight, CircleAlert, Coins, Fingerprint, KeyRound, LogOut, RefreshCw, Search, Settings2, ShieldCheck, UserRound, X } from 'lucide-react'
import AdminWalletView from './AdminWalletView'
import AdminProjectsView from './AdminProjectsView'
import AdminFrontSettingsView from './AdminFrontSettingsView'
import './admin.css'

type Status = 'pending' | 'approved' | 'rejected'
type Submission = {
  id: string; personalId: string; email: string; legalName: string; country: string; birthDate: string
  documentType: string; documentLast4: string; documents: { front: string; back: string }
  status: Status; reason: string; submittedAt: string; reviewedAt: string | null
}
const statusName: Record<Status, string> = { pending: '待审核', approved: '已通过', rejected: '已驳回' }
const countryName: Record<string, string> = { US: '美国', CN: '中国', VN: '越南', OTHER: '其他' }
const docName: Record<string, string> = { passport: '护照', 'national-id': '身份证', license: '驾驶证' }
const dateLabel = (value: string) => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function AdminApp() {
  const [adminKey, setAdminKey] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [rows, setRows] = useState<Submission[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [search, setSearch] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [adminView, setAdminView] = useState<'kyc' | 'wallet' | 'projects' | 'front-config'>('kyc')
  const selected = rows.find(row => row.id === selectedId) || rows[0]

  const refresh = async (key = adminKey) => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/kyc-submissions', { headers: { 'x-admin-key': key } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '无法读取审核队列')
      setRows(result.submissions)
      setAuthenticated(true)
      setSelectedId(current => result.submissions.some((row: Submission) => row.id === current) ? current : result.submissions[0]?.id || '')
    } catch (err) {
      setAuthenticated(false)
      setError(err instanceof Error ? err.message : '后台服务暂不可用')
    } finally { setBusy(false) }
  }
  const filtered = useMemo(() => rows.filter(row => {
    const matchesStatus = statusFilter === 'all' || row.status === statusFilter
    const matchesSearch = `${row.personalId} ${row.email} ${row.legalName}`.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  }), [rows, statusFilter, search])
  const decide = async (status: 'approved' | 'rejected') => {
    if (!selected) return
    if (status === 'rejected' && !rejectReason.trim()) { setError('请填写驳回原因'); return }
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/admin/kyc-submissions/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ status, reason: rejectReason }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '审核操作失败')
      setRows(current => current.map(row => row.id === selected.id ? result.submission : row))
      setRejectReason('')
    } catch (err) { setError(err instanceof Error ? err.message : '审核操作失败') }
    finally { setBusy(false) }
  }

  if (!authenticated) return <main className="admin-login-screen"><form className="admin-login" onSubmit={event => { event.preventDefault(); void refresh(adminKey) }}><div className="admin-brand"><div className="admin-logo"><Fingerprint size={20}/></div><div><b>northstar</b><small>运营后台</small></div></div><h1>后台管理员登录</h1><p>登录后管理 KYC、USDT 资金流水和演示项目</p><label>后台访问密钥</label><div className="admin-key-input"><KeyRound size={15}/><input value={adminKey} onChange={event => setAdminKey(event.target.value)} type="password" placeholder="输入后台密钥" required/></div><button className="admin-primary" disabled={busy}>{busy ? '正在验证…' : '进入审核后台'}</button>{error&&<div className="admin-error"><CircleAlert size={14}/>{error}</div>}<div className="admin-login-note"><ShieldCheck size={13}/> 本地开发密钥默认值：<code>local-demo-admin</code></div><a href="/" className="admin-back"><ArrowLeft size={13}/> 返回前台</a></form></main>

  return <div className="admin-shell"><aside className="admin-sidebar"><div className="admin-brand"><div className="admin-logo"><Fingerprint size={20}/></div><div><b>northstar</b><small>运营后台</small></div></div><div className="admin-nav-caption">运营管理</div><button className={`admin-nav ${adminView==='kyc'?'active':''}`} onClick={()=>setAdminView('kyc')}><BadgeCheck size={16}/> KYC 身份审核</button><button className={`admin-nav ${adminView==='wallet'?'active':''}`} onClick={()=>setAdminView('wallet')}><Coins size={16}/> USDT 资金流水</button><button className={`admin-nav ${adminView==='projects'?'active':''}`} onClick={()=>setAdminView('projects')}><Activity size={16}/> 项目与曲线</button><button className={`admin-nav ${adminView==='front-config'?'active':''}`} onClick={()=>setAdminView('front-config')}><Settings2 size={16}/> 前台配置</button><div className="admin-side-note"><ShieldCheck size={15}/><span>本地演示后台<br/>审核记录仅保存在服务进程内存</span></div><button className="admin-logout" onClick={()=>setAuthenticated(false)}><LogOut size={15}/> 退出后台</button></aside><main className="admin-main"><header className="admin-topbar"><div><span>运营管理</span><ChevronRight size={14}/><b>{adminView==='kyc'?'KYC 身份审核':adminView==='wallet'?'USDT 资金流水':adminView==='projects'?'项目与演示曲线':'前台配置'}</b></div>{adminView==='kyc'&&<button onClick={()=>void refresh()} disabled={busy}><RefreshCw size={14} className={busy?'spinning':''}/> 刷新队列</button>}</header>{adminView==='front-config'?<AdminFrontSettingsView adminKey={adminKey}/>:adminView==='kyc'?<div className="admin-content"><div className="admin-title-row"><div><div className="admin-eyebrow"><i/> 后台审核工作台</div><h1>KYC 身份审核</h1><p>审核用户身份申请，并将结果同步至前台账户。</p></div><div className="reviewer-chip"><div>AD</div><span><b>管理员</b><small>审核员会话</small></span></div></div><section className="admin-stats"><div><span>全部申请</span><b>{rows.length}</b><small><Activity size={13}/> 累计</small></div><div><span>待审核</span><b className="stat-pending">{rows.filter(row=>row.status==='pending').length}</b><small><CircleAlert size={13}/> 需要处理</small></div><div><span>已通过</span><b className="stat-approved">{rows.filter(row=>row.status==='approved').length}</b><small><BadgeCheck size={13}/> 已完成</small></div><div><span>已驳回</span><b className="stat-rejected">{rows.filter(row=>row.status==='rejected').length}</b><small><X size={13}/> 已退回</small></div></section><div className="admin-workspace"><section className="review-list"><div className="review-list-head"><div><h2>申请队列</h2><span>{filtered.length} 条记录</span></div><label className="admin-search"><Search size={14}/><input placeholder="搜索 ID、邮箱或姓名" value={search} onChange={event=>setSearch(event.target.value)}/></label></div><div className="review-filters">{([{key:'all',label:'全部'},{key:'pending',label:'待审核'},{key:'approved',label:'已通过'},{key:'rejected',label:'已驳回'}] as const).map(filter=><button key={filter.key} className={statusFilter===filter.key?'filter-active':''} onClick={()=>setStatusFilter(filter.key)}>{filter.label}{filter.key==='pending'&&<span>{rows.filter(row=>row.status==='pending').length}</span>}</button>)}</div>{filtered.length===0?<div className="admin-empty"><div><BadgeCheck size={20}/></div><b>暂无审核申请</b><p>用户在前台提交 KYC 后会显示在这里。</p></div>:<div className="review-rows">{filtered.map(row=><button key={row.id} className={`review-row ${selected?.id===row.id?'review-selected':''}`} onClick={()=>setSelectedId(row.id)}><div className="review-avatar">{row.legalName.slice(0,1).toUpperCase()}</div><div className="review-person"><b>{row.legalName}</b><small>{row.personalId} · {row.email}</small></div><div className="review-row-meta"><span className={`status-pill ${row.status}`}>{statusName[row.status]}</span><small><CalendarDays size={11}/>{dateLabel(row.submittedAt)}</small></div><ChevronRight size={15}/></button>)}</div>}</section><section className="review-detail">{selected?<><div className="detail-topline"><div><span className="detail-kicker">申请详情</span><h2>{selected.legalName}</h2></div><span className={`status-pill ${selected.status}`}>{statusName[selected.status]}</span></div><div className="detail-id-card"><Fingerprint size={16}/><span><small>关联个人 ID</small><b>{selected.personalId}</b></span></div><div className="detail-fields"><div><span>注册邮箱</span><b>{selected.email}</b></div><div><span>国家 / 地区</span><b>{countryName[selected.country]||selected.country}</b></div><div><span>出生日期</span><b>{selected.birthDate}</b></div><div><span>证件类型</span><b>{docName[selected.documentType]||selected.documentType}</b></div><div><span>证件号码</span><b>•••• {selected.documentLast4}</b></div><div><span>提交时间</span><b>{dateLabel(selected.submittedAt)}</b></div></div><div className="document-meta"><h3>证件附件信息</h3><p>当前本地原型只传送文件名，后台不能查看证件文件本体。</p><div><span>正面</span><b>{selected.documents.front}</b></div><div><span>反面</span><b>{selected.documents.back}</b></div></div>{selected.reason&&<div className="review-reason"><b>驳回原因</b><p>{selected.reason}</p></div>}{selected.status==='pending'&&<div className="review-actions"><label>驳回原因（驳回时必填）<input value={rejectReason} onChange={event=>setRejectReason(event.target.value)} placeholder="例如：资料信息不完整" maxLength={300}/></label><div><button className="reject-button" onClick={()=>void decide('rejected')} disabled={busy}>驳回申请</button><button className="approve-button" onClick={()=>void decide('approved')} disabled={busy}><BadgeCheck size={14}/>审核通过</button></div></div>}{selected.status!=='pending'&&<div className="review-completed"><BadgeCheck size={15}/> 审核完成 {selected.reviewedAt?`· ${dateLabel(selected.reviewedAt)}`:''}</div>}</>:<div className="admin-empty detail-empty"><div><UserRound size={20}/></div><b>选择一条申请</b><p>从左侧队列选择用户查看 KYC 信息。</p></div>}</section></div><div className="admin-footnote"><CircleAlert size={13}/> 本地 MVP：后台 API 绑定个人 ID，队列在内存中运行；真实证件存储、权限审计和身份核验需接入生产服务。</div>{error&&<div className="admin-toast">{error}</div>}</div>:adminView==='wallet'?<AdminWalletView adminKey={adminKey}/>:adminView==='projects'?<AdminProjectsView adminKey={adminKey}/>:<AdminFrontSettingsView adminKey={adminKey}/>}</main></div>
}
