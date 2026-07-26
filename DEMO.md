# Backstop — Benchmarks & Reproducible Proof

All numbers below are reproducible with the commands shown. Network: **Coston2 (chain 114)**.

## Headline: FDC round-trip latency (measured live on-chain)

The load-bearing operation is Flare's own default proof:
`IFdcHub.requestAttestation` → DA-Layer proof → `IFdcVerification.verifyReferencedPaymentNonexistence`.

| Metric | Value |
|---|---|
| **FDC request → on-chain verify** | **99.3 s** |
| `verifyReferencedPaymentNonexistence` result | `true` |
| Attestation tx | [`0x5774a763…9c540a`](https://coston2-explorer.flare.network/tx/0x5774a7631bdcfcf4d0bc90c25a3ce2c08664451213c617450d73b3a8149c540a) |
| Voting round | 1409442 |
| FDC request fee | 1e-15 C2FLR |

This is the honest floor on payout speed — it's bounded by the FDC voting round, not by us,
and we surface it in the UI rather than hide it.

**Reproduce** (funded wallet in `.env`):
```bash
REF=$(cast keccak "backstop-day4-spike-synthetic-nonpayment-2026")
# pick a finalized XRPL testnet ledger range (query s.altnet.rippletest.net, go ~300 back):
npm run spike:all -- --ref "$REF" --dest "r4uKJRy9mjxGHw1yzS1SrtaKCUwT66MCcP" \
  --drops 1000000 --min-block 19447531 --deadline-block 19447581 --deadline-ts 1785278621
```

## Gas per core operation

From `forge test --gas-report` (unit harness). `p50` = median, `max` = worst case observed.

| Operation | p50 gas | max gas |
|---|---|---|
| `buyGuard` (bind ticket, FTSO-price, take premium) | 353,919 | 361,149 |
| `claim` (proof-gated make-whole payout) | — | 103,033 |
| `expire` (lapse guard, premium → LPs) | 29,733 | 47,044 |
| `pool.deposit` (LP underwrite) | 70,746 | 70,746 |
| `quotePremiumFlr` (view, FTSO-priced) | 47,927 | 47,927 |

> **Honest caveat:** these are measured against **mock Flare contracts** in the unit harness, so
> `buyGuard`/`claim` understate real Coston2 gas — the live `FtsoV2.getFeedById` and
> `IAssetManager` reads add overhead not present in the mocks. The exact on-chain gas lands with the
> end-to-end demo tx (buyGuard → default → claim through the deployed contract). Structural cost
> ranking is accurate: `claim` is cheap; `buyGuard` dominates (it does the FTSO reads + ticket bind).

**Reproduce:**
```bash
forge test --gas-report --match-path test/Backstop.t.sol
```

## Test suite

**87 unit tests · 100% coverage** (lines / statements / branches / functions) across all four
contracts, **+ 4 live-Coston2 fork integration tests** (real registry / FTSO / AssetManager).

```bash
forge test           # 87 offline; 91 with a Coston2 RPC in .env (fork tests skip if unset)
forge coverage --no-match-coverage "(script|test)" --summary
```

## Deployed (verified source, Coston2)

- Backstop: [`0x38EB571B43C6eC03e37c8fC9514640D9d743DDca`](https://coston2-explorer.flare.network/address/0x38EB571B43C6eC03e37c8fC9514640D9d743DDca)
- BackstopPool: [`0xc18BDf574Ce129aa9dD7DCc80810CceE61200045`](https://coston2-explorer.flare.network/address/0xc18BDf574Ce129aa9dD7DCc80810CceE61200045)
