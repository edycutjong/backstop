# Day-4 FDC spike — RUN

The go/no-go gate for Backstop. A single viem runner (`spike.ts`) exercises the
load-bearing Flare call-sites end-to-end on **Coston2 (chain 114)** and prints
`PASS`/`FAIL` + the raw value for each. If the FDC
`ReferencedPaymentNonexistence` round-trip verifies on-chain, we build; if it
fails by **Jul 30**, we pivot to *FAsset Guardian* (liquidation-event claim
source, no FDC dependency).

## The five stages

| Stage | Call | Needs | Resolves unknown |
|---|---|---|---|
| `a` registry | `FlareContractRegistry.getContractAddressByName(...)` | public RPC | #1 exact registry names |
| `b` ftso | `FtsoV2.getFeedById(XRP/USD bytes21)` → live price | public RPC | #2 exact XRP/USD bytes21 |
| `c` agent | `IAssetManager.getAgentInfo(agentVault)` (+ `redemptionRequestInfo`) | public RPC | #3 AgentInfo fields + deadline semantics |
| `d` fdc | `IFdcHub.requestAttestation(RPN)` → poll **DA Layer** for proof | **funded wallet** | #4 FDC fee + DA endpoint + round timing |
| `e` verify | `IFdcVerification.verifyReferencedPaymentNonexistence(proof)` → `true` | funded wallet | the load-bearing assertion |

## Setup

```bash
cd build
npm install                 # viem, dotenv, tsx, typescript
cp .env.example .env        # then edit .env (gitignored — never commit a key)
```

`.env` needs at minimum `COSTON2_RPC_URL` (a public endpoint is fine for a/b/c).
For stages d/e also set `PRIVATE_KEY` (funded with C2FLR from
<https://faucet.flare.network/coston2>), `VERIFIER_URL_TESTNET`,
`VERIFIER_API_KEY_TESTNET`, `COSTON2_DA_LAYER_URL`, `X_API_KEY`.

## Run

```bash
# View-only stages — no wallet, no gas. Runs today against public Coston2.
npm run spike:view
#   == npx tsx scripts/spike.ts --stage a,b,c

# Read a specific live redemption ticket as part of stage c:
npx tsx scripts/spike.ts --stage c --agent 0x55c8... --redemption-id 123

# Full gate (funded wallet). Prints the FDC round-trip latency.
npm run spike:all
#   == npx tsx scripts/spike.ts --stage all

# Stage d with explicit XRPL non-payment parameters (from a real ticket):
npx tsx scripts/spike.ts --stage d,e \
  --ref 0x<32-byte standardPaymentReference> \
  --dest r<XRPL destination address>  \
  --drops 10000000 \
  --min-block <N> --deadline-block <N> --deadline-ts <unix>
```

`--dest` is hashed to `destinationAddressHash` for you; pass `--dest-hash 0x..`
if you already have the standard address hash.

## What a PASS looks like

- **a** — all 7 names resolve to non-zero live addresses.
- **b** — `getFeedById` returns a non-zero value with a timestamp < 1h old
  (prints e.g. `XRP/USD  $1.0986`).
- **c** — the 40-field `AgentInfo` tuple and the `RedemptionRequestInfo` tuple
  decode cleanly (status, underlying address, feeBIPS, mintedUBA, …).
- **d** — the verifier returns `VALID`, `requestAttestation` lands, the round
  finalizes on the Relay, and the DA Layer returns `response_hex` + Merkle
  `proofs`. Prints the **FDC round-trip latency** (the honest killer stat).
- **e** — `verifyReferencedPaymentNonexistence(proof)` returns `true` on-chain.
  `GATE: PASS — BUILD.`

## Pivot trigger

If stage **d** or **e** cannot be made to pass by **Jul 30 EOD**, pivot the same
day to **FAsset Guardian** (agent-liquidation claim source), which drops the FDC
dependency. No third option.

## Verified values (Coston2, chain 114 — captured 2026-07-26)

Resolved live by stages a/b/c; the snapshot lives in `flare.ts` for reference
but the spike always re-resolves from the registry.

Registry (stable on every Flare network): `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019`

| Name | Address |
|---|---|
| AssetManagerFXRP | `0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA` |
| FdcVerification | `0x906507E0B64bcD494Db73bd0459d1C667e14B933` |
| FtsoV2 | `0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d` |
| FdcHub | `0x48aC463d7975828989331F4De43341627b9c5f1D` |
| FdcRequestFeeConfigurations | `0x191a1282Ac700edE65c5B0AaF313BAcC3eA7fC7e` |
| FlareSystemsManager | `0xA90Db6D10F856799b10ef2A77EBCbF460aC71e52` |
| Relay | `0xa10B672D1c62e5457b17af63d4302add6A99d7dE` |

- **XRP/USD feed id (bytes21):** `0x015852502f55534400000000000000000000000000`
  (`0x01` crypto category + utf8("XRP/USD") right-padded to 20 bytes) — verified
  live, returned ~$1.0986.
- **FDC protocol id:** `200`. **Voting epoch:** 90 s
  (`firstVotingRoundStartTs = 1658430000`). Finalization normally lands 2–3
  rounds after submit ⇒ ~180–270 s round-trip — this is the demo latency.
- **XRP source:** verifier URL segment `xrp`; on-chain `sourceId = "testXRP"`.
- **FXRP lot size:** `10000000` UBA = 10 XRP (6 dp). 4 public agents available on
  Coston2 at capture time.

### AgentInfo / redemption ticket fields (the object Backstop insures)

`redemptionRequestInfo(id)` returns: `redemptionRequestId, status, agentVault,
redeemer, paymentAddress, paymentReference (== standardPaymentReference),
valueUBA (expected drops), feeUBA, lastUnderlyingBlock, lastUnderlyingTimestamp,
timestamp, executor, …`. **Deadline semantics:** the redemption is defaulted
once **both** `lastUnderlyingBlock` **and** `lastUnderlyingTimestamp` have
passed — that pair is what the keeper watches before requesting the RPN proof.

## Note on method names

The spec refers to `IFdcVerification.verify(proof)`; the concrete
flare-periphery method for this attestation type is
`verifyReferencedPaymentNonexistence(IReferencedPaymentNonexistence.Proof)`
(a `view` returning `bool`). The spike calls the real name.
