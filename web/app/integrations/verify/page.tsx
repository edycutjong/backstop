import type { Metadata } from "next";
import { VerifyDashboard } from "@/components/verify-dashboard";

export const metadata: Metadata = {
  title: "Verify the integration",
  description:
    "Live Coston2 pool state, open guards, the FDC ReferencedPaymentNonexistence proof, and verified contract links — a one-click check that the Flare integration is real.",
};

export default function VerifyPage() {
  return (
    <div className="space-y-8">
      <header>
        <span className="inline-flex items-center gap-2 rounded-full border border-guard-400/40 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-guard-400">
          Integration proof
        </span>
        <h1 className="mt-4 text-3xl font-semibold text-mist-100">
          Verify the Flare integration
        </h1>
        <p className="mt-3 max-w-2xl font-mono text-sm leading-relaxed text-slate-300">
          Everything on this page is read live from the deployed Coston2
          contracts — no wallet required. It is the one-click check that the
          FDC, FAssets and FTSO integration is real, not decoration.
        </p>
      </header>

      <VerifyDashboard />
    </div>
  );
}
