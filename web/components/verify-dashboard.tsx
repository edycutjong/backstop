"use client";

import { usePoolStats, useGuards, useSolvency } from "@/lib/hooks";
import { Stat } from "@/components/stat";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { GuardList } from "@/components/guard-list";
import { ProofPanel } from "@/components/proof-panel";
import { ContractLinks } from "@/components/contract-links";
import { fmtFlr, fmtUsd, fmtSharePrice, fmtInt } from "@/lib/format";

const pct = (bips?: bigint) =>
  bips !== undefined ? `${(Number(bips) / 100).toFixed(2)}%` : "—";

// THE centerpiece: a public route judges open to verify the integration is real.
export function VerifyDashboard() {
  const {
    tvlWei,
    sharePrice,
    totalShares,
    nextGuardId,
    guardCount,
    isLoading,
  } = usePoolStats();
  const { guards, isLoading: guardsLoading } = useGuards(nextGuardId);
  const {
    poolValueUsd,
    utilizationBips,
    totalActiveCoverageUsd,
    maxUtilizationBips,
    isLoading: solvencyLoading,
  } = useSolvency();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Live pool state — read from Coston2</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat
              label="Pool TVL"
              value={`${fmtFlr(tvlWei, 2)} C2FLR`}
              loading={isLoading}
            />
            <Stat
              label="Share price"
              value={`${fmtSharePrice(sharePrice)} FLR`}
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
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Solvency — coverage backed by real pool value</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat
              label="Pool value (USD)"
              value={`$${fmtUsd(poolValueUsd)}`}
              loading={solvencyLoading}
            />
            <Stat
              label="Active coverage (USD)"
              value={`$${fmtUsd(totalActiveCoverageUsd)}`}
              loading={solvencyLoading}
            />
            <Stat
              label="Utilization"
              value={pct(utilizationBips)}
              loading={solvencyLoading}
            />
            <Stat
              label="Max utilization"
              value={pct(maxUtilizationBips)}
              loading={solvencyLoading}
            />
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Active coverage can never exceed{" "}
            <span className="text-slate-300">{pct(maxUtilizationBips)}</span> of
            the pool&apos;s live USD value — enforced on-chain in{" "}
            <code>buyGuard</code> via the FTSO price feed. The pool can always
            cover every open guard. USD figures are small because they are the
            live FTSO valuation of <em>testnet</em> C2FLR — the cap logic is
            identical on mainnet.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open guards</CardTitle>
        </CardHeader>
        <CardBody>
          <GuardList guards={guards} loading={guardsLoading} />
        </CardBody>
      </Card>

      <ProofPanel />

      <ContractLinks />
    </div>
  );
}
