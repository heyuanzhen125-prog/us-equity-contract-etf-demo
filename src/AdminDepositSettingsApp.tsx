import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, Coins, Save } from 'lucide-react'
import './admin.css'
import './deposit.css'

type Currency = 'USDT' | 'USDC'
type DepositNetwork = { network: string; address: string; qrUrl: string }
type CurrencyConfig = { minimumAmount: number; instruction: string; networks: DepositNetwork[] }
type DepositConfig = Record<Currency, CurrencyConfig>
type DirectWalletStatus = { automaticCreditEnabled: false; ledgerConfigured: boolean; missingGlobal: string[]; message: string; networks: { network: string; chain: string; provider: string; configurationComplete: boolean; missing: string[] }[] }

const currencies: Currency[] = ['USDT', 'USDC']
const supportedNetworks = ['TRC20', 'ERC20', 'Polygon']
const initialConfig: DepositConfig = {
  USDT: { minimumAmount: 10, instruction: '此页面不处理真实资金，请勿转入资产。', networks: supportedNetworks.map(network => ({ network, address: '', qrUrl: '' })) },
  USDC: { minimumAmount: 10, instruction: '此页面不处理真实资金，请勿转入资产。', networks: supportedNetworks.map(network => ({ network, address: '', qrUrl: '' })) },
}

export default function AdminDepositSettingsApp({ adminKey }: { adminKey: string }) {
  const [config, setConfig] = useState<DepositConfig>(initialConfig)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [walletStatus, setWalletStatus] = useState<DirectWalletStatus | null>(null)

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
      const statusResponse = await fetch('/api/admin/direct-wallet-status', { headers: { 'x-admin-key': adminKey } })
      const statusResult = await statusResponse.json()
      if (!statusResponse.ok) throw new Error(statusResult.error || '读取钱包接入状态失败')
      setWalletStatus(statusResult)
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
      setNotice('USDT / USDC 虚拟充值配置已保存。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存充值配置失败')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return <div className="deposit-admin-page"><header className="deposit-admin-header"><div><div className="deposit-admin-eyebrow">资金虚拟</div><h1>USDT / USDC 充值配置</h1><p>{error || '正在读取充值配置…'}</p></div></header></div>

  return <div className="deposit-admin-page">
    <header className="deposit-admin-header"><div><div className="deposit-admin-eyebrow">资金虚拟</div><h1>USDT / USDC 充值配置</h1><p>这些设置只用于展示虚拟充值信息，不会生成真实收款或链上入账。</p></div></header>
    <section className="deposit-admin-card"><div className="deposit-admin-card-title"><Coins size={17}/><div><h2>直连钱包 API 接入状态</h2><p>TRC20 使用 TronGrid；ERC20 / Polygon 使用 Alchemy。此处只显示配置状态，不包含密钥。</p></div></div><div className="project-safety"><AlertTriangle size={14}/><span><b>真实自动入账已关闭。</b>框架目前不会监听或核实链上交易；开启前还需完成持久化账本和链上确认处理。</span></div><div className="deposit-admin-networks wallet-chain-status">{walletStatus?.networks.map(network=><div key={network.network}><b>{network.network} · {network.chain}</b><span>{network.configurationComplete?'配置项齐全':'待配置'}</span><small>数据接口：{network.provider}{network.missing.length>0?` · 缺少 ${network.missing.join(', ')}`:''}</small></div>)}</div><p className="deposit-admin-note">账本：{walletStatus?.ledgerConfigured?'已配置持久化数据库':'尚未配置持久化数据库'}{walletStatus?.missingGlobal.length?` · 缺少 ${walletStatus.missingGlobal.join(', ')}`:''}</p></section>
    <form onSubmit={event => void save(event)}>
      {currencies.map(currency => {
        const item = config[currency]
        return <section className="deposit-admin-card" key={currency}>
          <div className="deposit-admin-card-title"><Coins size={17}/><div><h2>{currency} 虚拟充值</h2><p>单独配置可用网络、虚拟地址和二维码</p></div></div>
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
            <label className="deposit-admin-field">测试收款地址<input maxLength={160} value={entry.address} onChange={event => updateCurrency(currency, { networks: item.networks.map(value => value.network === entry.network ? { ...value, address: event.target.value } : value) })} placeholder="可留空；请勿填写真实资金地址"/></label>
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
