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
