import { DEFAULT_ACCENT_COLOR } from "../core/constants";
import type { Settings } from "../core/settings";

export function getRecoveryBarThemeVars(settings: Settings): Record<string, string> {
  const customBannerText = isDarkColor(settings.bannerColor) ? "#fff9df" : "#17130a";
  const customBannerMuted = isDarkColor(settings.bannerColor) ? "#d7cfaa" : "#53491e";
  const accent = settings.bannerTheme === "custom" ? settings.actionColor : DEFAULT_ACCENT_COLOR;

  return settings.bannerTheme === "light"
    ? buildThemeVars("#f5f5f5", "#111111", "#525252", accent)
    : settings.bannerTheme === "dark"
      ? buildThemeVars("#11100c", "#fff9df", "#d7cfaa", accent)
      : settings.bannerTheme === "custom"
        ? buildThemeVars(settings.bannerColor, customBannerText, customBannerMuted, accent)
        : buildThemeVars("#f5f5f5", "#111111", "#525252", accent);
}

export function isDarkColor(hex: string) {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

function buildThemeVars(background: string, text: string, muted: string, accent: string) {
  return {
    "--wf-banner-bg": background,
    "--wf-banner-text": text,
    "--wf-banner-muted": muted,
    "--wf-banner-border": accent,
    "--wf-accent": accent,
    "--wf-accent-ink": isDarkColor(accent) ? "#fff9df" : "#17130a",
    "--wf-accent-soft": withAlpha(accent, 0.16),
    "--wf-accent-shadow": withAlpha(accent, 0.34)
  };
}

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
