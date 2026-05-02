import { X } from "lucide-react";
import type { CSSProperties } from "react";
import { explainDetectedError } from "../core/errors";
import type { Settings } from "../core/settings";
import type { DetectedError } from "../core/tabState";
import { I18nProvider, resolveLocaleFromLanguageMode, useI18n } from "../i18n";
import { getRecoveryBarThemeVars } from "./recoveryBarTheme";
import { LogoMark } from "./LogoMark";

export function TopBar({
  error,
  settings,
  onFind,
  onDismiss
}: {
  error: DetectedError;
  settings: Settings;
  onFind: () => void;
  onDismiss: () => void;
}) {
  const themeVars = getRecoveryBarThemeVars(settings);

  return (
    <I18nProvider locale={resolveLocaleFromLanguageMode(settings.language)}>
      <TopBarContent error={error} onFind={onFind} onDismiss={onDismiss} themeVars={themeVars} />
    </I18nProvider>
  );
}

function TopBarContent({
  error,
  onFind,
  onDismiss,
  themeVars
}: {
  error: DetectedError;
  onFind: () => void;
  onDismiss: () => void;
  themeVars: Record<string, string>;
}) {
  const { t } = useI18n();
  const explanation = explainDetectedError(error, t);
  const label =
    error.statusCode === 451
      ? t("topbar.legalReason")
      : t("topbar.default", { title: explanation.title });

  return (
    <div
      role="region"
      aria-label="PastPage"
      style={{
        ...themeVars,
        position: "fixed",
        inset: "0 0 auto 0",
        zIndex: 2147483647,
        background: "var(--wf-banner-bg)",
        color: "var(--wf-banner-text)",
        borderBottom: "2px solid var(--wf-banner-border)",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.24)"
      } as CSSProperties}
    >
      <div
        style={{
          minHeight: 48,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 14px",
          fontSize: 15,
          lineHeight: 1.45,
          letterSpacing: 0
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "var(--wf-accent)",
            color: "var(--wf-accent-ink)",
            flex: "0 0 auto"
          }}
        >
          <LogoMark size={17} color="var(--wf-accent-ink)" />
        </span>
        <div style={{ minWidth: 0, flex: "1 1 auto", color: "var(--wf-banner-text)", fontWeight: 750 }}>
          {label}
        </div>
        <button
          type="button"
          onClick={onFind}
          onMouseEnter={(event) => {
            event.currentTarget.style.transform = "translateY(-1px)";
            event.currentTarget.style.boxShadow = "0 10px 24px var(--wf-accent-shadow)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform = "translateY(0)";
            event.currentTarget.style.boxShadow = "none";
          }}
          style={{
            flex: "0 0 auto",
            border: "1px solid rgba(23, 19, 10, 0.22)",
            borderRadius: 6,
            background: "var(--wf-accent)",
            color: "var(--wf-accent-ink)",
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: 800,
            transition: "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease"
          }}
        >
          {t("topbar.cta")}
        </button>
        <button
          type="button"
          aria-label={t("topbar.dismiss")}
          onClick={onDismiss}
          style={{
            flex: "0 0 auto",
            width: 30,
            height: 30,
            border: "1px solid transparent",
            borderRadius: 6,
            background: "transparent",
            color: "var(--wf-banner-muted)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            transition: "background 160ms ease, color 160ms ease"
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = "var(--wf-accent-soft)";
            event.currentTarget.style.color = "var(--wf-banner-text)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "transparent";
            event.currentTarget.style.color = "var(--wf-banner-muted)";
          }}
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  );
}
