"use client";

import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { shortHex } from "@/lib/format";
import { coston2 } from "@/lib/wagmi";

// Custom connect button (injected wallet). We avoid RainbowKit's WalletConnect
// wiring because the provided env has an empty WalletConnect project id; with a
// project id you can swap this for RainbowKit's <ConnectButton/>.
export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const injected = connectors[0];

  if (!isConnected) {
    return (
      <Button
        variant="secondary"
        disabled={isPending || !injected}
        onClick={() => injected && connect({ connector: injected })}
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </Button>
    );
  }

  const wrongChain = chainId !== coston2.id;

  return (
    <div className="flex items-center gap-2">
      {wrongChain && (
        <Button
          variant="secondary"
          className="border-amber-300/60 text-amber-300"
          onClick={() => switchChain({ chainId: coston2.id })}
        >
          Switch to Coston2
        </Button>
      )}
      <button
        onClick={() => disconnect()}
        title="Disconnect"
        className="rounded-full border border-ink-line bg-ink-800 px-3 py-1.5 font-mono text-xs text-mist-100 transition-colors hover:border-guard-400/50"
      >
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-guard-400 align-middle" />
        {shortHex(address, 6, 4)}
      </button>
    </div>
  );
}
