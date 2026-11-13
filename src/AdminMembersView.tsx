import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, Users } from 'lucide-react'

type Member = {
  personalId: string; email: string; createdAt: string; inviterId: string; agentId: string
  kycStatus: 'unverified' | 'pending' | 'verified' | 'rejected'; walletTransactions: number; orderCount: number
}
const kycLabels: Record<Member['kycStatus'], string> = { unverified: '未认证', pending: '审核中', verified: '已通过', rejected: '需补充' }
const dateLabel = (value: string) => value ? new Date(value).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export default function AdminMembersView({ adminKey }: { adminKey: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/members', { headers: { 'x-admin-key': adminKey } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '无法读取成员列表')
      setMembers(result.members || [])
    } catch (cause) { setError(cause instanceof Error ? cause.message : '无法读取成员列表') }
    finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [adminKey])
  const filtered = useMemo(() => members.filter(member => `${member.email} ${member.personalId} ${member.inviterId}`.toLowerCase().includes(search.toLowerCase())), [members, search])
  return <section className="admin-content">
    <div className="admin-title-row"><div><div className="admin-eyebrow"><i/>账户管理</div><h1>成员列表</h1><p>查看前台注册账户、个人 ID、邀请来源、KYC 状态与账户活动记录。</p></div><button className="admin-refresh-button" onClick={() => void load()} disabled={busy}><RefreshCw size={14}/>{busy ? '读取中…' : '刷新列表'}</button></div>
    <div className="admin-stats"><div><span>成员总数</span><b>{members.length}</b><small><Users size={13}/>已登记账户</small></div><div><span>KYC 已通过</span><b>{members.filter(row => row.kycStatus === 'verified').length}</b><small>认证状态</small></div><div><span>待认证 / 审核</span><b>{members.filter(row => row.kycStatus === 'pending' || row.kycStatus === 'unverified').length}</b><small>账户状态</small></div></div>
    <div className="review-toolbar"><label className="review-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索邮箱、个人 ID 或邀请人"/></label><span>{filtered.length} 位成员</span></div>
    {error && <div className="admin-error">{error}</div>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>成员 / 个人 ID</th><th>注册时间</th><th>KYC</th><th>邀请来源</th><th>资金流水</th><th>虚拟订单</th></tr></thead><tbody>{filtered.map(member => <tr key={member.personalId}><td><b>{member.email || '未记录邮箱'}</b><small>{member.personalId}</small></td><td>{dateLabel(member.createdAt)}</td><td><span className={`status-pill ${member.kycStatus}`}>{kycLabels[member.kycStatus]}</span></td><td>{member.agentId ? `代理 ${member.agentId}` : member.inviterId || '—'}</td><td>{member.walletTransactions}</td><td>{member.orderCount}</td></tr>)}</tbody></table>{filtered.length === 0 && !error && <div className="admin-empty"><div><Users size={20}/></div><b>暂无成员记录</b><p>前台新注册账户会通过 API 登记到这里。</p></div>}</div>
    <p className="admin-members-note">当前为本地运行数据，成员目录存储在 API 运行实例中，服务重启或实例切换后记录可能丢失；密码不会发送或保存。正式使用前需接入持久化数据库及安全登录。</p>
  </section>
}
