import type { ManualArchiveProvider } from "./types";

export const archiveItProvider: ManualArchiveProvider = {
  id: "archive-it",
  displayName: "Archive-It",
  shortDescription: "Institutional web collections",
  kind: "manual",
  purpose: "manual-search",
  isRelevant: () => true,
  buildDirectLinkUrl(originalUrl: string): string {
    return `https://wayback.archive-it.org/all/*/${originalUrl}`;
  }
};
