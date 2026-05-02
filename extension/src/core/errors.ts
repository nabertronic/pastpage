import { RELEVANT_HTTP_STATUS_CODES } from "./constants";
import { createTranslator, type TranslationKey, type Translator } from "../i18n";

export type RelevantHttpStatus = (typeof RELEVANT_HTTP_STATUS_CODES)[number];

export type DetectedErrorKind = "http" | "navigation";

export type ErrorExplanation = {
  title: string;
  short: string;
  detail: string;
};

type ErrorExplanationDescriptor = {
  titleKey: TranslationKey;
  shortKey: TranslationKey;
  detailKey: TranslationKey;
};

export type ErrorLike = {
  kind: DetectedErrorKind;
  statusCode?: number;
  browserError?: string;
};

const english = createTranslator("en");

const HTTP_EXPLANATIONS: Record<number, ErrorExplanationDescriptor> = {
  404: {
    titleKey: "error.http.404.title",
    shortKey: "error.http.404.short",
    detailKey: "error.http.404.detail"
  },
  408: {
    titleKey: "error.http.408.title",
    shortKey: "error.http.408.short",
    detailKey: "error.http.408.detail"
  },
  410: {
    titleKey: "error.http.410.title",
    shortKey: "error.http.410.short",
    detailKey: "error.http.410.detail"
  },
  451: {
    titleKey: "error.http.451.title",
    shortKey: "error.http.451.short",
    detailKey: "error.http.451.detail"
  },
  500: {
    titleKey: "error.http.500.title",
    shortKey: "error.http.500.short",
    detailKey: "error.http.500.detail"
  },
  502: {
    titleKey: "error.http.502.title",
    shortKey: "error.http.502.short",
    detailKey: "error.http.502.detail"
  },
  503: {
    titleKey: "error.http.503.title",
    shortKey: "error.http.503.short",
    detailKey: "error.http.503.detail"
  },
  504: {
    titleKey: "error.http.504.title",
    shortKey: "error.http.504.short",
    detailKey: "error.http.504.detail"
  },
  509: {
    titleKey: "error.http.509.title",
    shortKey: "error.http.509.short",
    detailKey: "error.http.509.detail"
  },
  520: {
    titleKey: "error.http.520.title",
    shortKey: "error.http.520.short",
    detailKey: "error.http.520.detail"
  },
  521: {
    titleKey: "error.http.521.title",
    shortKey: "error.http.521.short",
    detailKey: "error.http.521.detail"
  },
  523: {
    titleKey: "error.http.523.title",
    shortKey: "error.http.523.short",
    detailKey: "error.http.523.detail"
  },
  524: {
    titleKey: "error.http.524.title",
    shortKey: "error.http.524.short",
    detailKey: "error.http.524.detail"
  },
  525: {
    titleKey: "error.http.525.title",
    shortKey: "error.http.525.short",
    detailKey: "error.http.525.detail"
  },
  526: {
    titleKey: "error.http.526.title",
    shortKey: "error.http.526.short",
    detailKey: "error.http.526.detail"
  }
};

function translateDescriptor(descriptor: ErrorExplanationDescriptor, translate: Translator): ErrorExplanation {
  return {
    title: translate(descriptor.titleKey),
    short: translate(descriptor.shortKey),
    detail: translate(descriptor.detailKey)
  };
}

export function isRelevantHttpStatus(statusCode: number): statusCode is RelevantHttpStatus {
  return RELEVANT_HTTP_STATUS_CODES.includes(statusCode as RelevantHttpStatus);
}

export function explainHttpStatus(statusCode: number, translate: Translator = english): ErrorExplanation {
  const explanation = HTTP_EXPLANATIONS[statusCode];
  if (explanation) return translateDescriptor(explanation, translate);

  return {
    title: translate("error.http.default.title", { statusCode }),
    short: translate("error.http.default.short"),
    detail: translate("error.http.default.detail", { statusCode })
  };
}

export function explainNavigationError(error?: string, translate: Translator = english): ErrorExplanation {
  const normalized = (error ?? "").toLowerCase();

  if (normalized.includes("name_not_resolved") || normalized.includes("dns")) {
    return {
      title: translate("error.navigation.dns.title"),
      short: translate("error.navigation.dns.short"),
      detail: translate("error.navigation.dns.detail")
    };
  }

  if (normalized.includes("timed_out") || normalized.includes("timeout")) {
    return {
      title: translate("error.navigation.timeout.title"),
      short: translate("error.navigation.timeout.short"),
      detail: translate("error.navigation.timeout.detail")
    };
  }

  if (
    normalized.includes("ssl") ||
    normalized.includes("cert") ||
    normalized.includes("tls")
  ) {
    return {
      title: translate("error.navigation.secure.title"),
      short: translate("error.navigation.secure.short"),
      detail: translate("error.navigation.secure.detail")
    };
  }

  if (normalized.includes("connection") || normalized.includes("refused")) {
    return {
      title: translate("error.navigation.connection.title"),
      short: translate("error.navigation.connection.short"),
      detail: translate("error.navigation.connection.detail")
    };
  }

  return {
    title: translate("error.navigation.default.title"),
    short: translate("error.navigation.default.short"),
    detail: translate("error.navigation.default.detail")
  };
}

export function isRelevantNavigationError(error?: string): boolean {
  const normalized = (error ?? "").toLowerCase();

  if (!normalized) return false;

  const relevantPatterns = [
    "name_not_resolved",
    "dns",
    "timed_out",
    "timeout",
    "ssl",
    "cert",
    "tls",
    "internet_disconnected",
    "address_unreachable"
  ];

  return relevantPatterns.some((pattern) => normalized.includes(pattern));
}

export function explainDetectedError(error: ErrorLike, translate: Translator = english): ErrorExplanation {
  return error.kind === "navigation"
    ? explainNavigationError(error.browserError, translate)
    : explainHttpStatus(error.statusCode ?? 0, translate);
}
