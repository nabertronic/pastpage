import {
  explainHttpStatus,
  explainNavigationError,
  isRelevantHttpStatus
} from "../src/core/errors";
import { lookupArchives } from "../src/core/lookup";
import { createManualPageLookupRequest, type LookupRequest } from "../src/core/lookupRequest";
import type { HistoryTrigger } from "../src/core/history";
import { buildProviderActions, getProvider, type ProviderId } from "../src/core/providers";
import { parseRuntimeMessage, type RuntimeMessage } from "../src/core/messages";
import { getLookupTargetState } from "../src/core/lookupTarget";
import { isBrokenPageAssistActive, type Settings } from "../src/core/settings";
import type { DetectedError, TabState } from "../src/core/tabState";
import { idleTabState } from "../src/core/tabState";
import { createTranslator, resolveLocaleFromLanguageMode, type TranslationKey } from "../src/i18n";
import { openArchiveUrl } from "../src/platform/archiveNavigation";
import { updateBadge } from "../src/platform/badge";
import {
  createHistoryEntry,
  ensureSettings,
  getLocalMeta,
  getSettings,
  markWhatsNewVersionSeen,
  saveSettings
} from "../src/platform/storage";
import { onboardingPageUrl, resolverUrl, whatsNewPageUrl } from "../src/platform/urls";

const tabStates = new Map<number, TabState>();
const ROOT_CONTEXT_MENU_ID = "pastpage-root";
const RESOLVER_CONTEXT_MENU_ID = "check-archived-versions";
const RESOLVER_CONTEXT_MENU_LINK_ID = "check-archived-versions-link";
const RESOLVER_CONTEXT_MENU_SELECTION_ID = "check-archived-versions-selection";
const ALL_ARCHIVES_TABS_CONTEXT_MENU_ID = "open-all-archives-tabs";
const ALL_ARCHIVES_TABS_CONTEXT_MENU_LINK_ID = "open-all-archives-tabs-link";
const ALL_ARCHIVES_TABS_CONTEXT_MENU_SELECTION_ID = "open-all-archives-tabs-selection";
const PROVIDER_CONTEXT_MENU_PREFIX = "provider:";
const PROVIDER_CONTEXT_MENU_LINK_SUFFIX = ":link";
const PROVIDER_CONTEXT_MENU_SELECTION_SUFFIX = ":selection";
const HTTP_URL_PATTERNS = ["http://*/*", "https://*/*"];
type ContextMenuCreateProperties = Parameters<typeof browser.contextMenus.create>[0];
type ContextMenuContexts = NonNullable<ContextMenuCreateProperties["contexts"]>;
type ContextMenuTarget = "page" | "link" | "selection";
type ContextMenuShownInfo = {
  contexts?: string[];
  selectionText?: string;
  linkUrl?: string;
  pageUrl?: string;
};
type ContextMenuShownTab = { id?: number; url?: string };
type ExtendedContextMenusApi = typeof browser.contextMenus & {
  refresh?: () => void;
  onShown?: {
    addListener: (listener: (info: ContextMenuShownInfo, tab?: ContextMenuShownTab) => void) => void;
  };
};

const CONTEXT_MENU_CONTEXTS: ContextMenuContexts = ["page", "link", "selection"];
const contextMenusApi = browser.contextMenus as ExtendedContextMenusApi;

const CONTEXT_MENU_ITEMS: Array<{
  id: string;
  titleKey: TranslationKey;
  iconPath: string;
  contexts: ContextMenuContexts;
  documentUrlPatterns?: string[];
  targetUrlPatterns?: string[];
}> = [
  {
    id: RESOLVER_CONTEXT_MENU_ID,
    titleKey: "popup.checkArchivedVersionsTitle",
    iconPath: "icon-transparent.svg",
    contexts: ["page"],
    documentUrlPatterns: HTTP_URL_PATTERNS
  },
  {
    id: RESOLVER_CONTEXT_MENU_LINK_ID,
    titleKey: "popup.checkArchivedVersionsTitleLink",
    iconPath: "icon-transparent.svg",
    contexts: ["link"],
    targetUrlPatterns: HTTP_URL_PATTERNS
  },
  {
    id: RESOLVER_CONTEXT_MENU_SELECTION_ID,
    titleKey: "popup.checkArchivedVersionsTitleSelection",
    iconPath: "icon-transparent.svg",
    contexts: ["selection"]
  },
  {
    id: ALL_ARCHIVES_TABS_CONTEXT_MENU_ID,
    titleKey: "popup.checkAllArchivesTitle",
    iconPath: "icon-transparent.svg",
    contexts: ["page"],
    documentUrlPatterns: HTTP_URL_PATTERNS
  },
  {
    id: ALL_ARCHIVES_TABS_CONTEXT_MENU_LINK_ID,
    titleKey: "popup.checkAllArchivesTitleLink",
    iconPath: "icon-transparent.svg",
    contexts: ["link"],
    targetUrlPatterns: HTTP_URL_PATTERNS
  },
  {
    id: ALL_ARCHIVES_TABS_CONTEXT_MENU_SELECTION_ID,
    titleKey: "popup.checkAllArchivesTitleSelection",
    iconPath: "icon-transparent.svg",
    contexts: ["selection"]
  }
];

const PROVIDER_CONTEXT_MENU_ITEMS: Record<
  ProviderId,
  {
    id: string;
    providerId: ProviderId;
    title: string;
    iconPath: string;
    documentUrlPatterns?: string[];
    targetUrlPatterns?: string[];
  }
> = {
  wayback: {
    id: `${PROVIDER_CONTEXT_MENU_PREFIX}wayback`,
    providerId: "wayback",
    title: "Wayback Machine",
    iconPath: "provider-icons/wayback.svg"
  },
  "archive-today": {
    id: `${PROVIDER_CONTEXT_MENU_PREFIX}archive-today`,
    providerId: "archive-today",
    title: "Archive.today",
    iconPath: "provider-icons/archive-today.svg"
  },
  ghostarchive: {
    id: `${PROVIDER_CONTEXT_MENU_PREFIX}ghostarchive`,
    providerId: "ghostarchive",
    title: "Ghostarchive",
    iconPath: "provider-icons/ghostarchive.png"
  },
  "arquivo-pt": {
    id: `${PROVIDER_CONTEXT_MENU_PREFIX}arquivo-pt`,
    providerId: "arquivo-pt",
    title: "Arquivo.pt",
    iconPath: "provider-icons/arquivo-pt.svg"
  },
  "web-gyotaku": {
    id: `${PROVIDER_CONTEXT_MENU_PREFIX}web-gyotaku`,
    providerId: "web-gyotaku",
    title: "Megalodon",
    iconPath: "provider-icons/web-gyotaku.svg"
  },
  "yandex-cache": {
    id: `${PROVIDER_CONTEXT_MENU_PREFIX}yandex-cache`,
    providerId: "yandex-cache",
    title: "Yandex Cache",
    iconPath: "provider-icons/yandex-cache.svg"
  },
  "uk-gov-web-archive": {
    id: `${PROVIDER_CONTEXT_MENU_PREFIX}uk-gov-web-archive`,
    providerId: "uk-gov-web-archive",
    title: "UK Government Web Archive",
    iconPath: "provider-icons/uk-gov-web-archive.svg",
    documentUrlPatterns: ["*://gov.uk/*", "*://*.gov.uk/*"],
    targetUrlPatterns: ["*://gov.uk/*", "*://*.gov.uk/*"]
  },
  "loc-web-archives": {
    id: `${PROVIDER_CONTEXT_MENU_PREFIX}loc-web-archives`,
    providerId: "loc-web-archives",
    title: "Library of Congress Web Archives",
    iconPath: "provider-icons/loc-web-archives.svg",
    documentUrlPatterns: [
      "*://*.gov/*",
      "*://gov/*",
      "*://*.mil/*",
      "*://mil/*",
      "*://*.loc.gov/*",
      "*://loc.gov/*",
      "*://*.congress.gov/*",
      "*://congress.gov/*"
    ],
    targetUrlPatterns: [
      "*://*.gov/*",
      "*://gov/*",
      "*://*.mil/*",
      "*://mil/*",
      "*://*.loc.gov/*",
      "*://loc.gov/*",
      "*://*.congress.gov/*",
      "*://congress.gov/*"
    ]
  },
  "perma-cc": {
    id: `${PROVIDER_CONTEXT_MENU_PREFIX}perma-cc`,
    providerId: "perma-cc",
    title: "Perma.cc",
    iconPath: "provider-icons/perma-cc.svg"
  },
  webcite: {
    id: `${PROVIDER_CONTEXT_MENU_PREFIX}webcite`,
    providerId: "webcite",
    title: "WebCite",
    iconPath: "provider-icons/webcite.svg"
  },
  "software-heritage": {
    id: `${PROVIDER_CONTEXT_MENU_PREFIX}software-heritage`,
    providerId: "software-heritage",
    title: "Software Heritage",
    iconPath: "provider-icons/software-heritage.svg",
    documentUrlPatterns: [
      "*://github.com/*",
      "*://gitlab.com/*",
      "*://codeberg.org/*",
      "*://bitbucket.org/*",
      "*://git.sr.ht/*"
    ],
    targetUrlPatterns: [
      "*://github.com/*",
      "*://gitlab.com/*",
      "*://codeberg.org/*",
      "*://bitbucket.org/*",
      "*://git.sr.ht/*"
    ]
  }
};

function getState(tabId?: number): TabState {
  if (tabId === undefined || tabId < 0) return idleTabState;
  return tabStates.get(tabId) ?? idleTabState;
}

async function setState(tabId: number, state: TabState) {
  tabStates.set(tabId, state);
  await updateBadge(tabId, state);
  await browser.tabs.sendMessage(tabId, { type: "STATE_UPDATED", tabId, state }).catch(() => undefined);
}

async function clearState(tabId: number) {
  tabStates.delete(tabId);
  await updateBadge(tabId, idleTabState);
  await browser.tabs.sendMessage(tabId, { type: "STATE_UPDATED", tabId, state: idleTabState }).catch(() => undefined);
}

function detectedHttpError(url: string, statusCode: number): DetectedError {
  return {
    kind: "http",
    originalUrl: url,
    statusCode,
    explanation: explainHttpStatus(statusCode),
    detectedAt: Date.now()
  };
}

function isMutedByDomain(rawUrl: string, domainExceptions: string[]) {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return domainExceptions.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

async function recordBrokenPage(tabId: number, error: DetectedError): Promise<boolean> {
  const settings = await getSettings();
  if (!isBrokenPageAssistActive(settings)) {
    await clearState(tabId);
    return false;
  }

  if (isMutedByDomain(error.originalUrl, settings.domainExceptions)) {
    await clearState(tabId);
    return false;
  }

  await setState(tabId, {
    status: "broken",
    error,
    lookup: { status: "idle" }
  });
  return true;
}

function lookupRequestToDetectedError(request: LookupRequest): DetectedError | null {
  if (request.trigger !== "broken-page") return null;

  return {
    kind: request.kind,
    originalUrl: request.originalUrl,
    statusCode: request.statusCode,
    browserError: request.browserError,
    explanation:
      request.kind === "navigation"
        ? explainNavigationError(request.browserError)
        : explainHttpStatus(request.statusCode ?? 0),
    detectedAt: Date.now()
  };
}

async function refreshTrackedBadges() {
  const trackedTabIds = new Set([...tabStates.keys()]);
  await Promise.all(
    Array.from(trackedTabIds).map((tabId) => updateBadge(tabId, getState(tabId)))
  );
}

async function clearBrokenStates() {
  const brokenTabIds = [...tabStates.entries()]
    .filter(([, state]) => state.status === "broken")
    .map(([tabId]) => tabId);

  await Promise.all(brokenTabIds.map((tabId) => clearState(tabId)));
}

async function applySettings(settings: Settings) {
  const savedSettings = await saveSettings(settings);
  await ensureContextMenu();

  if (isBrokenPageAssistActive(savedSettings)) {
    await refreshTrackedBadges();
  } else {
    await clearBrokenStates();
  }

  return savedSettings;
}

async function startResolver(request: LookupRequest, tabId?: number, historyTrigger?: HistoryTrigger) {
  const settings = await getSettings();
  const sourceTabId = tabId;
  const nextError = lookupRequestToDetectedError(request);
  const historyEntry = await createHistoryEntry({
    targetUrl: request.originalUrl,
    trigger: historyTrigger ?? request.trigger,
    requestTrigger: request.trigger
  });

  if (sourceTabId !== undefined && sourceTabId >= 0 && nextError) {
    const existing = getState(sourceTabId);
    const error =
      existing.status === "broken" && existing.error.originalUrl === nextError.originalUrl
        ? existing.error
        : nextError;

    await setState(sourceTabId, {
      status: "broken",
      error,
      lookup: { status: "running", startedAt: Date.now() }
    });
  }

  const url = resolverUrl(request, sourceTabId, undefined, historyEntry?.id);

  if (settings.openBehavior === "current-tab" && sourceTabId !== undefined) {
    await browser.tabs.update(sourceTabId, { url });
    return;
  }

  if (settings.openBehavior === "new-window") {
    await browser.windows.create({
      url,
      focused: true
    });
    return;
  }

  const created = await browser.tabs.create({
    url,
    active: settings.openBehavior !== "new-tab-background",
    openerTabId: sourceTabId
  });

  if (created.id !== undefined && nextError) {
    await setState(created.id, {
      status: "broken",
      error: nextError,
      lookup: { status: "running", startedAt: Date.now() }
    });
  }
}

async function openAllArchivesInTabs(rawUrl: string, sourceTabId?: number) {
  const settings = await getSettings();
  const archives = buildProviderActions(
    rawUrl,
    settings.enabledProviders,
    settings.archiveDisplayOrder,
    settings
  );
  const orderedArchives = [
    ...archives.filter((archive) => archive.action.kind === "resolver"),
    ...archives.filter((archive) => archive.action.kind !== "resolver")
  ];

  for (const [index, archive] of orderedArchives.entries()) {
    const historyEntry = await createHistoryEntry({
      targetUrl: rawUrl,
      trigger: "all-archives",
      requestTrigger: "manual-page",
      scopedProviderId: archive.providerId
    });
    await browser.tabs.create({
      url:
        archive.action.kind === "direct"
          ? archive.action.url
          : resolverUrl(
              createManualPageLookupRequest(archive.action.url),
              sourceTabId,
              archive.providerId,
              historyEntry?.id
            ),
      active: index === 0,
      openerTabId: sourceTabId
    });
  }
}

async function startResolverForActiveTab() {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.url) return;

  const target = getLookupTargetState(activeTab.url);
  if (target.kind !== "eligible") return;

  await startResolver(createManualPageLookupRequest(target.url), activeTab.id);
}

function getContextTargetUrl(
  info: { linkUrl?: string; pageUrl?: string; selectionText?: string },
  tab?: { url?: string }
) {
  const selectionUrl = extractSelectionUrl(info.selectionText);
  return selectionUrl ?? info.linkUrl ?? info.pageUrl ?? tab?.url;
}

function extractSelectionUrl(selectionText?: string) {
  if (!selectionText) return null;

  const match = selectionText
    .trim()
    .match(/https?:\/\/\S+/i)?.[0]
    .replace(/[)\],.;!?]+$/g, "");

  return match ?? null;
}

function buildMenuIcons(iconPath: string) {
  if (iconPath === "icon-transparent.svg") {
    return {
      16: "menu-icons/pastpage-16.png",
      32: "menu-icons/pastpage-32.png"
    };
  }

  const iconFileName = iconPath.split("/").pop()?.replace(/\.(svg|png)$/i, "");
  if (!iconFileName) {
    return {
      16: iconPath,
      32: iconPath
    };
  }

  return {
    16: `menu-icons/provider-icons/${iconFileName}-16.png`,
    32: `menu-icons/provider-icons/${iconFileName}-32.png`
  };
}

function buildProviderContextMenuId(providerId: ProviderId, target: ContextMenuTarget) {
  const baseId = `${PROVIDER_CONTEXT_MENU_PREFIX}${providerId}`;
  if (target === "page") return baseId;
  if (target === "link") return `${baseId}${PROVIDER_CONTEXT_MENU_LINK_SUFFIX}`;
  return `${baseId}${PROVIDER_CONTEXT_MENU_SELECTION_SUFFIX}`;
}

function parseProviderContextMenuId(menuItemId: string): ProviderId | null {
  if (!menuItemId.startsWith(PROVIDER_CONTEXT_MENU_PREFIX)) return null;

  const normalizedId = menuItemId
    .replace(new RegExp(`${PROVIDER_CONTEXT_MENU_LINK_SUFFIX}$`), "")
    .replace(new RegExp(`${PROVIDER_CONTEXT_MENU_SELECTION_SUFFIX}$`), "");

  return normalizedId.slice(PROVIDER_CONTEXT_MENU_PREFIX.length) as ProviderId;
}

function createContextMenuItem(
  createProperties: ContextMenuCreateProperties
): Promise<void> {
  return new Promise((resolve, reject) => {
    browser.contextMenus.create(createProperties, () => {
      const error = browser.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function updateContextMenuItem(
  id: string,
  updateProperties: Partial<ContextMenuCreateProperties>
): Promise<void> {
  return new Promise((resolve, reject) => {
    contextMenusApi.update(id, updateProperties, () => {
      const error = browser.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function refreshContextMenu() {
  contextMenusApi.refresh?.();
}

function getContextMenuIdsForTarget(target: Extract<ContextMenuTarget, "link" | "selection">) {
  const genericIds =
    target === "link"
      ? [RESOLVER_CONTEXT_MENU_LINK_ID, ALL_ARCHIVES_TABS_CONTEXT_MENU_LINK_ID]
      : [RESOLVER_CONTEXT_MENU_SELECTION_ID, ALL_ARCHIVES_TABS_CONTEXT_MENU_SELECTION_ID];

  return [
    ...genericIds,
    ...Object.values(PROVIDER_CONTEXT_MENU_ITEMS).map((item) =>
      buildProviderContextMenuId(item.providerId, target)
    )
  ];
}

async function syncTargetedContextMenuVisibility(
  info: { selectionText?: string; linkUrl?: string; contexts?: string[]; pageUrl?: string },
  tab?: { url?: string }
) {
  const isLinkContext = info.contexts?.includes("link") ?? false;
  const isSelectionContext = info.contexts?.includes("selection") ?? false;

  if (!isLinkContext && !isSelectionContext) {
    await Promise.all(
      ["link", "selection"].flatMap((target) =>
        getContextMenuIdsForTarget(target as "link" | "selection").map((id) =>
          updateContextMenuItem(id, { visible: true })
        )
      )
    );
    await updateContextMenuItem(ROOT_CONTEXT_MENU_ID, { visible: true });
    refreshContextMenu();
    return;
  }

  const menuTarget: "link" | "selection" = isLinkContext ? "link" : "selection";
  const scopedMenuIds = getContextMenuIdsForTarget(menuTarget);
  const targetUrl =
    menuTarget === "link"
      ? getContextTargetUrl({ linkUrl: info.linkUrl, pageUrl: info.pageUrl }, tab)
      : getContextTargetUrl({ selectionText: info.selectionText }, tab);
  const target = getLookupTargetState(targetUrl);

  if (target.kind !== "eligible") {
    await Promise.all(
      scopedMenuIds.map((id) => updateContextMenuItem(id, { visible: false }))
    );
    await updateContextMenuItem(ROOT_CONTEXT_MENU_ID, { visible: false });
    refreshContextMenu();
    return;
  }

  const settings = await getSettings();
  const relevantProviderIds = new Set(
    buildProviderActions(
      target.url,
      settings.enabledProviders,
      settings.archiveDisplayOrder,
      settings
    ).map((action) => action.providerId)
  );

  await Promise.all([
    updateContextMenuItem(ROOT_CONTEXT_MENU_ID, { visible: true }),
    updateContextMenuItem(
      menuTarget === "link" ? RESOLVER_CONTEXT_MENU_LINK_ID : RESOLVER_CONTEXT_MENU_SELECTION_ID,
      { visible: true }
    ),
    updateContextMenuItem(
      menuTarget === "link" ? ALL_ARCHIVES_TABS_CONTEXT_MENU_LINK_ID : ALL_ARCHIVES_TABS_CONTEXT_MENU_SELECTION_ID,
      { visible: true }
    ),
    ...Object.values(PROVIDER_CONTEXT_MENU_ITEMS).map((item) =>
      updateContextMenuItem(buildProviderContextMenuId(item.providerId, menuTarget), {
        visible: relevantProviderIds.has(item.providerId)
      })
    )
  ]);
  refreshContextMenu();
}

let ensureContextMenuTask: Promise<void> = Promise.resolve();

async function rebuildContextMenu() {
  const settings = await getSettings();
  const t = createTranslator(resolveLocaleFromLanguageMode(settings.language));

  await browser.contextMenus.removeAll().catch(() => undefined);
  await createContextMenuItem({
    id: ROOT_CONTEXT_MENU_ID,
    title: "PastPage",
    contexts: CONTEXT_MENU_CONTEXTS
  });

  for (const item of CONTEXT_MENU_ITEMS) {
    const createProperties: ContextMenuCreateProperties = {
      id: item.id,
      parentId: ROOT_CONTEXT_MENU_ID,
      title: t(item.titleKey),
      contexts: item.contexts,
      documentUrlPatterns: item.documentUrlPatterns,
      targetUrlPatterns: item.targetUrlPatterns
    };

    if (settings.showContextMenuIcons) {
      try {
        await createContextMenuItem({
          ...createProperties,
          icons: buildMenuIcons(item.iconPath)
        } as never);
      } catch {
        await createContextMenuItem(createProperties);
      }
    } else {
      await createContextMenuItem(createProperties);
    }
  }

  for (const providerId of settings.archiveDisplayOrder) {
    if (!settings.enabledProviders.includes(providerId)) continue;

    const item = PROVIDER_CONTEXT_MENU_ITEMS[providerId];
    const providerMenuVariants: Array<{
      id: string;
      contexts: ContextMenuContexts;
      documentUrlPatterns?: string[];
      targetUrlPatterns?: string[];
    }> = [
      {
        id: buildProviderContextMenuId(providerId, "page"),
        contexts: ["page"],
        documentUrlPatterns: item.documentUrlPatterns ?? HTTP_URL_PATTERNS
      },
      {
        id: buildProviderContextMenuId(providerId, "link"),
        contexts: ["link"],
        targetUrlPatterns: item.targetUrlPatterns ?? HTTP_URL_PATTERNS
      },
      {
        id: buildProviderContextMenuId(providerId, "selection"),
        contexts: ["selection"]
      }
    ];

    for (const variant of providerMenuVariants) {
      const createProperties: ContextMenuCreateProperties = {
        id: variant.id,
        parentId: ROOT_CONTEXT_MENU_ID,
        title: item.title,
        contexts: variant.contexts,
        documentUrlPatterns: variant.documentUrlPatterns,
        targetUrlPatterns: variant.targetUrlPatterns
      };

      if (settings.showContextMenuIcons) {
        try {
          await createContextMenuItem({
            ...createProperties,
            icons: buildMenuIcons(item.iconPath)
          } as never);
        } catch {
          await createContextMenuItem(createProperties);
        }
      } else {
        await createContextMenuItem(createProperties);
      }
    }
  }
}

function ensureContextMenu() {
  ensureContextMenuTask = ensureContextMenuTask
    .catch(() => undefined)
    .then(() => rebuildContextMenu());

  return ensureContextMenuTask;
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    void ensureSettings();
    void ensureContextMenu();

    if (details.reason === "install") {
      void browser.tabs.create({
        url: onboardingPageUrl(),
        active: true
      });
      return;
    }

    if (details.reason === "update") {
      void (async () => {
        const currentVersion = browser.runtime.getManifest().version;
        const meta = await getLocalMeta();

        if (meta.lastSeenWhatsNewVersion === currentVersion) {
          return;
        }

        await browser.tabs.create({
          url: whatsNewPageUrl(),
          active: true
        });
        await markWhatsNewVersionSeen(currentVersion);
      })();
    }
  });

  void ensureContextMenu();

  browser.webRequest.onCompleted.addListener(
    (details) => {
      if (details.tabId < 0 || details.type !== "main_frame") return;

      if (isRelevantHttpStatus(details.statusCode)) {
        void recordBrokenPage(details.tabId, detectedHttpError(details.url, details.statusCode));
        return;
      }

      if (details.statusCode >= 200 && details.statusCode < 400) {
        void clearState(details.tabId);
      }
    },
    { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] }
  );

  browser.tabs.onRemoved.addListener((tabId) => {
    tabStates.delete(tabId);
  });

  browser.runtime.onMessage.addListener(async (rawMessage, sender) => {
    let message: RuntimeMessage;
    try {
      message = parseRuntimeMessage(rawMessage);
    } catch {
      return;
    }
    const senderTabId = sender.tab?.id;
    const tabId = "tabId" in message ? message.tabId ?? senderTabId : senderTabId;

    switch (message.type) {
      case "GET_TAB_STATE":
        return { state: getState(tabId) };

      case "DISMISS_TOPBAR": {
        if (tabId === undefined) return { ok: false };
        const state = getState(tabId);
        if (state.status === "broken") {
          await setState(tabId, { ...state, dismissedForUrl: message.url });
        }
        return { ok: true };
      }

      case "START_RESOLVER":
        await startResolver(message.request, tabId, message.historyTrigger);
        return { ok: true };

      case "LOOKUP_ARCHIVES": {
        const settings = await getSettings();
        const result = await lookupArchives(
          message.originalUrl,
          settings.urlMatchingMode,
          undefined,
          undefined,
          undefined,
          undefined,
          settings.enabledProviders,
          settings
        );
        if (tabId !== undefined) {
          const state = getState(tabId);
          if (state.status === "broken") {
            if (result.status === "found") {
              await setState(tabId, {
                ...state,
                lookup: { status: "found", snapshot: result.snapshot }
              });
            } else if (result.status === "not-found") {
              await setState(tabId, {
                ...state,
                lookup: {
                  status: "not-found",
                  checked: Array.from(new Set(result.checked.map((attempt) => attempt.strategy))),
                  failedProviders: result.failedProviders
                }
              });
            }
          }
        }
        return { result };
      }

      case "GET_SETTINGS":
        return { settings: await getSettings() };

      case "UPDATE_SETTINGS": {
        const settings = await applySettings(message.settings);
        return { settings };
      }

      case "COPY_ARCHIVE_LINK":
        return { ok: true };

      case "STATE_UPDATED":
        return { ok: true };

      default:
        return { ok: false };
    }
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    const target = getLookupTargetState(getContextTargetUrl(info, tab));
    if (target.kind !== "eligible") return;

    if (
      info.menuItemId === RESOLVER_CONTEXT_MENU_ID ||
      info.menuItemId === RESOLVER_CONTEXT_MENU_LINK_ID ||
      info.menuItemId === RESOLVER_CONTEXT_MENU_SELECTION_ID
    ) {
      void startResolver(createManualPageLookupRequest(target.url), tab?.id, "context-menu");
      return;
    }

    if (
      info.menuItemId === ALL_ARCHIVES_TABS_CONTEXT_MENU_ID ||
      info.menuItemId === ALL_ARCHIVES_TABS_CONTEXT_MENU_LINK_ID ||
      info.menuItemId === ALL_ARCHIVES_TABS_CONTEXT_MENU_SELECTION_ID
    ) {
      void openAllArchivesInTabs(target.url, tab?.id);
      return;
    }

    if (typeof info.menuItemId !== "string") {
      return;
    }

    const providerId = parseProviderContextMenuId(info.menuItemId);
    if (!providerId) return;

    void getSettings().then(async (settings) => {
      if (!settings.enabledProviders.includes(providerId)) return;

      const directLinkUrl = getProvider(providerId).buildDirectLinkUrl(target.url, settings);
      const historyEntry = await createHistoryEntry({
        targetUrl: target.url,
        trigger: directLinkUrl ? "provider-direct" : "context-menu",
        requestTrigger: "manual-page",
        scopedProviderId: providerId
      });
      const destinationUrl =
        directLinkUrl ??
        resolverUrl(createManualPageLookupRequest(target.url), tab?.id, providerId, historyEntry?.id);

      return openArchiveUrl(destinationUrl, settings.providerMenuOpenBehavior, tab?.id);
    });
  });

  contextMenusApi.onShown?.addListener((info, tab) => {
    void syncTargetedContextMenuVisibility(info, tab).catch(() => undefined);
  });

  browser.commands?.onCommand.addListener((command) => {
    if (command === "start-resolver-current-page") {
      void startResolverForActiveTab();
    }
  });
});
