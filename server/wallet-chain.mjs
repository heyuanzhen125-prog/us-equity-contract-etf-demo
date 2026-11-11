const networkDefinitions = [
  {
    network: 'TRC20',
    chain: 'TRON',
    provider: 'TronGrid',
    required: ['TRONGRID_API_KEY', 'TRON_USDT_RECEIVE_ADDRESS', 'TRON_USDT_CONTRACT_ADDRESS'],
  },
  {
    network: 'ERC20',
    chain: 'Ethereum',
    provider: 'Alchemy',
    required: ['ALCHEMY_API_KEY', 'ETH_USDT_RECEIVE_ADDRESS', 'ETH_USDT_CONTRACT_ADDRESS'],
  },
  {
    network: 'Polygon',
    chain: 'Polygon PoS',
    provider: 'Alchemy',
    required: ['ALCHEMY_API_KEY', 'POLYGON_USDT_RECEIVE_ADDRESS', 'POLYGON_USDT_CONTRACT_ADDRESS'],
  },
]

export function getDirectWalletStatus() {
  const missingGlobal = []
  if (!process.env.WALLET_LEDGER_DATABASE_URL?.trim()) missingGlobal.push('WALLET_LEDGER_DATABASE_URL')

  return {
    mode: 'framework-only',
    automaticCreditEnabled: false,
    ledgerConfigured: missingGlobal.length === 0,
    missingGlobal,
    networks: networkDefinitions.map(definition => {
      const missing = definition.required.filter(name => !process.env[name]?.trim())
      const addressName = definition.required.find(name => name.endsWith('_RECEIVE_ADDRESS'))
      return {
        network: definition.network,
        chain: definition.chain,
        provider: definition.provider,
        receiveAddress: addressName ? process.env[addressName]?.trim() || '' : '',
        configurationComplete: missing.length === 0 && missingGlobal.length === 0,
        missing,
      }
    }),
    message: '只读接入框架已准备；链上验签、确认数校验和持久化入账尚未启用。',
  }
}
