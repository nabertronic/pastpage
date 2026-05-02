import type { ManualArchiveProvider } from "./types";

export const softwareHeritageProvider: ManualArchiveProvider = {
  id: "software-heritage",
  displayName: "Software Heritage",
  shortDescription: "Source code repository archive",
  kind: "manual",
  purpose: "manual-search",
  isRelevant: (context) => context.isRepositoryUrl,
  buildDirectLinkUrl(originalUrl: string): string {
    const params = new URLSearchParams({ origin_url: originalUrl });
    return `https://archive.softwareheritage.org/browse/origin/visits/?${params.toString()}`;
  }
};
