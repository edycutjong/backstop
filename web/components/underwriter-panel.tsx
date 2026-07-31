"use client";

import { useState } from "react";
import { parseEther } from "viem";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { poolAbi } from "@/lib/abis";
import { BACKSTOP_POOL_ADDRESS, explorerTx } from "@/lib/config";
import { useLpPosition, usePoolStats } from "@/lib/hooks";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Stat } from "@/components/stat";
import { ConnectButton } from "@/components/connect-button";
import { fmtFlr } from "@/lib/format";

export function UnderwriterPanel() {
  const { address, isConnected } = useAccount();
  const { tvlWei, sharePrice, isLoading: poolLoading } = usePoolStats();
  const {
    shares,
    valueWei,
    isLoading: posLoading,
    refetch,
  } = useLpPosition(address);

  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  function deposit() {
    try {
      const value = parseEther(depositAmt);
      writeContract(
        {
          address: BACKSTOP_POOL_ADDRESS,
          abi: poolAbi,
          functionName: "deposit",
          value,
        },
        { onSuccess: () => setTimeout(() => refetch(), 4000) },
      );
    } catch {
      /* invalid amount */
    }
  }

  function withdraw() {
    try {
      const s = parseEther(withdrawShares); // shares are 1e18-scaled like FLR
      writeContract(
        {
          address: BACKSTOP_POOL_ADDRESS,
          abi: poolAbi,
          functionName: "withdraw",
          args: [s],
        },
        { onSuccess: () => setTimeout(() => refetch(), 4000) },
      );
    } catch {
      /* invalid amount */
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Underwrite the pool</CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Stat
            label="Pool TVL"
            value={`${fmtFlr(tvlWei, 2)} C2FLR`}
            loading={poolLoading}
          />
          <Stat
            label="Share price"
            value={`${fmtFlr(sharePrice, 4)} FLR`}
            loading={poolLoading}
          />
        </div>

        <div className="rounded-xl border border-ink-line bg-ink-950 p-4">
          <span className="font-mono text-xs uppercase tracking-wider text-slate-300">
            Your position
          </span>
          {!isConnected ? (
            <p className="mt-2 font-mono text-sm text-slate-500">
              Connect a wallet to see your shares.
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-4">
              <Stat
                label="Your shares"
                value={fmtFlr(shares, 4)}
                loading={posLoading}
              />
              <Stat
                label="Value"
                value={`${fmtFlr(valueWei, 4)} FLR`}
                loading={posLoading}
              />
            </div>
          )}
        </div>

        {!isConnected ? (
          <ConnectButton />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dep">Deposit (C2FLR)</Label>
              <Input
                id="dep"
                inputMode="decimal"
                placeholder="0.0"
                value={depositAmt}
                onChange={(e) =>
                  setDepositAmt(e.target.value.replace(/[^0-9.]/g, ""))
                }
              />
              <Button
                className="w-full"
                disabled={!depositAmt || isPending || isMining}
                onClick={deposit}
              >
                Deposit
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wd">Withdraw (shares)</Label>
              <Input
                id="wd"
                inputMode="decimal"
                placeholder="0.0"
                value={withdrawShares}
                onChange={(e) =>
                  setWithdrawShares(e.target.value.replace(/[^0-9.]/g, ""))
                }
              />
              <Button
                variant="secondary"
                className="w-full"
                disabled={!withdrawShares || isPending || isMining}
                onClick={withdraw}
              >
                Withdraw
              </Button>
            </div>
          </div>
        )}

        {txHash && (
          <div className="rounded-xl border border-ink-line bg-ink-950 p-3">
            <p className="font-mono text-sm text-slate-300">
              {isSuccess ? "✓ Confirmed." : "Pending confirmation…"}
            </p>
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

        <p className="font-mono text-[11px] leading-relaxed text-slate-500">
          Premiums accrue to the pool; a proven claim dilutes LPs. Share price =
          balance / totalShares, enforced on-chain.
        </p>
      </CardBody>
    </Card>
  );
}
