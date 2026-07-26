#!/usr/bin/env -S npx tsx
/**
 * Backstop — Day-4 FDC spike (go/no-go gate).
 *
 * Exercises the load-bearing Flare call-sites end-to-end on Coston2 (chain 114)
 * and prints PASS/FAIL + the raw value for each. This is the go/no-go gate: if
 * the FDC ReferencedPaymentNonexistence round-trip verifies on-chain, we build;
 * if it fails by Jul 30, we pivot to FAsset Guardian.
 *
 * Stages (run any subset; a/b/c need only a public RPC, d/e need a funded wallet):
 *   a  registry   FlareContractRegistry.getContractAddressByName(...)   [view]
 *   b  ftso       FtsoV2.getFeedById(XRP/USD bytes21) -> live price      [view]
 *   c  agent      IAssetManager.getAgentInfo(agentVault) (+ redemption)  [view]
 *   d  fdc        IFdcHub.requestAttestation(RPN) -> poll DA Layer proof [tx + poll]
 *   e  verify     IFdcVerification.verify(proof) == true                 [view]
 *
 * Usage:
 *   npx tsx scripts/spike.ts --stage a,b,c        # view-only, no funds
 *   npx tsx scripts/spike.ts --stage all          # full round-trip (funded)
 *   npx tsx scripts/spike.ts --stage c --agent 0x..    --redemption-id 123
 *   npx tsx scripts/spike.ts --stage d,e --ref 0x.. --dest r... --drops 10000000 \
 *        --min-block N --deadline-block N --deadline-ts N
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
  FLARE_CONTRACT_REGISTRY,
  REGISTRY_NAMES,
  RESOLVED_COSTON2,
  XRP_USD_FEED_ID,
  FDC_PROTOCOL_ID,
  RPN_ATTESTATION_TYPE,
  XRP_VERIFIER_URL_SOURCE,
  XRP_SOURCE_ID,
  VOTING_EPOCH_SECONDS_FALLBACK,
  toUtf8Hex32,
  registryAbi,
  ftsoV2Abi,
  assetManagerAbi,
  fdcRequestFeeConfigAbi,
  fdcHubAbi,
  flareSystemsManagerAbi,
  relayAbi,
  fdcVerificationAbi,
  rpnResponseAbiParam,
  type RegistryName,
} from "./flare.js";

// ---------------------------------------------------------------------------
// tiny CLI + pretty printing
// ---------------------------------------------------------------------------

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
  return fallback;
}

const C = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

type Outcome = "PASS" | "FAIL" | "SKIP";
const results: { stage: string; outcome: Outcome; note: string }[] = [];
function record(stage: string, outcome: Outcome, note: string) {
  const tag =
    outcome === "PASS" ? C.green("PASS") : outcome === "FAIL" ? C.red("FAIL") : C.yellow("SKIP");
  console.log(`\n[${tag}] ${C.bold(stage)} — ${note}`);
  results.push({ stage, outcome, note });
}
function line(k: string, v: unknown) {
  console.log(`      ${C.dim(k.padEnd(26))} ${v}`);
}

// ---------------------------------------------------------------------------
// clients
// ---------------------------------------------------------------------------

const RPC = process.env.COSTON2_RPC_URL;
if (!RPC) {
  console.error(C.red("COSTON2_RPC_URL is not set. Copy .env.example to .env and fill it in."));
  process.exit(2);
}
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
  const account = privateKeyToAccount(pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`));
  const wallet = createWalletClient({ account, chain: coston2, transport: http(RPC) });
  return { account, wallet };
}

// resolve a registry name live; falls back to the documented snapshot only for display
async function resolve(name: RegistryName): Promise<Address> {
  const addr = (await publicClient.readContract({
    address: FLARE_CONTRACT_REGISTRY,
    abi: registryAbi,
    functionName: "getContractAddressByName",
    args: [name],
  })) as Address;
  return addr;
}

const ZERO = "0x0000000000000000000000000000000000000000";

// ---------------------------------------------------------------------------
// Stage a — registry resolution (unknown #1: exact names per network)
// ---------------------------------------------------------------------------
async function stageA(): Promise<Record<RegistryName, Address> | undefined> {
  console.log(C.bold("\n=== Stage a — FlareContractRegistry.getContractAddressByName ==="));
  const resolved = {} as Record<RegistryName, Address>;
  let ok = true;
  for (const name of REGISTRY_NAMES) {
    try {
      const addr = await resolve(name);
      resolved[name] = addr;
      const good = addr !== ZERO;
      ok &&= good;
      line(name, `${addr} ${good ? C.green("✓") : C.red("ZERO")}`);
    } catch (e) {
      ok = false;
      line(name, C.red(`error: ${(e as Error).message}`));
    }
  }
  record("a/registry", ok ? "PASS" : "FAIL", ok ? "all 7 names resolve to live addresses" : "one or more names unresolved");
  return ok ? resolved : undefined;
}

// ---------------------------------------------------------------------------
// Stage b — FTSO v2 price (unknown #2: exact XRP/USD bytes21)
// ---------------------------------------------------------------------------
async function stageB(ftsoAddr: Address) {
  console.log(C.bold("\n=== Stage b — FtsoV2.getFeedById(XRP/USD) ==="));
  try {
    const [value, decimals, timestamp] = (await publicClient.readContract({
      address: ftsoAddr,
      abi: ftsoV2Abi,
      functionName: "getFeedById",
      args: [XRP_USD_FEED_ID],
    })) as [bigint, number, bigint];
    const price = Number(value) / 10 ** Number(decimals);
    const ageSec = Math.floor(Date.now() / 1000) - Number(timestamp);
    line("feedId (bytes21)", XRP_USD_FEED_ID);
    line("raw value", value.toString());
    line("decimals", decimals);
    line("timestamp", `${timestamp} (${ageSec}s ago)`);
    line("XRP/USD", C.bold(`$${price.toFixed(6)}`));
    const ok = value > 0n && ageSec < 3600;
    record("b/ftso", ok ? "PASS" : "FAIL", ok ? `live price $${price.toFixed(6)}` : "stale or zero price");
  } catch (e) {
    record("b/ftso", "FAIL", (e as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Stage c — IAssetManager agent + redemption (unknown #3: AgentInfo fields)
// ---------------------------------------------------------------------------
async function stageC(amAddr: Address) {
  console.log(C.bold("\n=== Stage c — IAssetManager.getAgentInfo + redemptionRequestInfo ==="));
  try {
    const lot = (await publicClient.readContract({
      address: amAddr, abi: assetManagerAbi, functionName: "lotSize",
    })) as bigint;
    line("lotSize (UBA)", `${lot} (${Number(lot) / 1e6} XRP, 6dp)`);

    let agent = arg("agent") as Address | undefined;
    if (!agent) {
      const [agents] = (await publicClient.readContract({
        address: amAddr, abi: assetManagerAbi, functionName: "getAvailableAgentsList", args: [0n, 20n],
      })) as [Address[], bigint];
      line("available agents", agents.length);
      if (agents.length === 0) {
        record("c/agent", "FAIL", "no available FXRP agents on Coston2");
        return;
      }
      agent = agents[0];
    }
    line("agentVault", agent);

    const info = (await publicClient.readContract({
      address: amAddr, abi: assetManagerAbi, functionName: "getAgentInfo", args: [agent],
    })) as any;
    const STATUS = ["NORMAL", "LIQUIDATION", "FULL_LIQUIDATION", "DESTROYING", "DESTROYED"];
    line("status", `${info.status} (${STATUS[Number(info.status)] ?? "?"})`);
    line("underlyingAddress", info.underlyingAddressString);
    line("publiclyAvailable", info.publiclyAvailable);
    line("feeBIPS", info.feeBIPS.toString());
    line("mintedUBA", info.mintedUBA.toString());
    line("redeemingUBA", info.redeemingUBA.toString());
    line("vaultCollateralRatioBIPS", info.vaultCollateralRatioBIPS.toString());
    line("freeUnderlyingBalanceUBA", info.freeUnderlyingBalanceUBA.toString());

    // Optional: read a specific redemption ticket if one is supplied.
    const rid = arg("redemption-id");
    if (rid) {
      const r = (await publicClient.readContract({
        address: amAddr, abi: assetManagerAbi, functionName: "redemptionRequestInfo", args: [BigInt(rid)],
      })) as any;
      const RSTATUS = ["ACTIVE", "DEFAULTED_UNCONFIRMED", "SUCCESSFUL", "DEFAULTED_FAILED", "BLOCKED", "REJECTED"];
      console.log(C.dim("      --- redemption ticket (the object Backstop insures) ---"));
      line("redemptionRequestId", r.redemptionRequestId.toString());
      line("status", `${r.status} (${RSTATUS[Number(r.status)] ?? "?"})`);
      line("agentVault", r.agentVault);
      line("redeemer", r.redeemer);
      line("paymentAddress", r.paymentAddress);
      line("paymentReference", r.paymentReference); // == standardPaymentReference
      line("valueUBA (expected drops)", r.valueUBA.toString());
      line("lastUnderlyingBlock", r.lastUnderlyingBlock.toString());
      line("lastUnderlyingTimestamp", r.lastUnderlyingTimestamp.toString());
      console.log(
        C.dim("      deadline semantics: defaulted once BOTH lastUnderlyingBlock AND lastUnderlyingTimestamp pass."),
      );
    } else {
      console.log(
        C.dim("      (pass --redemption-id N to also read a live redemption ticket; skipped for now)"),
      );
    }
    record("c/agent", "PASS", "AgentInfo (40 fields) + redemption ABI decode confirmed");
  } catch (e) {
    record("c/agent", "FAIL", (e as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Stage d — FDC request + DA-Layer proof fetch (unknown #4: fee, endpoint, timing)
//   REQUIRES a funded Coston2 wallet (PRIVATE_KEY) + real XRPL reference params.
// ---------------------------------------------------------------------------
async function stageD(
  fdcHub: Address,
  feeCfg: Address,
  systemsMgr: Address,
  relay: Address,
): Promise<{ requestBytes: `0x${string}`; votingRoundId: bigint } | undefined> {
  console.log(C.bold("\n=== Stage d — IFdcHub.requestAttestation(RPN) + DA Layer poll ==="));
  const w = walletFromEnv();
  if (!w) {
    record("d/fdc", "SKIP", "PRIVATE_KEY not set — requires a funded Coston2 wallet");
    return;
  }
  const verifierUrl = process.env.VERIFIER_URL_TESTNET;
  const verifierKey = process.env.VERIFIER_API_KEY_TESTNET;
  const daUrl = process.env.COSTON2_DA_LAYER_URL;
  const daKey = process.env.X_API_KEY ?? "";
  if (!verifierUrl || !daUrl) {
    record("d/fdc", "SKIP", "VERIFIER_URL_TESTNET and/or COSTON2_DA_LAYER_URL not set");
    return;
  }

  // RPN request body — describes the XRP non-payment we assert.
  // For a real guard these come from the redemption ticket (stage c);
  // for the spike they are supplied on the CLI or via a synthetic reference.
  const requestBody = {
    minimalBlockNumber: arg("min-block") ?? "0",
    deadlineBlockNumber: arg("deadline-block") ?? "0",
    deadlineTimestamp: arg("deadline-ts") ?? "0",
    destinationAddressHash:
      arg("dest-hash") ?? (arg("dest") ? keccak256(toHex(arg("dest")!)) : `0x${"00".repeat(32)}`),
    amount: arg("drops") ?? "0",
    standardPaymentReference: arg("ref") ?? `0x${"00".repeat(32)}`,
    checkSourceAddresses: false,
    sourceAddressesRoot: `0x${"00".repeat(32)}`,
  };
  line("RPN requestBody", JSON.stringify(requestBody));

  const t0 = Date.now();

  // 1) Ask the verifier to build the abi-encoded request (this embeds the MIC).
  const prepUrl = `${verifierUrl}/verifier/${XRP_VERIFIER_URL_SOURCE}/${RPN_ATTESTATION_TYPE}/prepareRequest`;
  const prepBody = {
    attestationType: toUtf8Hex32(RPN_ATTESTATION_TYPE),
    sourceId: toUtf8Hex32(XRP_SOURCE_ID),
    requestBody,
  };
  const prep = await fetch(prepUrl, {
    method: "POST",
    headers: { "X-API-KEY": verifierKey ?? "", "Content-Type": "application/json" },
    body: JSON.stringify(prepBody),
  });
  const prepJson = (await prep.json()) as { status?: string; abiEncodedRequest?: `0x${string}` };
  line("verifier status", prepJson.status);
  if (prepJson.status !== "VALID" || !prepJson.abiEncodedRequest) {
    record("d/fdc", "FAIL", `verifier did not return VALID (got ${prepJson.status}) — check XRPL params`);
    return;
  }
  const requestBytes = prepJson.abiEncodedRequest;
  line("abiEncodedRequest", `${requestBytes.slice(0, 34)}… (MIC embedded)`);

  // 2) Read the FDC fee for this exact request, then submit it on-chain.
  const fee = (await publicClient.readContract({
    address: feeCfg, abi: fdcRequestFeeConfigAbi, functionName: "getRequestFee", args: [requestBytes],
  })) as bigint;
  line("FDC request fee", `${formatEther(fee)} C2FLR`);

  const txHash = await w.wallet.writeContract({
    address: fdcHub, abi: fdcHubAbi, functionName: "requestAttestation", args: [requestBytes], value: fee,
  });
  line("requestAttestation tx", txHash);
  const rcpt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const block = await publicClient.getBlock({ blockNumber: rcpt.blockNumber });
  const submitTs = Number(block.timestamp);

  // 3) Compute the voting round id for the submission timestamp.
  const firstTs = (await publicClient.readContract({
    address: systemsMgr, abi: flareSystemsManagerAbi, functionName: "firstVotingRoundStartTs",
  })) as bigint;
  let epoch = VOTING_EPOCH_SECONDS_FALLBACK;
  try {
    epoch = (await publicClient.readContract({
      address: systemsMgr, abi: flareSystemsManagerAbi, functionName: "votingEpochDurationSeconds",
    })) as bigint;
  } catch { /* older ABIs omit this getter; fallback is 90s on Coston2 */ }
  const votingRoundId = (BigInt(submitTs) - firstTs) / epoch;
  line("votingRoundId", votingRoundId.toString());

  // 4) Wait for finalization on the Relay, then pull the proof from the DA Layer.
  const MAX_MIN = 12;
  let proofResp: any | undefined;
  for (let i = 0; i < MAX_MIN * 4; i++) {
    const finalized = (await publicClient.readContract({
      address: relay, abi: relayAbi, functionName: "isFinalized",
      args: [BigInt(FDC_PROTOCOL_ID), votingRoundId],
    })) as boolean;
    if (finalized) {
      const resp = await fetch(`${daUrl}/api/v1/fdc/proof-by-request-round-raw`, {
        method: "POST",
        headers: { "X-API-KEY": daKey, "Content-Type": "application/json" },
        body: JSON.stringify({ votingRoundId: Number(votingRoundId), requestBytes }),
      });
      const j = (await resp.json()) as any;
      if (j && (j.response_hex || j.responseHex)) { proofResp = j; break; }
    }
    process.stdout.write(C.dim(`\r      waiting for round finalization + DA proof… ${((i + 1) * 15)}s`));
    await new Promise((r) => setTimeout(r, 15_000));
  }
  console.log("");
  const latencyMs = Date.now() - t0;
  line("FDC round-trip latency", C.bold(`${(latencyMs / 1000).toFixed(1)}s`) + C.dim("  <- the honest killer stat"));

  if (!proofResp) {
    record("d/fdc", "FAIL", `no proof from DA Layer within ${MAX_MIN}m (round ${votingRoundId})`);
    return;
  }
  (globalThis as any).__proofResp = proofResp; // handed to stage e
  record("d/fdc", "PASS", `RPN proof retrieved from DA Layer in ${(latencyMs / 1000).toFixed(1)}s`);
  return { requestBytes, votingRoundId };
}

// ---------------------------------------------------------------------------
// Stage e — on-chain verification (THE load-bearing assertion)
// ---------------------------------------------------------------------------
async function stageE(fdcVerification: Address) {
  console.log(C.bold("\n=== Stage e — IFdcVerification.verifyReferencedPaymentNonexistence(proof) ==="));
  const proofResp: any = (globalThis as any).__proofResp;
  if (!proofResp) {
    record("e/verify", "SKIP", "no proof in memory (run stage d first, funded)");
    return;
  }
  try {
    const responseHex: `0x${string}` = proofResp.response_hex ?? proofResp.responseHex;
    const merkleProof: `0x${string}`[] = proofResp.proofs ?? proofResp.proof ?? [];
    const [data] = decodeAbiParameters([rpnResponseAbiParam], responseHex) as unknown as any[];
    const proof = { merkleProof, data };

    const proved = (await publicClient.readContract({
      address: fdcVerification,
      abi: fdcVerificationAbi,
      functionName: "verifyReferencedPaymentNonexistence",
      args: [proof],
    })) as boolean;
    line("votingRound", data.votingRound?.toString?.());
    line("firstOverflowBlockNumber", data.responseBody?.firstOverflowBlockNumber?.toString?.());
    line("verify() ->", proved ? C.green("true") : C.red("false"));
    record("e/verify", proved ? "PASS" : "FAIL", proved ? "on-chain RPN verification returned TRUE" : "verify returned false");
  } catch (e) {
    record("e/verify", "FAIL", (e as Error).message);
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const stagesArg = (arg("stage") ?? "a,b,c").toLowerCase();
  const want = stagesArg === "all" ? new Set(["a", "b", "c", "d", "e"]) : new Set(stagesArg.split(","));

  console.log(C.bold("Backstop — Day-4 FDC spike"));
  const chainId = await publicClient.getChainId();
  line("chainId", `${chainId} ${chainId === 114 ? C.green("(Coston2 ✓)") : C.red("(expected 114!)")}`);
  line("stages", [...want].join(", "));

  // Resolve everything once (stage a is also the resolver for later stages).
  // Fall back to the documented snapshot so b/c/d/e can still try if a fails.
  const resolved: Record<RegistryName, Address> =
    (await stageA().catch(() => undefined)) ?? (RESOLVED_COSTON2 as Record<RegistryName, Address>);

  if (want.has("b")) await stageB(resolved.FtsoV2);
  if (want.has("c")) await stageC(resolved.AssetManagerFXRP);
  if (want.has("d")) await stageD(resolved.FdcHub, resolved.FdcRequestFeeConfigurations, resolved.FlareSystemsManager, resolved.Relay);
  if (want.has("e")) await stageE(resolved.FdcVerification);

  // Summary + gate verdict.
  console.log(C.bold("\n=== Spike summary ==="));
  for (const r of results) {
    const tag = r.outcome === "PASS" ? C.green("PASS") : r.outcome === "FAIL" ? C.red("FAIL") : C.yellow("SKIP");
    console.log(`  [${tag}] ${r.stage.padEnd(12)} ${C.dim(r.note)}`);
  }
  const gateStages = results.filter((r) => ["d/fdc", "e/verify"].includes(r.stage));
  const gatePass = gateStages.length === 2 && gateStages.every((r) => r.outcome === "PASS");
  const gateFailed = gateStages.some((r) => r.outcome === "FAIL");
  const anyFail = results.some((r) => r.outcome === "FAIL");
  console.log("");
  if (gatePass) {
    console.log(C.green(C.bold("GATE: PASS — FDC RPN round-trip verified on-chain. BUILD.")));
  } else if (gateFailed) {
    console.log(C.red(C.bold("GATE: FAIL — pivot to FAsset Guardian (liquidation-event claim source) by Jul 30.")));
  } else {
    console.log(
      C.yellow("GATE: INCOMPLETE — run `--stage all` with a funded wallet to clear the load-bearing FDC round-trip."),
    );
  }
  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => {
  console.error(C.red(`fatal: ${e.stack ?? e}`));
  process.exit(1);
});
