import { z } from "../lib/mini-zod";
import { HistoryTriggerSchema } from "./history";
import { LookupRequestSchema } from "./lookupRequest";
import { SettingsSchema } from "./settings";
import { ProviderIdSchema } from "./providers/types";

const ArchiveSnapshotSchema = z.object({
  originalUrl: z.string(),
  matchedUrl: z.string(),
  archiveUrl: z.string(),
  openUrl: z.string().optional(),
  timestamp: z.string(),
  statusCode: z.string(),
  mimeType: z.string(),
  strategy: z.enum(["exact", "cleaned", "variant"]),
  providerId: ProviderIdSchema,
  verification: z.enum(["confirmed", "unverified"]).optional(),
  verificationNote: z.string().optional()
});

const FailedProviderSchema = z.object({
  providerId: ProviderIdSchema,
  directLink: z.string(),
  reason: z.enum(["challenge-required", "rate-limited", "server-error", "timeout"]).optional(),
  technicalDetail: z.string().optional()
});

const LookupStatusSchema = z.union([
  z.object({ status: z.literal("idle") }),
  z.object({
    status: z.literal("running"),
    startedAt: z.number(),
    currentProviderId: ProviderIdSchema.optional()
  }),
  z.object({
    status: z.literal("found"),
    snapshot: ArchiveSnapshotSchema
  }),
  z.object({
    status: z.literal("unverified"),
    snapshot: ArchiveSnapshotSchema
  }),
  z.object({
    status: z.literal("not-found"),
    checked: z.array(z.enum(["exact", "cleaned", "variant"])),
    failedProviders: z.array(FailedProviderSchema)
  }),
  z.object({ status: z.literal("provider-error"), message: z.string() })
]);

const TabStateSchema = z.union([
  z.object({ status: z.literal("idle") }),
  z.object({
    status: z.literal("broken"),
    dismissedForUrl: z.string().optional(),
    error: z.object({
      kind: z.enum(["http", "navigation"]),
      originalUrl: z.string(),
      statusCode: z.number().optional(),
      browserError: z.string().optional(),
      detectedAt: z.number(),
      explanation: z.object({
        title: z.string(),
        short: z.string(),
        detail: z.string()
      })
    }),
    lookup: LookupStatusSchema
  })
]);

export const RuntimeMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("GET_TAB_STATE"), tabId: z.number().optional() }),
  z.object({ type: z.literal("STATE_UPDATED"), tabId: z.number(), state: TabStateSchema }),
  z.object({ type: z.literal("DISMISS_TOPBAR"), tabId: z.number().optional(), url: z.string() }),
  z.object({
    type: z.literal("START_RESOLVER"),
    tabId: z.number().optional(),
    request: LookupRequestSchema,
    historyTrigger: HistoryTriggerSchema.optional()
  }),
  z.object({ type: z.literal("LOOKUP_ARCHIVES"), originalUrl: z.string() }),
  z.object({ type: z.literal("GET_SETTINGS") }),
  z.object({ type: z.literal("UPDATE_SETTINGS"), settings: SettingsSchema }),
  z.object({ type: z.literal("COPY_ARCHIVE_LINK"), archiveUrl: z.string() })
]);

export type RuntimeMessage = z.infer<typeof RuntimeMessageSchema>;

export function parseRuntimeMessage(input: unknown): RuntimeMessage {
  return RuntimeMessageSchema.parse(input);
}
