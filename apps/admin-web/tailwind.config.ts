import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        muted: "#5c6670",
        line: "#d8dee4",
        field: "#f1f7f6",
        command: "#032221",
        eye: "#019934",
        eyeDeep: "#0b7e5d",
        danger: "#b42318",
        warning: "#b54708",
      },
      boxShadow: {
        soft: "0 8px 24px rgba(17, 24, 32, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
