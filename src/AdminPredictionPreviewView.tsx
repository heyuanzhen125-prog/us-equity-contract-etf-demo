import { useEffect, useState } from 'react'
import { RefreshCw, ShieldAlert, Users } from 'lucide-react'
import { useVisiblePolling } from './useVisiblePolling'
import './sim-controls.css'

type Kind = 'contracts' | 'forecasts' | 'etfOrders'
type Result = 'won' | 'lost'
type Policy = { all: Result | null; users: Record<string, Result> }
type Order = {
  id: string
  kind: Kind
  personalId: string
  symbol: string
  direction?: string
  durationSeconds?: number
  expiresAt?: string
  entryPrice?: number
  exitPrice?: number | null
  settlementModel?: string
  settlementSource?: string
  settlementEvidence?: { curveHash?: string; evaluatedAt?: string } | null
  quantity?: number
  leverage?: number
  exposureAmount?: number
  probability?: number
  stake: number
  payoutPercent: number
  status: 'pending' | 'won' | 'lost' | 'draw'
  result: Result | 'draw' | null
  profit: number | null
  createdAt: string
}
type ControlsSnapshot = {
  policies: Record<Kind, Policy>
  pendingContracts: number
  pendingForecasts: number
  pendingEtfOrders: number
  manualOutcomePoliciesEnabled?: boolean
  executionMode?: 'local-sandbox' | 'protected-hosted'
  sandboxOnly?: boolean
  automaticTimeSettlementEnabled?: boolean
}
type ControlDraft = { scope: 'all' | 'user'; personalId: string }

const emptyPolicy: Policy = { all: null, users: {} }
const resultName = (result: Result | null) => result === 'won' ? '全赢' : result === 'lost' ? '全输' : '未设置'
const kindName: Record<Kind, string> = { contracts: '时间合约', forecasts: '事件预测', etfOrders: '合约 ETF' }
const formatAmount = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function readAdminJson<T>(response: Response, label: string): Promise<T> {
  const text = await response.text()
  let data: T
  try { data = JSON.parse(text) as T }
  catch { throw new Error(`${label}接口返回了非 JSON 响应（HTTP ${response.status}），请刷新页面重试`) }
  if (!response.ok) throw new Error((data as { error?: string })?.error || `${label}请求失败（HTTP ${response.status}）`)
  return data
}

export default function AdminPredictionPreviewView({ adminKey }: { adminKey: string }) {
  const [snapshot, setSnapshot] = useState<ControlsSnapshot>({
    policies: { contracts: emptyPolicy, forecasts: emptyPolicy, etfOrders: emptyPolicy },
    pendingContracts: 0,
    pendingForecasts: 0,
    pendingEtfOrders: 0,
    manualOutcomePoliciesEnabled: import.meta.env.DEV,
    automaticTimeSettlementEnabled: false,
  })
  const [orders, setOrders] = useState<Order[]>([])
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | Kind>('all')
  const [drafts, setDrafts] = useState<Record<Kind, ControlDraft>>({
    contracts: { scope: 'all', personalId: '' },
    forecasts: { scope: 'all', personalId: '' },
    etfOrders: { scope: 'all', personalId: '' },
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [settlementRationale, setSettlementRationale] = useState('')

  const refresh = async (silent = false, signal?: AbortSignal) => {
    if (!silent) {
      setBusy(true)
      setError('')
    }
    try {
      const headers = { 'x-admin-key': adminKey }
      const [controlsResponse, ordersResponse] = await Promise.all([
        fetch('/api/admin/outcome-controls', { headers, signal }),
        fetch('/api/admin/orders', { headers, signal }),
      ])
      const [controls, orderData] = await Promise.all([
        readAdminJson<ControlsSnapshot>(controlsResponse, '输赢控制'),
        readAdminJson<{ orders: Order[] }>(ordersResponse, '订单列表'),
      ])
      setSnapshot(controls)
      setOrders(orderData.orders)
      setError('')
    } catch (requestError) {
      if (signal?.aborted) return
      setError(requestError instanceof Error ? requestError.message : '读取输赢控制状态失败')
    } finally {
      if (!silent) setBusy(false)
    }
  }

  useEffect(() => { void refresh() }, [adminKey])
  useVisiblePolling(async signal => {
    if (!busy) await refresh(true, signal)
  }, 3000, true, [adminKey])

  const apply = async (kind: Kind, result: Result | null) => {
    const draft = drafts[kind]
    const target = draft.scope === 'all' ? 'all' : draft.personalId.trim().toUpperCase()
    if (draft.scope === 'user' && !target) {
      setError('请输入要设置的个人 ID')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/admin/outcome-controls/${kind}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ target, result }),
      })
      const data = await readAdminJson<ControlsSnapshot & { affected: number }>(response, '保存输赢规则')
      setSnapshot(data)
      const ordersResponse = await fetch('/api/admin/orders', { headers: { 'x-admin-key': adminKey } })
      const orderData = await readAdminJson<{ orders: Order[] }>(ordersResponse, '订单列表')
      setOrders(orderData.orders)
      const targetName = target === 'all' ? '全部虚拟账号' : target
      const resultNameText = result === 'won' ? '赢' : result === 'lost' ? '输' : '清除结果规则'
      const affectedText = kind === 'contracts'
        ? `已有 ${data.affected} 笔未结算合约已更新规则，并在各自到期时结算`
        : result ? `已有 ${data.affected} 条待处理${kind === 'forecasts' ? '预测' : 'ETF 订单'}已立即结算` : `已清除规则，已结算${kind === 'forecasts' ? '预测' : '订单'}不会改写`
      const kindName = kind === 'contracts' ? '时间合约' : kind === 'forecasts' ? '事件预测' : '合约 ETF 订单'
      setNotice(`${targetName}的${kindName}结果已设置为${resultNameText}。${affectedText}；后续新记录也按当前规则处理。`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存输赢规则失败')
    } finally {
      setBusy(false)
    }
  }

  const setOrderResult = async (order: Order, result: Result) => {
    if (settlementRationale.trim().length < 10) {
      setError('请先填写至少 10 个字符的结算依据')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/order-result', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ kind: order.kind, id: order.id, result, rationale: settlementRationale.trim() }),
      })
      const data = await readAdminJson<{ order: Order }>(response, '设置订单结果')
      setOrders(current => current.map(item => item.id === order.id ? { ...item, ...data.order } : item))
      const before = order.status === 'won' ? '赢' : order.status === 'lost' ? '输' : order.status === 'draw' ? '平局' : '待处理'
      setNotice(`${kindName[order.kind]}订单 ${order.id.slice(0, 8)}：${before} → ${result === 'won' ? '赢' : '输'}。虚拟余额已按最新结果重新结算。`)
      setSettlementRationale('')
      const controlsResponse = await fetch('/api/admin/outcome-controls', { headers: { 'x-admin-key': adminKey } })
      const controls = await readAdminJson<ControlsSnapshot>(controlsResponse, '刷新输赢控制状态')
      setSnapshot(controls)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '设置订单结果失败')
    } finally {
      setBusy(false)
    }
  }

  const filteredOrders = orders.filter(order => orderFilter === 'all'
    || (orderFilter === 'pending' ? order.status === 'pending' : order.kind === orderFilter))

  const renderPolicy = (kind: Kind) => {
    const policy = snapshot.policies[kind] || emptyPolicy
    const users = Object.entries(policy.users)
    return <div className="outcome-policy">
      <div><span>全体默认规则</span><b>{resultName(policy.all)}</b></div>
      {users.length > 0 && <div className="outcome-user-rules"><span>个人覆盖规则</span>{users.map(([personalId, result]) => <small key={personalId}>{personalId} · {resultName(result)}</small>)}</div>}
    </div>
  }

  const renderControls = (kind: Kind, title: string, description: string) => {
    const draft = drafts[kind]
    const pending = kind === 'contracts' ? snapshot.pendingContracts : kind === 'forecasts' ? snapshot.pendingForecasts : snapshot.pendingEtfOrders
    return <section className="outcome-control-card">
      <div className="outcome-control-card-head"><div><b>{title}</b><p>{description}</p></div><span>{pending} 条待处理</span></div>
      {renderPolicy(kind)}
      {snapshot.manualOutcomePoliciesEnabled ? <><div className="outcome-form">
        <label>控制范围<select value={draft.scope} onChange={event => setDrafts(current => ({ ...current, [kind]: { ...draft, scope: event.target.value as ControlDraft['scope'] } }))}>
          <option value="all">全部虚拟账号</option>
          <option value="user">指定个人 ID</option>
        </select></label>
        {draft.scope === 'user' && <label>个人 ID<input value={draft.personalId} placeholder="例如 NST-AB12CD34" maxLength={12} onChange={event => setDrafts(current => ({ ...current, [kind]: { ...draft, personalId: event.target.value.toUpperCase() } }))}/></label>}
      </div>
      <div className="outcome-actions">
        <button className="outcome-win" onClick={() => void apply(kind, 'won')} disabled={busy}>设为赢</button>
        <button className="outcome-loss" onClick={() => void apply(kind, 'lost')} disabled={busy}>设为输</button>
        <button className="outcome-reset" onClick={() => void apply(kind, null)} disabled={busy}>清除规则</button>
      </div>
      <small>{kind === 'contracts'
        ? '未结算合约将在原定到期时间按此结果结算；新合约沿用此规则。'
        : kind === 'forecasts'
          ? '待结算及后续预测按此结果结算；赢按事件收益比例返还虚拟积分，输扣除投入。'
          : '现有待处理订单立即结算；新单按订单金额扣款，赢按收益比例返还本金与收益，输扣除投入。'}</small>
      </> : <div className="project-safety"><ShieldAlert size={15}/><span>批量和个人级输赢规则已关闭：仅能在未连接数据库的本地隔离沙盒中测试，不会作用于公网订单。订单复核需填写依据并记录后台账号与审计时间。</span></div>}
    </section>
  }

  return <div className="admin-content sim-preview-page">
    <div className="admin-title-row">
      <div><div className="admin-eyebrow"><i/> 本地 SIM 沙盒测试</div><h1>输赢规则测试</h1><p>在无数据库连接的本地隔离环境中，测试时间合约、合约 ETF 与事件预测的批量或个人 ID 结果规则；公网和连接数据库时禁用。</p></div>
      <button className="wallet-refresh" onClick={() => void refresh()} disabled={busy}><RefreshCw size={14} className={busy ? 'spinning' : ''}/>刷新状态</button>
    </div>
    <div className="project-safety"><ShieldAlert size={16}/><span><b>仅限本地隔离沙盒</b> · 控制器会在公网部署或配置数据库时关闭；不可用于影响客户账户、真实订单或结算结果。</span></div>
    <section className="outcome-control-grid">
      {renderControls('contracts', '前台时间合约', '控制现有未结算合约及后续新合约的最终输赢结果。')}
      {renderControls('forecasts', '前台事件预测', '预测记录使用虚拟积分投入；赢返还本金及事件收益，输扣除投入。')}
      {renderControls('etfOrders', '前台合约 ETF 买卖单', '记录买入/卖出模拟订单并以虚拟美元余额结算输赢。')}
    </section>
    <section className="admin-orders-panel">
      <div className="admin-orders-head">
        <div><h2>前台订单</h2><span>{orders.length} 笔 · 只可对待处理模拟订单逐笔复核</span></div>
        <div className="admin-orders-filters">
          {([
            ['all', '全部'],
            ['pending', '待处理'],
            ['contracts', '时间合约'],
            ['etfOrders', '合约 ETF'],
            ['forecasts', '事件预测'],
          ] as const).map(([value, label]) => <button key={value} className={orderFilter === value ? 'active' : ''} onClick={() => setOrderFilter(value)}>{label}</button>)}
        </div>
      </div>
      <label className="settlement-rationale-field">结算依据（单笔复核必填）<textarea value={settlementRationale} onChange={event => setSettlementRationale(event.target.value)} maxLength={500} rows={2} placeholder="填写事件来源、结算依据或复核说明，至少 10 个字符"/></label>
      {filteredOrders.length === 0 ? <div className="admin-orders-empty">暂无符合条件的前台订单。用户在前台下单或保存预测后，会显示在这里。</div> : <div className="admin-orders-list">
        {filteredOrders.map(order => <article className="admin-order-row" key={`${order.kind}:${order.id}`}>
          <div className="admin-order-summary">
            <div className="admin-order-title"><b>{kindName[order.kind]}</b><span>{order.symbol}</span><em className={`admin-order-status ${order.status}`}>{order.status === 'pending' ? '待处理' : order.status === 'won' ? '赢' : order.status === 'lost' ? '输' : '平局'}</em></div>
            <div className="admin-order-meta">
              <span>个人 ID：{order.personalId}</span>
              <span>{order.kind === 'contracts' ? `${order.direction === 'up' ? '看涨' : '看跌'} · ${order.durationSeconds} 秒` : order.kind === 'etfOrders' ? `${order.direction === 'buy' ? '买入' : '卖出'} · ${order.quantity} 股 · ${order.leverage || 1}×` : `概率 ${order.probability}%`}</span>
              <span>{order.kind === 'etfOrders' ? `保证金 ${formatAmount(order.stake)} USD · 名义金额 ${formatAmount(order.exposureAmount || order.stake)} USD` : `投入 ${formatAmount(order.stake)} PTS`}</span>
              <span>{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
              {order.kind === 'contracts' && order.expiresAt && <span>到期 {new Date(order.expiresAt).toLocaleString('zh-CN')} · {order.settlementSource || 'SIM'} 快照结算{order.exitPrice !== null && order.exitPrice !== undefined ? ` · ${order.entryPrice?.toFixed(4)} → ${order.exitPrice.toFixed(4)}` : ''}</span>}
              {order.settlementEvidence?.curveHash && <span>曲线快照 {order.settlementEvidence.curveHash.slice(0, 16)}…</span>}
              {order.profit !== null && <span>盈亏 {order.profit > 0 ? '+' : ''}{formatAmount(order.profit)} {order.kind === 'etfOrders' ? 'USD' : 'PTS'}</span>}
            </div>
          </div>
          <div className="admin-order-actions">
            {order.status === 'pending' && order.kind === 'contracts' && snapshot.automaticTimeSettlementEnabled && <small className="settlement-auto-note">到期自动按冻结的 SIM 曲线快照结算</small>}
            {order.status === 'pending' && !(order.kind === 'contracts' && snapshot.automaticTimeSettlementEnabled) && <><button className="outcome-win" onClick={() => void setOrderResult(order, 'won')} disabled={busy || settlementRationale.trim().length < 10}>复核为赢</button>
            <button className="outcome-loss" onClick={() => void setOrderResult(order, 'lost')} disabled={busy || settlementRationale.trim().length < 10}>复核为输</button></>}
          </div>
        </article>)}
      </div>}
    </section>
    {notice && <div className="project-notice">{notice}</div>}
    {error && <div className="project-error admin-error">{error}</div>}
    <div className="admin-footnote"><Users size={13}/>指定个人 ID 时只覆盖该账号；设为全部时会清除该模块已有的个人覆盖。清除规则不会撤销已结算结果。</div>
  </div>
}
