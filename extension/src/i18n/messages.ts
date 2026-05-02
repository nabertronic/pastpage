import { en } from "./locales/en";
import { de } from "./locales/de";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { it } from "./locales/it";
import { pl } from "./locales/pl";
import { pt } from "./locales/pt";
import { uk } from "./locales/uk";

export const SUPPORTED_LOCALES = ["en", "de", "es", "fr", "pt", "it", "pl", "uk"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type MessageCatalog = { [K in keyof typeof en]: string };

export const MESSAGES: Record<SupportedLocale, MessageCatalog> = { en, de, es, fr, pt, it, pl, uk };

export type Messages = MessageCatalog;
export type TranslationKey = keyof MessageCatalog;
