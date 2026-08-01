#!/usr/bin/env -S npx tsx
/**
 * Backstop — autonomous KEEPER.
 *
 * The off-chain watcher that turns Backstop from a contract into a working
 * product. It polls every ACTIVE guard on the deployed Backstop contract and,
 * once a guard's redemption deadline has passed, runs the SAME FDC
 * ReferencedPaymentNonexistence (RPN) request→proof pipeline proven in the
 * Day-4 spike (scripts/spike.ts stages d + e) and then submits
 * `Backstop.claim(guardId, proof)` on-chain. The claim re-verifies the proof
 * against the live FdcVerification contract, so the keeper never has to be
 * trusted — it is a convenience, not an authority. Anyone can call `claim`
 * permissionlessly with the same proof.
 *
 * Pipeline per claimable guard (mirrors spike.ts):
 *   1. Read redemptionRequestInfo(guard.redemptionRequestId) to reconstruct the
 *      RPN request body (the exact XRP non-payment we assert).
 *      FALLBACK: if the ticket is gone / fields are 0 (a synthetic demo guard),
 *      derive a finalized XRPL testnet ledger range (~300 ledgers back).
 *   2. verifier /prepareRequest  → abiEncodedRequest (MIC embedded)   [stage d]
 *   3. IFdcHub.requestAttestation(requestBytes) on-chain              [stage d]
 *   4. compute votingRoundId, poll Relay.isFinalized                 [stage d]
 *   5. fetch proof from the DA Layer                                  [stage d]
 *   6. decode DA response_hex into the on-chain Proof tuple           [stage e]
 *   7. Backstop.claim(guardId, proof)                                 [payout]
 *
 * Run modes:
 *   npx tsx scripts/keeper.ts            # loop forever every KEEPER_POLL_SECONDS
 *   npx tsx scripts/keeper.ts --once     # one sweep, then exit (CI/demo)
 *   npx tsx scripts/keeper.ts --dry-run  # everything EXCEPT the on-chain writes
 */

import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  decodeAbiParameters,
  keccak256,
  toHex,
  formatEther,
  type Address,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  RESOLVED_COSTON2,
  FLARE_CONTRACT_REGISTRY,
  FDC_PROTOCOL_ID,
  RPN_ATTESTATION_TYPE,
  XRP_VERIFIER_URL_SOURCE,
  XRP_SOURCE_ID,
  VOTING_EPOCH_SECONDS_FALLBACK,
  toUtf8Hex32,
  registryAbi,
  assetManagerAbi,
  fdcHubAbi,
  fdcRequestFeeConfigAbi,
  flareSystemsManagerAbi,
  relayAbi,
  rpnResponseAbiParam,
  rpnResponseComponents,
  type RegistryName,
} from "./flare.js";

// ---------------------------------------------------------------------------
// CLI + pretty printing (same palette as spike.ts)
// ---------------------------------------------------------------------------

const FLAGS = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const ONCE = FLAGS.has("--once");
const DRY_RUN = FLAGS.has("--dry-run");

const C = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};
function line(k: string, v: unknown) {
  console.log(`      ${C.dim(k.padEnd(26))} ${v}`);
}
function log(msg: string) {
  console.log(`${C.dim(new Date().toISOString())}  ${msg}`);
}

// ---------------------------------------------------------------------------
// Config + clients
// ---------------------------------------------------------------------------

const RPC = process.env.COSTON2_RPC_URL;
if (!RPC) {
  console.error(C.red("COSTON2_RPC_URL is not set. Copy .env.example to .env and fill it in."));
  process.exit(2);
}
const BACKSTOP = process.env.BACKSTOP_ADDRESS as Address | undefined;
if (!BACKSTOP) {
  console.error(C.red("BACKSTOP_ADDRESS is not set."));
  process.exit(2);
}
const POLL_SECONDS = Number(process.env.KEEPER_POLL_SECONDS ?? "30") || 30;

const coston2 = {
  id: 114,
  name: "Coston2",
  nativeCurrency: { name: "Coston2 Flare", symbol: "C2FLR", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
} as const;

const publicClient: PublicClient = createPublicClient({ transport: http(RPC) }) as PublicClient;

function walletFromEnv() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) return undefined;
  const account = privateKeyToAccount(
    pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`),
  );
  const wallet = createWalletClient({ account, chain: coston2, transport: http(RPC) });
  return { account, wallet };
}

// Live-resolve a registry name; fall back to the documented snapshot for display.
async function resolve(name: RegistryName): Promise<Address> {
  try {
    const addr = (await publicClient.readContract({
      address: FLARE_CONTRACT_REGISTRY,
      abi: registryAbi,
      functionName: "getContractAddressByName",
      args: [name],
    })) as Address;
    if (addr && addr !== "0x0000000000000000000000000000000000000000") return addr;
  } catch {
    /* fall through to snapshot */
  }
  return RESOLVED_COSTON2[name] as Address;
}

const ZERO32 = `0x${"00".repeat(32)}` as `0x${string}`;
// Placeholder XRPL destination used ONLY on the synthetic-demo fallback path.
// For an RPN (non-existence) assertion the destination just scopes the search;
// the assertion is "no payment with this reference to this address exists", which
// is trivially true for a demo reference — the real path uses the ticket address.
const DEMO_XRPL_ADDRESS = "rBackstopKeeperDemoNoPaymentXXXXXX";
const RIPPLE_EPOCH_OFFSET = 946684800; // XRPL close_time is seconds since 2000-01-01

// ---------------------------------------------------------------------------
// Minimal Backstop ABI (guards, nextGuardId, claim)
// ---------------------------------------------------------------------------

const backstopAbi = [
  {
    type: "function",
    name: "nextGuardId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "guards",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
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
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "guardId", type: "uint256" },
      {
        name: "proof",
        type: "tuple",
        components: [
          { name: "merkleProof", type: "bytes32[]" },
          { name: "data", type: "tuple", components: rpnResponseComponents },
        ],
      },
    ],
    outputs: [],
  },
] as const;

type Guard = {
  redeemer: Address;
  agentVault: Address;
  redemptionRequestId: bigint;
  ticketRef: `0x${string}`;
  expectedAmount: bigint;
  deadlineTs: bigint;
  coverageUsd: bigint;
  premiumPaid: bigint;
  status: number;
};

const STATUS_NAME = ["NONE", "ACTIVE", "PAID", "EXPIRED"] as const;

type RpnRequestBody = {
  minimalBlockNumber: string;
  deadlineBlockNumber: string;
  deadlineTimestamp: string;
  destinationAddressHash: `0x${string}`;
  amount: string;
  standardPaymentReference: `0x${string}`;
  checkSourceAddresses: boolean;
  sourceAddressesRoot: `0x${string}`;
};

// Resolved once at startup.
let ADDR: {
  assetManager: Address;
  fdcHub: Address;
  feeCfg: Address;
  systemsMgr: Address;
  relay: Address;
};

// ---------------------------------------------------------------------------
// XRPL fallback — derive a finalized testnet ledger range (synthetic demo guards)
// ---------------------------------------------------------------------------

async function xrplLedger(indexOrTag: number | "validated"): Promise<any> {
  const resp = await fetch("https://s.altnet.rippletest.net:51234/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "ledger",
      params: [{ ledger_index: indexOrTag, transactions: false, expand: false }],
    }),
  });
  const j = (await resp.json()) as any;
  return j?.result?.ledger ?? j?.result;
}

async function fallbackRpnRequest(guard: Guard): Promise<RpnRequestBody> {
  log(C.yellow("  fallback: reconstructing RPN range from XRPL testnet (synthetic guard)"));
  const head = await xrplLedger("validated");
  const validated = Number(head.ledger_index);
  const deadlineBlock = validated - 300; // well past finality
  const minimalBlock = deadlineBlock - 20;
  const deadlineLedger = await xrplLedger(deadlineBlock);
  const closeTime = Number(deadlineLedger.close_time);
  const deadlineTs = closeTime + RIPPLE_EPOCH_OFFSET;
  line("XRPL validated ledger", validated);
  line("minimalBlockNumber", minimalBlock);
  line("deadlineBlockNumber", deadlineBlock);
  line("deadlineTimestamp", `${deadlineTs} (unix)`);
  return {
    minimalBlockNumber: String(minimalBlock),
    deadlineBlockNumber: String(deadlineBlock),
    deadlineTimestamp: String(deadlineTs),
    destinationAddressHash: keccak256(toHex(DEMO_XRPL_ADDRESS)),
    amount: guard.expectedAmount.toString(),
    standardPaymentReference: guard.ticketRef,
    checkSourceAddresses: false,
    sourceAddressesRoot: ZERO32,
  };
}

// ---------------------------------------------------------------------------
// Build the RPN request body from the redemption ticket (primary path).
// ---------------------------------------------------------------------------

async function buildRpnRequest(guard: Guard): Promise<RpnRequestBody> {
  let r: any | undefined;
  try {
    r = await publicClient.readContract({
      address: ADDR.assetManager,
      abi: assetManagerAbi,
      functionName: "redemptionRequestInfo",
      args: [guard.redemptionRequestId],
    });
  } catch (e) {
    log(C.yellow(`  redemptionRequestInfo reverted (${(e as Error).message.split("\n")[0]})`));
  }

  const ticketGone =
    !r ||
    BigInt(r.firstUnderlyingBlock ?? 0) === 0n ||
    BigInt(r.lastUnderlyingTimestamp ?? 0) === 0n;

  if (ticketGone) return fallbackRpnRequest(guard);

  line("paymentAddress", r.paymentAddress);
  line("firstUnderlyingBlock", r.firstUnderlyingBlock.toString());
  line("lastUnderlyingBlock", r.lastUnderlyingBlock.toString());
  line("lastUnderlyingTimestamp", r.lastUnderlyingTimestamp.toString());
  return {
    minimalBlockNumber: r.firstUnderlyingBlock.toString(),
    deadlineBlockNumber: r.lastUnderlyingBlock.toString(),
    deadlineTimestamp: r.lastUnderlyingTimestamp.toString(),
    destinationAddressHash: keccak256(toHex(r.paymentAddress as string)),
    amount: guard.expectedAmount.toString(),
    standardPaymentReference: guard.ticketRef,
    checkSourceAddresses: false,
    sourceAddressesRoot: ZERO32,
  };
}

// ---------------------------------------------------------------------------
// Request attestation + fetch proof (mirrors spike.ts stage d, then decode e).
// ---------------------------------------------------------------------------

async function requestAndFetchProof(
  requestBody: RpnRequestBody,
): Promise<{ merkleProof: `0x${string}`[]; data: any } | undefined> {
  const w = walletFromEnv();
  if (!w) {
    log(C.red("  PRIVATE_KEY not set — cannot submit attestation"));
    return;
  }
  const verifierUrl = process.env.VERIFIER_URL_TESTNET;
  const verifierKey = process.env.VERIFIER_API_KEY_TESTNET ?? "";
  const daUrl = process.env.COSTON2_DA_LAYER_URL;
  const daKey = process.env.X_API_KEY ?? "";
  if (!verifierUrl || !daUrl) {
    log(C.red("  VERIFIER_URL_TESTNET and/or COSTON2_DA_LAYER_URL not set"));
    return;
  }

  // 1) verifier /prepareRequest → abi-encoded request (embeds the MIC).
  const prepUrl = `${verifierUrl}/verifier/${XRP_VERIFIER_URL_SOURCE}/${RPN_ATTESTATION_TYPE}/prepareRequest`;
  const prep = await fetch(prepUrl, {
    method: "POST",
    headers: { "X-API-KEY": verifierKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      attestationType: toUtf8Hex32(RPN_ATTESTATION_TYPE),
      sourceId: toUtf8Hex32(XRP_SOURCE_ID),
      requestBody,
    }),
  });
  const prepJson = (await prep.json()) as { status?: string; abiEncodedRequest?: `0x${string}` };
  line("verifier status", prepJson.status);
  if (prepJson.status !== "VALID" || !prepJson.abiEncodedRequest) {
    log(C.red(`  verifier did not return VALID (got ${prepJson.status}) — check XRPL params`));
    return;
  }
  const requestBytes = prepJson.abiEncodedRequest;
  line("abiEncodedRequest", `${requestBytes.slice(0, 34)}… (MIC embedded)`);

  // 2) Read the FDC fee for this exact request.
  const fee = (await publicClient.readContract({
    address: ADDR.feeCfg,
    abi: fdcRequestFeeConfigAbi,
    functionName: "getRequestFee",
    args: [requestBytes],
  })) as bigint;
  line("FDC request fee", `${formatEther(fee)} C2FLR`);

  if (DRY_RUN) {
    log(C.cyan("  [dry-run] WOULD submit IFdcHub.requestAttestation with the above requestBytes"));
    log(C.cyan("  [dry-run] skipping attestation + DA poll + claim"));
    return;
  }

  // 3) Submit the attestation request on-chain.
  const txHash = await w.wallet.writeContract({
    address: ADDR.fdcHub,
    abi: fdcHubAbi,
    functionName: "requestAttestation",
    args: [requestBytes],
    value: fee,
  });
  line("requestAttestation tx", txHash);
  const rcpt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const block = await publicClient.getBlock({ blockNumber: rcpt.blockNumber });
  const submitTs = Number(block.timestamp);

  // 4) Compute the voting round id for the submission timestamp.
  const firstTs = (await publicClient.readContract({
    address: ADDR.systemsMgr,
    abi: flareSystemsManagerAbi,
    functionName: "firstVotingRoundStartTs",
  })) as bigint;
  let epoch = VOTING_EPOCH_SECONDS_FALLBACK;
  try {
    epoch = (await publicClient.readContract({
      address: ADDR.systemsMgr,
      abi: flareSystemsManagerAbi,
      functionName: "votingEpochDurationSeconds",
    })) as bigint;
  } catch {
    /* older ABIs omit this getter; 90s fallback on Coston2 */
  }
  const votingRoundId = (BigInt(submitTs) - firstTs) / epoch;
  line("votingRoundId", votingRoundId.toString());

  // 5) Wait for finalization on the Relay, then pull the proof from the DA Layer.
  const MAX_MIN = 12;
  let proofResp: any | undefined;
  for (let i = 0; i < MAX_MIN * 4; i++) {
    const finalized = (await publicClient.readContract({
      address: ADDR.relay,
      abi: relayAbi,
      functionName: "isFinalized",
      args: [BigInt(FDC_PROTOCOL_ID), votingRoundId],
    })) as boolean;
    if (finalized) {
      const resp = await fetch(`${daUrl}/api/v1/fdc/proof-by-request-round-raw`, {
        method: "POST",
        headers: { "X-API-KEY": daKey, "Content-Type": "application/json" },
        body: JSON.stringify({ votingRoundId: Number(votingRoundId), requestBytes }),
      });
      const j = (await resp.json()) as any;
      if (j && (j.response_hex || j.responseHex)) {
        proofResp = j;
        break;
      }
    }
    process.stdout.write(C.dim(`\r      waiting for round finalization + DA proof… ${(i + 1) * 15}s`));
    await sleep(15_000);
  }
  console.log("");

  if (!proofResp) {
    log(C.red(`  no proof from DA Layer within ${MAX_MIN}m (round ${votingRoundId})`));
    return;
  }

  // 6) Decode the DA response into the on-chain Proof tuple (spike stage e).
  const responseHex: `0x${string}` = proofResp.response_hex ?? proofResp.responseHex;
  const merkleProof: `0x${string}`[] = proofResp.proofs ?? proofResp.proof ?? [];
  const [data] = decodeAbiParameters([rpnResponseAbiParam], responseHex) as unknown as any[];
  return { merkleProof, data };
}

// ---------------------------------------------------------------------------
// Process a single claimable guard.
// ---------------------------------------------------------------------------

async function processClaim(guardId: bigint, guard: Guard) {
  console.log(C.bold(`\n=== processClaim guard #${guardId} ===`));
  line("redeemer", guard.redeemer);
  line("agentVault", guard.agentVault);
  line("redemptionRequestId", guard.redemptionRequestId.toString());
  line("ticketRef", guard.ticketRef);
  line("expectedAmount (drops)", guard.expectedAmount.toString());
  line("deadlineTs", `${guard.deadlineTs} (${new Date(Number(guard.deadlineTs) * 1000).toISOString()})`);

  const requestBody = await buildRpnRequest(guard);
  line("RPN requestBody", JSON.stringify(requestBody));

  const proof = await requestAndFetchProof(requestBody);
  if (!proof) {
    if (DRY_RUN) log(C.cyan(`  [dry-run] guard #${guardId}: nothing submitted (dry-run)`));
    else log(C.red(`  guard #${guardId}: no proof obtained — will retry next sweep`));
    return;
  }

  const w = walletFromEnv()!;
  const claimTx = await w.wallet.writeContract({
    address: BACKSTOP!,
    abi: backstopAbi,
    functionName: "claim",
    args: [guardId, proof],
    // Explicit, generous limit: the on-chain FDC Merkle verification + nonReentrant
    // guards make auto-estimation flaky (it can land just under and OOG). ~220k is
    // the real cost; 700k is a safe ceiling.
    gas: 700_000n,
  });
  log(C.green(`  claim tx submitted: ${claimTx}`));
  line("Flarescan", `https://coston2.testnet.flarescan.com/tx/${claimTx}`);
  const rcpt = await publicClient.waitForTransactionReceipt({ hash: claimTx });
  log(
    rcpt.status === "success"
      ? C.green(`  guard #${guardId} PAID — claim confirmed in block ${rcpt.blockNumber}`)
      : C.red(`  guard #${guardId} claim REVERTED (tx ${claimTx})`),
  );
}

// ---------------------------------------------------------------------------
// One sweep over all guards.
// ---------------------------------------------------------------------------

async function sweep() {
  const nextGuardId = (await publicClient.readContract({
    address: BACKSTOP!,
    abi: backstopAbi,
    functionName: "nextGuardId",
  })) as bigint;
  const total = nextGuardId - 1n;
  log(`sweep: nextGuardId=${nextGuardId} → ${total} guard(s) to inspect`);

  const now = BigInt(Math.floor(Date.now() / 1000));
  let claimable = 0;

  for (let id = 1n; id < nextGuardId; id++) {
    const raw = (await publicClient.readContract({
      address: BACKSTOP!,
      abi: backstopAbi,
      functionName: "guards",
      args: [id],
    })) as readonly [Address, Address, bigint, `0x${string}`, bigint, bigint, bigint, bigint, number];
    const guard: Guard = {
      redeemer: raw[0],
      agentVault: raw[1],
      redemptionRequestId: raw[2],
      ticketRef: raw[3],
      expectedAmount: raw[4],
      deadlineTs: raw[5],
      coverageUsd: raw[6],
      premiumPaid: raw[7],
      status: Number(raw[8]),
    };
    const statusName = STATUS_NAME[guard.status] ?? `?(${guard.status})`;
    const isClaimable = guard.status === 1 && now > guard.deadlineTs;

    if (guard.status !== 1) {
      // Idempotent: PAID/EXPIRED/NONE are terminal — never re-claim.
      log(`  guard #${id}: ${statusName} — skip (terminal)`);
      continue;
    }
    if (!isClaimable) {
      const secsLeft = guard.deadlineTs - now;
      log(`  guard #${id}: ACTIVE, deadline in ${secsLeft}s — skip (not yet due)`);
      continue;
    }
    log(C.yellow(`  guard #${id}: ACTIVE + past deadline — CLAIMABLE`));
    claimable++;
    try {
      await processClaim(id, guard);
    } catch (e) {
      log(C.red(`  guard #${id}: processClaim error — ${(e as Error).message.split("\n")[0]}`));
    }
  }

  log(`sweep complete: ${claimable} claimable guard(s) processed`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(C.bold("Backstop — autonomous KEEPER"));
  const chainId = await publicClient.getChainId();
  line("chainId", `${chainId} ${chainId === 114 ? C.green("(Coston2 ✓)") : C.red("(expected 114!)")}`);
  line("Backstop", BACKSTOP);
  line(
    "mode",
    DRY_RUN ? C.cyan("DRY-RUN (no on-chain writes)") : ONCE ? "ONCE (single sweep)" : `LOOP (every ${POLL_SECONDS}s)`,
  );

  ADDR = {
    assetManager: await resolve("AssetManagerFXRP"),
    fdcHub: await resolve("FdcHub"),
    feeCfg: await resolve("FdcRequestFeeConfigurations"),
    systemsMgr: await resolve("FlareSystemsManager"),
    relay: await resolve("Relay"),
  };
  line("AssetManagerFXRP", ADDR.assetManager);
  line("FdcHub", ADDR.fdcHub);

  if (ONCE || DRY_RUN) {
    await sweep();
    log(C.green("done (single sweep)"));
    process.exit(0);
  }

  // Loop forever.
  for (;;) {
    try {
      await sweep();
    } catch (e) {
      log(C.red(`sweep error: ${(e as Error).message.split("\n")[0]}`));
    }
    await sleep(POLL_SECONDS * 1000);
  }
}

main().catch((e) => {
  console.error(C.red(`fatal: ${e.stack ?? e}`));
  process.exit(1);
});
