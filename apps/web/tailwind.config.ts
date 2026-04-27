import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Tomorrow", "system-ui", "sans-serif"],
        sans: ["Tomorrow", "system-ui", "sans-serif"],
        mono: ["Tomorrow", "ui-monospace", "monospace"],
      },
      colors: {
        void: "#02060d",
        obsidian: "#07111d",
        hull: "#101a27",
        steel: "#8ba5bc",
        ion: "#19a8ff",
        plasma: "#60d7ff",
        amber: "#a855f7",
      },
      boxShadow: {
        panel: "0 24px 80px rgba(0, 0, 0, 0.34)",
        glow: "0 0 32px rgba(25, 168, 255, 0.22)",
      },
    },
  },
  plugins: [],
} satisfies Config;
