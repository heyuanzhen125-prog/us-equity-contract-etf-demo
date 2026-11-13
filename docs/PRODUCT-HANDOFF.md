# Northstar Markets 交付手册

更新日期：2026-11-13

## 当前可交付范围

当前版本可作为公开访问的 H5 产品原型、内部运营后台和 SIM 模拟交易演示交付。前台注册、个人 ID、模拟订单/账单、预测事件、管理配置、成员/资金/KYC 审核页面均有对应 API 流程。网页端和后台读写同一套配置；配置在 `SUPABASE_URL` 与 `SUPABASE_SECRET_KEY` 可用时写入 `platform_app_state`，并由前台配置接口读取。

本产品当前不处理真实证券订单或真实资产：

- 合约 ETF、时间合约和事件预测余额均为模拟记账。
- 时间合约按下单时冻结的 SIM 曲线快照自动结算。
- 后台批量或个人级强制输赢，以及逐笔手动改结果，只能用于未连接数据库的本地隔离测试；公网与数据库环境会由服务端拒绝。
- USDT 页面仅记录模拟申请，不生成收款地址、不验证链上到账，也不广播提现。
- KYC 仅管理审核状态，不收集证件影像或调用身份核验供应商。
- 免费 Alpaca IEX 适配器只覆盖 IEX 数据；需要 API 凭证，公网客户展示前还需确认数据展示授权。

## 打开产品

- 前台：<https://us-equity-contract-etf-demo.vercel.app/>
- 后台：<https://us-equity-contract-etf-demo.vercel.app/admin>
- 本地开发：运行 `npm install`、`npm run dev`，再打开 `http://127.0.0.1:5173/`；后台为 `http://127.0.0.1:5173/admin`。

生产超级管理员使用 Vercel `ADMIN_REVIEW_KEY` 登录，不使用本地的 `local-demo-admin`。不要把密钥发到聊天或提交到代码库。

## 新环境部署顺序

1. 在 Supabase 项目中按文件名顺序应用 `supabase/migrations/` 下的 SQL 迁移，并检查项目 Auth 邮箱验证设置。
2. 在 Vercel Production 环境设置 `ADMIN_REVIEW_KEY`、`SUPABASE_URL`、`SUPABASE_SECRET_KEY`。`SUPABASE_SECRET_KEY` 是服务端高权限密钥，只能存储在 Vercel 环境变量中。
3. 如需连接 Alpaca 行情，在 Vercel 配置 `ALPACA_DATA_API_KEY_ID` 与 `ALPACA_DATA_API_SECRET_KEY`。未获书面公开展示许可前，不启用 `ALPACA_PUBLIC_DISPLAY_AUTHORIZED`。
4. 部署后分别打开前台、后台；在后台保存一项无风险配置，再刷新前台确认显示同步。后台配置页会显示当前是否检测到 Supabase 持久化。

环境变量完整样例见仓库根目录 `.env.example`。所有生产密钥都必须由项目所有者在 Vercel/Supabase 控制台填写。

## 当前生产上线阻塞项

若目标是向美国客户提供真实交易，还需完成券商合作和批准、真实订单/成交/持仓生命周期、市场数据展示许可、结算依据、客户资产托管/支付、KYC/AML、法律审查、安全与灾备验收。具体范围见仓库根目录 README 的“美国真实证券交易发布路线”。在这些依赖未完成前，只交付 SIM 产品原型，不宣传为实盘交易平台。
