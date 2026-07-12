export type ThemePreference = "dark" | "light" | "system";

export const THEME_STORAGE_KEY = "the-eye-theme";

export const brandColors = {
  green: "#009933",
  orange: "#FF9933",
} as const;

export const darkPalette = {
  background: "#0B0F14",
  surface: "#161B22",
  surfaceMuted: "#1E252D",
  text: "#FFFFFF",
  textMuted: "#B8C2CC",
  border: "#2C3440",
  sidebar: "#032221",
  danger: "#FF4D4F",
  success: "#00C853",
  warning: "#FFB300",
  info: "#29B6F6",
} as const;

export const lightPalette = {
  background: "#F1F7F6",
  surface: "#FFFFFF",
  surfaceMuted: "#E7EDF0",
  text: "#172026",
  textMuted: "#5C6670",
  border: "#D8DEE4",
  sidebar: "#032221",
  danger: "#B42318",
  success: "#00C853",
  warning: "#B54708",
  info: "#0284C7",
} as const;
