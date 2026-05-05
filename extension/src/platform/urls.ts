import type { LookupRequest } from "../core/lookupRequest";
import type { ProviderId } from "../core/providers/types";
import type { DetectedError } from "../core/tabState";

function buildExtensionUrl(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return browser.runtime.getURL(`/${path}?${search.toString()}` as Parameters<typeof browser.runtime.getURL>[0]);
}

export function optionsPageUrl(): string {
  return browser.runtime.getURL("/options.html");
}

export function historyPageUrl(): string {
  return browser.runtime.getURL("/archive-history.html" as Parameters<typeof browser.runtime.getURL>[0]);
}

export function onboardingPageUrl(): string {
  return browser.runtime.getURL("/onboarding.html" as Parameters<typeof browser.runtime.getURL>[0]);
}

export function thanksPageUrl(): string {
  return browser.runtime.getURL("/thanks.html" as Parameters<typeof browser.runtime.getURL>[0]);
}

export function resolverUrl(
  request: LookupRequest,
  sourceTabId?: number,
  providerId?: ProviderId,
  historyId?: string
): string {
  return buildExtensionUrl("resolver.html", {
    url: request.originalUrl,
    trigger: request.trigger,
    kind: request.trigger === "broken-page" ? request.kind : undefined,
    statusCode: request.trigger === "broken-page" ? request.statusCode : undefined,
    browserError: request.trigger === "broken-page" ? request.browserError : undefined,
    sourceTabId,
    providerId,
    historyId
  });
}

export function fallbackUrl(error: DetectedError, sourceTabId?: number): string {
  return buildExtensionUrl("fallback.html", {
    url: error.originalUrl,
    kind: error.kind,
    statusCode: error.statusCode,
    browserError: error.browserError,
    sourceTabId
  });
}

export function waybackCalendarUrl(originalUrl: string): string {
  return `https://web.archive.org/web/*/${originalUrl}`;
}
