import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, Plus, RefreshCw, Save, TrendingDown, TrendingUp, X } from 'lucide-react'

type Project = { id: string; symbol: string; name: string; startPrice: number; lastPrice: number; targetChangePct: number; curve: number[]; simulated: true; updatedAt: string }
const fmt = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Curve({ values, positive }: { values: number[]; positive: boolean }) {
  const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${44 - ((value - min) / range) * 38}`).join(' ')
  return <svg className="project-curve" viewBox="0 0 100 50" preserveAspectRatio="none"><polyline points={points} fill="none" stroke={positive ? '#6bd5a2' : '#f18b8f'} strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>
}

export default function AdminProjectsView({ adminKey }: { adminKey: string }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [form, setForm] = useState({ symbol: 'SIM-DEMO', name: '演示项目', startPrice: '100', targetChangePct: '3' })
  const [curveDrafts, setCurveDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/projects', { headers: { 'x-admin-key': adminKey } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '读取项目列表失败')
      setProjects(result.projects)
      setCurveDrafts(current => Object.fromEntries(result.projects.map((project: Project) => [project.id, current[project.id] ?? String(project.targetChangePct)])))
    } catch (err) { setError(err instanceof Error ? err.message : '后台服务不可用') }
    finally { setBusy(false) }
  }
  useEffect(() => { void refresh() }, [])
  const summary = useMemo(() => ({ rising: projects.filter(project => project.targetChangePct > 0).length, falling: projects.filter(project => project.targetChangePct < 0).length }), [projects])

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/admin/projects', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify(form) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '创建失败')
      setForm(current => ({ ...current, symbol: `SIM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, name: '' }))
      setNotice(`${result.project.symbol} 已发布到前台演示区`)
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : '创建失败') }
    finally { setBusy(false) }
  }
  const saveCurve = async (project: Project) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/admin/projects/${project.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ targetChangePct: Number(curveDrafts[project.id]) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '更新曲线失败')
      setNotice(`${project.symbol} 演示曲线已更新；前台仅显示为模拟行情`)
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : '更新曲线失败') }
    finally { setBusy(false) }
  }

  return <div className="admin-content project-admin-content"><div className="admin-title-row"><div><div className="admin-eyebrow"><i/> 模拟项目控制台</div><h1>项目与演示曲线</h1><p>仅管理 SIM- 前缀的虚拟项目，配置会同步至前台演示区。</p></div><button className="wallet-refresh" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={14} className={busy?'spinning':''}/> 刷新项目</button></div><div className="project-safety"><Activity size={16}/><span><b>演示数据隔离</b> · 此处编辑的是虚拟曲线，不修改或覆盖任何真实证券、交易所行情。</span></div><div className="project-admin-grid"><form className="project-create-card" onSubmit={createProject}><div className="project-card-title"><div><span>新建模拟标的</span><small>新增后将立即展示在前台</small></div><span className="sim-chip">SIM ONLY</span></div><label>项目代码<input value={form.symbol} onChange={event=>setForm(current=>({...current,symbol:event.target.value.toUpperCase()}))} pattern="SIM-[A-Z0-9]{2,8}" title="代码必须以 SIM- 开头" required/></label><label>项目名称<input value={form.name} onChange={event=>setForm(current=>({...current,name:event.target.value}))} placeholder="例如：AI 模拟指数" required maxLength={60}/></label><div className="project-form-pair"><label>起始模拟价格<input type="number" min="0.01" max="1000000" step="0.01" value={form.startPrice} onChange={event=>setForm(current=>({...current,startPrice:event.target.value}))} required/></label><label>目标曲线变化 %<input type="number" min="-20" max="20" step="0.1" value={form.targetChangePct} onChange={event=>setForm(current=>({...current,targetChangePct:event.target.value}))} required/></label></div><button className="admin-primary project-create-button" disabled={busy}><Plus size={14}/> 发布模拟项目</button></form><section className="project-list-card"><div className="project-card-title"><div><span>前台模拟项目</span><small>{projects.length} 个项目 · {summary.rising} 条上行 / {summary.falling} 条下行</small></div><span className="sim-chip">前台同步</span></div>{projects.length===0?<div className="admin-empty project-empty"><div><Activity size={20}/></div><b>还没有模拟项目</b><p>新建一个 SIM- 项目后即可在前台显示。</p></div>:<div className="managed-projects">{projects.map(project=><article className="managed-project" key={project.id}><div className="managed-project-main"><div className="sim-project-icon">SIM</div><div className="managed-project-name"><b>{project.symbol}</b><small>{project.name}</small></div><div className={`project-change ${project.targetChangePct>=0?'':'down'}`}>{project.targetChangePct>=0?'+':''}{project.targetChangePct.toFixed(1)}%</div></div><div className="managed-project-chart"><Curve values={project.curve} positive={project.targetChangePct>=0}/><div><span>${fmt(project.startPrice)}</span><span>${fmt(project.lastPrice)}</span></div></div><div className="curve-edit-row"><label>目标变化 %<input type="number" min="-20" max="20" step="0.1" value={curveDrafts[project.id] ?? project.targetChangePct} onChange={event=>setCurveDrafts(current=>({...current,[project.id]:event.target.value}))}/></label><button onClick={()=>void saveCurve(project)} disabled={busy}><Save size={13}/> 保存曲线</button></div><div className="project-disclosure">{project.targetChangePct>=0?<TrendingUp size={12}/>:<TrendingDown size={12}/>} 前台会显示为演示曲线，非实盘行情</div></article>)}</div>}</section></div>{notice&&<div className="project-notice">{notice}</div>}{error&&<div className="admin-error project-error"><X size={14}/>{error}</div>}<div className="admin-footnote"><Activity size={13}/> 曲线变化限制为 ±20%；新曲线不会影响已开始的秒合约模拟预测。</div></div>
}
