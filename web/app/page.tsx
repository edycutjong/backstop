// ─────────────────────────────────────────────────────────────────────────────
// Backstop — landing page.
//
// AESTHETIC DIRECTION (per assets/brand/DESIGN.md — non-negotiable, overrides the
// generic "distinctive Google display font" advice): "insurance you can audit" —
// an actuarial LEDGER, not a crypto casino. Dark-first vault surfaces (ink-950),
// a single trust-green accent (guard-400 #3ECF9A), monospace as the load-bearing
// brand voice (every figure/hash/tagline is mono ledger type), Flare-pink
// (ember-300) quarantined to the network chip only, and the signature green
// floor-bar resting under the hero. Swiss/data-room serious. No gradients-on-
// white, no stock imagery — the "media" is real on-chain proof.
//
// HONESTY: a real end-to-end claim HAS executed on-chain (guard #1 PAID, claim tx
// 0xd4c7be56…). Every proof shown is a real, verifiable artifact (that claim, the
// Day-4 FDC gate spike, the verified deploys, the test suite, the live pool reads)
// and is labelled as such. No fabricated users, testimonials, or usage metrics.
//
// 11 essential elements are annotated inline: [E1]…[E11].
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import type { Metadata } from "next";
import { PoolStats } from "@/components/pool-stats";
import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DAY4_SPIKE, REAL_CLAIM } from "@/lib/seed-proof";
import {
  BACKSTOP_ADDRESS,
  BACKSTOP_POOL_ADDRESS,
  explorerAddress,
  explorerTx,
} from "@/lib/config";
import { shortHex } from "@/lib/format";

// [E1] URL with keywords — descriptive route metadata (keywords + OG).
export const metadata: Metadata = {
  title: { absolute: "Backstop — redemption insurance for FXRP on Flare" },
  description:
    "If your FAsset redemption agent never delivers XRP, Backstop pays you make-whole — triggered by Flare's own on-chain non-payment proof. Deployed on Coston2.",
  // OpenGraph / Twitter / icons inherited from the root layout (with the /og-image.png card).
};

// ── Content models ───────────────────────────────────────────────────────────

// `to` present → animated count-up figure; `text` → static (non-numeric) figure.
const proofStrip: {
  l: string;
  tone: "green" | "mist";
  text?: string;
  to?: number;
  decimals?: number;
  suffix?: string;
}[] = [
  { l: "Day-4 FDC gate · live Coston2", tone: "green", text: "PASSED" },
  { l: "on-chain non-payment verify", tone: "green", text: "~2 min" },
  { l: "tests · 100% unit coverage", tone: "mist", to: 91 },
  { l: "Flare engine methods, wired", tone: "mist", to: 6 },
  { l: "contracts deployed + verified", tone: "mist", to: 2 },
];

const flow = [
  {
    step: "buyGuard",
    desc: "Bind a live FXRP redemption ticket, pay an FTSO-priced premium.",
  },
  {
    step: "agent defaults",
    desc: "The assigned agent never delivers XRP by the deadline.",
  },
  {
    step: "RPN proof",
    desc: "Flare's FDC ReferencedPaymentNonexistence proves non-payment.",
  },
  {
    step: "verify on-chain",
    desc: "IFdcVerification checks the proof inside Backstop.claim.",
  },
  {
    step: "make-whole",
    desc: "The pool pays the redeemer back — permissionless, automatic.",
  },
];

const engine = [
  {
    k: "IFdcVerification.verifyReferencedPaymentNonexistence",
    v: "The claim gate. Flare's own proof that the agent never paid — no oracle, no relayer, no light client of our own.",
  },
  {
    k: "IFdcHub.requestAttestation (RPN)",
    v: "The autonomous keeper requests the non-payment attestation the moment a deadline is breached.",
  },
  {
    k: "IAssetManager.redemptionRequestInfo",
    v: "Binds each guard to a real FAssets redemption ticket at buyGuard — the exact default the protocol recognizes.",
  },
  {
    k: "FtsoV2.getFeedById (XRP/USD · FLR/USD)",
    v: "Prices premiums and sizes make-whole payouts in real time from Flare's native oracle.",
  },
  {
    k: "FDC DA-Layer proof fetch",
    v: "Retrieves the finalized attestation plus its Merkle path before anything is submitted on-chain.",
  },
  {
    k: "FlareContractRegistry.getContractAddressByName",
    v: "Resolves every Flare address at runtime — nothing hardcoded, nothing to trust but the registry.",
  },
];

// [E8] Honest substitute for "customer testimonials": verifiable receipts.
// The chain vouches for us, not fabricated users. Each links to public proof.
const receipts = [
  {
    seal: "paid",
    claim:
      "A real FXRP redemption defaulted on Coston2 and Backstop paid the redeemer make-whole — guard #1 PAID, 170.08 C2FLR, end-to-end on-chain. Not synthetic.",
    label: `claim tx ${shortHex(REAL_CLAIM.claimTx, 8, 6)}`,
    href: explorerTx(REAL_CLAIM.claimTx),
  },
  {
    seal: "gate",
    claim:
      "The load-bearing FDC round-trip returned true on Coston2 in 99.3s (FDC round-bound) — the exact proof Backstop.claim gates on.",
    label: `attestation tx ${shortHex(DAY4_SPIKE.txHash, 8, 6)}`,
    href: explorerTx(DAY4_SPIKE.txHash),
  },
  {
    seal: "deploy",
    claim:
      "Backstop is deployed and source-verified on Coston2 — read its bytecode and storage yourself.",
    label: `Backstop ${shortHex(BACKSTOP_ADDRESS, 8, 6)}`,
    href: explorerAddress(BACKSTOP_ADDRESS),
  },
  {
    seal: "pool",
    claim:
      "The underwriting pool is a separate, verified contract holding real C2FLR collateral on-chain.",
    label: `BackstopPool ${shortHex(BACKSTOP_POOL_ADDRESS, 8, 6)}`,
    href: explorerAddress(BACKSTOP_POOL_ADDRESS),
  },
];

const faqs = [
  {
    q: "Is this actually live, or a mockup?",
    a: "Live. Both contracts are deployed and source-verified on Coston2, this site reads their state on-chain with no wallet, and a full end-to-end claim has already paid out on-chain (guard #1 PAID, tx below).",
  },
  {
    q: "Has an end-to-end claim run through the deployed contract yet?",
    a: "Yes. A real FXRP redemption defaulted on Coston2, the keeper built the FDC ReferencedPaymentNonexistence proof from the live redemption ticket, and Backstop.claim paid the redeemer make-whole — guard #1 PAID, 170.08 C2FLR (claim tx 0xd4c7be56…). Not synthetic: redeem → buyGuard → default → claim → payout, every leg on-chain.",
  },
  {
    q: "What actually triggers a payout?",
    a: "Flare's Data Connector ReferencedPaymentNonexistence attestation — the same proof the FAssets protocol itself accepts for a redemption default. Backstop verifies it on-chain inside claim(), then pays make-whole. The claim path is permissionless: the redeemer, the keeper, or anyone can submit the proof.",
  },
  {
    q: "Why does this need Flare — and only Flare?",
    a: "Remove Flare and you'd need four separate systems: an XRPL light client, a decentralized 'payment-did-not-happen' attestation network, a price oracle, and a canonical FXRP redemption registry. Flare enshrines all four, and FDC's non-existence proof is something almost no other chain exposes natively.",
  },
  {
    q: "What happens if many agents default at once?",
    a: "Per-agent exposure caps are enforced on-chain and invariant-tested, so correlated defaults are bounded rather than unbounded. It's a mitigation, not a guarantee against every tail — and we say so plainly rather than hide it.",
  },
  {
    q: "How fast is a payout, honestly?",
    a: "Bounded by the FDC voting round — measured at 99.3s on-chain, set by Flare, not by us; payout lands within one voting round. We surface the wait in the UI instead of pretending it's instant.",
  },
];

// ── Tiny geometric icons — echo the logo's stroke language (round-cap green
// strokes), never generic line-icon clipart. ─────────────────────────────────
function CradleIcon() {
  return (
    <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
      <path
        d="M32 6 V24 A9 9 0 0 1 23 33 H9"
        fill="none"
        stroke="#3ECF9A"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="23" cy="24" r="6" fill="#E9EDF2" />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="space-y-24">
      {/* ══ HERO ══ [E3] title/subtitle · [E4] primary CTA · [E5] social proof */}
      <section className="relative overflow-hidden rounded-3xl border border-ink-line dot-grid floor-bar">
        <div className="aurora" aria-hidden="true" />
        <div className="relative z-[1] hero-mesh px-6 py-16 sm:px-12 sm:py-24">
          <span className="anim-rise inline-flex items-center gap-2 rounded-full border border-guard-400/40 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-guard-400">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-guard-400" />
            Insurance you can audit
          </span>

          {/* [E3] SEO title — massive ledger type, staggered reveal. */}
          <h1
            className="hero-rule anim-rise mt-6 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-tight text-mist-100 sm:text-6xl"
            style={{ animationDelay: "70ms" }}
          >
            Redeem FXRP
            <br className="hidden sm:block" />{" "}
            <span className="accent text-guard-400">
              without the default risk.
            </span>
          </h1>

          <p
            className="anim-rise mt-6 max-w-2xl font-mono text-base leading-relaxed text-slate-300 sm:text-lg"
            style={{ animationDelay: "140ms" }}
          >
            If your redemption agent doesn&apos;t pay, Backstop makes you whole
            — triggered by Flare&apos;s own on-chain proof that the payment
            never happened. Proven, not promised.
          </p>

          {/* [E4] Primary CTA — impossible to miss, plus a secondary + verify. */}
          <div
            className="anim-rise mt-9 flex flex-wrap gap-3"
            style={{ animationDelay: "210ms" }}
          >
            <Button
              asChild
              className="sheen px-6 py-3 text-base shadow-[0_0_0_1px_rgba(62,207,154,0.35),0_10px_30px_-8px_rgba(62,207,154,0.55)] transition-transform hover:scale-[1.02]"
            >
              <Link href="/guard">Guard a redemption →</Link>
            </Button>
            <Button asChild variant="secondary" className="px-6 py-3 text-base">
              <Link href="/underwrite">Underwrite &amp; earn</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="px-6 py-3 text-base text-guard-400"
            >
              <Link href="/integrations/verify">Verify the integration</Link>
            </Button>
          </div>

          {/* [E5] Social proof — HONEST hard facts, not user counts. */}
          <div
            className="anim-rise mt-12 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-5"
            style={{ animationDelay: "300ms" }}
          >
            {proofStrip.map((p) => (
              <div key={p.l} className="flex flex-col gap-1">
                <span
                  className={
                    "tick-in font-mono text-2xl font-semibold tabular-nums " +
                    (p.tone === "green" ? "text-guard-400" : "text-mist-100")
                  }
                >
                  {p.text ? (
                    p.text
                  ) : (
                    <CountUp
                      to={p.to as number}
                      decimals={p.decimals ?? 0}
                      suffix={p.suffix ?? ""}
                    />
                  )}
                </span>
                <span className="font-mono text-[11px] leading-snug text-slate-300">
                  {p.l}
                </span>
              </div>
            ))}
          </div>

          {/* Live on-chain read — the real "live" proof element. */}
          <div
            className="anim-rise mt-10 rounded-2xl border border-ink-line bg-ink-950/60 p-6 backdrop-blur-sm"
            style={{ animationDelay: "380ms" }}
          >
            <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-guard-400" />
              Live pool state · read from Coston2 · no wallet required
            </p>
            <PoolStats />
          </div>
        </div>
      </section>

      {/* ══ MEDIA [E6] — the product's real output: the FDC trigger firing ══ */}
      <Reveal as="section">
        <div className="rule-tick h-0.5 w-full" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <div className="min-w-0">
            <h2 className="font-mono text-sm uppercase tracking-wider text-slate-300">
              See the trigger fire
            </h2>
            <p className="mt-3 max-w-xl font-mono text-sm leading-relaxed text-slate-300">
              The whole product hinges on one thing: that Flare&apos;s
              non-existence proof resolves on-chain. We front-loaded it as a
              go/no-go gate and ran it for real on Coston2. This is that run —
              labelled a spike, not an end-to-end claim.
            </p>

            {/* Ledger "terminal" — honest depiction of the Day-4 gate run. */}
            <div className="scanline mt-6 overflow-hidden rounded-2xl border border-ink-line bg-ink-950 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.7)]">
              <div className="flex items-center justify-between border-b border-ink-line px-4 py-2.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  {DAY4_SPIKE.label}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
                  <span className="live-dot inline-block h-1 w-1 rounded-full bg-amber-300" />
                  spike · not a claim
                </span>
              </div>
              <div className="space-y-1.5 break-words p-4 font-mono text-[13px] leading-relaxed">
                <p className="caret text-slate-500">
                  $ npm run spike:all{" "}
                  <span className="text-slate-500">--ref …nonpayment</span>
                </p>
                <p className="text-slate-300">
                  <span className="text-guard-400">→</span>{" "}
                  IFdcHub.requestAttestation(RPN){" "}
                  <span className="text-slate-500">requested</span>
                </p>
                <p className="text-slate-300">
                  <span className="text-guard-400">→</span> DA-Layer proof
                  fetched <span className="text-slate-500">(Merkle path)</span>
                </p>
                <p className="text-slate-300">
                  <span className="text-guard-400">→</span> IFdcVerification.
                  {DAY4_SPIKE.method}
                </p>
                <p className="pl-4 text-guard-400">
                  ✓ returned true · {DAY4_SPIKE.roundTripSeconds}s · round{" "}
                  {DAY4_SPIKE.votingRound.toLocaleString()}
                </p>
                <a
                  href={explorerTx(DAY4_SPIKE.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block break-all text-[12px] text-guard-400 underline underline-offset-2"
                >
                  tx {shortHex(DAY4_SPIKE.txHash, 10, 8)} on Coston2 Explorer ↗
                </a>
              </div>
            </div>
          </div>

          {/* [E7-adjacent] the one flow, as a stacked ledger of steps. */}
          <div className="min-w-0">
            <h2 className="font-mono text-sm uppercase tracking-wider text-slate-300">
              The one flow
            </h2>
            <ol className="mt-4 space-y-2.5">
              {flow.map((f, i) => (
                <li
                  key={f.step}
                  className="flex gap-4 rounded-xl border border-ink-line bg-ink-800/60 p-4"
                >
                  <span className="font-mono text-xs text-guard-400">
                    0{i + 1}
                  </span>
                  <div>
                    <p className="font-mono text-sm font-semibold text-mist-100">
                      {f.step}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {f.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Reveal>

      {/* ══ BENEFITS / FEATURES [E7] — the six Flare engine methods ══ */}
      <Reveal as="section">
        <div className="rule-tick h-0.5 w-full" />
        <div className="mt-6 flex items-start gap-4">
          <CradleIcon />
          <div>
            <h2 className="font-mono text-sm uppercase tracking-wider text-slate-300">
              Why this needs Flare — and only Flare
            </h2>
            <p className="mt-2 max-w-3xl font-mono text-sm leading-relaxed text-slate-300">
              Backstop is a thin, correct wrapper around the redemption-default
              mechanism that already lives inside FAssets. Six engine-class
              Flare methods, wired in code and proven on Coston2. Take Flare out
              and there is no product.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {engine.map((w, i) => (
            <Reveal key={w.k} delay={i * 60} className="min-w-0">
              <Card className="card-sheen group h-full transition-all duration-300 hover:-translate-y-0.5 hover:border-guard-400/40 hover:shadow-[0_16px_44px_-20px_rgba(62,207,154,0.4)]">
                <CardBody>
                  <span className="font-mono text-[11px] text-slate-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-1 break-words font-mono text-[13px] font-semibold leading-snug text-guard-400">
                    {w.k}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {w.v}
                  </p>
                </CardBody>
              </Card>
            </Reveal>
          ))}
        </div>

        <p className="mt-5 max-w-3xl rounded-xl border border-ink-line bg-ink-800/40 p-4 font-mono text-xs leading-relaxed text-slate-300">
          The{" "}
          <span className="text-mist-100">claim path is permissionless</span> —
          the keeper is a convenience, not a trust assumption. An autonomous
          watcher requests the proof the moment a deadline breaches, but the
          redeemer or anyone can submit it. ~500 lines of Solidity, because
          Flare enshrines the hard parts.
        </p>
      </Reveal>

      {/* ══ RECEIPTS [E8] — honest stand-in for testimonials ══ */}
      <Reveal as="section">
        <div className="rule-tick h-0.5 w-full" />
        <h2 className="mt-6 font-mono text-sm uppercase tracking-wider text-slate-300">
          Don&apos;t take our word for it — verify it
        </h2>
        <p className="mt-2 max-w-2xl font-mono text-sm leading-relaxed text-slate-300">
          No user testimonials — just what the chain vouches for, including a
          real end-to-end claim that already paid out on-chain:
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {receipts.map((r, i) => (
            <Reveal key={r.label} delay={i * 70} className="min-w-0">
              <a
                href={r.href}
                target="_blank"
                rel="noreferrer"
                className="group block h-full rounded-2xl border border-ink-line bg-ink-800/70 p-5 transition-all hover:-translate-y-0.5 hover:border-guard-400/50 hover:shadow-[0_14px_40px_-18px_rgba(62,207,154,0.5)]"
              >
                <span
                  aria-hidden="true"
                  className="font-mono text-3xl leading-none text-guard-400/70"
                >
                  ✓
                </span>
                <p className="mt-3 text-sm leading-relaxed text-mist-100">
                  {r.claim}
                </p>
                <span className="mt-4 inline-block break-all font-mono text-xs text-guard-400 underline underline-offset-2">
                  {r.label} ↗
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </Reveal>

      {/* ══ FAQ [E9] — native <details> accordion, no JS needed ══ */}
      <Reveal as="section">
        <div className="rule-tick h-0.5 w-full" />
        <h2 className="mt-6 font-mono text-sm uppercase tracking-wider text-slate-300">
          Straight answers
        </h2>
        <div className="mt-6 divide-y divide-ink-line rounded-2xl border border-ink-line bg-ink-800/50">
          {faqs.map((f) => (
            <details key={f.q} className="faq-item group px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-mono text-sm font-semibold text-mist-100 marker:content-none hover:text-guard-400">
                {f.q}
                <span
                  aria-hidden="true"
                  className="faq-sign shrink-0 font-mono text-lg leading-none text-guard-400 transition-transform duration-300"
                >
                  +
                </span>
              </summary>
              <p className="pb-5 pr-8 text-sm leading-relaxed text-slate-300">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </Reveal>

      {/* ══ FINAL CTA [E10] — dramatic, full-width, signature floor bar ══ */}
      <Reveal as="section">
        <div className="relative overflow-hidden rounded-3xl border border-guard-400/30 dot-grid floor-bar">
          <div className="aurora" aria-hidden="true" />
          <div className="relative z-[1] hero-mesh flex flex-col items-start gap-6 px-6 py-14 sm:px-12 sm:py-16">
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight text-mist-100 sm:text-4xl">
              Cover a redemption, or back the pool that pays.
            </h2>
            <p className="max-w-xl font-mono text-sm leading-relaxed text-slate-300">
              Read-only views need no wallet. Actions run on Coston2 testnet —
              fund a throwaway key at the Flare faucet and try the full flow.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                className="sheen px-7 py-3.5 text-base transition-transform hover:scale-[1.02]"
              >
                <Link href="/guard">Guard a redemption →</Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                className="px-7 py-3.5 text-base"
              >
                <Link href="/underwrite">Underwrite &amp; earn</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="px-7 py-3.5 text-base text-guard-400"
              >
                <Link href="/integrations/verify">Verify the integration</Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
