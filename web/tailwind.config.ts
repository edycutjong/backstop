import type { Config } from "tailwindcss";

// Palette verbatim from backstop/assets/brand/DESIGN.md §2 — "insurance you can audit".
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0D1522",
          800: "#182433",
          line: "#24303F",
        },
        slate: {
          // 500 lightened from DESIGN.md's #55677D to meet WCAG AA (4.5:1) on
          // ink-950/ink-800 — the original failed Lighthouse color-contrast.
          500: "#7E90A6",
          300: "#8CA0B3",
        },
        mist: {
          100: "#E9EDF2",
        },
        paper: {
          DEFAULT: "#F7F6F1",
          2: "#ECEAE1",
          line: "#D8D4C6",
        },
        guard: {
          700: "#0B7A57",
          400: "#3ECF9A",
        },
        ember: {
          600: "#C81E4F",
          300: "#FF7A9C",
        },
        amber: {
          700: "#8A5B00",
          300: "#F2B94B",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SF Mono",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
        ui: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      backgroundImage: {
        "guard-ramp": "linear-gradient(135deg, #3ECF9A 0%, #0B7A57 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
