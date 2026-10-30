import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        praxd: {
          bg: "#111111",
          sidebar: "#171717",
          panel: "#1b1b1b",
          "panel-hover": "#222222",
          border: "#303030",
          "border-soft": "#262626",
          text: "#f2f2f2",
          "text-secondary": "#a3a3a3",
          "text-muted": "#737373",
          green: "#2fbf71",
          red: "#f05252",
          amber: "#d6a344",
          blue: "#5a9cff",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Geist Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "9px",
        lg: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
