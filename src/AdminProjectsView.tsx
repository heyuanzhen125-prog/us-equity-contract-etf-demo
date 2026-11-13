import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, Eye, EyeOff, Plus, RefreshCw, Save, TrendingDown, TrendingUp, Trash2 } from 'lucide-react'

type Project = {
  id: string
  symbol: string
  name: string
  startPrice: number
  lastPrice: number
  targetChangePct: number
  curve: number[]
  marketPoints: number[]
  marketPointIntervalSeconds: number
  previewPoints: number[]
  simulated: true
  visible: boolean
  sortOrder: number
  updatedAt: string
}
type ProjectDraft = Pick<Project, 'symbol' | 'name' | 'startPrice' | 'targetChangePct' | 'visible' | 'sortOrder'>

const fmt = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Curve({ values, positive }: { values: number[]; positive: boolean }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${44 - ((value - min) / range) * 38}`).join(' ')
  return <svg className="project-curve" viewBox="0 0 100 50" preserveAspectRatio="none"><polyline points={points} fill="none" stroke={positive ? '#6bd5a2' : '#f18b8f'} strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>
}

export default function AdminProjectsView({ adminKey }: { adminKey: string }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [drafts, setDrafts] = useState<Record<string, ProjectDraft>>({})
  const [pointDrafts, setPointDrafts] = useState<Record<string, number[]>>({})
  const [intervalDrafts, setIntervalDrafts] = useState<Record<string, number>>({})
  const [form, setForm] = useState({ symbol: 'SIM-DEMO', name: '虚拟项目', startPrice: '100', targetChangePct: '3' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/projects', { headers: { 'x-admin-key': adminKey } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '读取项目列表失败')
      setProjects(result.projects)
      setPointDrafts(Object.fromEntries(result.projects.map((project: Project) => [project.id, project.marketPoints || project.curve])))
      setIntervalDrafts(Object.fromEntries(result.projects.map((project: Project) => [project.id, project.marketPointIntervalSeconds || 5])))
      setDrafts(Object.fromEntries(result.projects.map((project: Project) => [project.id, {
        symbol: project.symbol,
        name: project.name,
        startPrice: project.startPrice,
        targetChangePct: project.targetChangePct,
        visible: project.visible,
        sortOrder: project.sortOrder,
      }])))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '后台服务不可用')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void refresh() }, [adminKey])

  const summary = useMemo(() => ({
    visible: projects.filter(project => project.visible).length,
    rising: projects.filter(project => project.targetChangePct > 0).length,
    falling: projects.filter(project => project.targetChangePct < 0).length,
  }), [projects])

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(form),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '创建失败')
      setForm(current => ({ ...current, symbol: `SIM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, name: '' }))
      setNotice(`${result.project.symbol} 已添加到前台项目列表`)
      await refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '创建失败')
    } finally {
      setBusy(false)
    }
  }

  const saveProject = async (project: Project) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(drafts[project.id]),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '保存项目失败')
      setNotice(`${result.project.symbol} 项目已更新`)
      await refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存项目失败')
    } finally {
      setBusy(false)
    }
  }

  const deleteProject = async (project: Project) => {
    if (!window.confirm(`确定删除 ${project.symbol}「${project.name}」吗？`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '删除项目失败')
      setNotice(`${project.symbol} 已从前台项目列表删除`)
      await refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '删除项目失败')
    } finally {
      setBusy(false)
    }
  }

  const setDirection = (project: Project, direction: 'up' | 'down') => {
    const current = drafts[project.id] || project
    const magnitude = Math.max(1, Math.abs(Number(current.targetChangePct)) || 3)
    const targetChangePct = direction === 'up' ? magnitude : -magnitude
    setDrafts(items => ({ ...items, [project.id]: { ...current, targetChangePct: Math.min(20, targetChangePct) } }))
    const end = project.startPrice * (1 + Math.max(-20, Math.min(20, targetChangePct)) / 100)
    setPointDrafts(items => ({
      ...items,
      [project.id]: Array.from({ length: 20 }, (_, index) => {
        const progress = index / 19
        const wave = Math.sin(index * 1.47) * project.startPrice * 0.004 * Math.sin(progress * Math.PI)
        return Math.round((project.startPrice + (end - project.startPrice) * progress + wave) * 100) / 100
      }),
    }))
  }

  const savePoints = async (project: Project) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/admin/projects/${project.id}/market-points`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ points: pointDrafts[project.id], intervalSeconds: intervalDrafts[project.id] || 5 }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '启动行情点位失败')
      setProjects(current => current.map(item => item.id === project.id ? result.project : item))
      setPointDrafts(current => ({ ...current, [project.id]: result.project.marketPoints }))
      setNotice(`${project.symbol} 已按设置的 20 个行情点位开始运行；每 ${result.project.marketPointIntervalSeconds} 秒进入下一点。`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '启动行情点位失败')
    } finally {
      setBusy(false)
    }
  }

  return <div className="admin-content project-admin-content">
    <div className="admin-title-row">
      <div><div className="admin-eyebrow"><i/> 前台项目管理</div><h1>项目列表</h1><p>在这里新增、编辑、排序、上下架前台展示的虚拟项目，无需改动页面代码。</p></div>
      <button className="wallet-refresh" onClick={() => void refresh()} disabled={busy}><RefreshCw size={14} className={busy ? 'spinning' : ''}/> 刷新项目</button>
    </div>
    <div className="project-safety"><Activity size={16}/><span><b>SIM 价格曲线 · 仅用于界面展示</b> · 保存后，前台价格会按下方设定点位依次运行；不会影响真实市场或订单结算。</span></div>
    <div className="project-admin-grid">
      <form className="project-create-card" onSubmit={event => void createProject(event)}>
        <div className="project-card-title"><div><span>添加前台项目</span><small>发布后会出现在前台项目列表</small></div><span className="sim-chip">SIM ONLY</span></div>
        <label>项目代码<input value={form.symbol} onChange={event => setForm(current => ({ ...current, symbol: event.target.value.toUpperCase() }))} pattern="SIM-[A-Z0-9]{2,8}" title="代码必须以 SIM- 开头" required/></label>
        <label>项目名称<input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="例如：AI 参考指数" required maxLength={60}/></label>
        <div className="project-form-pair">
          <label>起始价格<input type="number" min="0.01" max="1000000" step="0.01" value={form.startPrice} onChange={event => setForm(current => ({ ...current, startPrice: event.target.value }))} required/></label>
          <label>目标变化 %<input type="number" min="-20" max="20" step="0.1" value={form.targetChangePct} onChange={event => setForm(current => ({ ...current, targetChangePct: event.target.value }))} required/></label>
        </div>
        <button className="admin-primary project-create-button" disabled={busy}><Plus size={14}/> 添加项目</button>
      </form>
      <section className="project-list-card">
        <div className="project-card-title"><div><span>前台项目</span><small>{summary.visible} 个上架 · {summary.rising} 条上行 / {summary.falling} 条下行</small></div><span className="sim-chip">前台同步</span></div>
        {projects.length === 0 ? <div className="admin-empty project-empty"><div><Activity size={20}/></div><b>还没有项目</b><p>添加项目后即可在这里编辑和管理前台显示。</p></div> : <div className="managed-projects">
          {projects.map(project => {
            const draft = drafts[project.id] || project
            const update = (patch: Partial<ProjectDraft>) => setDrafts(current => ({ ...current, [project.id]: { ...draft, ...patch } }))
            return <article className="managed-project" key={project.id}>
              <div className="managed-project-main"><div className="sim-project-icon">SIM</div><div className="managed-project-name"><b>{draft.symbol}</b><small>{draft.name}</small></div><div className={`project-change ${draft.targetChangePct >= 0 ? '' : 'down'}`}>{draft.targetChangePct >= 0 ? '+' : ''}{Number(draft.targetChangePct).toFixed(1)}%</div></div>
              <div className="managed-project-chart"><Curve values={project.curve} positive={project.targetChangePct >= 0}/><div><span>${fmt(project.startPrice)}</span><span>${fmt(project.lastPrice)}</span></div></div>
              <div className="sim-market-controls">
                <span>快捷生成一组点位（可再逐点调整）</span>
                <button type="button" onClick={() => setDirection(project, 'up')} disabled={busy}><TrendingUp size={13}/>拉升</button>
                <button type="button" onClick={() => setDirection(project, 'down')} disabled={busy}><TrendingDown size={13}/>拉跌</button>
              </div>
              <details className="sim-point-editor">
                <summary>设置实际行情点位（20 个点）</summary>
                <p>保存即从第 1 点开始运行，前台价格和曲线按点位顺序变化；点位范围为起始价 ±20%。</p>
                <label className="sim-point-interval">每个点切换间隔（秒）<input type="number" min="1" max="60" step="1" value={intervalDrafts[project.id] || 5} onChange={event => setIntervalDrafts(current => ({ ...current, [project.id]: Number(event.target.value) }))}/></label>
                <div className="sim-point-grid">{(pointDrafts[project.id] || project.marketPoints || project.curve).map((value, index) => <label key={index}><span>点 {index + 1}</span><input type="number" min={project.startPrice * 0.8} max={project.startPrice * 1.2} step="0.01" value={value} onChange={event => {
                  const points = [...(pointDrafts[project.id] || project.marketPoints || project.curve)]
                  points[index] = Number(event.target.value)
                  setPointDrafts(current => ({ ...current, [project.id]: points }))
                }}/></label>)}</div>
                <button className="sim-point-save" type="button" onClick={() => void savePoints(project)} disabled={busy}><Save size={13}/>应用点位并开始行情</button>
              </details>
              <div className="project-form-pair"><label>项目代码<input value={draft.symbol} pattern="SIM-[A-Z0-9]{2,8}" onChange={event => update({ symbol: event.target.value.toUpperCase() })}/></label><label>项目名称<input maxLength={60} value={draft.name} onChange={event => update({ name: event.target.value })}/></label></div>
              <div className="project-form-pair"><label>起始价格<input type="number" min="0.01" max="1000000" step="0.01" value={draft.startPrice} onChange={event => update({ startPrice: Number(event.target.value) })}/></label><label>目标变化 %<input type="number" min="-20" max="20" step="0.1" value={draft.targetChangePct} onChange={event => update({ targetChangePct: Number(event.target.value) })}/></label></div>
              <div className="project-form-pair"><label>前台排序（小号靠前）<input type="number" min="0" max="999" step="1" value={draft.sortOrder} onChange={event => update({ sortOrder: Number(event.target.value) })}/></label><label className="front-toggle project-visibility"><span>{draft.visible ? <><Eye size={13}/> 已上架</> : <><EyeOff size={13}/> 已下架</>}</span><input type="checkbox" checked={draft.visible} onChange={event => update({ visible: event.target.checked })}/></label></div>
              <div className="project-admin-actions"><button onClick={() => void saveProject(project)} disabled={busy}><Save size={13}/> 保存修改</button><button className="project-delete-button" onClick={() => void deleteProject(project)} disabled={busy}><Trash2 size={13}/> 删除项目</button></div>
              <div className="project-disclosure">{project.targetChangePct >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} 前台只显示虚拟行情，修改后自动同步</div>
            </article>
          })}
        </div>}
      </section>
    </div>
    {notice && <div className="project-notice">{notice}</div>}
    {error && <div className="admin-error project-error">{error}</div>}
    <div className="admin-footnote"><Activity size={13}/> 价格曲线仅供界面展示；保存点位后价格依序变化，点位间线性过渡。订单结算仍使用独立虚拟轨迹。</div>
  </div>
}
