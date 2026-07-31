# Security Policy

## Scope

Backstop is a set of smart contracts (`src/`) plus an off-chain keeper. The
security-critical surface is the on-chain claim path: `Backstop.claim` must only
pay out against a valid FDC `ReferencedPaymentNonexistence` proof bound to the
exact guard, and `BackstopPool.payout` must be callable only by the Backstop core.

## Supported Versions

| Version | Supported |
|---|---|
| latest (`main`) | ✅ |

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities. Instead:

- Email **edy.cu@live.com**, or
- Use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability).

You'll get an acknowledgment within 48 hours. Please allow a reasonable window to
patch before public disclosure.
