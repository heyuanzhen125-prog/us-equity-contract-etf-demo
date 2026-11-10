import { useEffect, useState, type FormEvent } from 'react'
import { Coins, Save } from 'lucide-react'
import './admin.css'
import './deposit.css'

type Currency = 'USDT' | 'USDC'
type DepositNetwork = { network: string; address: string; qrUrl: string }
type CurrencyConfig = { minimumAmount: number; instruction: string; networks: DepositNetwork[] }
type DepositConfig = Record<Currency, CurrencyConfig>

const currencies: Currency[] = ['USDT', 'USDC']
const supportedNetworks = ['TRC20', 'ERC20', 'Polygon']
const initialConfig: DepositConfig = {
  USDT: { minimumAmount: 10, instruction: '仅供演示，请勿向此页面提供真实资金。', networks: supportedNetworks.map(network => ({ network, address: '', qrUrl: '' })) },
  USDC: { minimumAmount: 10, instruction: '仅供演示，请勿向此页面提供真实资金。', networks: supportedNetworks.map(network => ({ network, address: '', qrUrl: '' })) },
}

export default function AdminDepositSettingsApp({ adminKey }: { adminKey: string }) {
  const [config, setConfig] = useState<DepositConfig>(initialConfig)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const updateCurrency = (currency: Currency, update: Partial<CurrencyConfig>) => {
    setConfig(current => ({ ...current, [currency]: { ...current[currency], ...update } }))
  }

  const loadConfig = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/deposit-config', { headers: { 'x-admin-key': adminKey } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '读取充值配置失败')
      setConfig(result.currencies)
      setLoaded(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '无法读取充值配置')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void loadConfig() }, [adminKey])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/deposit-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ currencies: config }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '保存充值配置失败')
      setConfig(result.currencies)
      setNotice('USDT / USDC 演示充值配置已保存。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存充值配置失败')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return <div className="deposit-admin-page"><header className="deposit-admin-header"><div><div className="deposit-admin-eyebrow">资金演示</div><h1>USDT / USDC 充值配置</h1><p>{error || '正在读取充值配置…'}</p></div></header></div>

  return <div className="deposit-admin-page">
    <header className="deposit-admin-header"><div><div className="deposit-admin-eyebrow">资金演示</div><h1>USDT / USDC 充值配置</h1><p>这些设置只用于展示模拟充值信息，不会生成真实收款或链上入账。</p></div></header>
    <form onSubmit={event => void save(event)}>
      {currencies.map(currency => {
        const item = config[currency]
        return <section className="deposit-admin-card" key={currency}>
          <div className="deposit-admin-card-title"><Coins size={17}/><div><h2>{currency} 演示充值</h2><p>单独配置可用网络、演示地址和二维码</p></div></div>
          <label className="deposit-admin-field">最低充值金额
            <input type="number" min="0.01" max="100000" step="0.01" value={item.minimumAmount} onChange={event => updateCurrency(currency, { minimumAmount: Number(event.target.value) })}/>
          </label>
          <div className="deposit-admin-networks"><b>支持网络</b>{supportedNetworks.map(network => {
            const existing = item.networks.find(entry => entry.network === network)
            return <label key={network}><input type="checkbox" checked={Boolean(existing)} onChange={event => {
              const networks = event.target.checked
                ? [...item.networks, { network, address: '', qrUrl: '' }]
                : item.networks.filter(entry => entry.network !== network)
              updateCurrency(currency, { networks: supportedNetworks.flatMap(name => networks.filter(entry => entry.network === name)) })
            }}/>{network}</label>
          })}</div>
          {item.networks.map(entry => <div className="deposit-admin-network-config" key={entry.network}>
            <h3>{entry.network}</h3>
            <label className="deposit-admin-field">演示收款地址<input maxLength={160} value={entry.address} onChange={event => updateCurrency(currency, { networks: item.networks.map(value => value.network === entry.network ? { ...value, address: event.target.value } : value) })} placeholder="可留空；请勿填写真实资金地址"/></label>
            <label className="deposit-admin-field">二维码图片 HTTPS 链接<input type="url" maxLength={2048} value={entry.qrUrl} onChange={event => updateCurrency(currency, { networks: item.networks.map(value => value.network === entry.network ? { ...value, qrUrl: event.target.value } : value) })} placeholder="https://example.com/demo-qr.png"/></label>
          </div>)}
          <label className="deposit-admin-field">充值说明 / 到账提示<textarea maxLength={280} value={item.instruction} onChange={event => updateCurrency(currency, { instruction: event.target.value })} rows={3}/></label>
        </section>
      })}
      <button className="admin-primary deposit-admin-save" disabled={busy}><Save size={15}/>{busy ? '保存中…' : '保存充值配置'}</button>
      {notice && <div className="project-notice">{notice}</div>}
      {error && <div className="project-error admin-error">{error}</div>}
    </form>
  </div>
}
