import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1917",
        paper: "#fffdfb",
        sand: "#f6f3ef",
        line: "#e7e0d8",
        brand: "#c44536",
        branddeep: "#9d2f24"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        jp: ["var(--font-jp)", "serif"]
      },
      boxShadow: {
        card: "0 16px 40px rgba(28, 25, 23, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
