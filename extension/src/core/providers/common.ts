export function timestampFromDate(date: Date): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return (
    pad(date.getUTCFullYear(), 4) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  );
}

export function timestampFromIso(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return timestampFromDate(date);
}

export function normalizeComparableUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const pathname = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.hostname.toLowerCase()}${pathname}${url.search}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function absoluteUrl(baseUrl: string, pathOrUrl: string): string {
  return new URL(pathOrUrl, baseUrl).toString();
}

export type PhaseAwareFetch = typeof fetch & {
  replay?: typeof fetch;
};

export function replayFetch(fetchImpl: typeof fetch): typeof fetch {
  return (fetchImpl as PhaseAwareFetch).replay ?? fetchImpl;
}

export function parseRetryAfterMs(headerValue: string | null | undefined, now = Date.now()): number | undefined {
  if (!headerValue) return undefined;

  const numeric = Number(headerValue);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric * 1000;
  }

  const date = new Date(headerValue);
  if (Number.isNaN(date.getTime())) return undefined;

  const delta = date.getTime() - now;
  return delta > 0 ? delta : undefined;
}

export function formatRetryAfterDetail(retryAfterMs?: number): string | undefined {
  if (!retryAfterMs || retryAfterMs <= 0) return undefined;
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `429 with Retry-After ${seconds}s`;
}
