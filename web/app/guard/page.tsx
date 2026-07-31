import type { Metadata } from "next";
import { BuyGuardForm } from "@/components/buy-guard-form";
import { Card, CardBody } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Guard a redemption",
};

export default function GuardPage() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <h1 className="text-3xl font-semibold text-mist-100">
          Guard a redemption
        </h1>
        <p className="mt-3 max-w-xl font-mono text-sm leading-relaxed text-slate-300">
          Bind a guard to your live FXRP redemption ticket. The premium is
          priced in real time from the FTSO XRP/USD and FLR/USD feeds. If the
          agent defaults, anyone can submit Flare&apos;s FDC proof and you are
          paid make-whole from the pool.
        </p>
        <div className="mt-6 max-w-md">
          <BuyGuardForm />
        </div>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardBody>
            <p className="font-mono text-xs uppercase tracking-wider text-slate-500">
              How pricing works
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              <span className="text-guard-400">quotePremiumFlr(coverage)</span>{" "}
              reads the live FLR/USD feed via FTSO v2 and converts a
              USD-denominated premium to native C2FLR — the exact value you send
              with <code className="text-guard-400">buyGuard</code>. Overpayment
              is refunded on-chain.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="font-mono text-xs uppercase tracking-wider text-slate-500">
              On testnet
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              buyGuard binds a <em>real</em> FXRP redemption: the contract
              checks the request is ACTIVE and that you are its redeemer.
              Without a matching live redemption the call reverts with a clear
              reason — that is the honest, proof-gated behaviour.
            </p>
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}
