import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://backstop.edycu.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Backstop — redemption insurance for FXRP",
    template: "%s · Backstop",
  },
  description:
    "If your FAsset redemption agent never delivers XRP, Backstop pays you make-whole — triggered by Flare's own on-chain proof (FDC ReferencedPaymentNonexistence). Deployed and gate-proven on Coston2.",
  applicationName: "Backstop",
  category: "DeFi",
  keywords: [
    "FXRP",
    "FXRP redemption insurance",
    "FAssets",
    "Flare",
    "Flare Data Connector",
    "ReferencedPaymentNonexistence",
    "FTSO",
    "Coston2",
    "on-chain insurance",
    "DeFi",
  ],
  authors: [{ name: "Backstop" }],
  creator: "Backstop",
  openGraph: {
    type: "website",
    siteName: "Backstop",
    title: "Backstop — redemption insurance for FXRP",
    description:
      "Proof-triggered make-whole cover for FAsset redemptions. Gate-proven and deployed on Coston2.",
    url: "/",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Backstop — redemption insurance for FXRP on Flare",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Backstop — redemption insurance for FXRP",
    description:
      "If the redemption agent never pays, Flare's own on-chain proof pays you. Gate-proven on Coston2.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon-512.png",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#0D1522",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
          <footer className="border-t border-ink-line">
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-6 font-mono text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>Backstop · Flare Summer Signal · Bounty 1 (FAssets)</span>
              <span className="flex items-center gap-3">
                <a
                  href="/pitch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 transition-colors hover:text-guard-400"
                >
                  Pitch deck ↗
                </a>
                <span>
                  Coston2 (chain 114) · read-only views need no wallet
                </span>
                {process.env.NEXT_PUBLIC_APP_VERSION ? (
                  <a
                    href={`https://github.com/edycutjong/backstop/releases/tag/v${process.env.NEXT_PUBLIC_APP_VERSION}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-ink-line px-1.5 py-0.5 text-slate-400 transition-colors hover:text-guard-400"
                    title="Deployed release"
                  >
                    v{process.env.NEXT_PUBLIC_APP_VERSION}
                    {process.env.NEXT_PUBLIC_COMMIT_SHA
                      ? ` · ${process.env.NEXT_PUBLIC_COMMIT_SHA}`
                      : ""}
                  </a>
                ) : null}
              </span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
