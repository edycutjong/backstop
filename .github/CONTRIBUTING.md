# Contributing

Thanks for your interest in Backstop! 🎉

## Getting Started

1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation).
2. Fork and branch from `main`: `git checkout -b feat/your-feature`
3. Install dependencies: `forge soldeer install`
4. Copy the env template: `cp .env.example .env` and fill in a Coston2 RPC + key.

## Before You Open a PR

- `forge fmt --check` passes (formatting).
- `forge build` compiles clean.
- `forge test -vvv` passes; add or update tests for any behavior change.
- Keep commits conventional (`feat:`, `fix:`, `docs:`, `chore:`).

## Testing Notes

- Pure/local logic (pool accounting, premium math) is unit-tested and runs with no
  network. FDC/FTSO-dependent paths require a Coston2 fork or the live spike — keep
  those behind the fork-test tag and never mock the judged capability.

## Reporting Bugs / Requesting Features

Open an issue using the provided templates. Include repro steps, expected vs. actual
behavior, and environment details. For security issues, see [SECURITY.md](SECURITY.md).
