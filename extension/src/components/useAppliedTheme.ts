import { useEffect } from "react";
import { parseSettings, type ThemeMode } from "../core/settings";

function resolveIsDark(themeMode: ThemeMode, mediaQueryList: MediaQueryList | null) {
  if (themeMode === "dark") return true;
  if (themeMode === "light") return false;
  return mediaQueryList?.matches ?? false;
}

function setDocumentTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
}

export function applyThemeModeToDocument(themeMode: ThemeMode) {
  const mediaQueryList =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  setDocumentTheme(resolveIsDark(themeMode, mediaQueryList));
}

export async function loadAndApplyStoredTheme() {
  if (typeof document === "undefined" || typeof browser === "undefined") return;

  const stored = await browser.storage.local.get("pastPage.settings");
  const settings = parseSettings(stored["pastPage.settings"]);
  applyThemeModeToDocument(settings.themeMode);
  return settings;
}

export function useAppliedTheme(themeMode: ThemeMode) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const mediaQueryList =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const syncTheme = () => {
      setDocumentTheme(resolveIsDark(themeMode, mediaQueryList));
    };

    syncTheme();

    if (themeMode !== "browser" || !mediaQueryList) {
      return;
    }

    const handleChange = () => {
      syncTheme();
    };

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleChange);
      return () => {
        mediaQueryList.removeEventListener("change", handleChange);
      };
    }

    mediaQueryList.addListener(handleChange);
    return () => {
      mediaQueryList.removeListener(handleChange);
    };
  }, [themeMode]);
}
