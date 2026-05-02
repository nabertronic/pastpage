import { describe, expect, it } from "vitest";
import { explainHttpStatus, explainNavigationError } from "@/core/errors";
import { createTranslator, resolveLocale } from "@/i18n";

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
});
