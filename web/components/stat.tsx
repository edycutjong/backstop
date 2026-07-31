import { cn } from "@/lib/cn";

export function Stat({
  label,
  value,
  sub,
  loading,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="font-mono text-[11px] uppercase tracking-wider text-slate-300">
        {label}
      </span>
      {loading ? (
        <span className="h-8 w-24 animate-pulse rounded bg-ink-line" />
      ) : (
        <span className="font-mono text-2xl font-semibold tabular-nums text-mist-100">
          {value}
        </span>
      )}
      {sub && <span className="font-mono text-xs text-slate-500">{sub}</span>}
    </div>
  );
}
