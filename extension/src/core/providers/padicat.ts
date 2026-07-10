import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot } from "../tabState";
import { lookupLatestPywbCdxCapture } from "./pywbCdx";
import type { ArchivePriorityContext, ArchiveProviderLookupResult, AutomaticArchiveProvider } from "./types";

const PADICAT_BASE_URL = "https://wayback.padicat.cat";

function isPadicatRelevant(context: ArchivePriorityContext): boolean {
  return context.isCataloniaTld;
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
      providerId: "padicat",
      providerName: "PADICAT / Web Archive of Catalonia",
      cdxBaseUrl: PADICAT_BASE_URL,
      replayBaseUrl: PADICAT_BASE_URL
    },
    candidate,
    fetchImpl,
    onProgress,
    onSnapshot
  );
}

export const padicatProvider: AutomaticArchiveProvider = {
  id: "padicat",
  displayName: "PADICAT / Web Archive of Catalonia",
  shortDescription: "Catalan websites",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant: isPadicatRelevant,
  lookup,
  buildDirectLinkUrl(originalUrl: string): string {
    return `${PADICAT_BASE_URL}/wayback/*/${originalUrl}`;
  }
};
