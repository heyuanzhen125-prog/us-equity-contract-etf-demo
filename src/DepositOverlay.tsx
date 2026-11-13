import { useEffect, useMemo, useState } from 'react'
import { Check, Coins, Copy, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import './deposit.css'

type Currency = 'USDT' | 'USDC'
type DepositNetwork = { network: string; address: string; qrUrl: string }
type CurrencyConfig = { minimumAmount: number; instruction: string; networks: DepositNetwork[] }
type Transaction = { id: string; currency: Currency; amount: number; network: string; createdAt: string }

const currencies: Currency[] = ['USDT', 'USDC']
const formatAmount = (amount: number) => amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function DepositOverlay() {
  const [open, setOpen] = useState(false)
  const [currency, setCurrency] = useState<Currency>('USDT')
  const [network, setNetwork] = useState('')
  const [amount, setAmount] = useState('10')
  const [config, setConfig] = useState<Record<Currency, CurrencyConfig> | null>(null)
  const [balances, setBalances] = useState<Record<Currency, number>>({ USDT: 0, USDC: 0 })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const activeConfig = config?.[currency]
  const activeNetwork = useMemo(
    () => activeConfig?.networks.find(item => item.network === network) || activeConfig?.networks[0],
    [activeConfig, network],
  )

  const load = async () => {
    setBusy(true)
    setError('')
    try {
      const [configResponse, walletResponse] = await Promise.all([
        fetch('/api/public-config'),
        fetch(`/api/wallet?personalId=${encodeURIComponent(localStorage.getItem('northstar.demo.personalId') || '')}`),
      ])
      const [configResult, walletResult] = await Promise.all([configResponse.json(), walletResponse.json()])
      if (!configResponse.ok) throw new Error(configResult.error || '读取充值配置失败')
      if (!walletResponse.ok) throw new Error(walletResult.error || '读取虚拟钱包失败')
      setConfig(configResult.config.depositAssets)
      setTransactions(walletResult.transactions.filter((item: Transaction) => currencies.includes(item.currency)))
      setBalances({ USDT: walletResult.balances?.USDT || 0, USDC: walletResult.balances?.USDC || 0 })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '充值服务暂不可用')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const show = () => {
      setOpen(true)
      setNotice('')
      void load()
    }
    window.addEventListener('northstar:deposit-open', show)
    return () => window.removeEventListener('northstar:deposit-open', show)
  }, [])

  useEffect(() => {
    if (activeConfig) {
      setNetwork(activeConfig.networks[0]?.network || '')
      setAmount(String(activeConfig.minimumAmount))
    }
  }, [currency, config])

  const simulateDeposit = async () => {
    if (!activeConfig || !activeNetwork) {
      setError('后台尚未配置该币种的可用网络')
      return
    }
    const value = Number(amount)
    if (!Number.isFinite(value) || value < activeConfig.minimumAmount) {
      setError(`最低虚拟充值金额为 ${activeConfig.minimumAmount} ${currency}`)
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/wallet/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalId: localStorage.getItem('northstar.demo.personalId'),
          amount: value,
          network: activeNetwork.network,
          currency,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '虚拟充值失败')
      setBalances(current => ({ ...current, [currency]: result.balance }))
      setTransactions(current => [result.transaction, ...current])
      setNotice(`虚拟入账 +${formatAmount(value)} ${currency}；未发生链上转账。`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '虚拟充值服务暂不可用')
    } finally {
      setBusy(false)
    }
  }

  const copyAddress = async () => {
    if (!activeNetwork?.address) return
    try {
      await navigator.clipboard.writeText(activeNetwork.address)
      setNotice('虚拟地址已复制。请勿向该地址转入真实资产。')
    } catch {
      setError('无法访问剪贴板，请手动复制虚拟地址。')
    }
  }

  if (!open) return null

  return (
    <div className="deposit-overlay-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section className="deposit-overlay" role="dialog" aria-modal="true" aria-labelledby="deposit-overlay-title">
        <header className="deposit-overlay-header">
          <div className="deposit-overlay-icon"><Coins size={19}/></div>
          <div><h2 id="deposit-overlay-title">USDT / USDC 虚拟充值</h2><p>账户余额仅为虚拟记账，不会接收或转移真实资金</p></div>
          <button type="button" className="deposit-overlay-close" aria-label="关闭" onClick={() => setOpen(false)}><X size={18}/></button>
        </header>
        <div className="deposit-demo-warning"><TriangleAlert size={16}/><span><b>此功能仅记录账本。</b>不要向页面所示地址转入真实数字资产。</span></div>
        <div className="deposit-currency-options" aria-label="选择充值币种">
          {currencies.map(item => <button type="button" key={item} className={currency === item ? 'selected' : ''} onClick={() => setCurrency(item)}>{item}</button>)}
        </div>
        {error && <div className="deposit-feedback error">{error}</div>}
        {notice && <div className="deposit-feedback success">{notice}</div>}
        {busy && !config ? <div className="deposit-loading">正在读取充值配置…</div> : activeConfig && <>
          <label className="deposit-overlay-label">选择网络</label>
          <div className="deposit-chain-options">
            {activeConfig.networks.map(item => <button type="button" key={item.network} className={activeNetwork?.network === item.network ? 'selected' : ''} onClick={() => setNetwork(item.network)}>{item.network}</button>)}
          </div>
          <div className="deposit-address-card">
            {activeNetwork?.qrUrl && <img className="deposit-qr" src={activeNetwork.qrUrl} alt={`${currency} ${activeNetwork.network} 虚拟二维码`}/>}
            <div className="deposit-address-title">{currency} · {activeNetwork?.network || '未配置网络'} 虚拟地址</div>
            <div className="deposit-address-line"><code>{activeNetwork?.address || '后台尚未填写虚拟地址'}</code>{activeNetwork?.address && <button type="button" onClick={() => void copyAddress()} aria-label="复制虚拟地址"><Copy size={14}/></button>}</div>
            <p>{activeConfig.instruction || '请勿向该虚拟地址转入真实资产。'}</p>
          </div>
          <label className="deposit-overlay-label" htmlFor="deposit-overlay-amount">虚拟充值金额</label>
          <div className="deposit-overlay-amount"><input id="deposit-overlay-amount" type="number" min={activeConfig.minimumAmount} step="0.01" value={amount} onChange={event => setAmount(event.target.value)}/><span>{currency}</span></div>
          <small className="deposit-minimum">最低 {activeConfig.minimumAmount} {currency}</small>
          <div className="deposit-overlay-balance"><span>{currency} 虚拟余额</span><b>{formatAmount(balances[currency])} {currency}</b></div>
          <button type="button" className="deposit-overlay-submit" disabled={busy || !activeNetwork} onClick={() => void simulateDeposit()}>{busy ? '处理中…' : `虚拟增加 ${currency} 余额`}</button>
          {notice && <div className="deposit-confirmation"><Check size={14}/>{notice}</div>}
        </>}
        {transactions.length > 0 && <div className="deposit-overlay-history"><h3>虚拟流水</h3>{transactions.slice(0, 5).map(item => <div key={item.id}><span>+{formatAmount(item.amount)} {item.currency}</span><small>{item.network} · {new Date(item.createdAt).toLocaleString('zh-CN')}</small></div>)}</div>}
        <footer><ShieldCheck size={13}/> 链上充值与实际到账均未启用</footer>
      </section>
    </div>
  )
}
