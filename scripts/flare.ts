// Backstop — Flare on-chain surface for the Day-4 FDC spike.
//
// Every address here is RESOLVED AT RUNTIME from the Flare Contract Registry
// (never hardcode — see RegistryResolver.sol). The addresses in RESOLVED_COSTON2
// below are only a documented snapshot captured on 2026-07-26 so a reader knows
// what to expect; the spike re-resolves them live in stage (a).

import { stringToHex } from "viem";

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

export const COSTON2_CHAIN_ID = 114;

// FlareContractRegistry — the ONE address that is stable across all Flare
// networks (mainnet, songbird, coston, coston2). Everything else is resolved.
export const FLARE_CONTRACT_REGISTRY =
  "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019" as const;

// Registry names — VERIFIED on Coston2 (chain 114) on 2026-07-26 via
// getContractAddressByName(...) returning non-zero live addresses.
export const REGISTRY_NAMES = [
  "AssetManagerFXRP",
  "FdcVerification",
  "FtsoV2",
  "FdcHub",
  "FdcRequestFeeConfigurations",
  "FlareSystemsManager",
  "Relay",
] as const;
export type RegistryName = (typeof REGISTRY_NAMES)[number];

// Snapshot of the live resolution on Coston2 (2026-07-26). Documentation only —
// the spike prints the freshly-resolved values and does not trust these.
export const RESOLVED_COSTON2: Record<RegistryName, `0x${string}`> = {
  AssetManagerFXRP: "0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA",
  FdcVerification: "0x906507E0B64bcD494Db73bd0459d1C667e14B933",
  FtsoV2: "0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d",
  FdcHub: "0x48aC463d7975828989331F4De43341627b9c5f1D",
  FdcRequestFeeConfigurations: "0x191a1282Ac700edE65c5B0AaF313BAcC3eA7fC7e",
  FlareSystemsManager: "0xA90Db6D10F856799b10ef2A77EBCbF460aC71e52",
  Relay: "0xa10B672D1c62e5457b17af63d4302add6A99d7dE",
};

// ---------------------------------------------------------------------------
// FTSO v2 feed id — VERIFIED live on Coston2 (returned $1.098408 on 2026-07-26)
// bytes21 = 0x01 (category: crypto) + utf8("XRP/USD") right-padded to 20 bytes.
// ---------------------------------------------------------------------------
export const XRP_USD_FEED_ID =
  "0x015852502f55534400000000000000000000000000" as const;
export const FLR_USD_FEED_ID =
  "0x01464c522f55534400000000000000000000000000" as const;

// ---------------------------------------------------------------------------
// FDC — attestation request routing (VERIFIED against flare-foundry-starter)
// ---------------------------------------------------------------------------
export const FDC_PROTOCOL_ID = 200; // FdcVerification.fdcProtocolId() == 200 on Coston2
export const RPN_ATTESTATION_TYPE = "ReferencedPaymentNonexistence"; // custom:id 0x04
// XRP source: verifier URL path segment is "xrp"; the on-chain sourceId is "testXRP".
export const XRP_VERIFIER_URL_SOURCE = "xrp";
export const XRP_SOURCE_ID = "testXRP";

// Coston2 voting-round timing (from FlareSystemsManager, 2026-07-26):
//   firstVotingRoundStartTs = 1658430000, votingEpochDurationSeconds = 90.
// Finalization normally lands 2-3 rounds after submit => ~180-270s round-trip.
export const VOTING_EPOCH_SECONDS_FALLBACK = 90n;

// Hex-encode an attestation type / source name the way the FDC verifier expects:
// utf8 bytes, right-padded with zeros to 32 bytes (matches Base.toUtf8HexString).
export function toUtf8Hex32(s: string): `0x${string}` {
  return stringToHex(s, { size: 32 });
}

// ---------------------------------------------------------------------------
// Minimal ABIs (hand-written from flare-periphery 0.1.37 /src/coston2).
// getFeedById is marked `view` here on purpose: on-chain it is `payable`, but a
// zero-value eth_call reads the price for free, and marking it view lets viem
// readContract accept it.
// ---------------------------------------------------------------------------

export const registryAbi = [
  {
    type: "function",
    name: "getContractAddressByName",
    stateMutability: "view",
    inputs: [{ name: "_name", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const ftsoV2Abi = [
  {
    type: "function",
    name: "getFeedById",
    stateMutability: "view",
    inputs: [{ name: "_feedId", type: "bytes21" }],
    outputs: [
      { name: "_value", type: "uint256" },
      { name: "_decimals", type: "int8" },
      { name: "_timestamp", type: "uint64" },
    ],
  },
] as const;

// AgentInfo.Info — full 40-field struct as returned by getAgentInfo(address).
const agentInfoTuple = {
  name: "",
  type: "tuple",
  components: [
    { name: "status", type: "uint8" },
    { name: "ownerManagementAddress", type: "address" },
    { name: "ownerWorkAddress", type: "address" },
    { name: "collateralPool", type: "address" },
    { name: "collateralPoolToken", type: "address" },
    { name: "underlyingAddressString", type: "string" },
    { name: "publiclyAvailable", type: "bool" },
    { name: "feeBIPS", type: "uint256" },
    { name: "poolFeeShareBIPS", type: "uint256" },
    { name: "vaultCollateralToken", type: "address" },
    { name: "mintingVaultCollateralRatioBIPS", type: "uint256" },
    { name: "mintingPoolCollateralRatioBIPS", type: "uint256" },
    { name: "freeCollateralLots", type: "uint256" },
    { name: "totalVaultCollateralWei", type: "uint256" },
    { name: "freeVaultCollateralWei", type: "uint256" },
    { name: "vaultCollateralRatioBIPS", type: "uint256" },
    { name: "poolWNatToken", type: "address" },
    { name: "totalPoolCollateralNATWei", type: "uint256" },
    { name: "freePoolCollateralNATWei", type: "uint256" },
    { name: "poolCollateralRatioBIPS", type: "uint256" },
    { name: "totalAgentPoolTokensWei", type: "uint256" },
    { name: "announcedVaultCollateralWithdrawalWei", type: "uint256" },
    { name: "announcedPoolTokensWithdrawalWei", type: "uint256" },
    { name: "freeAgentPoolTokensWei", type: "uint256" },
    { name: "mintedUBA", type: "uint256" },
    { name: "reservedUBA", type: "uint256" },
    { name: "redeemingUBA", type: "uint256" },
    { name: "poolRedeemingUBA", type: "uint256" },
    { name: "dustUBA", type: "uint256" },
    { name: "liquidationStartTimestamp", type: "uint256" },
    { name: "maxLiquidationAmountUBA", type: "uint256" },
    { name: "liquidationPaymentFactorVaultBIPS", type: "uint256" },
    { name: "liquidationPaymentFactorPoolBIPS", type: "uint256" },
    { name: "underlyingBalanceUBA", type: "int256" },
    { name: "requiredUnderlyingBalanceUBA", type: "uint256" },
    { name: "freeUnderlyingBalanceUBA", type: "int256" },
    { name: "announcedUnderlyingWithdrawalId", type: "uint256" },
    { name: "buyFAssetByAgentFactorBIPS", type: "uint256" },
    { name: "poolExitCollateralRatioBIPS", type: "uint256" },
    { name: "redemptionPoolFeeShareBIPS", type: "uint256" },
  ],
} as const;

// RedemptionRequestInfo.Data — the ticket Backstop insures.
const redemptionRequestTuple = {
  name: "",
  type: "tuple",
  components: [
    { name: "redemptionRequestId", type: "uint64" },
    { name: "status", type: "uint8" },
    { name: "agentVault", type: "address" },
    { name: "redeemer", type: "address" },
    { name: "paymentAddress", type: "string" },
    { name: "paymentReference", type: "bytes32" }, // == standardPaymentReference
    { name: "valueUBA", type: "uint128" },
    { name: "feeUBA", type: "uint128" },
    { name: "poolFeeShareBIPS", type: "uint16" },
    { name: "firstUnderlyingBlock", type: "uint64" },
    { name: "lastUnderlyingBlock", type: "uint64" }, // deadline (block) ...
    { name: "lastUnderlyingTimestamp", type: "uint64" }, // ... AND timestamp
    { name: "timestamp", type: "uint64" },
    { name: "poolSelfClose", type: "bool" },
    { name: "transferToCoreVault", type: "bool" },
    { name: "executor", type: "address" },
    { name: "executorFeeNatWei", type: "uint256" },
  ],
} as const;

export const assetManagerAbi = [
  {
    type: "function",
    name: "lotSize",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getAvailableAgentsList",
    stateMutability: "view",
    inputs: [
      { name: "_start", type: "uint256" },
      { name: "_end", type: "uint256" },
    ],
    outputs: [
      { name: "_agents", type: "address[]" },
      { name: "_totalLength", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getAgentInfo",
    stateMutability: "view",
    inputs: [{ name: "_agentVault", type: "address" }],
    outputs: [agentInfoTuple],
  },
  {
    type: "function",
    name: "redemptionRequestInfo",
    stateMutability: "view",
    inputs: [{ name: "_redemptionRequestId", type: "uint256" }],
    outputs: [redemptionRequestTuple],
  },
] as const;

export const fdcRequestFeeConfigAbi = [
  {
    type: "function",
    name: "getRequestFee",
    stateMutability: "view",
    inputs: [{ name: "_data", type: "bytes" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const fdcHubAbi = [
  {
    type: "function",
    name: "requestAttestation",
    stateMutability: "payable",
    inputs: [{ name: "_data", type: "bytes" }],
    outputs: [],
  },
] as const;

export const flareSystemsManagerAbi = [
  {
    type: "function",
    name: "firstVotingRoundStartTs",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "votingEpochDurationSeconds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
] as const;

export const relayAbi = [
  {
    type: "function",
    name: "isFinalized",
    stateMutability: "view",
    inputs: [
      { name: "_protocolId", type: "uint256" },
      { name: "_votingRoundId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ReferencedPaymentNonexistence.Response — the shape the DA Layer returns
// (response_hex) and the shape verifyReferencedPaymentNonexistence consumes.
const rpnRequestBody = {
  name: "requestBody",
  type: "tuple",
  components: [
    { name: "minimalBlockNumber", type: "uint64" },
    { name: "deadlineBlockNumber", type: "uint64" },
    { name: "deadlineTimestamp", type: "uint64" },
    { name: "destinationAddressHash", type: "bytes32" },
    { name: "amount", type: "uint256" },
    { name: "standardPaymentReference", type: "bytes32" },
    { name: "checkSourceAddresses", type: "bool" },
    { name: "sourceAddressesRoot", type: "bytes32" },
  ],
} as const;

const rpnResponseBody = {
  name: "responseBody",
  type: "tuple",
  components: [
    { name: "minimalBlockTimestamp", type: "uint64" },
    { name: "firstOverflowBlockNumber", type: "uint64" },
    { name: "firstOverflowBlockTimestamp", type: "uint64" },
  ],
} as const;

export const rpnResponseComponents = [
  { name: "attestationType", type: "bytes32" },
  { name: "sourceId", type: "bytes32" },
  { name: "votingRound", type: "uint64" },
  { name: "lowestUsedTimestamp", type: "uint64" },
  rpnRequestBody,
  rpnResponseBody,
] as const;

// IReferencedPaymentNonexistence.Proof { bytes32[] merkleProof; Response data; }
const rpnProofTuple = {
  name: "_proof",
  type: "tuple",
  components: [
    { name: "merkleProof", type: "bytes32[]" },
    { name: "data", type: "tuple", components: rpnResponseComponents },
  ],
} as const;

export const fdcVerificationAbi = [
  {
    type: "function",
    name: "fdcProtocolId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "verifyReferencedPaymentNonexistence",
    stateMutability: "view",
    inputs: [rpnProofTuple],
    outputs: [{ name: "_proved", type: "bool" }],
  },
] as const;

// Standalone tuple used to abi-decode the DA-Layer response_hex blob.
export const rpnResponseAbiParam = {
  type: "tuple",
  components: rpnResponseComponents,
} as const;
