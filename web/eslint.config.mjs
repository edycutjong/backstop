// Flat ESLint config, replacing `.eslintrc.json` + `next lint`.
//
// `next lint` was removed in Next.js 16 (`next` now parses `lint` as a
// positional project-directory argument), so the "lint" script runs the
// ESLint CLI directly. `eslint-config-next@14.x/15.x` only ships the
// legacy eslintrc-shaped config, so we bridge it into flat config via
// `FlatCompat`. Once `eslint-config-next` is bumped to a version that
// ships a native flat export (v16+, which also requires eslint >=9),
// this can switch to importing it directly, e.g.:
//   import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
//   export default [...nextCoreWebVitals, { ignores: [...] }];
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    ignores: ["e2e/**", "playwright.config.ts", ".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
