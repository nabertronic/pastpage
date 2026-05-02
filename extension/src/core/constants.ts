export const EXTENSION_NAME = "PastPage";
export const FEEDBACK_EMAIL = "nabert@pm.me";
export const PRIVACY_SHORT = "No tracking. No analytics. No telemetry.";
export const PRIVACY_LONG =
  "By default, URLs are sent to archive providers only after you click to check archived versions. A lookup may contact multiple relevant archives for that URL.";
export const DEFAULT_ACCENT_COLOR = "#ffd400";
export const GITHUB_URL = "https://github.com/nabertronic/pastpage";
export const SUPPORT_URL = "https://github.com/nabertronic/pastpage/blob/main/docs/SUPPORT.md";
export const CHROME_WEB_STORE_URL = null;
export const FIREFOX_ADDONS_URL = "https://addons.mozilla.org/en-US/firefox/addon/pastpage-query-10-web-archives/";
export const LICENSE_URL = "https://github.com/nabertronic/pastpage/blob/main/LICENSE";
export const PRIVACY_URL = "https://github.com/nabertronic/pastpage/blob/main/docs/PRIVACY.md";

export const RELEVANT_HTTP_STATUS_CODES = [
  404, 408, 410, 451, 500, 502, 503, 504, 509, 520, 521, 523, 524, 525, 526
] as const;

export const WAYBACK_CDX_ENDPOINT = "https://web.archive.org/cdx";
export const WAYBACK_HOSTS = new Set([
  "archive.org",
  "www.archive.org",
  "web.archive.org",
  "web.archivep75mbjunhxc6x4j5mwjmomyxb573v42baldlqu56ruil2oiad.onion",
  "archive.is",
  "archive.ph",
  "archive.today",
  "archive.vn",
  "archive.fo",
  "archive.li",
  "archive.md",
  "archiveiya74codqgiixo33q62qlrqtkgmcitqx5u2oeqnmn5bpcbiyd.onion",
  "ghostarchive.org",
  "webarchive.nationalarchives.gov.uk",
  "webarchive.loc.gov",
  "arquivo.pt",
  "www.arquivo.pt",
  "megalodon.jp",
  "gyo.tc",
  "wayback.archive-it.org",
  "www.webcitation.org",
  "archive.softwareheritage.org"
]);
