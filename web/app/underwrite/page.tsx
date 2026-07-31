import type { Metadata } from "next";
import { UnderwriterPanel } from "@/components/underwriter-panel";
import { Card, CardBody } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Underwrite",
};

export default function UnderwritePage() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <h1 className="text-3xl font-semibold text-mist-100">
          Underwrite the pool
        </h1>
        <p className="mt-3 max-w-xl font-mono text-sm leading-relaxed text-slate-300">
          Provide native C2FLR liquidity and earn guard premiums. You receive
          proportional shares; premiums accrue to the pool and lift the share
          price. A proven claim dilutes LPs — that is the insurance risk, made
          explicit on-chain.
        </p>
        <div className="mt-6 max-w-lg">
          <UnderwriterPanel />
        </div>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardBody>
            <p className="font-mono text-xs uppercase tracking-wider text-slate-500">
              Pool mechanics
            </p>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-slate-300">
              <li>
                <span className="text-guard-400">deposit()</span> mints shares =
                value / share price.
              </li>
              <li>
                <span className="text-guard-400">withdraw(shares)</span> burns
                shares for the proportional balance.
              </li>
              <li>
                Only the Backstop contract can draw a payout, and only on a
                proven default.
              </li>
            </ul>
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}
