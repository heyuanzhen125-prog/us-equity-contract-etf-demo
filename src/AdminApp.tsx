import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, ArrowLeft, BadgeCheck, CalendarDays, ChevronRight, CircleAlert, Coins, Fingerprint, KeyRound, LogOut, RefreshCw, Search, Settings2, ShieldCheck, UserRound, Users, X, ChartNoAxesCombined } from 'lucide-react'
import AdminAccessView from './AdminAccessView'
import AdminAgentsView from './AdminAgentsView'
import { FRONTEND_LINK_HREF } from './siteRouting'
import AdminDepositSettingsApp from './AdminDepositSettingsApp'
import AdminFrontSettingsView from './AdminFrontSettingsView'
import AdminProjectsView from './AdminProjectsView'
import AdminPredictionPreviewView from './AdminPredictionPreviewView'
import AdminWalletView from './AdminWalletView'
import './admin.css'

type Status = 'pending' | 'approved' | 'rejected'
type AdminView = 'kyc' | 'wallet' | 'deposits' | 'projects' | 'prediction-preview' | 'front-config' | 'agents' | 'permissions'
type AdminRole = { id: string; name: string; permissions: string[] }
type Submission = {
  id: string; personalId: string; email: string; legalName: string; country: string; birthDate: string
  documentType: string; documentLast4: string; documents: { front: string; back: string }
  status: Status; reason: string; submittedAt: string; reviewedAt: string | null
}

const statusName: Record<Status, string> = { pending: '待审核', approved: '已通过', rejected: '已驳回' }
const countryName: Record<string, string> = { US: '美国', CN: '中国', VN: '越南', OTHER: '其他' }
const docName: Record<string, string> = { passport: '护照', 'national-id': '身份证', license: '驾驶证' }
const viewInfo: Record<AdminView, { name: string; icon: typeof BadgeCheck }> = {
  kyc: { name: 'KYC 身份审核', icon: BadgeCheck },
  wallet: { name: 'USDT 资金流水', icon: Coins },
  deposits: { name: 'USDT / USDC 充值配置', icon: Coins },
  projects: { name: '项目与曲线', icon: Activity },
  'prediction-preview': { name: '输赢结果控制', icon: ChartNoAxesCombined },
  'front-config': { name: '前台配置', icon: Settings2 },
  agents: { name: '代理系统', icon: Users },
  permissions: { name: '权限与账号', icon: ShieldCheck },
}
const allViews = Object.keys(viewInfo) as AdminView[]
const dateLabel = (value: string) => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function AdminApp() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('northstar.adminToken') || '')
  const [masterKey, setMasterKey] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [role, setRole] = useState<AdminRole | null>(null)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [rows, setRows] = useState<Submission[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [search, setSearch] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [adminView, setAdminView] = useState<AdminView>(() => ['/admin/deposits', '/deposits'].includes(window.location.pathname) ? 'deposits' : 'kyc')
  const selected = rows.find(row => row.id === selectedId) || rows[0]
  const canAccess = (view: AdminView) => Boolean(role?.permissions.includes(view))
  const accessibleViews = allViews.filter(canAccess)

  const loadKyc = async (key: string) => {
    const response = await fetch('/api/admin/kyc-submissions', { headers: { 'x-admin-key': key } })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '无法读取审核队列')
    setRows(result.submissions)
    setSelectedId(current => result.submissions.some((row: Submission) => row.id === current) ? current : result.submissions[0]?.id || '')
  }

  const acceptSession = async (token: string) => {
    const response = await fetch('/api/admin/session', { headers: { 'x-admin-key': token } })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '后台登录已失效')
    setRole(result.role)
    setMustChangePassword(result.mustChangePassword)
    setAuthenticated(true)
    setError('')
    if (!result.role.permissions.includes(adminView)) {
      setAdminView(allViews.find(view => result.role.permissions.includes(view)) || 'kyc')
    }
    if (result.role.permissions.includes('kyc') && !result.mustChangePassword) await loadKyc(token)
  }

  useEffect(() => {
    const storedToken = sessionStorage.getItem('northstar.adminToken')
    if (!storedToken) return
    void acceptSession(storedToken).catch(() => {
      sessionStorage.removeItem('northstar.adminToken')
      setAdminKey('')
    })
  }, [])

  const refresh = async (key = adminKey) => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/kyc-submissions', { headers: { 'x-admin-key': key } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '无法读取审核队列')
      setRows(result.submissions)
      setSelectedId(current => result.submissions.some((row: Submission) => row.id === current) ? current : result.submissions[0]?.id || '')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '后台服务暂不可用')
    } finally {
      setBusy(false)
    }
  }

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = masterKey.trim() ? { masterKey } : { username, password }
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '后台登录失败')
      sessionStorage.setItem('northstar.adminToken', result.token)
      sessionStorage.removeItem('northstar.adminKey')
      setAdminKey(result.token)
      setMasterKey('')
      setPassword('')
      await acceptSession(result.token)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '后台服务暂不可用')
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    if (adminKey) await fetch('/api/admin/logout', { method: 'POST', headers: { 'x-admin-key': adminKey } }).catch(() => undefined)
    sessionStorage.removeItem('northstar.adminToken')
    setAdminKey('')
    setRole(null)
    setAuthenticated(false)
  }

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '修改密码失败')
      setMustChangePassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '修改密码失败')
    } finally {
      setBusy(false)
    }
  }

  const filtered = useMemo(() => rows.filter(row => {
    const matchesStatus = statusFilter === 'all' || row.status === statusFilter
    const matchesSearch = `${row.personalId} ${row.email} ${row.legalName}`.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  }), [rows, statusFilter, search])

  const decide = async (status: 'approved' | 'rejected') => {
    if (!selected) return
    if (status === 'rejected' && !rejectReason.trim()) {
      setError('请填写驳回原因')
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/kyc-submissions/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ status, reason: rejectReason }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '审核操作失败')
      setRows(current => current.map(row => row.id === selected.id ? result.submission : row))
      setRejectReason('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '审核操作失败')
    } finally {
      setBusy(false)
    }
  }

  if (!authenticated) return <main className="admin-login-screen">
    <form className="admin-login" onSubmit={event => void login(event)}>
      <div className="admin-brand"><div className="admin-logo"><Fingerprint size={20}/></div><div><b>northstar</b><small>运营后台</small></div></div>
      <h1>后台人员登录</h1>
      <p>可使用超级管理员主密钥，或使用已创建的后台人员账号。</p>
      <label>超级管理员主密钥（可选）</label><div className="admin-key-input"><KeyRound size={15}/><input value={masterKey} onChange={event => setMasterKey(event.target.value)} type="password" placeholder="超级管理员登录时填写"/></div>
      <div className="access-login-divider">或使用后台人员账号</div>
      <label>后台账号</label><div className="admin-key-input"><UserRound size={15}/><input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" placeholder="人员账号"/></div>
      <label>密码</label><div className="admin-key-input"><KeyRound size={15}/><input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="后台人员密码"/></div>
      <button className="admin-primary" disabled={busy}>{busy ? '正在验证…' : '登录后台'}</button>
      {error && <div className="admin-error"><CircleAlert size={14}/>{error}</div>}
      <div className="admin-login-note"><ShieldCheck size={13}/> 本地超级管理员主密钥默认值：<code>local-demo-admin</code></div>
      <a href={FRONTEND_LINK_HREF} className="admin-back"><ArrowLeft size={13}/>返回前台</a>
    </form>
  </main>

  if (mustChangePassword) return <main className="admin-login-screen"><form className="admin-login" onSubmit={event => void changePassword(event)}>
    <div className="admin-brand"><div className="admin-logo"><KeyRound size={20}/></div><div><b>northstar</b><small>安全设置</small></div></div>
    <h1>请修改临时密码</h1><p>首次登录或密码重置后，需修改密码才能进入后台。</p>
    <label>当前临时密码</label><div className="admin-key-input"><KeyRound size={15}/><input type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)}/></div>
    <label>新密码（至少 12 个字符）</label><div className="admin-key-input"><KeyRound size={15}/><input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={event => setNewPassword(event.target.value)}/></div>
    <button className="admin-primary" disabled={busy}>{busy ? '保存中…' : '更新密码并继续'}</button>
    {error && <div className="admin-error"><CircleAlert size={14}/>{error}</div>}
    <button type="button" className="admin-back access-logout-link" onClick={() => void logout()}><LogOut size={13}/>退出登录</button>
  </form></main>

  const currentLabel = viewInfo[adminView].name
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-brand"><div className="admin-logo"><Fingerprint size={20}/></div><div><b>northstar</b><small>运营后台</small></div></div>
      <div className="admin-nav-caption">运营管理</div>
      {accessibleViews.map(view => {
        const Icon = viewInfo[view].icon
        return <button key={view} className={`admin-nav ${adminView === view ? 'active' : ''}`} title={viewInfo[view].name} onClick={() => setAdminView(view)}><Icon size={16}/>{viewInfo[view].name}</button>
      })}
      <div className="admin-side-note"><ShieldCheck size={15}/><span>{role?.name || '后台人员'}<br/>栏目权限由角色控制</span></div>
      <button className="admin-logout" title="退出后台" onClick={() => void logout()}><LogOut size={15}/>退出后台</button>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><span>运营管理</span><ChevronRight size={14}/><b>{currentLabel}</b></div>{adminView === 'kyc' && <button onClick={() => void refresh()} disabled={busy}><RefreshCw size={14} className={busy ? 'spinning' : ''}/>刷新队列</button>}</header>
      {adminView === 'permissions' && <AdminAccessView adminKey={adminKey}/>}
      {adminView === 'agents' && <AdminAgentsView adminKey={adminKey}/>}
      {adminView === 'front-config' && <AdminFrontSettingsView adminKey={adminKey}/>}
      {adminView === 'deposits' && <AdminDepositSettingsApp adminKey={adminKey}/>}
      {adminView === 'wallet' && <AdminWalletView adminKey={adminKey}/>}
      {adminView === 'projects' && <AdminProjectsView adminKey={adminKey}/>}
      {adminView === 'prediction-preview' && <AdminPredictionPreviewView adminKey={adminKey}/>}
      {adminView === 'kyc' && <div className="admin-content">
        <div className="admin-title-row"><div><div className="admin-eyebrow"><i/>后台审核工作台</div><h1>KYC 身份审核</h1><p>审核用户身份申请，并将结果同步至前台账户。</p></div><div className="reviewer-chip"><div>AD</div><span><b>{role?.name || '管理员'}</b><small>后台人员会话</small></span></div></div>
        <section className="admin-stats">
          <div><span>全部申请</span><b>{rows.length}</b><small><Activity size={13}/>累计</small></div>
          <div><span>待审核</span><b className="stat-pending">{rows.filter(row => row.status === 'pending').length}</b><small><CircleAlert size={13}/>需要处理</small></div>
          <div><span>已通过</span><b className="stat-approved">{rows.filter(row => row.status === 'approved').length}</b><small><BadgeCheck size={13}/>已完成</small></div>
          <div><span>已驳回</span><b className="stat-rejected">{rows.filter(row => row.status === 'rejected').length}</b><small><X size={13}/>已退回</small></div>
        </section>
        <div className="admin-workspace">
          <section className="review-list">
            <div className="review-list-head"><div><h2>申请队列</h2><span>{filtered.length} 条记录</span></div><label className="admin-search"><Search size={14}/><input placeholder="搜索 ID、邮箱或姓名" value={search} onChange={event => setSearch(event.target.value)}/></label></div>
            <div className="review-filters">{([{ key: 'all', label: '全部' }, { key: 'pending', label: '待审核' }, { key: 'approved', label: '已通过' }, { key: 'rejected', label: '已驳回' }] as const).map(filter => <button key={filter.key} className={statusFilter === filter.key ? 'filter-active' : ''} onClick={() => setStatusFilter(filter.key)}>{filter.label}{filter.key === 'pending' && <span>{rows.filter(row => row.status === 'pending').length}</span>}</button>)}</div>
            {filtered.length === 0 ? <div className="admin-empty"><div><BadgeCheck size={20}/></div><b>暂无审核申请</b><p>用户在前台提交 KYC 后会显示在这里。</p></div> : <div className="review-rows">{filtered.map(row => <button key={row.id} className={`review-row ${selected?.id === row.id ? 'review-selected' : ''}`} onClick={() => setSelectedId(row.id)}><div className="review-avatar">{row.legalName.slice(0, 1).toUpperCase()}</div><div className="review-person"><b>{row.legalName}</b><small>{row.personalId} · {row.email}</small></div><div className="review-row-meta"><span className={`status-pill ${row.status}`}>{statusName[row.status]}</span><small><CalendarDays size={11}/>{dateLabel(row.submittedAt)}</small></div><ChevronRight size={15}/></button>)}</div>}
          </section>
          <section className="review-detail">{selected ? <>
            <div className="detail-topline"><div><span className="detail-kicker">申请详情</span><h2>{selected.legalName}</h2></div><span className={`status-pill ${selected.status}`}>{statusName[selected.status]}</span></div>
            <div className="detail-id-card"><Fingerprint size={16}/><span><small>关联个人 ID</small><b>{selected.personalId}</b></span></div>
            <div className="detail-fields"><div><span>注册邮箱</span><b>{selected.email}</b></div><div><span>国家 / 地区</span><b>{countryName[selected.country] || selected.country}</b></div><div><span>出生日期</span><b>{selected.birthDate}</b></div><div><span>证件类型</span><b>{docName[selected.documentType] || selected.documentType}</b></div><div><span>证件号码</span><b>•••• {selected.documentLast4}</b></div><div><span>提交时间</span><b>{dateLabel(selected.submittedAt)}</b></div></div>
            <div className="document-meta"><h3>证件附件信息</h3><p>当前本地原型只传送文件名，后台不能查看证件文件本体。</p><div><span>正面</span><b>{selected.documents.front}</b></div><div><span>反面</span><b>{selected.documents.back}</b></div></div>
            {selected.reason && <div className="review-reason"><b>驳回原因</b><p>{selected.reason}</p></div>}
            {selected.status === 'pending' ? <div className="review-actions"><label>驳回原因（驳回时必填）<input value={rejectReason} onChange={event => setRejectReason(event.target.value)} placeholder="例如：资料信息不完整" maxLength={300}/></label><div><button className="reject-button" onClick={() => void decide('rejected')} disabled={busy}>驳回申请</button><button className="approve-button" onClick={() => void decide('approved')} disabled={busy}><BadgeCheck size={14}/>审核通过</button></div></div> : <div className="review-completed"><BadgeCheck size={15}/>审核完成 {selected.reviewedAt ? `· ${dateLabel(selected.reviewedAt)}` : ''}</div>}
          </> : <div className="admin-empty detail-empty"><div><UserRound size={20}/></div><b>选择一条申请</b><p>从左侧队列选择用户查看 KYC 信息。</p></div>}</section>
        </div>
        <div className="admin-footnote"><CircleAlert size={13}/>本地 MVP：后台 API 绑定个人 ID，队列在内存中运行；真实证件存储、权限审计和身份核验需接入生产服务。</div>
        {error && <div className="admin-toast">{error}</div>}
      </div>}
    </main>
  </div>
}
