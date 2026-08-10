import { describe, expect, it } from "vitest";
import { explainHttpStatus, explainNavigationError } from "@/core/errors";
import { createTranslator, resolveLocale } from "@/i18n";
import { MESSAGES, type SupportedLocale, type TranslationKey } from "@/i18n/messages";

const HISTORY_KEYS_REQUIRING_TRANSLATION = [
  "historyPage.selection.selectVisible",
  "historyPage.selection.selectedCount",
  "historyPage.selection.none",
  "historyPage.selection.selectEntry",
  "historyPage.delete.singleAction",
  "historyPage.delete.bulkAction",
  "historyPage.delete.singleConfirm",
  "historyPage.delete.bulkConfirm",
  "historyPage.exportCurrentViewCsv",
  "historyPage.sort.label",
  "historyPage.sort.startedAtDesc",
  "historyPage.sort.startedAtAsc",
  "historyPage.sort.outcome",
  "historyPage.sort.provider",
  "historyPage.sort.snapshotCount",
  "historyPage.view.label",
  "historyPage.view.compact",
  "historyPage.view.detailed",
  "historyPage.presets.label",
  "historyPage.presets.save",
  "historyPage.presets.savePrompt",
  "historyPage.presets.empty",
  "historyPage.presets.delete",
  "historyPage.selection.exportSelected",
  "historyPage.selection.rerunSelected",
  "historyPage.selection.rerunConfirm",
  "historyPage.card.checkedAttempts",
  "historyPage.card.failedProviders"
] as const satisfies readonly TranslationKey[];

const HISTORY_TRANSLATION_LOCALES = [
  "es",
  "fr",
  "it",
  "pl",
  "pt",
  "uk"
] as const satisfies readonly SupportedLocale[];

describe("i18n", () => {
  it("maps browser locales to supported locales with an English fallback", () => {
    expect(resolveLocale("browser", "de-DE")).toBe("de");
    expect(resolveLocale("browser", "fr-CA")).toBe("fr");
    expect(resolveLocale("browser", "pt-BR")).toBe("pt");
    expect(resolveLocale("browser", "it-IT")).toBe("it");
    expect(resolveLocale("browser", "pl-PL")).toBe("pl");
    expect(resolveLocale("browser", "uk-UA")).toBe("uk");
    expect(resolveLocale("de", "en-US")).toBe("de");
    expect(resolveLocale("browser", "sv-SE")).toBe("en");
  });

  it("localizes HTTP explanations", () => {
    const t = createTranslator("de");
    expect(explainHttpStatus(404, t).title).toBe("404: Seite nicht gefunden");
    expect(explainHttpStatus(500, t).short).toContain("Serverfehler");
  });

  it("localizes navigation explanations", () => {
    const t = createTranslator("de");
    expect(explainNavigationError("net::ERR_NAME_NOT_RESOLVED", t).title).toBe("DNS-Fehler");
    expect(explainNavigationError("net::ERR_CERT_AUTHORITY_INVALID", t).short).toContain(
      "sichere Verbindung"
    );
  });

  it("does not leave known History controls as English placeholders", () => {
    for (const locale of HISTORY_TRANSLATION_LOCALES) {
      for (const key of HISTORY_KEYS_REQUIRING_TRANSLATION) {
        expect(MESSAGES[locale][key], `${locale}.${key}`).not.toBe(MESSAGES.en[key]);
      }
    }
  });
});
