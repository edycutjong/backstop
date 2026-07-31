// Central runtime config. Values come from NEXT_PUBLIC_* (see build/.env), with
// safe public fallbacks so the app builds and reads chain data even without a
// local .env.local. None of these are secrets — they are public addresses/URLs.

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "114");

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://coston2-api.flare.network/ext/C/rpc";

export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ??
  "https://coston2-explorer.flare.network";

export const BACKSTOP_ADDRESS = (process.env.NEXT_PUBLIC_BACKSTOP_ADDRESS ??
  "0x38EB571B43C6eC03e37c8fC9514640D9d743DDca") as `0x${string}`;

export const BACKSTOP_POOL_ADDRESS = (process.env
  .NEXT_PUBLIC_BACKSTOP_POOL_ADDRESS ??
  "0xc18BDf574Ce129aa9dD7DCc80810CceE61200045") as `0x${string}`;

// Empty in the provided env — read-only views must work without it and
// wallet-gated actions fall back to an injected wallet (MetaMask).
export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

// Block the Backstop contract was deployed at (Coston2). Used to scope the
// Claimed-event log query so we don't scan the whole chain.
export const DEPLOY_BLOCK = BigInt(
  process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? "33387376",
);

export function explorerTx(hash: string) {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddress(addr: string) {
  return `${EXPLORER_URL}/address/${addr}`;
}
