import type { ProviderId } from "./types";

export type ChallengePhase = "query" | "replay";

export type ChallengeDetectionResult = {
  challenged: boolean;
  technicalDetail?: string;
};

type ChallengeDetector = (html: string) => ChallengeDetectionResult;

const NO_CHALLENGE: ChallengeDetectionResult = { challenged: false };
const CHALLENGE_PAGE: ChallengeDetectionResult = {
  challenged: true,
  technicalDetail: "challenge page"
};

const CAPTCHA_WIDGET_PATTERNS = [
  /\bg-recaptcha\b/i,
  /data-sitekey\s*=/i,
  /grecaptcha\.render\s*\(/i,
  /challenge-platform/i
];

const EXPLICIT_CHALLENGE_TEXT_PATTERNS = [
  /verify you are human/i,
  /security check/i,
  /please wait while we verify that you are not a robot/i,
  /please complete the security check to access/i,
  /this page requires a captcha/i,
  /why do i have to complete a captcha/i
];

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function hasCaptchaWidget(html: string): boolean {
  return CAPTCHA_WIDGET_PATTERNS.some((pattern) => pattern.test(html));
}

function hasExplicitChallengeText(html: string): boolean {
  return EXPLICIT_CHALLENGE_TEXT_PATTERNS.some((pattern) => pattern.test(html));
}

function detectGenericChallenge(html: string): ChallengeDetectionResult {
  const title = extractTitle(html);
  if (/^(?:one more step|captcha)$/i.test(title)) {
    return CHALLENGE_PAGE;
  }

  if (hasCaptchaWidget(html) || hasExplicitChallengeText(html)) {
    return CHALLENGE_PAGE;
  }

  return NO_CHALLENGE;
}

function stripWebCiteBootstrapRecaptcha(html: string): string {
  return html.replace(
    /<script\b[^>]*src=["']https?:\/\/www\.google\.com\/recaptcha\/api\.js[^"']*["'][^>]*>\s*<\/script>/gi,
    ""
  );
}

function detectWebCiteChallenge(html: string): ChallengeDetectionResult {
  return detectGenericChallenge(stripWebCiteBootstrapRecaptcha(html));
}

function detectArchiveTodayChallenge(html: string): ChallengeDetectionResult {
  if (/\brel="(?:first\s+)?memento"\b/i.test(html) && /\bdatetime="/i.test(html)) {
    return NO_CHALLENGE;
  }

  return detectGenericChallenge(html);
}

function detectArchiveItChallenge(html: string): ChallengeDetectionResult {
  if (
    /<title[^>]*>\s*Session Verification\s*<\/title>/i.test(html) ||
    /action=["']https?:\/\/archive-it\.org\/_challenge["']/i.test(html) ||
    /Archive-It uses a bot protection system/i.test(html)
  ) {
    return CHALLENGE_PAGE;
  }

  return detectGenericChallenge(html);
}

const PROVIDER_CHALLENGE_DETECTORS: Partial<
  Record<ProviderId, Partial<Record<ChallengePhase, ChallengeDetector>>>
> = {
  "archive-today": {
    query: detectArchiveTodayChallenge,
    replay: detectArchiveTodayChallenge
  },
  ghostarchive: {
    replay: detectGenericChallenge
  },
  wayback: {
    replay: detectGenericChallenge
  },
  "canada-gov-web-archive": {
    query: detectArchiveItChallenge,
    replay: detectArchiveItChallenge
  },
  webcite: {
    query: detectWebCiteChallenge,
    replay: detectWebCiteChallenge
  }
};

export function detectProviderChallenge(
  providerId: ProviderId | undefined,
  html: string,
  phase: ChallengePhase
): ChallengeDetectionResult {
  const detector = providerId
    ? PROVIDER_CHALLENGE_DETECTORS[providerId]?.[phase]
    : undefined;

  return (detector ?? detectGenericChallenge)(html);
}
