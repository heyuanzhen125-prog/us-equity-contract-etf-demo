# Direct USDT wallet integration

## Current state

The application exposes an admin-only readiness endpoint at
`GET /api/admin/direct-wallet-status`. It reports whether each network has a
node API key, a receive address, a USDT contract address, and a durable ledger
database configured. It never returns API secrets.

This is framework-only. `automaticCreditEnabled` is always false. The current
wallet balance and transaction maps are process memory, so they are not a safe
ledger for real funds. The existing demo deposit route is still separate from
this chain-integration status.

## Network setup

| Network | Chain reader | Required server variables |
| --- | --- | --- |
| TRC20 | TronGrid | `TRONGRID_API_KEY`, `TRON_USDT_RECEIVE_ADDRESS`, `TRON_USDT_CONTRACT_ADDRESS` |
| ERC20 | Alchemy | `ALCHEMY_API_KEY`, `ETH_USDT_RECEIVE_ADDRESS`, `ETH_USDT_CONTRACT_ADDRESS` |
| Polygon | Alchemy | `ALCHEMY_API_KEY`, `POLYGON_USDT_RECEIVE_ADDRESS`, `POLYGON_USDT_CONTRACT_ADDRESS` |

All networks also require `WALLET_LEDGER_DATABASE_URL`. Add credentials in the
hosting provider's server-side environment settings; never put keys in Vite
variables or browser code.

Before accepting Polygon deposits, explicitly decide whether the platform
accepts legacy bridged USDT or Polygon USDT0. Polygon announced the migration
of its Polygon PoS USDT deployment to native USDT0. Do not reuse the Ethereum
USDT contract on Polygon.

## Required implementation before activation

1. Move balances and transaction history to a durable Postgres ledger.
2. Create a deposit intent tied to the authenticated personal ID and selected
   network; do not trust a client-supplied personal ID alone.
3. Verify token contract, recipient, amount, transaction hash, log/event index,
   chain, and finality using the network API. Make `(network, tx_hash, event)`
   unique so retries cannot credit twice.
4. Verify provider webhook signatures, or poll by transaction hash. Mark
   deposits `confirming` until the configured finality threshold, then post a
   single ledger credit transaction.
5. Keep withdrawals in manual review initially. Any automated payout must use
   a protected signer or custody service; never put a mnemonic/private key in
   the website or ordinary environment variables.
6. Keep chain deposits disabled until the verification, database, replay
   protection, and reconciliation paths have been exercised on testnets.
