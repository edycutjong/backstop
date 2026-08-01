import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fmtCountdown,
  fmtDrops,
  fmtFlr,
  fmtInt,
  fmtSharePrice,
  fmtUsd,
  shortHex,
} from "./format";

const ONE = 10n ** 18n; // 1e18 (18-decimal scale)

describe("fmtFlr", () => {
  it("returns the em-dash placeholder for undefined", () => {
    expect(fmtFlr(undefined)).toBe("—");
  });

  it("formats whole FLR amounts with grouping", () => {
    expect(fmtFlr(ONE)).toBe("1");
    expect(fmtFlr(1_000_000n * ONE)).toBe("1,000,000");
  });

  it("rounds to the default 4 decimal places", () => {
    // 1234.56789 FLR -> 4 dp -> 1,234.5679
    expect(fmtFlr(1234567890000000000000n)).toBe("1,234.5679");
  });

  it("honours a custom decimal-place argument", () => {
    expect(fmtFlr(1_500_000_000_000_000_000n, 2)).toBe("1.5");
  });
});

describe("fmtUsd", () => {
  it("returns the em-dash placeholder for undefined", () => {
    expect(fmtUsd(undefined)).toBe("—");
  });

  it("always shows two fraction digits by default", () => {
    expect(fmtUsd(12n * ONE + ONE / 2n)).toBe("12.50");
    expect(fmtUsd(1234560000000000000000n)).toBe("1,234.56");
  });

  it("honours a custom decimal-place argument", () => {
    expect(fmtUsd(1234560000000000000000n, 0)).toBe("1,235");
  });
});

describe("fmtSharePrice", () => {
  it("returns the em-dash placeholder for undefined", () => {
    expect(fmtSharePrice(undefined)).toBe("—");
  });

  it("formats FLR-per-share to a fixed 4 decimals", () => {
    expect(fmtSharePrice(1_050_000_000_000_000_000n)).toBe("1.0500");
  });
});

describe("fmtInt", () => {
  it("returns the em-dash placeholder for undefined", () => {
    expect(fmtInt(undefined)).toBe("—");
  });

  it("formats a bigint with thousands separators", () => {
    expect(fmtInt(1_234_567n)).toBe("1,234,567");
  });
});

describe("shortHex", () => {
  it("returns the em-dash placeholder for undefined", () => {
    expect(shortHex(undefined)).toBe("—");
  });

  it("returns the em-dash placeholder for an empty string", () => {
    expect(shortHex("")).toBe("—");
  });

  it("returns short strings unchanged", () => {
    // length 10 <= 6 + 4 + 2 threshold -> unchanged
    expect(shortHex("0x12345678")).toBe("0x12345678");
  });

  it("truncates long hex with the default lead/tail", () => {
    expect(shortHex("0x1234567890abcdef1234567890abcdef12345678")).toBe(
      "0x1234…5678",
    );
  });

  it("honours custom lead and tail lengths", () => {
    expect(shortHex("0x1234567890abcdef1234567890abcdef12345678", 4, 2)).toBe(
      "0x12…78",
    );
  });
});

describe("fmtDrops", () => {
  it("returns the em-dash placeholder for undefined", () => {
    expect(fmtDrops(undefined)).toBe("—");
  });

  it("formats XRP from 6-decimal drops with the unit suffix", () => {
    expect(fmtDrops(1_000_000n)).toBe("1 XRP");
    expect(fmtDrops(1_500_000n)).toBe("1.5 XRP");
  });
});

describe("fmtCountdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the em-dash placeholder for undefined", () => {
    expect(fmtCountdown(undefined)).toBe("—");
  });

  it("reports a passed deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_700_000_000_000));
    // exactly now -> secs === 0 -> boundary of the <= 0 branch
    expect(fmtCountdown(1_700_000_000)).toBe("deadline passed");
    // in the past
    expect(fmtCountdown(1_699_999_000)).toBe("deadline passed");
  });

  it("formats a future deadline as zero-padded h:m:s (number input)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_700_000_000_000));
    expect(fmtCountdown(1_700_000_000 + 3661)).toBe("01:01:01");
  });

  it("accepts a bigint deadline and does not cap the hours field", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_700_000_000_000));
    // 100h 0m 0s in the future
    expect(fmtCountdown(BigInt(1_700_000_000 + 360000))).toBe("100:00:00");
  });
});
