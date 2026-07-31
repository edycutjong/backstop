"use client";

import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import {
  CHAIN_ID,
  RPC_URL,
  EXPLORER_URL,
  WALLETCONNECT_PROJECT_ID,
} from "./config";

// Coston2 — defined from env so the whole app is single-sourced on build/.env.
export const coston2 = defineChain({
  id: CHAIN_ID,
  name: "Flare Testnet Coston2",
  nativeCurrency: { name: "Coston2 Flare", symbol: "C2FLR", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Coston2 Explorer", url: EXPLORER_URL },
  },
  testnet: true,
});

// We deliberately avoid RainbowKit's getDefaultConfig here: it always wires a
// WalletConnect connector, which needs a project id and logs errors when one is
// missing. The provided env has an EMPTY project id, so we use a plain wagmi
// config with the injected connector — read-only views need no wallet, and
// wallet-gated actions work through MetaMask/any injected wallet.
//
// If a WalletConnect project id is later supplied, swap this for
// getDefaultConfig({ appName, projectId, chains }) to light up the full
// RainbowKit wallet list. The rest of the app is unchanged.
export const wagmiConfig = createConfig({
  chains: [coston2],
  connectors: [injected()],
  transports: {
    [coston2.id]: http(RPC_URL),
  },
  ssr: true,
});

export const HAS_WALLETCONNECT = WALLETCONNECT_PROJECT_ID.length > 0;
