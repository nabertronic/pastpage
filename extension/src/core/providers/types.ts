import { z } from "../../lib/mini-zod";
import type { ProviderHostSettings } from "../providerHosts";
import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot } from "../tabState";

export type ProviderFailureReason = "challenge-required" | "rate-limited" | "server-error" | "timeout";

export class ProviderLookupError extends Error {
  readonly reason?: ProviderFailureReason;
  readonly retryAfterMs?: number;
  readonly technicalDetail?: string;

  constructor(
    message: string,
    reason?: ProviderFailureReason,
    retryAfterMs?: number,
    technicalDetail?: string
  ) {
    super(message);
    this.name = "ProviderLookupError";
    this.reason = reason;
    this.retryAfterMs = retryAfterMs;
    this.technicalDetail = technicalDetail;
  }
}

export const ProviderIdSchema = z.enum([
  "wayback",
  "archive-today",
  "ghostarchive",
  "yandex-cache",
  "uk-gov-web-archive",
  "loc-web-archives",
  "canada-gov-web-archive",
  "vefsafn",
  "ntuwas",
  "padicat",
  "perma-cc",
  "arquivo-pt",
  "web-gyotaku",
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
  isCanadaGov: boolean;
  isIcelandTld: boolean;
  isTaiwanTld: boolean;
  isCataloniaTld: boolean;
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
    hostSettings?: ProviderHostSettings,
    onProgress?: (phase: "querying" | "verifying") => void,
    onSnapshot?: (snapshot: ArchiveSnapshot) => void
  ): Promise<ArchiveProviderLookupResult>;
};

export type ManualArchiveProvider = BaseArchiveProvider & {
  readonly kind: "manual";
};

export type ArchiveProvider = AutomaticArchiveProvider | ManualArchiveProvider;

export type ArchiveProviderLookupResult =
  | { status: "confirmed"; snapshot: ArchiveSnapshot }
  | { status: "unverified"; snapshot: ArchiveSnapshot }
  | { status: "miss" };
