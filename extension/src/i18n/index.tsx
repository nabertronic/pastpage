import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { LanguageMode } from "../core/settings";
import { MESSAGES, SUPPORTED_LOCALES, type Messages, type SupportedLocale, type TranslationKey } from "./messages";

export type { TranslationKey } from "./messages";

export type TranslationValues = Record<string, string | number | undefined>;
export type Translator = (key: TranslationKey, values?: TranslationValues) => string;

const I18nContext = createContext<{ locale: SupportedLocale; t: Translator } | null>(null);

function formatMessage(template: string, values?: TranslationValues) {
  if (!values) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ""));
}

export function getMessages(locale: SupportedLocale): Messages {
  return MESSAGES[locale];
}

export function createTranslator(locale: SupportedLocale): Translator {
  const messages = getMessages(locale);
  return (key, values) => formatMessage(messages[key], values);
}

export function resolveLocale(mode: LanguageMode, browserUiLanguage: string): SupportedLocale {
  if (mode !== "browser") {
    return SUPPORTED_LOCALES.includes(mode as SupportedLocale) ? (mode as SupportedLocale) : "en";
  }

  const normalized = browserUiLanguage.toLowerCase();
  const matched = SUPPORTED_LOCALES.find((locale) => normalized === locale || normalized.startsWith(`${locale}-`));
  return (matched as SupportedLocale | undefined) ?? "en";
}

export function getBrowserUiLanguage() {
  if (typeof browser !== "undefined" && browser.i18n?.getUILanguage) {
    return browser.i18n.getUILanguage();
  }

  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }

  return "en";
}

export function resolveLocaleFromLanguageMode(mode: LanguageMode): SupportedLocale {
  return resolveLocale(mode, getBrowserUiLanguage());
}

export function I18nProvider({
  locale,
  children
}: {
  locale: SupportedLocale;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
