/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
