"use client";

import { usePoolStats } from "@/lib/hooks";
import { Stat } from "@/components/stat";
import { fmtFlr, fmtSharePrice, fmtInt } from "@/lib/format";

// Live protocol headline read straight from the deployed Coston2 contracts.
// Renders with NO wallet connected.
export function PoolStats() {
  const { tvlWei, sharePrice, totalShares, guardCount, isLoading, isError } =
    usePoolStats();

  if (isError) {
    return (
      <p className="font-mono text-sm text-amber-300">
        Could not reach Coston2 RPC. Live stats unavailable — retrying…
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
      <Stat
        label="Pool TVL"
        value={
          <>
            {fmtFlr(tvlWei, 2)}{" "}
            <span className="text-base text-slate-300">C2FLR</span>
          </>
        }
        loading={isLoading}
      />
      <Stat
        label="Share price"
        value={
          <>
            {fmtSharePrice(sharePrice)}{" "}
            <span className="text-base text-slate-300">FLR</span>
          </>
        }
        loading={isLoading}
      />
      <Stat
        label="Total shares"
        value={fmtFlr(totalShares, 2)}
        loading={isLoading}
      />
      <Stat
        label="Guards issued"
        value={guardCount !== undefined ? fmtInt(guardCount) : "—"}
        loading={isLoading}
      />
    </div>
  );
}
