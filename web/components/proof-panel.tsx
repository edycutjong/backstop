"use client";

import { DAY4_SPIKE, REAL_CLAIM } from "@/lib/seed-proof";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { explorerTx } from "@/lib/config";
import { shortHex } from "@/lib/format";

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-line/60 py-2">
      <span className="shrink-0 font-mono text-xs uppercase tracking-wider text-slate-500">
        {k}
      </span>
      <span className="min-w-0 break-all text-right font-mono text-sm text-mist-100">
        {v}
      </span>
    </div>
  );
}

// Shows the REAL end-to-end claim through the deployed Backstop from a static,
// verifiable record. (A live eth_getLogs scan is unreliable — the public Coston2
// RPC caps getLogs at 30 blocks — so we render the confirmed claim and link every
// value to the explorer for independent verification.) The Day-4 FDC gate is shown
// below as the load-bearing benchmark round-trip.
export function ProofPanel() {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>FDC default proof</CardTitle>
        <Badge className="border-guard-400 bg-guard-400/15 text-guard-400">
          Real on-chain claim
        </Badge>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          <div className="rounded-xl border border-guard-400/30 bg-guard-400/5 p-4">
            <Field
              k="Guard"
              v={`#${REAL_CLAIM.guardId} · ${REAL_CLAIM.status}`}
            />
            <Field
              k="Redemption"
              v={REAL_CLAIM.redemptionRequestId.toLocaleString()}
            />
            <Field k="Payout" v={REAL_CLAIM.payoutFlr} />
            <Field k="Block" v={REAL_CLAIM.block.toLocaleString()} />
            <Field
              k="Voting round"
              v={REAL_CLAIM.votingRound.toLocaleString()}
            />
            <Field k="Date" v={REAL_CLAIM.date} />
            <a
              href={explorerTx(REAL_CLAIM.claimTx)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-mono text-xs text-guard-400 underline underline-offset-2"
            >
              {shortHex(REAL_CLAIM.claimTx, 10, 8)} — verified payout ↗
            </a>
          </div>

          <p className="font-mono text-[11px] leading-relaxed text-slate-500">
            A real end-to-end claim through the deployed Backstop —{" "}
            <code>redeem → buyGuard → default → claim → payout</code>, every leg
            on-chain. Below: the Day-4 FDC gate, the load-bearing{" "}
            <code>ReferencedPaymentNonexistence</code> round-trip run for real
            on Coston2.
          </p>

          <div className="rounded-xl border border-ink-line bg-ink-950 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-amber-300">
                {DAY4_SPIKE.label}
              </span>
            </div>
            <Field k="Attestation" v={DAY4_SPIKE.attestationType} />
            <Field
              k="Method"
              v={<code className="text-guard-400">{DAY4_SPIKE.method}</code>}
            />
            <Field
              k="Result"
              v={
                <span className="text-guard-400">
                  {String(DAY4_SPIKE.result)} ✓
                </span>
              }
            />
            <Field
              k="Voting round"
              v={DAY4_SPIKE.votingRound.toLocaleString()}
            />
            <Field
              k="Round-trip"
              v={`${DAY4_SPIKE.roundTripSeconds}s (request → on-chain verify)`}
            />
            <Field k="Request fee" v={DAY4_SPIKE.requestFee} />
            <Field k="Network" v={DAY4_SPIKE.network} />
            <Field k="Date" v={DAY4_SPIKE.date} />
            <a
              href={explorerTx(DAY4_SPIKE.txHash)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-mono text-xs text-guard-400 underline underline-offset-2"
            >
              {shortHex(DAY4_SPIKE.txHash, 10, 8)} on Coston2 Explorer ↗
            </a>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
