import { z } from "zod";

export const WAYBACK_HOST_OPTIONS = [
  "web.archive.org",
  "web.archivep75mbjunhxc6x4j5mwjmomyxb573v42baldlqu56ruil2oiad.onion"
] as const;
export const ARCHIVE_TODAY_HOST_OPTIONS = [
  "archive.is",
  "archive.today",
  "archive.ph",
  "archive.vn",
  "archive.fo",
  "archive.li",
  "archive.md",
  "archiveiya74codqgiixo33q62qlrqtkgmcitqx5u2oeqnmn5bpcbiyd.onion"
] as const;

export const WaybackHostSchema = z.enum(WAYBACK_HOST_OPTIONS);
export const ArchiveTodayHostSchema = z.enum(ARCHIVE_TODAY_HOST_OPTIONS);

export type WaybackHost = z.infer<typeof WaybackHostSchema>;
export type ArchiveTodayHost = z.infer<typeof ArchiveTodayHostSchema>;

export type ProviderHostSettings = {
  waybackHost: WaybackHost;
  archiveTodayHost: ArchiveTodayHost;
};

export const DEFAULT_PROVIDER_HOST_SETTINGS: ProviderHostSettings = {
  waybackHost: "web.archive.org",
  archiveTodayHost: "archive.ph"
};

export function buildWaybackBaseUrl(host: WaybackHost): string {
  return `https://${host}`;
}

export function buildArchiveTodayBaseUrl(host: ArchiveTodayHost): string {
  return `https://${host}`;
}
