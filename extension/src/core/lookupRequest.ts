import { z } from "../lib/mini-zod";
import type { DetectedError } from "./tabState";

export const BrokenPageLookupRequestSchema = z.object({
  trigger: z.literal("broken-page"),
  originalUrl: z.string(),
  kind: z.enum(["http", "navigation"]),
  statusCode: z.number().optional(),
  browserError: z.string().optional()
});

export const ManualPageLookupRequestSchema = z.object({
  trigger: z.literal("manual-page"),
  originalUrl: z.string()
});

export const LookupRequestSchema = z.discriminatedUnion("trigger", [
  BrokenPageLookupRequestSchema,
  ManualPageLookupRequestSchema
]);

export type LookupRequest = z.infer<typeof LookupRequestSchema>;

export function createBrokenPageLookupRequest(error: DetectedError): LookupRequest {
  return {
    trigger: "broken-page",
    originalUrl: error.originalUrl,
    kind: error.kind,
    statusCode: error.statusCode,
    browserError: error.browserError
  };
}

export function createManualPageLookupRequest(originalUrl: string): LookupRequest {
  return {
    trigger: "manual-page",
    originalUrl
  };
}
