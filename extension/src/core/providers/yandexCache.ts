import type { ManualArchiveProvider } from "./types";

export const yandexCacheProvider: ManualArchiveProvider = {
  id: "yandex-cache",
  displayName: "Yandex Cache",
  shortDescription: "Yandex search engine cache",
  kind: "manual",
  purpose: "manual-search",
  isRelevant: () => true,
  buildDirectLinkUrl(originalUrl: string): string {
    const params = new URLSearchParams({
      text: `url:${originalUrl}`
    });
    return `https://yandex.com/search/?${params.toString()}`;
  }
};
