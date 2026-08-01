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

## Real end-to-end claim (live on-chain, 2026-08-01)

The complete product loop, proven against a **real FAssets redemption default** on Coston2 — not a
synthetic reference: faucet FXRP → `redeem` → `buyGuard` → the assigned agent misses the payment
deadline → the keeper builds the FDC `ReferencedPaymentNonexistence` proof from the live
`redemptionRequestInfo` → `Backstop.claim` pays the redeemer make-whole, all on-chain.

| Step | Tx | Result |
|---|---|---|
| `redeem` 1 lot (10 FTestXRP) | [`0x65a13293…`](https://coston2-explorer.flare.network/tx/0x65a1329342f145ea02b18163d482ef54000680121031dccf747043f02b22b052) | redemptionRequestId **42481292**, agent `0xd5dE…2D64` |
| `buyGuard` (bind + premium) | [`0x92466808…`](https://coston2-explorer.flare.network/tx/0x92466808c5b989651640ae487e744149b05bb14bae48049cc616d91a43d3a7c8) | guard **#1**, coverage $0.70 |
| FDC `requestAttestation` (RPN) | [`0xebfdbcc7…`](https://coston2-explorer.flare.network/tx/0xebfdbcc7ee5b5edfabbd81998f73b106ea181fb1b33655244b8e59d1490c6340) | voting round **1412464**, verifier **VALID** |
| **`claim` → `Claimed`** | [`0x5fde024f…`](https://coston2-explorer.flare.network/tx/0x5fde024fbad3db5f678f06b0a0cfa4f99a7f5c42fb5ecb250840f21fe4713afe) | guard #1 **PAID**, **111.55 C2FLR** paid to the redeemer |

The keeper used its **primary** path: the RPN request window (`[firstUnderlyingBlock,
lastUnderlyingBlock]`, destination-address hash, payment reference, amount) was reconstructed
directly from the on-chain redemption ticket, so the non-existence assertion is bound to the exact
payment the agent failed to make — nothing synthetic. On-chain `claim` cost **212,908 gas** (incl.
the FDC proof verification).

**Reproduce** (funded wallet in `.env`, ≥ 1 lot of faucet FXRP):
```bash
npm run route-b        # fund pool → redeem 1 lot → buyGuard on the real ticket
# wait out the ~15-min default window + XRPL block finalization, then:
npm run keeper:once    # builds the real RPN proof and fires Backstop.claim
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
> `IAssetManager` reads add overhead not present in the mocks. The exact on-chain gas is now measured
> in the **live end-to-end claim above** — real `claim` cost **212,908 gas** on Coston2 (incl. the FDC
> proof verification the mocks omit). Structural cost ranking holds: both `claim` and `buyGuard` do
> real FTSO / AssetManager reads on-chain.

**Reproduce:**
```bash
forge test --gas-report --match-path test/Backstop.t.sol
```

## Test suite

**90 unit tests · 100% line/statement/function coverage** (branch 98.7% — the one uncovered branch
is a reentrancy-guard revert, exercised by a dedicated test but uncreditable through the nested call)
across all four contracts, **+ 4 live-Coston2 fork integration tests** (real registry / FTSO / AssetManager).

```bash
forge test           # 90 offline; 94 with a Coston2 RPC in .env (fork tests skip if unset)
forge coverage --no-match-coverage "(script|test)" --summary
```

## Deployed (verified source, Coston2)

- Backstop: [`0xe7DFfa49EC57f5a9ca349C0F9a170950F052E708`](https://coston2-explorer.flare.network/address/0xe7DFfa49EC57f5a9ca349C0F9a170950F052E708)
- BackstopPool: [`0x9c1e0f1318141B7dA85207d731157D4853918A9A`](https://coston2-explorer.flare.network/address/0x9c1e0f1318141B7dA85207d731157D4853918A9A)
