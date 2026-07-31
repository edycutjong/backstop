# Backstop Keeper

The autonomous off-chain watcher that turns Backstop from a contract into a
working product. It polls the deployed `Backstop` contract for redemption guards
whose deadline has passed, produces a real Flare FDC
`ReferencedPaymentNonexistence` (RPN) proof of the agent's default, and submits
`Backstop.claim(guardId, proof)` so the redeemer gets paid.

It is the same request → proof pipeline proven end-to-end in the Day-4 spike
(`scripts/spike.ts`, stages **d** and **e**) — only the final on-chain call
changed from `verifyReferencedPaymentNonexistence` to `Backstop.claim`.

## What it does, per sweep

1. Read `nextGuardId`; for `guardId` in `1 .. nextGuardId-1`, read `guards(guardId)`.
2. A guard is **claimable** iff `status == 1 (ACTIVE)` **and** `now > deadlineTs`.
   Everything else is logged one line and skipped (idempotent — `PAID`/`EXPIRED`
   are terminal and never re-claimed).
3. For each claimable guard (`processClaim`):
   1. Read `redemptionRequestInfo(guard.redemptionRequestId)` from the AssetManager
      and reconstruct the RPN request body:
      - `standardPaymentReference = guard.ticketRef`
      - `amount = guard.expectedAmount`
      - `deadlineTimestamp = redemption.lastUnderlyingTimestamp`
      - `minimalBlockNumber = redemption.firstUnderlyingBlock`
      - `deadlineBlockNumber = redemption.lastUnderlyingBlock`
      - `destinationAddressHash = keccak256(toHex(redemption.paymentAddress))`
      - `checkSourceAddresses = false`, `sourceAddressesRoot = 0x00..0`
      - **Fallback** (ticket gone / zeroed fields — e.g. a synthetic demo guard):
        derive a finalized XRPL testnet ledger range by querying
        `https://s.altnet.rippletest.net:51234/` (`method: ledger`,
        `ledger_index: "validated"`) and going ~300 ledgers back — exactly as the
        spike PASS run did. Reference and amount still come from the guard.
   2. `POST /verifier/xrp/ReferencedPaymentNonexistence/prepareRequest` → the
      abi-encoded request (MIC embedded).
   3. Read the FDC fee, `IFdcHub.requestAttestation(requestBytes)` on-chain.
   4. Compute `votingRoundId`, poll `Relay.isFinalized` until the round finalizes.
   5. Fetch the proof from the DA Layer (`proof-by-request-round-raw`).
   6. Decode the DA `response_hex` into the on-chain `Proof` tuple.
   7. `Backstop.claim(guardId, proof)`; log the tx hash + a Flarescan link.

## Run modes

| Command | Behaviour |
|---|---|
| `npm run keeper` | Loop forever, one sweep every `KEEPER_POLL_SECONDS` (default 30). |
| `npm run keeper:once` | Run a single sweep, then exit 0. For CI / demos. |
| `npm run keeper:dry` | Do everything **except** the on-chain `requestAttestation` and `claim` writes — reconstruct the request, call the verifier, read the fee, and log exactly what it *would* submit. |

## Environment (`build/.env`)

| Var | Purpose |
|---|---|
| `COSTON2_RPC_URL` | Coston2 (chain 114) JSON-RPC. |
| `PRIVATE_KEY` | Funded throwaway testnet key (with or without `0x`). Pays the FDC fee + claim gas. |
| `BACKSTOP_ADDRESS` | Deployed Backstop contract. |
| `VERIFIER_URL_TESTNET`, `VERIFIER_API_KEY_TESTNET` | FDC verifier for `prepareRequest`. |
| `COSTON2_DA_LAYER_URL`, `X_API_KEY` | DA Layer proof fetch. |
| `KEEPER_POLL_SECONDS` | Loop interval (default 30). |

All Flare system contracts (AssetManager, FdcHub, FdcRequestFeeConfigurations,
FlareSystemsManager, Relay) are **resolved live** from the Flare Contract
Registry at startup, falling back to the documented Coston2 snapshot — never
hardcoded.

## Honesty + safety

- **Never fabricates a proof.** Every claim goes through the real verifier + DA
  Layer, and `Backstop.claim` re-verifies the RPN proof on-chain against the live
  `FdcVerification` contract before paying out. A bad proof reverts.
- **The keeper is a convenience, not a trust assumption.** `Backstop.claim` is
  **permissionless** — anyone (the redeemer, an LP, a competing keeper) can fetch
  the same DA-Layer proof and call `claim(guardId, proof)` themselves. The keeper
  just automates it so no human has to watch the deadline.
- **Idempotent.** A guard whose status is already `PAID` or `EXPIRED` is skipped;
  the keeper only acts on `ACTIVE` guards past their deadline.

## Assumption — RPN range reconstruction

The **primary** path reconstructs the exact XRPL block/timestamp window and
destination hash from the on-chain redemption ticket, so the nonexistence
assertion is bound to the real payment the agent failed to make.

The **fallback** path exists only for synthetic demo guards whose redemption
ticket has been pruned (zeroed fields). It keeps the guard's real `ticketRef` and
`expectedAmount` but derives a finalized XRPL testnet range ~300 validated
ledgers back and uses a placeholder destination address — an RPN assertion of
"no payment with this reference exists in this finalized range" that is trivially
true. This proves the full pipeline against live infrastructure without a real
defaulted redemption on hand; it is not used when a genuine ticket is present.
