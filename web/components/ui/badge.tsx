import * as React from "react";
import { cn } from "@/lib/cn";
import type { GuardStatus } from "@/lib/abis";

// Chips are pill-shaped, mono, UPPERCASE — DESIGN.md §4.6. Status colours from §2.
export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5",
        "font-mono text-[11px] uppercase tracking-wider",
        className,
      )}
      {...props}
    />
  );
}

const statusStyles: Record<GuardStatus, string> = {
  NONE: "border-slate-500/40 text-slate-300",
  ACTIVE: "border-guard-400/50 text-guard-400",
  PAID: "border-guard-400 bg-guard-400/15 text-guard-400",
  EXPIRED: "border-slate-500/40 text-slate-300",
};

export function StatusBadge({ status }: { status: GuardStatus }) {
  return <Badge className={statusStyles[status]}>{status}</Badge>;
}
