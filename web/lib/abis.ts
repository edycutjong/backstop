// Minimal hand-written ABIs for exactly the functions/events the frontend touches.
// Verified against build/src/Backstop.sol and build/src/BackstopPool.sol.
//
// NOTE on stateMutability: quotePremiumFlr / expectedUsd / usdToFlr are declared
// non-view in Solidity only because FtsoV2.getFeedById is payable. They mutate no
// state, so we mark them "view" here to read them cleanly via eth_call.

export const backstopAbi = [
  // ── reads ──────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "nextGuardId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "guards",
    stateMutability: "view",
    inputs: [{ name: "guardId", type: "uint256" }],
    outputs: [
      { name: "redeemer", type: "address" },
      { name: "agentVault", type: "address" },
      { name: "redemptionRequestId", type: "uint256" },
      { name: "ticketRef", type: "bytes32" },
      { name: "expectedAmount", type: "uint256" },
      { name: "deadlineTs", type: "uint64" },
      { name: "coverageUsd", type: "uint256" },
      { name: "premiumPaid", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "quotePremiumUsd",
    stateMutability: "view",
    inputs: [{ name: "coverageUsd", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "quotePremiumFlr",
    stateMutability: "view",
    inputs: [{ name: "coverageUsd", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "expectedUsd",
    stateMutability: "view",
    inputs: [{ name: "valueUBA", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "usdToFlr",
    stateMutability: "view",
    inputs: [{ name: "usd1e18", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  // ── solvency / global utilization (eth_call reads; non-view on-chain) ────
  {
    type: "function",
    name: "poolValueUsd",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "utilizationBips",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalActiveCoverageUsd",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "maxUtilizationBips",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "pool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "agentCapUsd",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "baseBips",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "kBips",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "sigmaBips",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "xrpUsdFeedId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes21" }],
  },
  {
    type: "function",
    name: "flrUsdFeedId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes21" }],
  },
  // ── writes ─────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "buyGuard",
    stateMutability: "payable",
    inputs: [
      { name: "redemptionRequestId", type: "uint256" },
      { name: "coverageUsd", type: "uint256" },
    ],
    outputs: [{ name: "guardId", type: "uint256" }],
  },
  {
    type: "function",
    name: "expire",
    stateMutability: "nonpayable",
    inputs: [{ name: "guardId", type: "uint256" }],
    outputs: [],
  },
  // ── events ─────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "guardId", type: "uint256", indexed: true },
      { name: "redeemer", type: "address", indexed: true },
      { name: "payoutFlr", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GuardBought",
    inputs: [
      { name: "guardId", type: "uint256", indexed: true },
      { name: "redeemer", type: "address", indexed: true },
      { name: "agentVault", type: "address", indexed: true },
      { name: "coverageUsd", type: "uint256", indexed: false },
      { name: "premiumFlr", type: "uint256", indexed: false },
    ],
  },
] as const;

export const poolAbi = [
  {
    type: "function",
    name: "sharePrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalShares",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "shares",
    stateMutability: "view",
    inputs: [{ name: "lp", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "exposureUsd",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "backstop",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [{ name: "minted", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "sharesToBurn", type: "uint256" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;

// Guard status enum — matches Solidity: NONE=0, ACTIVE=1, PAID=2, EXPIRED=3.
export const GUARD_STATUS = ["NONE", "ACTIVE", "PAID", "EXPIRED"] as const;
export type GuardStatus = (typeof GUARD_STATUS)[number];
