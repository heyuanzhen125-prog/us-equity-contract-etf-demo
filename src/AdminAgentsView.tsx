import { useEffect, useState, type FormEvent } from 'react'
import { Copy, Pencil, Plus, RefreshCw, Save, Trash2, Users } from 'lucide-react'
import { FRONTEND_SITE_URL } from './siteRouting'
import './admin-access.css'

type Agent = {
  id: string
  code: string
  name: string
  contact: string
  commissionRate: number
  members: { personalId: string; name: string }[]
  active: boolean
  createdAt: string
}
type Draft = { code: string; name: string; contact: string; commissionRate: string; membersText: string; active: boolean }
const newDraft = (): Draft => ({ code: `AG-${Date.now().toString(36).toUpperCase()}`, name: '', contact: '', commissionRate: '0', membersText: '', active: true })

export default function AdminAgentsView({ adminKey }: { adminKey: string }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [draft, setDraft] = useState<Draft>(newDraft())
  const [editingId, setEditingId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const request = async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(path, {
      method,
      headers: { 'x-admin-key': adminKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '代理管理请求失败')
    return result
  }

  const refresh = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await request('/api/admin/agents')
      setAgents(result.agents)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '加载代理列表失败')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void refresh() }, [adminKey])

  const edit = (agent: Agent) => {
    setEditingId(agent.id)
    setDraft({ code: agent.code, name: agent.name, contact: agent.contact, commissionRate: String(agent.commissionRate), membersText: agent.members.map(member => `${member.personalId}|${member.name}`).join('\n'), active: agent.active })
    setNotice('')
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const members = draft.membersText.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const [personalId, ...nameParts] = line.split('|')
      return { personalId: personalId.trim().toUpperCase(), name: nameParts.join('|').trim() }
    })
    try {
      const body = { ...draft, commissionRate: Number(draft.commissionRate), members }
      const result = await request(editingId ? `/api/admin/agents/${editingId}` : '/api/admin/agents', editingId ? 'PATCH' : 'POST', body)
      setAgents(current => editingId ? current.map(agent => agent.id === editingId ? result.agent : agent) : [...current, result.agent])
      setNotice(editingId ? '代理资料已更新。' : '代理已创建。佣金仍待接入真实入金接口。')
      setEditingId('')
      setDraft(newDraft())
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存代理失败')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (agent: Agent) => {
    if (!window.confirm(`删除代理 ${agent.name}？其下级关联也会移除。`)) return
    setBusy(true)
    setError('')
    try {
      await request(`/api/admin/agents/${agent.id}`, 'DELETE')
      setAgents(current => current.filter(item => item.id !== agent.id))
      if (editingId === agent.id) {
        setEditingId('')
        setDraft(newDraft())
      }
      setNotice(`已删除代理 ${agent.name}。`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '删除代理失败')
    } finally {
      setBusy(false)
    }
  }

  const copyInviteLink = async (agent: Agent) => {
    const url = new URL('/', FRONTEND_SITE_URL || window.location.origin)
    url.searchParams.set('ref', agent.code)
    try {
      await navigator.clipboard.writeText(url.toString())
      setNotice(`已复制 ${agent.name} 的前台邀请链接。`)
    } catch {
      setError('复制失败，请检查浏览器剪贴板权限。')
    }
  }

  return <div className="admin-content access-view">
    <div className="admin-title-row"><div><div className="admin-eyebrow"><i/> 渠道运营</div><h1>代理系统</h1><p>维护代理账号、下级用户及返佣比例。</p></div><button className="access-refresh" onClick={() => void refresh()} disabled={busy}><RefreshCw size={13}/>刷新</button></div>
    <div className="access-note access-warning"><Users size={16}/><span><b>佣金自动计算未启用：</b>当前没有接入真实入金数据源。下方比例仅为配置，不会根据虚拟充值计算佣金，也不会产生真实结算或提现。</span></div>
    <div className="agent-layout">
      <section className="access-panel agent-form-panel">
        <header><div><h2>{editingId ? '编辑代理' : '添加代理'}</h2><p>每个下级个人 ID 只能关联一个代理。</p></div></header>
        <form className="agent-form" onSubmit={event => void save(event)}>
          <label>代理编号<input required maxLength={27} value={draft.code} onChange={event => setDraft(current => ({ ...current, code: event.target.value }))} placeholder="AG-NORTH01"/></label>
          <label>代理名称<input required maxLength={80} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="代理名称"/></label>
          <label>联系方式<input maxLength={120} value={draft.contact} onChange={event => setDraft(current => ({ ...current, contact: event.target.value }))} placeholder="邮箱或联系方式"/></label>
          <label>返佣比例（%）<input type="number" min="0" max="100" step="0.01" value={draft.commissionRate} onChange={event => setDraft(current => ({ ...current, commissionRate: event.target.value }))}/></label>
          <label>下级用户（每行一个个人 ID，可选填名称）<textarea rows={7} value={draft.membersText} onChange={event => setDraft(current => ({ ...current, membersText: event.target.value }))} placeholder={'NST-AB12CD34|用户甲\nNST-EF56GH78|用户乙'}/></label>
          <small className="agent-format-hint">格式：NST-XXXXXXXX 或 NST-XXXXXXXX|显示名称。当前只校验个人 ID 格式；需接入账户系统后才能核实用户归属。</small>
          <label className="agent-active-check"><input type="checkbox" checked={draft.active} onChange={event => setDraft(current => ({ ...current, active: event.target.checked }))}/>启用代理</label>
          <div className="agent-form-actions"><button className="admin-primary"><Save size={14}/>{busy ? '保存中…' : editingId ? '保存修改' : '添加代理'}</button>{editingId && <button type="button" className="access-cancel" onClick={() => { setEditingId(''); setDraft(newDraft()) }}>取消编辑</button>}</div>
        </form>
      </section>
      <section className="access-panel agent-list-panel">
        <header><div><h2>代理列表</h2><p>{agents.length} 个代理 · 佣金数据源未接入</p></div></header>
        {agents.length ? <div className="agent-list">{agents.map(agent => <article className="agent-row" key={agent.id}>
          <div className="agent-row-main"><div className="agent-avatar">{agent.name.slice(0, 1)}</div><div><b>{agent.name}</b><small>{agent.code}{agent.contact ? ` · ${agent.contact}` : ''}</small></div><span className={`agent-status ${agent.active ? 'on' : ''}`}>{agent.active ? '启用' : '停用'}</span></div>
          <div className="agent-meta"><span>下级用户 <b>{agent.members.length}</b></span><span>配置返佣比例 <b>{agent.commissionRate}%</b></span></div>
          <div className="agent-invite-link"><span>前台注册链接</span><code>{new URL(`/?ref=${encodeURIComponent(agent.code)}`, FRONTEND_SITE_URL || window.location.origin).toString()}</code><button onClick={() => void copyInviteLink(agent)} disabled={busy || !agent.active}><Copy size={13}/>复制邀请链接</button></div>
          <div className="agent-members">{agent.members.length ? agent.members.map(member => <span key={member.personalId}>{member.name} <code>{member.personalId}</code></span>) : <span>尚未关联下级用户</span>}</div>
          <div className="agent-actions"><button onClick={() => edit(agent)} disabled={busy}><Pencil size={13}/>编辑</button><button className="danger" onClick={() => void remove(agent)} disabled={busy}><Trash2 size={13}/>删除</button></div>
        </article>)}</div> : <div className="access-empty"><Plus size={18}/>还没有代理，使用左侧表单添加。</div>}
        <div className="commission-placeholder"><b>佣金记录</b><span>暂无记录。接入并验证真实入金 API 后，才会按“已确认入金 × 返佣比例”生成佣金。</span></div>
      </section>
    </div>
    {notice && <div className="project-notice">{notice}</div>}
    {error && <div className="project-error admin-error">{error}</div>}
  </div>
}
