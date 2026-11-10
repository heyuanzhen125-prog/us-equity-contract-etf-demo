import { useEffect, useState } from 'react'
import { Plus, Save, ShieldCheck, UserPlus } from 'lucide-react'
import './admin-access.css'

type Module = { id: string; name: string }
type Role = { id: string; name: string; permissions: string[] }
type StaffUser = { id: string; username: string; roleId: string; active: boolean; mustChangePassword: boolean; createdAt: string }

export default function AdminAccessView({ adminKey }: { adminKey: string }) {
  const [modules, setModules] = useState<Module[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<StaffUser[]>([])
  const [newRoleName, setNewRoleName] = useState('')
  const [newUser, setNewUser] = useState({ username: '', password: '', roleId: '' })
  const [userEdits, setUserEdits] = useState<Record<string, { roleId: string; password: string }>>({})
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
    if (!response.ok) throw new Error(result.error || '权限管理请求失败')
    return result
  }

  const refresh = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await request('/api/admin/permissions')
      setModules(result.modules)
      setRoles(result.roles)
      setUsers(result.users)
      setUserEdits(Object.fromEntries(result.users.map((user: StaffUser) => [user.id, { roleId: user.roleId, password: '' }])))
      setNewUser(current => ({ ...current, roleId: current.roleId || result.roles.find((role: Role) => role.id !== 'superadmin')?.id || '' }))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '加载权限配置失败')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void refresh() }, [adminKey])

  const saveRoles = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await request('/api/admin/permissions', 'PUT', { roles: roles.filter(role => role.id !== 'superadmin') })
      setRoles(result.roles)
      setNotice('角色与栏目权限已保存。已登录账号的权限立即生效。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存权限失败')
    } finally {
      setBusy(false)
    }
  }

  const createRole = () => {
    const name = newRoleName.trim()
    if (!name) return
    const id = `custom-${Date.now().toString(36)}`
    setRoles(current => [...current, { id, name, permissions: [] }])
    setNewRoleName('')
  }

  const saveUser = async (user: StaffUser) => {
    const edit = userEdits[user.id]
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body: { roleId: string; password?: string } = { roleId: edit.roleId }
      if (edit.password) body.password = edit.password
      const result = await request(`/api/admin/staff-users/${user.id}`, 'PATCH', body)
      setUsers(current => current.map(item => item.id === user.id ? result.user : item))
      setUserEdits(current => ({ ...current, [user.id]: { ...current[user.id], password: '' } }))
      setNotice(edit.password ? `已重置 ${user.username} 的临时密码；下次登录需修改。` : `已更新 ${user.username} 的角色。`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新账号失败')
    } finally {
      setBusy(false)
    }
  }

  const toggleUser = async (user: StaffUser) => {
    setBusy(true)
    setError('')
    try {
      const result = await request(`/api/admin/staff-users/${user.id}`, 'PATCH', { active: !user.active })
      setUsers(current => current.map(item => item.id === user.id ? result.user : item))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新账号状态失败')
    } finally {
      setBusy(false)
    }
  }

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await request('/api/admin/staff-users', 'POST', newUser)
      setUsers(current => [...current, result.user])
      setUserEdits(current => ({ ...current, [result.user.id]: { roleId: result.user.roleId, password: '' } }))
      setNewUser(current => ({ ...current, username: '', password: '' }))
      setNotice(`已创建账号 ${result.user.username}。初始密码仅用于首次登录，需修改后才能使用其他后台栏目。`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '创建账号失败')
    } finally {
      setBusy(false)
    }
  }

  return <div className="admin-content access-view">
    <div className="admin-title-row"><div><div className="admin-eyebrow"><i/> 后台安全</div><h1>权限与账号</h1><p>配置后台角色栏目权限，并创建独立后台人员账号。</p></div><button className="access-refresh" onClick={() => void refresh()} disabled={busy}>刷新</button></div>
    <div className="access-note"><ShieldCheck size={16}/><span>权限由服务端校验，不只是隐藏导航。后台账号、角色及演示数据当前保存在 API 进程内存，服务重启后会重置；生产使用前需配置持久化存储。</span></div>
    <section className="access-panel">
      <header><div><h2>角色与栏目权限</h2><p>勾选该角色允许访问的后台栏目；超级管理员角色不可修改。</p></div><div className="access-new-role"><input value={newRoleName} onChange={event => setNewRoleName(event.target.value)} placeholder="新角色名称" maxLength={40}/><button onClick={createRole} disabled={!newRoleName.trim()}><Plus size={14}/>添加角色</button></div></header>
      <div className="access-roles">{roles.map(role => <article className="access-role" key={role.id}>
        <div className="access-role-head"><input aria-label="角色名称" value={role.name} disabled={role.id === 'superadmin'} onChange={event => setRoles(current => current.map(item => item.id === role.id ? { ...item, name: event.target.value } : item))}/><span>{role.id === 'superadmin' ? '系统内置' : role.id}</span></div>
        <div className="access-module-list">{modules.map(module => <label key={module.id}><input type="checkbox" checked={role.permissions.includes(module.id)} disabled={role.id === 'superadmin'} onChange={event => setRoles(current => current.map(item => item.id === role.id ? { ...item, permissions: event.target.checked ? [...item.permissions, module.id] : item.permissions.filter(permission => permission !== module.id) } : item))}/>{module.name}</label>)}</div>
        {role.id !== 'superadmin' && <button className="access-remove-role" onClick={() => setRoles(current => current.filter(item => item.id !== role.id))}>移除此角色</button>}
      </article>)}</div>
      <button className="admin-primary access-save" onClick={() => void saveRoles()} disabled={busy}><Save size={14}/>保存角色权限</button>
    </section>
    <section className="access-panel">
      <header><div><h2>后台人员账号</h2><p>初始密码至少 12 位；人员首次登录后必须修改密码。</p></div></header>
      <form className="access-create-user" onSubmit={event => void createUser(event)}>
        <label>账号<input required minLength={3} maxLength={32} value={newUser.username} onChange={event => setNewUser(current => ({ ...current, username: event.target.value }))} placeholder="例如：ops.jane"/></label>
        <label>初始密码<input required minLength={12} maxLength={128} type="password" value={newUser.password} onChange={event => setNewUser(current => ({ ...current, password: event.target.value }))} placeholder="至少 12 个字符"/></label>
        <label>分配角色<select required value={newUser.roleId} onChange={event => setNewUser(current => ({ ...current, roleId: event.target.value }))}>{roles.filter(role => role.id !== 'superadmin').map(role => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label>
        <button className="admin-primary" disabled={busy}><UserPlus size={14}/>创建后台账号</button>
      </form>
      <div className="access-users">{users.length ? users.map(user => <article className="access-user" key={user.id}>
        <div className="access-user-name"><b>{user.username}</b><small>{user.mustChangePassword ? '需修改临时密码' : '密码已更新'}</small></div>
        <select aria-label={`${user.username} 角色`} value={userEdits[user.id]?.roleId || user.roleId} onChange={event => setUserEdits(current => ({ ...current, [user.id]: { ...current[user.id], roleId: event.target.value } }))}>{roles.filter(role => role.id !== 'superadmin').map(role => <option value={role.id} key={role.id}>{role.name}</option>)}</select>
        <input aria-label={`${user.username} 重置临时密码`} type="password" minLength={12} maxLength={128} placeholder="可选：重置临时密码" value={userEdits[user.id]?.password || ''} onChange={event => setUserEdits(current => ({ ...current, [user.id]: { ...current[user.id], password: event.target.value } }))}/>
        <button className="access-user-save" onClick={() => void saveUser(user)} disabled={busy}>保存</button>
        <button className={`access-user-status ${user.active ? 'enabled' : ''}`} onClick={() => void toggleUser(user)} disabled={busy}>{user.active ? '停用账号' : '启用账号'}</button>
      </article>) : <div className="access-empty">还没有后台人员账号。超级管理员主密钥不会显示在此列表中。</div>}</div>
    </section>
    {notice && <div className="project-notice">{notice}</div>}
    {error && <div className="project-error admin-error">{error}</div>}
  </div>
}
