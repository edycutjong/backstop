"use client";

// Route-level error boundary — a client hook that throws lands here instead of
// Next's raw error screen. Ledger-styled, with a retry() to re-attempt the read.

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for observability; no PII, just the message + digest.
    console.error("route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="font-mono text-6xl font-semibold tracking-tight text-amber-300 sm:text-7xl">
        ✕
      </p>

      <h1 className="mt-6 text-2xl font-semibold text-mist-100 sm:text-3xl">
        A read didn&apos;t settle.
      </h1>
      <p className="mt-3 max-w-md font-mono text-sm leading-relaxed text-slate-400">
        Something failed while loading this view — most likely a hiccup reaching
        the Coston2 RPC. Nothing on-chain was affected. Try again.
      </p>
      {error?.digest && (
        <p className="mt-2 font-mono text-xs text-slate-500">
          ref: {error.digest}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-guard-400 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-all hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-guard-400/60"
        >
          ↻ Retry
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-line bg-ink-800 px-5 py-2.5 text-sm text-mist-100 transition-all hover:border-guard-400/50"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
