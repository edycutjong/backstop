// Flat ESLint config, replacing `.eslintrc.json` + `next lint`.
//
// `next lint` was removed in Next.js 16 (`next` now parses `lint` as a
// positional project-directory argument), so the "lint" script runs the
// ESLint CLI directly. `eslint-config-next@16+` ships a native flat config
// export (module.exports is already a flat-config array), so it's imported
// directly here — no `FlatCompat` / `@eslint/eslintrc` bridge needed.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: ["e2e/**", "playwright.config.ts", ".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
