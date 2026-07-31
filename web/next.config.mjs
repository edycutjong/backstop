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
  // wagmi/walletconnect pull in optional native deps that we don't use in the browser.
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // The wagmi/connectors barrel imports the Coinbase Base Account connector,
    // whose optional deps (@base-org/account -> @coinbase/cdp-sdk -> @x402/*)
    // are not installed. We only use the injected connector, so cut those
    // subtrees to empty modules to keep the bundle resolvable.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@base-org/account": false,
      "@coinbase/cdp-sdk": false,
      // Optional React Native storage the MetaMask SDK references but never needs
      // in the browser; unused because we only use the injected connector.
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
