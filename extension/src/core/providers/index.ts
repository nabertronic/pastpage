import { arquivoPtProvider } from "./arquivoPt";
import { archiveTodayProvider } from "./archiveToday";
import { ghostarchiveProvider } from "./ghostarchive";
import { locWebArchivesProvider } from "./locWebArchives";
import { permaCcProvider } from "./permaCc";
import {
  buildAutomaticProviderOrder as buildAutomaticProviderOrderFromContext,
  buildManualDirectLinkProviders as buildManualDirectLinkProvidersFromContext,
  classifyArchivePriority
} from "./priority";
import { softwareHeritageProvider } from "./softwareHeritage";
import { ukGovWebArchiveProvider } from "./ukGovWebArchive";
import { waybackProvider } from "./wayback";
import { webCiteProvider } from "./webCite";
import { webGyotakuProvider } from "./webGyotaku";
import { yandexCacheProvider } from "./yandexCache";
import type { ProviderHostSettings } from "../providerHosts";
import type { ArchiveProvider, AutomaticArchiveProvider, ProviderId } from "./types";

export const PROVIDERS: Record<ProviderId, ArchiveProvider> = {
  "arquivo-pt": arquivoPtProvider,
  "archive-today": archiveTodayProvider,
  ghostarchive: ghostarchiveProvider,
  "loc-web-archives": locWebArchivesProvider,
  "perma-cc": permaCcProvider,
  "software-heritage": softwareHeritageProvider,
  "uk-gov-web-archive": ukGovWebArchiveProvider,
  wayback: waybackProvider,
  webcite: webCiteProvider,
  "web-gyotaku": webGyotakuProvider,
  "yandex-cache": yandexCacheProvider
};

export function getProvider(id: ProviderId): ArchiveProvider {
  return PROVIDERS[id];
}

export function getAutomaticProvider(id: ProviderId): AutomaticArchiveProvider {
  const provider = getProvider(id);
  if (provider.kind !== "automatic") {
    throw new Error(`Provider ${id} is not automatic`);
  }
  return provider;
}

export function buildAutomaticProviderOrder(rawUrl: string): ProviderId[] {
  return buildAutomaticProviderOrderFromContext(classifyArchivePriority(rawUrl));
}

export function buildManualSourceProviderOrder(rawUrl: string): ProviderId[] {
  const context = classifyArchivePriority(rawUrl);
  const automatic = buildAutomaticProviderOrderFromContext(context).filter((id) =>
    PROVIDERS[id].isRelevant(context)
  );
  const manual = buildManualDirectLinkProvidersFromContext(context).filter((id) =>
    PROVIDERS[id].isRelevant(context)
  );

  return [...automatic, ...manual];
}

export type ProviderAction = {
  providerId: ProviderId;
  label: string;
  action: {
    kind: "direct" | "resolver";
    url: string;
  };
};

export function buildProviderActions(
  rawUrl: string,
  enabledProviders?: Iterable<ProviderId>,
  providerOrder?: Iterable<ProviderId>,
  hostSettings?: ProviderHostSettings
): ProviderAction[] {
  const enabled = enabledProviders ? new Set(enabledProviders) : null;
  const context = classifyArchivePriority(rawUrl);
  const orderedProviders = providerOrder ? Array.from(providerOrder) : buildManualSourceProviderOrder(rawUrl);

  return orderedProviders.flatMap((providerId) => {
    if (enabled && !enabled.has(providerId)) return [];

    const provider = getProvider(providerId);
    if (!provider.isRelevant(context)) return [];
    const directLinkUrl = provider.buildDirectLinkUrl(rawUrl, hostSettings);
    const action = directLinkUrl
      ? { kind: "direct" as const, url: directLinkUrl }
      : provider.kind === "automatic"
        ? { kind: "resolver" as const, url: rawUrl }
        : null;

    if (!action) return [];

    return [{ providerId, label: provider.displayName, action }];
  });
}

export { classifyArchivePriority } from "./priority";
export type {
  ArchivePriorityContext,
  ArchiveProvider,
  AutomaticArchiveProvider,
  ProviderId
} from "./types";
