/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "SF Mono", "Menlo", "monospace"],
      },
      colors: {
        bg: "#0b0b0e",
        "bg-cell": "#15151a",
        "bg-cell-active": "#1c1c23",
        fg: "#e8e8ec",
        "fg-dim": "#6b6b75",
        accent: "#7c5cff",
        error: "#ff5c7c",
        null: "#4a4a52",
      },
    },
  },
  plugins: [],
}

