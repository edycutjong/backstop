import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// config.ts resolves its constants from NEXT_PUBLIC_* at module-load time, so
// each env scenario is exercised by mutating process.env, resetting the module
// registry, and re-importing a fresh copy.

const KEYS = [
  "NEXT_PUBLIC_CHAIN_ID",
  "NEXT_PUBLIC_RPC_URL",
  "NEXT_PUBLIC_EXPLORER_URL",
  "NEXT_PUBLIC_BACKSTOP_ADDRESS",
  "NEXT_PUBLIC_BACKSTOP_POOL_ADDRESS",
  "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
  "NEXT_PUBLIC_DEPLOY_BLOCK",
] as const;

let saved: Record<string, string | undefined>;

async function loadConfig(env: Record<string, string> = {}) {
  for (const key of KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  vi.resetModules();
  return import("./config");
}

beforeEach(() => {
  saved = {};
  for (const key of KEYS) saved[key] = process.env[key];
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.resetModules();
});

describe("config constants — public fallbacks (no env set)", () => {
  it("resolves every constant to its safe public default", async () => {
    const c = await loadConfig();
    expect(c.CHAIN_ID).toBe(114);
    expect(c.RPC_URL).toBe("https://coston2-api.flare.network/ext/C/rpc");
    expect(c.EXPLORER_URL).toBe("https://coston2-explorer.flare.network");
    expect(c.BACKSTOP_ADDRESS).toBe(
      "0xe7DFfa49EC57f5a9ca349C0F9a170950F052E708",
    );
    expect(c.BACKSTOP_POOL_ADDRESS).toBe(
      "0x9c1e0f1318141B7dA85207d731157D4853918A9A",
    );
    expect(c.WALLETCONNECT_PROJECT_ID).toBe("");
    expect(c.DEPLOY_BLOCK).toBe(33492108n);
  });
});

describe("config constants — env overrides", () => {
  it("prefers NEXT_PUBLIC_* values when present", async () => {
    const c = await loadConfig({
      NEXT_PUBLIC_CHAIN_ID: "14",
      NEXT_PUBLIC_RPC_URL: "https://rpc.example/ext",
      NEXT_PUBLIC_EXPLORER_URL: "https://explorer.example",
      NEXT_PUBLIC_BACKSTOP_ADDRESS:
        "0x1111111111111111111111111111111111111111",
      NEXT_PUBLIC_BACKSTOP_POOL_ADDRESS:
        "0x2222222222222222222222222222222222222222",
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "wc-project-id",
      NEXT_PUBLIC_DEPLOY_BLOCK: "42",
    });
    expect(c.CHAIN_ID).toBe(14);
    expect(c.RPC_URL).toBe("https://rpc.example/ext");
    expect(c.EXPLORER_URL).toBe("https://explorer.example");
    expect(c.BACKSTOP_ADDRESS).toBe(
      "0x1111111111111111111111111111111111111111",
    );
    expect(c.BACKSTOP_POOL_ADDRESS).toBe(
      "0x2222222222222222222222222222222222222222",
    );
    expect(c.WALLETCONNECT_PROJECT_ID).toBe("wc-project-id");
    expect(c.DEPLOY_BLOCK).toBe(42n);
  });
});

describe("explorer URL builders", () => {
  it("builds a tx URL from the default explorer base", async () => {
    const c = await loadConfig();
    expect(c.explorerTx("0xabc")).toBe(
      "https://coston2-explorer.flare.network/tx/0xabc",
    );
  });

  it("builds an address URL from the default explorer base", async () => {
    const c = await loadConfig();
    expect(c.explorerAddress("0xdef")).toBe(
      "https://coston2-explorer.flare.network/address/0xdef",
    );
  });

  it("uses the overridden explorer base for both builders", async () => {
    const c = await loadConfig({
      NEXT_PUBLIC_EXPLORER_URL: "https://explorer.example",
    });
    expect(c.explorerTx("0xabc")).toBe("https://explorer.example/tx/0xabc");
    expect(c.explorerAddress("0xdef")).toBe(
      "https://explorer.example/address/0xdef",
    );
  });
});
