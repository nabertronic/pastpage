import type { TranslationKey } from "../i18n";
import { getUrlEligibility } from "./urlPolicy";

export type LookupTargetState =
  | { kind: "eligible"; url: string }
  | { kind: "ineligible"; reasonKey: TranslationKey };

export function getLookupTargetState(rawUrl?: string | null): LookupTargetState {
  if (!rawUrl) {
    return { kind: "ineligible", reasonKey: "lookupTarget.missingUrl" };
  }

  const eligibility = getUrlEligibility(rawUrl);
  if (!eligibility.eligible) {
    return { kind: "ineligible", reasonKey: eligibility.reasonKey };
  }

  return { kind: "eligible", url: eligibility.url.toString() };
}

function normalizeCustomLookupUrl(rawUrl?: string | null): string | null {
  const trimmed = rawUrl?.trim();

  if (!trimmed) return null;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return trimmed;
  if (/^[^\s./?#]+\.[^\s]+$/i.test(trimmed)) return `https://${trimmed}`;

  return trimmed;
}

export function getCustomLookupTargetState(rawUrl?: string | null): LookupTargetState {
  const normalizedUrl = normalizeCustomLookupUrl(rawUrl);

  if (!normalizedUrl) {
    return { kind: "ineligible", reasonKey: "eligibility.invalidUrl" };
  }

  return getLookupTargetState(normalizedUrl);
}
