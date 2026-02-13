"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAppStore } from "@/lib/store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThemePreference = "light" | "dark" | "system";
export type SidebarTab = "risks" | "related" | "definitions" | "flags";

export interface Preferences {
  theme: ThemePreference;
  compactMode: boolean;
  defaultSidebarTab: SidebarTab;
  navPanelVisibleDefault: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREFS_KEY = "ambrose-preferences";

const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  compactMode: false,
  defaultSidebarTab: "risks",
  navPanelVisibleDefault: true,
};

// ---------------------------------------------------------------------------
// localStorage helpers (SSR-safe)
// ---------------------------------------------------------------------------

export function loadPreferences(): Partial<Preferences> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Preferences>;
  } catch {
    return {};
  }
}

export function savePreferences(prefs: Preferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage full or unavailable -- silently ignore
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePreferences() {
  const { setTheme } = useTheme();
  const storeCompactMode = useAppStore((s) => s.compactMode);
  const toggleCompactMode = useAppStore((s) => s.toggleCompactMode);

  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    const saved = loadPreferences();
    const merged: Preferences = { ...DEFAULT_PREFERENCES, ...saved };
    setPrefs(merged);

    // Sync theme with next-themes
    setTheme(merged.theme);

    // Sync compact mode with store if they differ
    if (merged.compactMode !== storeCompactMode) {
      toggleCompactMode();
    }

    setLoaded(true);
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist whenever prefs change (after initial load)
  useEffect(() => {
    if (loaded) {
      savePreferences(prefs);
    }
  }, [prefs, loaded]);

  // ------ Setters ------

  const setThemePreference = useCallback(
    (theme: ThemePreference) => {
      setPrefs((prev) => ({ ...prev, theme }));
      setTheme(theme);
    },
    [setTheme]
  );

  const setCompactMode = useCallback(
    (compactMode: boolean) => {
      setPrefs((prev) => ({ ...prev, compactMode }));
      // Keep store in sync
      if (compactMode !== storeCompactMode) {
        toggleCompactMode();
      }
    },
    [storeCompactMode, toggleCompactMode]
  );

  const setDefaultSidebarTab = useCallback((tab: SidebarTab) => {
    setPrefs((prev) => ({ ...prev, defaultSidebarTab: tab }));
  }, []);

  const setNavPanelVisibleDefault = useCallback((visible: boolean) => {
    setPrefs((prev) => ({ ...prev, navPanelVisibleDefault: visible }));
  }, []);

  return {
    preferences: prefs,
    loaded,
    setThemePreference,
    setCompactMode,
    setDefaultSidebarTab,
    setNavPanelVisibleDefault,
  };
}
