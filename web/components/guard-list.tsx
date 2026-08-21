"use client";

import { useEffect, useState } from "react";
import type { GuardRow } from "@/lib/hooks";
import { GUARD_STATUS, type GuardStatus } from "@/lib/abis";
import { StatusBadge } from "@/components/ui/badge";
import { fmtUsd, fmtDrops, shortHex, fmtCountdown } from "@/lib/format";
import { explorerAddress } from "@/lib/config";

function Countdown({ deadlineTs }: { deadlineTs: bigint }) {
  // `now` is captured via useState's lazy initializer (a deferred callback,
  // not a direct call in the render body) so the Date.now() read stays out
  // of the render itself; the interval refreshes it every second in an
  // effect, which is where impure reads belong.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const passed = Number(deadlineTs) - Math.floor(now / 1000) <= 0;
  return (
    <span
      className={`font-mono tabular-nums ${passed ? "text-amber-300" : "text-mist-100"}`}
    >
      {fmtCountdown(deadlineTs)}
    </span>
  );
}

export function GuardList({
  guards,
  loading,
}: {
  guards: GuardRow[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl border border-ink-line bg-ink-800/50"
          />
        ))}
      </div>
    );
  }

  if (guards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-line bg-ink-950/40 p-6 text-center">
        <p className="font-mono text-sm text-slate-300">
          No guards issued yet on the deployed contract.
        </p>
        <p className="mt-1 font-mono text-xs text-slate-500">
          Open guards will appear here live as{" "}
          <code className="text-guard-400">buyGuard</code> is called on-chain.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-ink-line text-left font-mono text-[11px] uppercase tracking-wider text-slate-500">
            <th className="py-2 pr-4 font-normal">Guard</th>
            <th className="py-2 pr-4 font-normal">Status</th>
            <th className="py-2 pr-4 font-normal">Expected</th>
            <th className="py-2 pr-4 font-normal">Coverage</th>
            <th className="py-2 pr-4 font-normal">Agent</th>
            <th className="py-2 font-normal">Deadline</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {guards.map((g) => {
            const status = (GUARD_STATUS[g.status] ?? "NONE") as GuardStatus;
            return (
              <tr key={g.id} className="border-b border-ink-line/60">
                <td className="py-3 pr-4 text-mist-100">#{g.id}</td>
                <td className="py-3 pr-4">
                  <StatusBadge status={status} />
                </td>
                <td className="py-3 pr-4 text-slate-300">
                  {fmtDrops(g.expectedAmount)}
                </td>
                <td className="py-3 pr-4 text-mist-100">
                  ${fmtUsd(g.coverageUsd)}
                </td>
                <td className="py-3 pr-4">
                  <a
                    href={explorerAddress(g.agentVault)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-guard-400 underline underline-offset-2"
                  >
                    {shortHex(g.agentVault)}
                  </a>
                </td>
                <td className="py-3">
                  {status === "ACTIVE" ? (
                    <Countdown deadlineTs={g.deadlineTs} />
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
