import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f4efe4",
        ink: "#1c1915",
        muted: "#6d655b",
        line: "#ddd2bf",
        card: "#fffdf8",
        teal: {
          DEFAULT: "#0b6e5a",
          soft: "#dceee6",
          deep: "#084c3f"
        },
        clay: "#c45c26",
        rose: "#9c3a3a",
        navy: "#243044"
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Outfit", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 12px 40px rgba(36, 28, 18, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
