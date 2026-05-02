import { z } from "../../lib/mini-zod";
import type { ProviderHostSettings } from "../providerHosts";
import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot } from "../tabState";

export const ProviderIdSchema = z.enum([
  "wayback",
  "archive-today",
  "ghostarchive",
  "yandex-cache",
  "uk-gov-web-archive",
  "loc-web-archives",
  "perma-cc",
  "arquivo-pt",
  "web-gyotaku",
  "archive-it",
  "webcite",
  "software-heritage"
]);

export type ProviderId = z.infer<typeof ProviderIdSchema>;
export const ALL_PROVIDER_IDS = ProviderIdSchema.options;

export type ArchivePriorityContext = {
  rawUrl: string;
  hostname: string;
  isUkGov: boolean;
  isUsGov: boolean;
  isPortugalTld: boolean;
  isJapanTld: boolean;
  isRepositoryUrl: boolean;
};

type BaseArchiveProvider = {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly shortDescription: string;
  readonly kind: "automatic" | "manual";
  readonly purpose: "automatic-snapshot" | "manual-search";
  isRelevant(context: ArchivePriorityContext): boolean;
  buildDirectLinkUrl(originalUrl: string, hostSettings?: ProviderHostSettings): string | null;
};

export type AutomaticArchiveProvider = BaseArchiveProvider & {
  readonly kind: "automatic";
  lookup(
    candidate: SearchCandidate,
    fetchImpl: typeof fetch,
    hostSettings?: ProviderHostSettings
  ): Promise<ArchiveSnapshot | null>;
};

export type ManualArchiveProvider = BaseArchiveProvider & {
  readonly kind: "manual";
};

export type ArchiveProvider = AutomaticArchiveProvider | ManualArchiveProvider;
