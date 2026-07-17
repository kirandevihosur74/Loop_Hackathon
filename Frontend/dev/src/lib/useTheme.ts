"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "day" | "night";

/**
 * Day/night theme state, backed by the `night` class on <html>.
 *
 * The initial class is set by an inline no-flash script (see layout.tsx) BEFORE
 * React hydrates, reading localStorage("theme") or the system preference. This
 * hook reads that class via useSyncExternalStore (the correct tool for external
 * DOM state — no setState-in-effect) and exposes a toggle that flips the class,
 * persists the choice, and notifies all consumers.
 */

function subscribe(callback: () => void): () => void {
  window.addEventListener("themechange", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("themechange", callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("night") ? "night" : "day";
}

function getServerSnapshot(): Theme {
  return "day";
}

export function useTheme(): { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.classList.toggle("night", next === "night");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    window.dispatchEvent(new Event("themechange"));
  }, []);

  const toggle = useCallback(() => {
    setTheme(document.documentElement.classList.contains("night") ? "day" : "night");
  }, [setTheme]);

  return { theme, toggle, setTheme };
}

/** The inline script string that sets the initial theme before paint (no FOUC). */
export const NO_FLASH_THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var night=t?t==='night':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('night',night);}catch(e){}})();`;
