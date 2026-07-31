"use client";

import {
  useReadContract,
  useReadContracts,
  useBalance,
  usePublicClient,
} from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { backstopAbi, poolAbi } from "@/lib/abis";
import {
  BACKSTOP_ADDRESS,
  BACKSTOP_POOL_ADDRESS,
  DEPLOY_BLOCK,
} from "@/lib/config";

const backstop = {
  address: BACKSTOP_ADDRESS,
  abi: backstopAbi,
} as const;

const pool = {
  address: BACKSTOP_POOL_ADDRESS,
  abi: poolAbi,
} as const;

/** Live pool + protocol headline stats. Works with no wallet connected. */
export function usePoolStats() {
  const tvl = useBalance({ address: BACKSTOP_POOL_ADDRESS });
  const sharePrice = useReadContract({ ...pool, functionName: "sharePrice" });
  const totalShares = useReadContract({ ...pool, functionName: "totalShares" });
  const nextGuardId = useReadContract({
    ...backstop,
    functionName: "nextGuardId",
  });

  return {
    tvlWei: tvl.data?.value,
    sharePrice: sharePrice.data as bigint | undefined,
    totalShares: totalShares.data as bigint | undefined,
    nextGuardId: nextGuardId.data as bigint | undefined,
    // guards issued = nextGuardId - 1 (ids start at 1)
    guardCount:
      nextGuardId.data !== undefined
        ? (nextGuardId.data as bigint) - 1n
        : undefined,
    isLoading:
      tvl.isLoading ||
      sharePrice.isLoading ||
      totalShares.isLoading ||
      nextGuardId.isLoading,
    isError:
      tvl.isError ||
      sharePrice.isError ||
      totalShares.isError ||
      nextGuardId.isError,
  };
}

/** Global solvency: pool value (USD), active coverage, utilization vs the cap. */
export function useSolvency() {
  const poolValueUsd = useReadContract({
    ...backstop,
    functionName: "poolValueUsd",
  });
  const utilizationBips = useReadContract({
    ...backstop,
    functionName: "utilizationBips",
  });
  const totalActiveCoverageUsd = useReadContract({
    ...backstop,
    functionName: "totalActiveCoverageUsd",
  });
  const maxUtilizationBips = useReadContract({
    ...backstop,
    functionName: "maxUtilizationBips",
  });

  return {
    poolValueUsd: poolValueUsd.data as bigint | undefined,
    utilizationBips: utilizationBips.data as bigint | undefined,
    totalActiveCoverageUsd: totalActiveCoverageUsd.data as bigint | undefined,
    maxUtilizationBips: maxUtilizationBips.data as bigint | undefined,
    isLoading:
      poolValueUsd.isLoading ||
      utilizationBips.isLoading ||
      totalActiveCoverageUsd.isLoading ||
      maxUtilizationBips.isLoading,
  };
}

export interface GuardRow {
  id: number;
  redeemer: `0x${string}`;
  agentVault: `0x${string}`;
  redemptionRequestId: bigint;
  ticketRef: `0x${string}`;
  expectedAmount: bigint;
  deadlineTs: bigint;
  coverageUsd: bigint;
  premiumPaid: bigint;
  status: number;
}

/** Read every open guard: guards(i) for i in 1..nextGuardId-1. */
export function useGuards(nextGuardId?: bigint) {
  const count = nextGuardId && nextGuardId > 1n ? Number(nextGuardId - 1n) : 0;
  const ids = Array.from({ length: count }, (_, i) => i + 1);

  const { data, isLoading, isError } = useReadContracts({
    contracts: ids.map((id) => ({
      ...backstop,
      functionName: "guards" as const,
      args: [BigInt(id)] as const,
    })),
    query: { enabled: count > 0 },
  });

  const guards: GuardRow[] = (data ?? [])
    .map((res, idx) => {
      if (res.status !== "success" || !res.result) return null;
      const r = res.result as readonly [
        `0x${string}`,
        `0x${string}`,
        bigint,
        `0x${string}`,
        bigint,
        bigint,
        bigint,
        bigint,
        number,
      ];
      return {
        id: ids[idx],
        redeemer: r[0],
        agentVault: r[1],
        redemptionRequestId: r[2],
        ticketRef: r[3],
        expectedAmount: r[4],
        deadlineTs: r[5],
        coverageUsd: r[6],
        premiumPaid: r[7],
        status: Number(r[8]),
      };
    })
    .filter((g): g is GuardRow => g !== null);

  return { guards, count, isLoading, isError };
}

/** Connected LP position in the pool. */
export function useLpPosition(address?: `0x${string}`) {
  const shares = useReadContract({
    ...pool,
    functionName: "shares",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const sharePrice = useReadContract({ ...pool, functionName: "sharePrice" });

  const shareBal = shares.data as bigint | undefined;
  const price = sharePrice.data as bigint | undefined;
  const valueWei =
    shareBal !== undefined && price !== undefined
      ? (shareBal * price) / 10n ** 18n
      : undefined;

  return {
    shares: shareBal,
    valueWei,
    isLoading: shares.isLoading || sharePrice.isLoading,
    refetch: shares.refetch,
  };
}

/** FTSO-priced premium in FLR wei for a given coverage (USD, 1e18). */
export function usePremiumQuote(coverageUsd1e18?: bigint) {
  const flr = useReadContract({
    ...backstop,
    functionName: "quotePremiumFlr",
    args: coverageUsd1e18 ? [coverageUsd1e18] : undefined,
    query: { enabled: !!coverageUsd1e18 && coverageUsd1e18 > 0n },
  });
  const usd = useReadContract({
    ...backstop,
    functionName: "quotePremiumUsd",
    args: coverageUsd1e18 ? [coverageUsd1e18] : undefined,
    query: { enabled: !!coverageUsd1e18 && coverageUsd1e18 > 0n },
  });
  return {
    premiumFlr: flr.data as bigint | undefined,
    premiumUsd: usd.data as bigint | undefined,
    isLoading: flr.isLoading || usd.isLoading,
    isError: flr.isError || usd.isError,
    error: flr.error,
  };
}

export interface ClaimedEvent {
  guardId: bigint;
  redeemer: `0x${string}`;
  payoutFlr: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
}

/**
 * Read real Claimed logs from the deployed Backstop contract. When an
 * end-to-end claim happens on-chain, the verify page surfaces it. Until then
 * this is legitimately empty and the page shows the labelled Day-4 spike proof.
 */
export function useClaimedEvents() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["claimed-events", BACKSTOP_ADDRESS],
    enabled: !!client,
    refetchInterval: 20_000,
    queryFn: async (): Promise<ClaimedEvent[]> => {
      if (!client) return [];
      const logs = await client.getContractEvents({
        address: BACKSTOP_ADDRESS,
        abi: backstopAbi,
        eventName: "Claimed",
        fromBlock: DEPLOY_BLOCK,
        toBlock: "latest",
      });
      return logs.map((l) => ({
        guardId: (l.args as { guardId: bigint }).guardId,
        redeemer: (l.args as { redeemer: `0x${string}` }).redeemer,
        payoutFlr: (l.args as { payoutFlr: bigint }).payoutFlr,
        txHash: l.transactionHash,
        blockNumber: l.blockNumber,
      }));
    },
  });
}
