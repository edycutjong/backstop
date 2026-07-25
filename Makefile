# Backstop — monorepo harness targets.
# Root = Foundry (Solidity) + TS scripts. web/ = Next.js frontend.

.PHONY: help test web-e2e lighthouse security-scan

help:
	@echo "Backstop — make targets"
	@echo ""
	@echo "  test            Run the Foundry test suite (forge test)"
	@echo "  web-e2e         Run Playwright E2E against the web app (cd web)"
	@echo "  lighthouse      Run Lighthouse CI on the web app (cd web)"
	@echo "  security-scan   Slither (Solidity) + npm audit (web)"
	@echo ""

# ── Solidity ────────────────────────────────────────────────
test:
	@echo "🧪 Running Foundry tests..."
	forge test

# ── Web (Next.js) ───────────────────────────────────────────
web-e2e:
	@echo "🎭 Running Playwright E2E tests (real read-only app, no wallet)..."
	cd web && npx playwright test

lighthouse:
	@echo "🔦 Running Lighthouse CI audit (advisory)..."
	cd web && npx lhci autorun

# ── Security ────────────────────────────────────────────────
security-scan:
	@echo "=== SLITHER (Solidity SAST) ==="
	slither . || true
	@echo ""
	@echo "=== NPM AUDIT (web) ==="
	cd web && npm audit --audit-level=high || true
