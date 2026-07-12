"use client";

import { useTheme } from "../components/theme-provider";
import type { ThemePreference } from "../lib/theme/tokens";

const options: Array<{ value: ThemePreference; label: string }> = [
  { value: "dark", label: "Dark (default)" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

export function ThemeSettingsPanel() {
  const { preference, resolvedTheme, setPreference } = useTheme();

  return (
    <div className="grid gap-3 text-sm">
      <p>
        <span className="font-semibold text-ink">Active theme:</span>{" "}
        <span className="text-muted">{resolvedTheme}</span>
      </p>
      <div className="grid gap-2">
        {options.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-surfaceMuted px-3 py-2">
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={preference === option.value}
              onChange={() => setPreference(option.value)}
            />
            <span className="text-ink">{option.label}</span>
          </label>
        ))}
      </div>
      <p className="text-muted">Typography: Montserrat. Brand colors: #009933 / #FF9933.</p>
    </div>
  );
}
