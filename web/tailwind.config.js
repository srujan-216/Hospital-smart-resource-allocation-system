/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Light professional palette — government / medical enterprise
        bg: "#f7f8fb",           // page background (soft off-white)
        surface: "#ffffff",      // cards
        surface2: "#f1f4f9",     // subtle panel
        card: "#ffffff",
        card2: "#f1f4f9",
        border: "#e2e8f0",
        borderStrong: "#cbd5e1",
        ink: "#0f172a",          // primary text
        inkMuted: "#475569",
        muted: "#64748b",

        // Brand — Govt of India / AIIMS-style deep navy + medical teal
        primary: "#0f3a6e",
        primaryDark: "#0a2a52",
        primaryLight: "#e8f0fb",
        accent: "#0d9488",
        accentLight: "#ccfbf1",
        brand: "#0d9488",        // alias → accent (teal)
        brandDark: "#0f766e",

        // Status
        success: "#059669",
        successLight: "#d1fae5",
        ok: "#059669",           // alias → success
        warn: "#d97706",
        warnLight: "#fef3c7",
        danger: "#dc2626",
        dangerLight: "#fee2e2",
        info: "#0284c7",
        infoLight: "#e0f2fe",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.04)",
        pop: "0 8px 24px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
