"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Count-up figure — rolls from 0 to `to` once the element scrolls into view,
 * with an easeOutExpo settle so it decelerates like a mechanical meter.
 * Non-numeric figures (e.g. "PASSED") should NOT use this; render them plain.
 * Reduced-motion users see the final value immediately (no roll).
 */
export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  durationMs = 1100,
  className,
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // Defer to a rAF callback (rather than setting state synchronously in
      // the effect body) so this update isn't flagged as a cascading render
      // — matches the animated path below, which also updates state from an
      // async callback rather than directly in the effect.
      const raf = requestAnimationFrame(() => {
        setValue(to);
        setDone(true);
      });
      return () => cancelAnimationFrame(raf);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || done) return;
        io.disconnect();
        setDone(true);

        let raf = 0;
        let start = 0;
        const tick = (t: number) => {
          if (!start) start = t;
          const p = Math.min((t - start) / durationMs, 1);
          const eased = 1 - Math.pow(2, -10 * p); // easeOutExpo
          setValue(to * eased);
          if (p < 1) raf = requestAnimationFrame(tick);
          else setValue(to);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, durationMs, done]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
