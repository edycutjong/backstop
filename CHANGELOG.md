## [1.1.1](https://github.com/edycutjong/backstop/compare/v1.1.0...v1.1.1) (2026-07-31)


### Bug Fixes

* **ci:** run Vercel deploy gate at workspace root (web/ absent pre-checkout) ([a45a477](https://github.com/edycutjong/backstop/commit/a45a477f2fbabe6ff23586cb54a72bc64aa35375))

# [1.1.0](https://github.com/edycutjong/backstop/compare/v1.0.0...v1.1.0) (2026-07-31)


### Features

* **ci:** deploy web to Vercel production on each new release ([89e4e68](https://github.com/edycutjong/backstop/commit/89e4e6817fbc1b1b55fa930281240002e0872911))

# 1.0.0 (2026-07-31)


### Features

* core Backstop contract — FDC RPN claim gate + FTSO-priced premium/payout; Deploy script ([7bea686](https://github.com/edycutjong/backstop/commit/7bea686bef02731da5c0f3db5be0d2500d451499))
* Coston2 deploy + verify; live-fork tests; FDC round-trip PROVEN on-chain (99.3s) ([0dec83b](https://github.com/edycutjong/backstop/commit/0dec83b96e35e18feb06af1c7f8adeac3785fa5a))
* **keeper:** autonomous FDC watcher — detect breach, request RPN, poll DA-Layer, claim ([72ee3dc](https://github.com/edycutjong/backstop/commit/72ee3dc50ef0a517b8c3b2092de5f927ac82fad5))
* **web:** Next.js dApp on live Coston2 — /integrations/verify proof route, buyGuard, underwrite ([5c04515](https://github.com/edycutjong/backstop/commit/5c04515e292247117372b295f423ac194a1dcf83))
