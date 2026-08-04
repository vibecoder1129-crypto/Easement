"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("easement-theme") as Theme | null;
    if (saved === "dark" || saved === "light") {
      setThemeState(saved);
      applyTheme(saved);
    } else {
      // Default to light or check system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "light";
      setThemeState(initial);
      applyTheme(initial);
    }
    setMounted(true);
  }, []);

  function applyTheme(t: Theme) {
    const root = document.documentElement;
    root.setAttribute("data-theme", t);
    if (t === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme);
    localStorage.setItem("easement-theme", newTheme);
    applyTheme(newTheme);
  }

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <div className={mounted ? "" : "opacity-0 transition-opacity duration-150"}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
