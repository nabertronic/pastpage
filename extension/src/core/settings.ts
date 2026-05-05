import { z } from "../lib/mini-zod";
import {
  ArchiveTodayHostSchema,
  DEFAULT_PROVIDER_HOST_SETTINGS,
  WaybackHostSchema
} from "./providerHosts";
import { ALL_PROVIDER_IDS, ProviderIdSchema } from "./providers/types";

export const ArchiveOpenBehaviorSchema = z.enum([
  "current-tab",
  "new-tab-foreground",
  "new-tab-background",
  "new-window"
]);
export type ArchiveOpenBehavior = z.infer<typeof ArchiveOpenBehaviorSchema>;

export const OpenBehaviorSchema = ArchiveOpenBehaviorSchema;
export type OpenBehavior = ArchiveOpenBehavior;

export const ProviderMenuOpenBehaviorSchema = ArchiveOpenBehaviorSchema;
export type ProviderMenuOpenBehavior = ArchiveOpenBehavior;

export const UrlMatchingModeSchema = z.enum([
  "exact-then-cleaned",
  "exact-only",
  "cleaned-first"
]);
export type UrlMatchingMode = z.infer<typeof UrlMatchingModeSchema>;

export const LanguageModeSchema = z.enum(["browser", "en", "de", "es", "fr", "pt", "it", "pl", "uk"]);
export type LanguageMode = z.infer<typeof LanguageModeSchema>;

export const ThemeModeSchema = z.enum(["browser", "light", "dark"]);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

export const BannerThemeSchema = z.enum(["auto-contrast", "dark", "light", "custom"]);
export type BannerTheme = z.infer<typeof BannerThemeSchema>;

export const ResolverSuccessBehaviorSchema = z.enum(["keep-resolver", "replace-resolver"]);
export type ResolverSuccessBehavior = z.infer<typeof ResolverSuccessBehaviorSchema>;

export const DEFAULT_PROVIDER_TIMEOUT_SECONDS = 60;

export const SettingsSchema = z.object({
  openBehavior: OpenBehaviorSchema,
  providerMenuOpenBehavior: ProviderMenuOpenBehaviorSchema,
  enabledProviders: z.array(ProviderIdSchema),
  archiveDisplayOrder: z.array(ProviderIdSchema),
  historyEnabled: z.boolean(),
  popupArchiveListEnabled: z.boolean(),
  showSearchEngineIcons: z.boolean(),
  showContextMenuIcons: z.boolean(),
  waybackHost: WaybackHostSchema,
  archiveTodayHost: ArchiveTodayHostSchema,
  urlMatchingMode: UrlMatchingModeSchema,
  providerTimeoutSeconds: z.number(),
  language: LanguageModeSchema,
  themeMode: ThemeModeSchema,
  badgeEnabled: z.boolean(),
  bannerTheme: BannerThemeSchema,
  bannerColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  actionColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  resolverSuccessBehavior: ResolverSuccessBehaviorSchema,
  domainExceptions: z.array(z.string())
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  openBehavior: "new-tab-background",
  providerMenuOpenBehavior: "new-tab-foreground",
  enabledProviders: ALL_PROVIDER_IDS.filter(
    (providerId) => providerId !== "arquivo-pt" && providerId !== "perma-cc"
  ),
  archiveDisplayOrder: [
    "wayback",
    "archive-today",
    "ghostarchive",
    "yandex-cache",
    "uk-gov-web-archive",
    "loc-web-archives",
    "arquivo-pt",
    "web-gyotaku",
    "webcite",
    "perma-cc",
    "software-heritage"
  ],
  historyEnabled: true,
  popupArchiveListEnabled: true,
  showSearchEngineIcons: true,
  showContextMenuIcons: true,
  waybackHost: DEFAULT_PROVIDER_HOST_SETTINGS.waybackHost,
  archiveTodayHost: DEFAULT_PROVIDER_HOST_SETTINGS.archiveTodayHost,
  urlMatchingMode: "exact-then-cleaned",
  providerTimeoutSeconds: DEFAULT_PROVIDER_TIMEOUT_SECONDS,
  language: "browser",
  themeMode: "dark",
  badgeEnabled: true,
  bannerTheme: "auto-contrast",
  bannerColor: "#11100c",
  actionColor: "#ffd400",
  resolverSuccessBehavior: "keep-resolver",
  domainExceptions: []
};

export function parseSettings(value: unknown): Settings {
  const partial = SettingsSchema.partial()
    .catch({})
    .parse(value);

  const providerTimeoutSeconds =
    typeof partial.providerTimeoutSeconds === "number" &&
    Number.isInteger(partial.providerTimeoutSeconds) &&
    partial.providerTimeoutSeconds >= 1
      ? partial.providerTimeoutSeconds
      : DEFAULT_PROVIDER_TIMEOUT_SECONDS;

  return SettingsSchema.parse({
    ...DEFAULT_SETTINGS,
    ...partial,
    providerTimeoutSeconds
  });
}
