import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-guard-400 text-ink-950 hover:brightness-110 active:brightness-95 font-semibold",
  secondary:
    "bg-ink-800 text-mist-100 border border-ink-line hover:border-guard-400/50",
  ghost: "bg-transparent text-mist-100 hover:bg-ink-800",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-guard-400/60",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
