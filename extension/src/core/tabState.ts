import type { DetectedErrorKind, ErrorExplanation } from "./errors";
import type { ProviderFailureReason, ProviderId } from "./providers/types";

export type DetectedError = {
  kind: DetectedErrorKind;
  originalUrl: string;
  statusCode?: number;
  browserError?: string;
  explanation: ErrorExplanation;
  detectedAt: number;
};

export type ArchiveSnapshot = {
  originalUrl: string;
  matchedUrl: string;
  archiveUrl: string;
  openUrl?: string;
  timestamp: string;
  statusCode: string;
  mimeType: string;
  strategy: "exact" | "cleaned";
  providerId: ProviderId;
  verification: "confirmed" | "unverified";
  verificationNote?: string;
};

export type ArchiveSnapshotCandidate = Omit<ArchiveSnapshot, "verification">;

export type ManualArchiveSource = {
  providerId: ProviderId;
  label: string;
  url: string;
  cleanedUrl?: string;
};

export type FailedProvider = {
  providerId: ProviderId;
  directLink?: string;
  reason?: ProviderFailureReason;
  technicalDetail?: string;
};

export type ArchiveCheckStrategy = "exact" | "cleaned";

export type LookupStatus =
  | { status: "idle" }
  | { status: "running"; startedAt: number; currentProviderId?: ProviderId }
  | { status: "found"; snapshot: ArchiveSnapshot }
  | { status: "unverified"; snapshot: ArchiveSnapshot }
  | {
      status: "not-found";
      checked: Array<"exact" | "cleaned">;
      failedProviders: FailedProvider[];
    }
  | { status: "provider-error"; message: string };

export type TabState =
  | { status: "idle" }
  | {
      status: "broken";
      error: DetectedError;
      dismissedForUrl?: string;
      lookup: LookupStatus;
    };

export const idleTabState: TabState = { status: "idle" };
