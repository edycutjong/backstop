# Backstop — web app

The judge-facing dApp for **Backstop** (redemption insurance for FXRP). It reads
the **live deployed contracts on Flare Coston2** (chain 114) and lets you buy a
guard, underwrite the pool, and verify the Flare integration end-to-end.

Next.js (App Router) · TypeScript · wagmi + viem · Tailwind. Deployable on Vercel.

## Run

```bash
cd build/web
npm install
cp .env.example .env.local   # values are public; defaults already point at Coston2
npm run dev                  # http://localhost:3000
# or
npm run build && npm start
```

Read-only views (landing, `/integrations/verify`) render **live Coston2 data with
no wallet connected**. Wallet-gated actions (buy guard, deposit/withdraw) use an
injected wallet (MetaMask) on Coston2.

## Pages

| Route | What |
|---|---|
| `/` | Hero + live pool stats (TVL, share price, total shares, guards issued) read from chain. |
| `/guard` | Buy a guard: FTSO-priced premium (`quotePremiumFlr`) + wallet-gated `buyGuard`. |
| `/underwrite` | LP deposit / withdraw with your live shares + value. |
| `/integrations/verify` | **The centerpiece** — live pool state, open guards, the FDC proof, verified contract links. |

## `/integrations/verify` shows

1. **Live pool state** — TVL (`pool` balance), `sharePrice()`, `totalShares()`,
   guards issued (`nextGuardId - 1`) — all read from Coston2.
2. **Open guards** — `guards(i)` for `i` in `1..nextGuardId-1`, with live
   countdowns and status chips. Empty state until the first `buyGuard`.
3. **FDC default proof** — the real on-chain `Claimed` events from the Backstop
   contract if any exist; otherwise the **Day-4 FDC gate (spike)** — the real
   Coston2 `verifyReferencedPaymentNonexistence` result (tx `0x5774a763…9c540a`,
   voting round 1409442, `true` in 99.3s), clearly labelled as the gate spike,
   **not** an end-to-end claim through the deployed contract.
4. **Verified contract links** to both addresses on Coston2 Explorer.

## Contract reads / writes wired

- **Reads (no wallet):** `BackstopPool.sharePrice/totalShares/shares/exposureUsd`,
  pool `balance`; `Backstop.nextGuardId/guards/quotePremiumUsd/quotePremiumFlr`,
  and `Claimed` event logs.
- **Writes (injected wallet):** `Backstop.buyGuard`, `BackstopPool.deposit/withdraw`.

`quotePremiumFlr` is non-view in Solidity (FTSO `getFeedById` is payable) but
mutates no state, so it is read via `eth_call` (marked `view` in the local ABI).

## Environment (`.env.local` — all public, no secrets)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | `114` (Coston2) |
| `NEXT_PUBLIC_RPC_URL` | Coston2 RPC |
| `NEXT_PUBLIC_BACKSTOP_ADDRESS` | Backstop contract |
| `NEXT_PUBLIC_BACKSTOP_POOL_ADDRESS` | BackstopPool contract |
| `NEXT_PUBLIC_EXPLORER_URL` | Coston2 Explorer base |
| `NEXT_PUBLIC_DEPLOY_BLOCK` | Backstop deploy block (scopes the `Claimed` log query) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional. Empty = injected wallet only. |

## Notes

- **WalletConnect is optional.** With an empty project id the app uses the
  injected connector; set a WalletConnect Cloud project id to enable the full
  wallet list (swap `createConfig` for RainbowKit's `getDefaultConfig` in
  `lib/wagmi.ts`).
- All displayed values are on-chain-true; unavailable data shows a clear
  loading/empty state. No fabricated numbers.
