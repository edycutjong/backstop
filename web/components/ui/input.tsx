import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "w-full rounded-xl border border-ink-line bg-ink-950 px-4 py-2.5",
      "font-mono text-sm text-mist-100 placeholder:text-slate-500",
      "focus:outline-none focus:ring-2 focus:ring-guard-400/50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block font-mono text-xs uppercase tracking-wider text-slate-300",
        className,
      )}
      {...props}
    />
  );
}
