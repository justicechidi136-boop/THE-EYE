import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--text)",
        muted: "var(--text-muted)",
        line: "var(--border)",
        field: "var(--bg)",
        surface: "var(--surface)",
        surfaceMuted: "var(--surface-muted)",
        command: "var(--sidebar)",
        onCommand: "var(--on-sidebar)",
        eye: "var(--accent)",
        eyeOrange: "var(--accent-orange)",
        eyeDeep: "var(--accent-hover)",
        stroke: "var(--border)",
        danger: "var(--danger)",
        warning: "var(--warning)",
        success: "var(--success)",
        info: "var(--info)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
      },
    },
  },
  plugins: [],
};

export default config;
