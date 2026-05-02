import type { ManualArchiveProvider } from "./types";

export const webCiteProvider: ManualArchiveProvider = {
  id: "webcite",
  displayName: "WebCite",
  shortDescription: "Academic citation archive",
  kind: "manual",
  purpose: "manual-search",
  isRelevant: () => true,
  buildDirectLinkUrl(originalUrl: string): string {
    const params = new URLSearchParams({ url: originalUrl });
    return `https://www.webcitation.org/query?${params.toString()}`;
  }
};
