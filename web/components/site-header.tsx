"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { ConnectButton } from "@/components/connect-button";
import { cn } from "@/lib/cn";

const nav = [
  { href: "/guard", label: "Guard" },
  { href: "/underwrite", label: "Underwrite" },
  { href: "/integrations/verify", label: "Verify" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-ink-line bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-8">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 font-mono text-sm transition-colors",
                    active
                      ? "text-guard-400"
                      : "text-slate-300 hover:text-mist-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <a
              href="/pitch"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-1.5 font-mono text-sm text-slate-300 transition-colors hover:text-mist-100"
            >
              Pitch ↗
            </a>
            <a
              href="https://github.com/edycutjong/backstop"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-1.5 font-mono text-sm text-slate-300 transition-colors hover:text-mist-100"
            >
              GitHub ↗
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-ember-300/40 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-ember-300 lg:inline-flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-ember-300" />
            Coston2 · 114
          </span>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
