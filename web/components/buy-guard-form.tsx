"use client";

import { useMemo, useState } from "react";
import { parseUnits } from "viem";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { backstopAbi } from "@/lib/abis";
import { BACKSTOP_ADDRESS, explorerTx } from "@/lib/config";
import { usePremiumQuote } from "@/lib/hooks";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ConnectButton } from "@/components/connect-button";
import { fmtFlr, fmtUsd } from "@/lib/format";

export function BuyGuardForm() {
  const { isConnected } = useAccount();
  const [requestId, setRequestId] = useState("");
  const [coverage, setCoverage] = useState("");

  const coverage1e18 = useMemo(() => {
    try {
      if (!coverage || Number(coverage) <= 0) return undefined;
      return parseUnits(coverage, 18);
    } catch {
      return undefined;
    }
  }, [coverage]);

  const { premiumFlr, premiumUsd, isLoading, isError, error } =
    usePremiumQuote(coverage1e18);

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const canBuy =
    isConnected &&
    !!coverage1e18 &&
    !!requestId &&
    premiumFlr !== undefined &&
    premiumFlr > 0n;

  function submit() {
    if (!coverage1e18 || premiumFlr === undefined) return;
    // Send the quoted premium + a 2% buffer for FTSO price drift between the
    // quote read and mining; the contract refunds any overpayment.
    const value = (premiumFlr * 102n) / 100n;
    writeContract({
      address: BACKSTOP_ADDRESS,
      abi: backstopAbi,
      functionName: "buyGuard",
      args: [BigInt(requestId), coverage1e18],
      value,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guard a redemption</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <Label htmlFor="rid">Redemption request ID</Label>
          <Input
            id="rid"
            inputMode="numeric"
            placeholder="e.g. 10427"
            value={requestId}
            onChange={(e) =>
              setRequestId(e.target.value.replace(/[^0-9]/g, ""))
            }
          />
          <p className="mt-1.5 font-mono text-[11px] text-slate-500">
            Must be a live FXRP redemption where you are the redeemer.
          </p>
        </div>

        <div>
          <Label htmlFor="cov">Coverage (USD)</Label>
          <Input
            id="cov"
            inputMode="decimal"
            placeholder="e.g. 6400"
            value={coverage}
            onChange={(e) =>
              setCoverage(e.target.value.replace(/[^0-9.]/g, ""))
            }
          />
        </div>

        {/* FTSO-priced premium panel */}
        <div className="rounded-xl border border-ink-line bg-ink-950 p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-300">
              Premium (FTSO-priced)
            </span>
            {coverage1e18 && isLoading && (
              <span className="font-mono text-xs text-slate-500">quoting…</span>
            )}
          </div>
          {!coverage1e18 ? (
            <p className="mt-2 font-mono text-sm text-slate-500">
              Enter coverage to fetch a live quote.
            </p>
          ) : isError ? (
            <p className="mt-2 font-mono text-xs text-amber-300">
              Quote reverted — check the coverage is within the redemption
              value.
              {error?.message ? ` (${error.message.split("\n")[0]})` : ""}
            </p>
          ) : (
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-mono text-2xl font-semibold tabular-nums text-guard-400">
                {fmtFlr(premiumFlr, 4)} C2FLR
              </span>
              <span className="font-mono text-sm text-slate-300">
                ≈ ${fmtUsd(premiumUsd)}
              </span>
            </div>
          )}
        </div>

        {/* Action */}
        {!isConnected ? (
          <div className="space-y-2">
            <ConnectButton />
            <p className="font-mono text-[11px] text-slate-500">
              Connect an injected wallet on Coston2 to buy a guard.
            </p>
          </div>
        ) : (
          <Button
            className="w-full"
            disabled={!canBuy || isPending || isMining}
            onClick={submit}
          >
            {isPending
              ? "Confirm in wallet…"
              : isMining
                ? "Buying guard…"
                : "Buy Guard →"}
          </Button>
        )}

        {/* Tx status */}
        {txHash && (
          <div className="rounded-xl border border-ink-line bg-ink-950 p-3">
            {isSuccess ? (
              <p className="font-mono text-sm text-guard-400">
                ✓ Guard purchased.
              </p>
            ) : (
              <p className="font-mono text-sm text-slate-300">
                Transaction submitted, waiting for confirmation…
              </p>
            )}
            <a
              href={explorerTx(txHash)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block font-mono text-xs text-guard-400 underline underline-offset-2"
            >
              View on Coston2 Explorer ↗
            </a>
          </div>
        )}

        {writeError && (
          <div className="rounded-xl border border-ember-600/40 bg-ember-600/10 p-3">
            <p className="font-mono text-xs text-ember-300">
              {writeError.message.split("\n")[0]}
            </p>
            <button
              onClick={() => reset()}
              className="mt-1 font-mono text-[11px] text-slate-300 underline"
            >
              dismiss
            </button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
