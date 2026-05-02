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
