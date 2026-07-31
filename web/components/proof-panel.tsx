"use client";

import { DAY4_SPIKE } from "@/lib/seed-proof";
import { useClaimedEvents } from "@/lib/hooks";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { explorerTx } from "@/lib/config";
import { fmtFlr, shortHex } from "@/lib/format";

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

// Shows the REAL on-chain Claimed events if any exist on the deployed contract;
// otherwise the labelled Day-4 FDC spike proof (honest — it is NOT an
// end-to-end claim through the deployed Backstop).
export function ProofPanel() {
  const { data: claims, isLoading, isError } = useClaimedEvents();
  const hasClaims = (claims?.length ?? 0) > 0;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>FDC default proof</CardTitle>
        {hasClaims ? (
          <Badge className="border-guard-400 bg-guard-400/15 text-guard-400">
            Live on-chain claim
          </Badge>
        ) : (
          <Badge className="border-amber-300/50 text-amber-300">
            {DAY4_SPIKE.label}
          </Badge>
        )}
      </CardHeader>
      <CardBody>
        {hasClaims ? (
          <div className="space-y-4">
            {claims!.map((c) => (
              <div
                key={c.txHash}
                className="rounded-xl border border-guard-400/30 bg-guard-400/5 p-4"
              >
                <Field k="Guard" v={`#${c.guardId.toString()}`} />
                <Field k="Redeemer" v={shortHex(c.redeemer)} />
                <Field k="Payout" v={`${fmtFlr(c.payoutFlr, 4)} C2FLR`} />
                <Field k="Block" v={c.blockNumber.toString()} />
                <a
                  href={explorerTx(c.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block font-mono text-xs text-guard-400 underline underline-offset-2"
                >
                  {shortHex(c.txHash, 10, 8)} — verified payout ↗
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-mono text-xs leading-relaxed text-slate-300">
              No end-to-end claim has been executed through the deployed
              contract yet. Below is the{" "}
              <span className="text-amber-300">Day-4 go/no-go gate</span> — the
              load-bearing FDC leg run for real on Coston2 (a spike, not a claim
              through Backstop):
            </p>
            <div className="rounded-xl border border-ink-line bg-ink-950 p-4">
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
            <p className="font-mono text-[11px] leading-relaxed text-slate-500">
              This proves Flare&apos;s own{" "}
              <code>ReferencedPaymentNonexistence</code> attestation — the exact
              trigger <code>Backstop.claim</code> gates on — resolves on-chain.
              A real <code>Claimed</code> event replaces this panel
              automatically once a guard is claimed end-to-end.
            </p>
            {isError && (
              <p className="font-mono text-[11px] text-amber-300">
                (Could not query on-chain Claimed logs; showing gate result.)
              </p>
            )}
            {isLoading && (
              <p className="font-mono text-[11px] text-slate-500">
                Checking for live on-chain claims…
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
