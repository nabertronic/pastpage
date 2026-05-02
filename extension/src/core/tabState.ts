import type { DetectedErrorKind, ErrorExplanation } from "./errors";
import type { ProviderId } from "./providers/types";

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
};

export type ManualArchiveSource = {
  providerId: ProviderId;
  label: string;
  url: string;
};

export type FailedProvider = {
  providerId: ProviderId;
  directLink?: string;
};

export type ArchiveCheckStrategy = "exact" | "cleaned";

export type LookupStatus =
  | { status: "idle" }
  | { status: "running"; startedAt: number; currentProviderId?: ProviderId }
  | { status: "found"; snapshot: ArchiveSnapshot }
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
