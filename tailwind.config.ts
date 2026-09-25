import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
        },
        desk: "var(--desk)",
        border: {
          DEFAULT: "#2a2a3a",
          subtle: "#1f1f2e",
        },
        accent: {
          DEFAULT: "#6366f1",
          hover: "#818cf8",
          muted: "#4f46e5",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      keyframes: {
        "ai-rise": {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "ai-caret": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
        "ai-ring": {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "100%": { transform: "scale(1.35)", opacity: "0" },
        },
        "hero-live": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.85)" },
        },
        "hero-draw": {
          "0%": { strokeDashoffset: "520" },
          "55%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "0" },
        },
        "hero-fill": {
          "0%, 12%": { opacity: "0" },
          "40%, 100%": { opacity: "1" },
        },
        "hero-rise": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "hero-glow": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "ai-rise": "ai-rise 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        "ai-caret": "ai-caret 900ms ease-in-out infinite",
        "ai-ring": "ai-ring 1.8s ease-out infinite",
        "hero-live": "hero-live 1.6s ease-in-out infinite",
        "hero-draw": "hero-draw 5.5s ease-in-out infinite",
        "hero-fill": "hero-fill 5.5s ease-in-out infinite",
        "hero-rise": "hero-rise 700ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "hero-glow": "hero-glow 3.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
