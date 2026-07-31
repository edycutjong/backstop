import { formatUnits } from "viem";

// FLR (native) has 18 decimals; USD values in the contract are 1e18-scaled.

export function fmtFlr(wei?: bigint, dp = 4): string {
  if (wei === undefined) return "—";
  const n = Number(formatUnits(wei, 18));
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: dp,
  });
}

export function fmtUsd(usd1e18?: bigint, dp = 2): string {
  if (usd1e18 === undefined) return "—";
  const n = Number(formatUnits(usd1e18, 18));
  return n.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

// sharePrice() is returned 1e18-scaled (FLR wei per share).
export function fmtSharePrice(sp?: bigint): string {
  if (sp === undefined) return "—";
  const n = Number(formatUnits(sp, 18));
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

export function fmtInt(v?: bigint): string {
  if (v === undefined) return "—";
  return v.toLocaleString("en-US");
}

export function shortHex(hex?: string, lead = 6, tail = 4): string {
  if (!hex) return "—";
  if (hex.length <= lead + tail + 2) return hex;
  return `${hex.slice(0, lead)}…${hex.slice(-tail)}`;
}

export function fmtDrops(drops?: bigint): string {
  // XRP has 6 decimals (drops). Contract stores expectedAmount in minimal units.
  if (drops === undefined) return "—";
  const n = Number(formatUnits(drops, 6));
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 6 })} XRP`;
}

export function fmtCountdown(deadlineTs?: bigint | number): string {
  if (deadlineTs === undefined) return "—";
  const secs = Number(deadlineTs) - Math.floor(Date.now() / 1000);
  if (secs <= 0) return "deadline passed";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
