import { z } from "../lib/mini-zod";
import { ProviderIdSchema } from "./providers/types";

export const HistoryTriggerSchema = z.enum([
  "broken-page",
  "manual-page",
  "context-menu",
  "provider-direct",
  "all-archives"
]);
export type HistoryTrigger = z.infer<typeof HistoryTriggerSchema>;

export const HistoryOutcomeSchema = z.enum(["hit", "miss", "unknown"]);
export type HistoryOutcome = z.infer<typeof HistoryOutcomeSchema>;

export const HistoryAttemptSchema = z.object({
  providerId: ProviderIdSchema,
  strategy: z.enum(["exact", "cleaned"]),
  url: z.string(),
  outcome: z.enum(["hit", "miss", "error"])
});
export type HistoryAttempt = z.infer<typeof HistoryAttemptSchema>;

export const HistoryFailedProviderSchema = z.object({
  providerId: ProviderIdSchema,
  directLink: z.string().optional(),
  reason: z.enum(["challenge-required", "rate-limited", "server-error", "timeout"]).optional(),
  technicalDetail: z.string().optional()
});
export type HistoryFailedProvider = z.infer<typeof HistoryFailedProviderSchema>;

export const HistorySnapshotSchema = z.object({
  originalUrl: z.string(),
  matchedUrl: z.string(),
  archiveUrl: z.string(),
  openUrl: z.string().optional(),
  timestamp: z.string(),
  statusCode: z.string(),
  mimeType: z.string(),
  strategy: z.enum(["exact", "cleaned"]),
  providerId: ProviderIdSchema,
  verification: z.enum(["confirmed", "unverified"]).optional(),
  verificationNote: z.string().optional()
});
export type HistorySnapshot = z.infer<typeof HistorySnapshotSchema>;

export const HistoryEntrySchema = z.object({
  id: z.string(),
  startedAt: z.number(),
  resolvedAt: z.number().optional(),
  targetUrl: z.string(),
  trigger: HistoryTriggerSchema,
  requestTrigger: z.enum(["broken-page", "manual-page"]).optional(),
  scopedProviderId: ProviderIdSchema.optional(),
  outcome: HistoryOutcomeSchema,
  resultSnapshots: z.array(HistorySnapshotSchema),
  failedProviders: z.array(HistoryFailedProviderSchema).optional(),
  checkedAttempts: z.array(HistoryAttemptSchema).optional()
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const HistoryListSchema = z.array(HistoryEntrySchema);

export type CreateHistoryEntryInput = {
  targetUrl: string;
  trigger: HistoryTrigger;
  requestTrigger?: "broken-page" | "manual-page";
  scopedProviderId?: z.infer<typeof ProviderIdSchema>;
};

export type CompleteHistoryEntryInput = {
  outcome: HistoryOutcome;
  resolvedAt?: number;
  resultSnapshots?: HistorySnapshot[];
  failedProviders?: HistoryFailedProvider[];
  checkedAttempts?: HistoryAttempt[];
};

export function parseHistory(value: unknown): HistoryEntry[] {
  return HistoryListSchema.catch([]).parse(value);
}
