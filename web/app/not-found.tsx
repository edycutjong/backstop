import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 — page not found",
};

const routes = [
  { href: "/guard", label: "Guard a redemption" },
  { href: "/underwrite", label: "Underwrite" },
  { href: "/integrations/verify", label: "Verify the integration" },
];

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="font-mono text-7xl font-semibold tracking-tight text-guard-400 sm:text-8xl">
        404
      </p>

      <h1 className="mt-6 text-2xl font-semibold text-mist-100 sm:text-3xl">
        This page isn&apos;t in the net.
      </h1>
      <p className="mt-3 max-w-md font-mono text-sm leading-relaxed text-slate-400">
        Backstop catches redemption defaults — not stray URLs. The page you
        asked for doesn&apos;t exist here.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-guard-400 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-all hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-guard-400/60"
        >
          ← Back to home
        </Link>
        <Link
          href="/integrations/verify"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-line bg-ink-800 px-5 py-2.5 text-sm text-mist-100 transition-all hover:border-guard-400/50"
        >
          Verify the integration →
        </Link>
      </div>

      <nav className="mt-10 flex flex-wrap items-center justify-center gap-x-1 gap-y-2 font-mono text-sm text-slate-400">
        {routes.map((r, i) => (
          <span key={r.href} className="flex items-center">
            {i > 0 && <span className="px-3 text-ink-line">·</span>}
            <Link
              href={r.href}
              className="transition-colors hover:text-guard-400"
            >
              {r.label}
            </Link>
          </span>
        ))}
      </nav>
    </div>
  );
}
