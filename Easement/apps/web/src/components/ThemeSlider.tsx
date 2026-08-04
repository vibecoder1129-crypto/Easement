"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeSlider() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="ease-theme-slider group"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Current mode: ${theme.toUpperCase()} (Click to switch)`}
    >
      <span className="text-[11px] pl-1 select-none">☀️</span>
      <span className="text-[11px] pr-1 select-none">🌙</span>
      <span className="ease-theme-thumb">
        {theme === "light" ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
