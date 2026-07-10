import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot } from "../tabState";
import { lookupLatestPywbCdxCapture } from "./pywbCdx";
import type { ArchivePriorityContext, ArchiveProviderLookupResult, AutomaticArchiveProvider } from "./types";

const VEFSAFN_BASE_URL = "https://vefsafn.is";

function isIcelandRelevant(context: ArchivePriorityContext): boolean {
  return context.isIcelandTld;
}

function lookup(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch,
  _hostSettings?: never,
  onProgress?: (phase: "querying" | "verifying") => void,
  onSnapshot?: (snapshot: ArchiveSnapshot) => void
): Promise<ArchiveProviderLookupResult> {
  return lookupLatestPywbCdxCapture(
    {
      providerId: "vefsafn",
      providerName: "Icelandic Web Archive / Vefsafn",
      cdxBaseUrl: VEFSAFN_BASE_URL,
      replayBaseUrl: VEFSAFN_BASE_URL
    },
    candidate,
    fetchImpl,
    onProgress,
    onSnapshot
  );
}

export const vefsafnProvider: AutomaticArchiveProvider = {
  id: "vefsafn",
  displayName: "Icelandic Web Archive / Vefsafn",
  shortDescription: "Icelandic websites",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant: isIcelandRelevant,
  lookup,
  buildDirectLinkUrl(originalUrl: string): string {
    return `${VEFSAFN_BASE_URL}/wayback/*/${originalUrl}`;
  }
};
