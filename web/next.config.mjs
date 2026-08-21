import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

// Resolve the short commit SHA from the CI/Vercel env, falling back to git,
// then to empty (e.g. a source-only remote build with no .git).
function commitSha() {
  const fromEnv =
    process.env.NEXT_PUBLIC_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "";
  }
}

// wagmi/walletconnect pull in optional native/CJS deps we don't use in the
// browser. Both bundlers need to be told to stand down on these — Turbopack
// is the default since Next 16, but `webpack` is kept below so `next build
// --webpack` (or any consumer that opts back into webpack) still works.
// Keep these two lists in sync with the ones below.
//
// Packages dynamically `require()`d by CJS logging/storage libs (pino,
// walletconnect's keyvaluestorage) that are never reachable in a browser
// build — webpack marks these `externals` (leave unresolved, never bundle);
// Turbopack has no externals equivalent, so it gets the same empty-module
// alias as the `false`-aliased group below.
const externalOnlyDeps = [
  // pino's pretty-printer transport, dynamically required by walletconnect's
  // logger; never used in a browser build.
  "pino-pretty",
  // Optional IndexedDB/WebSQL backend pouchdb-core (walletconnect keyvaluestorage)
  // can use; unused because we only use the injected connector.
  "lokijs",
  // Optional Node encoding shim node-fetch references; unused in the browser.
  "encoding",
];

// Packages statically imported by the wagmi/connectors barrel whose own
// optional deps aren't installed; webpack aliases these straight to `false`
// (empty module) so the import resolves to nothing.
const aliasedToEmptyDeps = [
  // The wagmi/connectors barrel imports the Coinbase Base Account connector,
  // whose optional deps (@base-org/account -> @coinbase/cdp-sdk -> @x402/*)
  // are not installed. We only use the injected connector, so cut those
  // subtrees to empty modules to keep the bundle resolvable.
  "@base-org/account",
  "@coinbase/cdp-sdk",
  // Optional React Native storage the MetaMask SDK references but never needs
  // in the browser; unused because we only use the injected connector.
  "@react-native-async-storage/async-storage",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baked at build time so the footer can show the deployed release + commit.
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || pkg.version,
    NEXT_PUBLIC_COMMIT_SHA: commitSha(),
  },
  // Clean URL for the static pitch deck served from public/.
  async rewrites() {
    return [{ source: "/pitch", destination: "/pitch-deck.html" }];
  },
  // Next 16 defaults to Turbopack, which refuses to silently ignore a
  // `webpack` config below — it errors unless a `turbopack` key is also
  // present. Turbopack has no `externals`/`alias: false` equivalent; the
  // closest is `resolveAlias` pointed at a real (empty) module.
  turbopack: {
    resolveAlias: Object.fromEntries(
      [...externalOnlyDeps, ...aliasedToEmptyDeps].map((dep) => [
        dep,
        "./empty-module.js",
      ]),
    ),
  },
  // Only exercised by `next build --webpack` / `next dev --webpack`; Turbopack
  // ignores this block and uses `turbopack.resolveAlias` above instead.
  webpack: (config) => {
    config.externals.push(...externalOnlyDeps);
    config.resolve.alias = {
      ...config.resolve.alias,
      ...Object.fromEntries(aliasedToEmptyDeps.map((dep) => [dep, false])),
    };
    return config;
  },
};

export default nextConfig;
