// The Day-4 FDC go/no-go gate result — REAL, on Coston2, but a SPIKE run of the
// load-bearing FDC leg (IFdcHub.requestAttestation -> DA-Layer proof ->
// IFdcVerification.verifyReferencedPaymentNonexistence), NOT an end-to-end claim
// through the deployed Backstop contract. It is labelled as such everywhere it
// appears. Source: build/README.md + build/DEMO.md.
//
// HONESTY: display this only as "Day-4 FDC gate (spike)". When a real Claimed
// event appears on the deployed Backstop contract, the verify page shows that
// on-chain event instead/in addition — see components/verify-dashboard.

export const DAY4_SPIKE = {
  label: "Day-4 FDC gate (spike)",
  attestationType: "ReferencedPaymentNonexistence",
  method: "verifyReferencedPaymentNonexistence",
  result: true,
  txHash: "0x5774a7631bdcfcf4d0bc90c25a3ce2c08664451213c617450d73b3a8149c540a",
  votingRound: 1409442,
  roundTripSeconds: 99.3,
  requestFee: "1e-15 C2FLR",
  network: "Coston2 (chain 114)",
  date: "2026-07-29",
} as const;

// The REAL end-to-end claim: a genuine FAssets redemption defaulted on Coston2
// and Backstop.claim paid the redeemer make-whole. This is NOT the spike and NOT
// synthetic — the keeper reconstructed the RPN window from the live redemption
// ticket (its primary path). Source: build/DEMO.md + build/README.md.
export const REAL_CLAIM = {
  label: "Real end-to-end claim (PAID)",
  guardId: 1,
  status: "PAID",
  redemptionRequestId: 42456370,
  payoutFlr: "170.08 C2FLR",
  claimTx: "0xd4c7be5695886de05fb05912e7a0e1f21d06e049661a47322d3f0d53befb43f0",
  block: 33481588,
  votingRound: 1412120,
  network: "Coston2 (chain 114)",
  date: "2026-07-31",
} as const;
