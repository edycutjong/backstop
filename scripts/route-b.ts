#!/usr/bin/env -S npx tsx
/**
 * Backstop — ROUTE B: real end-to-end redemption-default claim on Coston2.
 *
 * Produces a genuine on-chain `Claimed` event WITHOUT running your own FAssets
 * agent (which is whitelist-gated on Coston2). Instead it redeems faucet-minted
 * FXRP from a public agent and insures it; if that agent doesn't pay the
 * underlying XRP within the ~15-min window (common on testnet), the keeper
 * produces the real FDC ReferencedPaymentNonexistence proof and `claim()` fires.
 *
 * One attempt = one run of this script, then `npm run keeper:once` after the
 * deadline. If the agent DID pay, nothing to claim — just run it again.
 *
 * Steps (all as account #1 = PRIVATE_KEY = the redeemer/LP/owner):
 *   1. sanity: FXRP balance >= 1 lot (else tells you to hit the faucet)
 *   2. fund the Backstop pool so it can back the guard (idempotent-ish)
 *   3. AssetManager.redeem(1 lot, yourXRPL, executor=0)  -> redemptionRequestId
 *   4. Backstop.buyGuard(requestId, coverageUsd) with the quoted premium
 *   5. print guardId + the exact deadline to wait for, then the keeper command
 *
 * Run:
 *   npx tsx scripts/route-b.ts              # full attempt (fund + redeem + guard)
 *   npx tsx scripts/route-b.ts --fund-only  # just top up the pool
 *   npx tsx scripts/route-b.ts --dry-run    # read + size everything, no writes
 *
 * Env (build/.env): COSTON2_RPC_URL, PRIVATE_KEY (#1), BACKSTOP_ADDRESS.
 * Optional: REDEEMER_XRPL_ADDRESS (defaults to the Route-A user XRPL account).
 */

import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  parseEventLogs,
  zeroAddress,
  type Address,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { FLARE_CONTRACT_REGISTRY, registryAbi } from "./flare.js";

// ── CLI + palette (same as keeper.ts) ──────────────────────────────────────
const FLAGS = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const FUND_ONLY = FLAGS.has("--fund-only");
const DRY_RUN = FLAGS.has("--dry-run");

const C = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};
const line = (k: string, v: unknown) => console.log(`      ${C.dim(k.padEnd(24))} ${v}`);
const log = (m: string) => console.log(`${C.dim(new Date().toISOString())}  ${m}`);
const usd = (x: bigint) => `$${(Number(x) / 1e18).toFixed(4)}`;

// ── Config + clients ────────────────────────────────────────────────────────
const RPC = process.env.COSTON2_RPC_URL;
const BACKSTOP = process.env.BACKSTOP_ADDRESS as Address | undefined;
if (!RPC || !BACKSTOP) {
  console.error(C.red("COSTON2_RPC_URL and BACKSTOP_ADDRESS must be set in build/.env"));
  process.exit(2);
}
const REDEEMER_XRPL =
  process.env.REDEEMER_XRPL_ADDRESS || "r4TgaZzJ1AZaQUfAGGraSBeA5ZZo3Bgj7C";
// leave this much native for gas + premium + executor fee; deposit the rest to the pool
const GAS_RESERVE_FLR = parseEther("40");
const COVERAGE_FRACTION_BIPS = 7000n; // insure 70% of pool value — margin under the 80% cap

const coston2 = {
  id: 114,
  name: "Coston2",
  nativeCurrency: { name: "Coston2 Flare", symbol: "C2FLR", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
} as const;

const publicClient: PublicClient = createPublicClient({ transport: http(RPC) }) as PublicClient;
const pk = process.env.PRIVATE_KEY;
if (!pk) {
  console.error(C.red("PRIVATE_KEY (account #1, the redeemer) is not set."));
  process.exit(2);
}
const account = privateKeyToAccount(
  pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`),
);
const wallet = createWalletClient({ account, chain: coston2, transport: http(RPC) });

// ── Minimal ABIs (only what we call) ────────────────────────────────────────
const backstopAbi = [
  { type: "function", name: "pool", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "poolValueUsd", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxUtilizationBips", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalActiveCoverageUsd", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "expectedUsd", stateMutability: "nonpayable", inputs: [{ name: "valueUBA", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "quotePremiumFlr", stateMutability: "nonpayable", inputs: [{ name: "coverageUsd", type: "uint256" }], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "buyGuard", stateMutability: "payable",
    inputs: [{ name: "redemptionRequestId", type: "uint256" }, { name: "coverageUsd", type: "uint256" }],
    outputs: [{ name: "guardId", type: "uint256" }],
  },
  {
    type: "event", name: "GuardBought", inputs: [
      { name: "guardId", type: "uint256", indexed: true },
      { name: "redeemer", type: "address", indexed: true },
      { name: "agentVault", type: "address", indexed: true },
      { name: "coverageUsd", type: "uint256", indexed: false },
      { name: "premium", type: "uint256", indexed: false },
    ],
  },
] as const;

const poolAbi = [
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [{ name: "minted", type: "uint256" }] },
] as const;

const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

const assetManagerAbi = [
  { type: "function", name: "fAsset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "lotSize", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "redeem", stateMutability: "payable",
    inputs: [
      { name: "_lots", type: "uint256" },
      { name: "_redeemerUnderlyingAddressString", type: "string" },
      { name: "_executor", type: "address" },
    ],
    outputs: [{ name: "_redeemedAmountUBA", type: "uint256" }],
  },
  {
    type: "event", name: "RedemptionRequested", inputs: [
      { name: "agentVault", type: "address", indexed: true },
      { name: "redeemer", type: "address", indexed: true },
      { name: "requestId", type: "uint256", indexed: true },
      { name: "paymentAddress", type: "string", indexed: false },
      { name: "valueUBA", type: "uint256", indexed: false },
      { name: "feeUBA", type: "uint256", indexed: false },
      { name: "firstUnderlyingBlock", type: "uint256", indexed: false },
      { name: "lastUnderlyingBlock", type: "uint256", indexed: false },
      { name: "lastUnderlyingTimestamp", type: "uint256", indexed: false },
      { name: "paymentReference", type: "bytes32", indexed: false },
      { name: "executor", type: "address", indexed: false },
      { name: "executorFeeNatWei", type: "uint256", indexed: false },
    ],
  },
] as const;

const read = <T>(address: Address, abi: any, functionName: string, args: any[] = []) =>
  publicClient.readContract({ address, abi, functionName, args }) as Promise<T>;

async function main() {
  console.log(C.bold("\n╭─ Backstop Route B — real redemption-default attempt ─────────────╮"));
  line("network", "Coston2 (114)");
  line("account #1 (redeemer)", account.address);
  line("Backstop", BACKSTOP);
  if (DRY_RUN) log(C.yellow("DRY-RUN — no transactions will be sent"));

  // Resolve AssetManagerFXRP the same way Backstop does, then the FXRP token.
  const am = await read<Address>(FLARE_CONTRACT_REGISTRY, registryAbi, "getContractAddressByName", ["AssetManagerFXRP"]);
  const fxrp = await read<Address>(am, assetManagerAbi, "fAsset");
  const lot = await read<bigint>(am, assetManagerAbi, "lotSize");
  const dec = await read<number>(fxrp, erc20Abi, "decimals");
  const sym = await read<string>(fxrp, erc20Abi, "symbol");
  const bal = await read<bigint>(fxrp, erc20Abi, "balanceOf", [account.address]);
  const fmt = (v: bigint) => (Number(v) / 10 ** dec).toFixed(dec);
  line("AssetManagerFXRP", am);
  line(`${sym} token`, fxrp);
  line("lot size", `${fmt(lot)} ${sym}`);
  line("your FXRP balance", `${fmt(bal)} ${sym}`);

  // ── Step 1: need ≥ 1 lot ──────────────────────────────────────────────────
  if (bal < lot) {
    console.log(
      C.red(`\n✗ Need ≥ ${fmt(lot)} ${sym} to redeem 1 lot; you have ${fmt(bal)}.`),
    );
    console.log(
      `  Click ${C.bold("Request FXRP")} at https://faucet.flare.network/coston2 to\n` +
        `  ${C.bold(account.address)}, then re-run this script.`,
    );
    process.exit(1);
  }

  // ── Step 2: fund the pool ────────────────────────────────────────────────
  const pool = await read<Address>(BACKSTOP, backstopAbi, "pool");
  let poolVal = await read<bigint>(BACKSTOP, backstopAbi, "poolValueUsd");
  const nativeBal = await publicClient.getBalance({ address: account.address });
  line("pool", pool);
  line("pool value (pre)", usd(poolVal));
  line("your native", `${formatEther(nativeBal)} C2FLR`);

  const depositAmt = nativeBal > GAS_RESERVE_FLR ? nativeBal - GAS_RESERVE_FLR : 0n;
  if (depositAmt > 0n) {
    log(`funding pool with ${formatEther(depositAmt)} C2FLR (leaving ${formatEther(GAS_RESERVE_FLR)} for gas/premium)`);
    if (!DRY_RUN) {
      const tx = await wallet.writeContract({ address: pool, abi: poolAbi, functionName: "deposit", value: depositAmt });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      line("deposit tx", tx);
      poolVal = await read<bigint>(BACKSTOP, backstopAbi, "poolValueUsd");
      line("pool value (post)", usd(poolVal));
    }
  } else {
    log(C.yellow("native balance below reserve — skipping pool top-up"));
  }
  if (FUND_ONLY) {
    log(C.green("--fund-only: done."));
    return;
  }

  // ── Step 3: redeem 1 lot ─────────────────────────────────────────────────
  log(`redeeming 1 lot -> underlying ${REDEEMER_XRPL}`);
  if (DRY_RUN) {
    log(C.yellow("[dry-run] would call AssetManager.redeem(1, <yourXRPL>, 0x0) and buyGuard"));
    return;
  }
  const redeemTx = await wallet.writeContract({
    address: am, abi: assetManagerAbi, functionName: "redeem",
    args: [1n, REDEEMER_XRPL, zeroAddress], value: 0n,
  });
  const redeemRcpt = await publicClient.waitForTransactionReceipt({ hash: redeemTx });
  line("redeem tx", redeemTx);

  const events = parseEventLogs({ abi: assetManagerAbi, eventName: "RedemptionRequested", logs: redeemRcpt.logs });
  if (events.length === 0) {
    console.log(C.red("✗ No RedemptionRequested event — redemption may have been rejected (address not normalized?) or split incomplete."));
    console.log(`  Inspect tx: https://coston2-explorer.flare.network/tx/${redeemTx}`);
    process.exit(1);
  }
  const ev = events[0].args as any;
  const requestId: bigint = ev.requestId;
  const deadlineTs: bigint = ev.lastUnderlyingTimestamp;
  line("redemptionRequestId", requestId.toString());
  line("assigned agentVault", ev.agentVault);
  line("value / fee (UBA)", `${ev.valueUBA} / ${ev.feeUBA}`);
  line("payment deadline", new Date(Number(deadlineTs) * 1000).toISOString());

  // ── Step 4: size coverage + buyGuard ─────────────────────────────────────
  const maxUsd = await read<bigint>(BACKSTOP, backstopAbi, "expectedUsd", [ev.valueUBA]);
  const byPool = (poolVal * COVERAGE_FRACTION_BIPS) / 10_000n;
  let coverageUsd = byPool < maxUsd ? byPool : maxUsd;
  if (coverageUsd === 0n) {
    console.log(C.red("✗ Computed zero coverage — pool value too low. Fund the pool (Request C2FLR to #1) and retry."));
    process.exit(1);
  }
  const premium = await read<bigint>(BACKSTOP, backstopAbi, "quotePremiumFlr", [coverageUsd]);
  const value = premium + premium / 50n + 1n; // +2% buffer; buyGuard refunds overpayment
  line("coverage (max for lot)", usd(maxUsd));
  line("coverage (chosen)", `${usd(coverageUsd)}  (${Number(COVERAGE_FRACTION_BIPS) / 100}% of pool)`);
  line("premium", `${formatEther(premium)} C2FLR`);

  log("buying guard…");
  const guardTx = await wallet.writeContract({
    address: BACKSTOP, abi: backstopAbi, functionName: "buyGuard",
    args: [requestId, coverageUsd], value,
  });
  const guardRcpt = await publicClient.waitForTransactionReceipt({ hash: guardTx });
  line("buyGuard tx", guardTx);
  const bought = parseEventLogs({ abi: backstopAbi, eventName: "GuardBought", logs: guardRcpt.logs });
  const guardId = bought.length ? (bought[0].args as any).guardId : "(check tx)";

  // ── Summary ──────────────────────────────────────────────────────────────
  const waitS = Number(deadlineTs) - Math.floor(Date.now() / 1000);
  console.log(C.bold(C.green("\n╭─ Guard live ────────────────────────────────────────────────────╮")));
  line("guardId", guardId.toString());
  line("redemptionRequestId", requestId.toString());
  line("deadline", `${new Date(Number(deadlineTs) * 1000).toISOString()}  (~${Math.max(0, Math.ceil(waitS / 60))} min)`);
  console.log(C.bold("╰─────────────────────────────────────────────────────────────────╯"));
  console.log(
    `\nNext:\n` +
      `  1. If the agent PAYS the XRP before the deadline, there's nothing to claim —\n` +
      `     just run this script again for another attempt.\n` +
      `  2. After the deadline passes (+ a minute), run:\n` +
      C.bold(`        npm run keeper:once\n`) +
      `     It builds the real FDC non-existence proof and fires Backstop.claim(${guardId}).\n` +
      `  3. A CLAIMED event = your real end-to-end artifact. Grab the claim tx hash.`,
  );
}

main().catch((e) => {
  console.error(C.red(`\n✗ ${e?.shortMessage || e?.message || e}`));
  process.exit(1);
});
