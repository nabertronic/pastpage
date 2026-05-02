import React from "react";
import { ExternalLink, GitBranch, LifeBuoy, Mail, Scale } from "lucide-react";
import {
  FEEDBACK_EMAIL,
  GITHUB_URL,
  LICENSE_URL,
  PRIVACY_URL,
  SUPPORT_URL
} from "../core/constants";
import { useI18n } from "../i18n";
import { getExtensionBrowser, getExtensionStoreUrl } from "../platform/runtimeInfo";
import { historyPageUrl, optionsPageUrl } from "../platform/urls";
import { LogoMark } from "./LogoMark";

export function ResearcherFooter() {
  const { t } = useI18n();
  const browserName = getExtensionBrowser();
  const storeLabel = browserName === "firefox" ? t("common.firefoxAddons") : t("common.chromeWebStore");
  const storeUrl = getExtensionStoreUrl(browserName);
  const links = [
    { label: t("common.settings"), href: optionsPageUrl(), icon: ExternalLink, openInTab: true },
    { label: t("common.history"), href: historyPageUrl(), icon: ExternalLink, openInTab: true },
    { label: t("common.github"), href: GITHUB_URL, icon: GitBranch, openInTab: false },
    { label: t("common.license"), href: LICENSE_URL, icon: Scale, openInTab: false },
    { label: t("common.privacy"), href: PRIVACY_URL, icon: ExternalLink, openInTab: false },
    { label: t("common.support"), href: SUPPORT_URL, icon: LifeBuoy, openInTab: false },
    { label: t("common.sendFeedback"), href: `mailto:${FEEDBACK_EMAIL}`, icon: Mail, openInTab: false }
  ];
  const allLinks = storeUrl
    ? [...links.slice(0, 3), { label: storeLabel, href: storeUrl, icon: ExternalLink, openInTab: false }, ...links.slice(3)]
    : links;

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, href: string, openInTab: boolean) {
    if (openInTab) {
      e.preventDefault();
      void browser.tabs.create({ url: href });
    }
  }

  return (
    <footer className="border-t border-stone-200 pt-5 text-sm dark:border-stone-800">
      <div className="flex flex-wrap gap-2">
        {allLinks.map(({ label, href, icon: Icon, openInTab }) => (
          <a
            key={label}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-stone-600 underline-offset-4 transition-colors hover:bg-yellow-100 hover:text-stone-950 hover:underline focus-visible:outline-yellow-400 dark:text-stone-300 dark:hover:bg-yellow-300/10 dark:hover:text-yellow-100"
            href={href}
            target={href.startsWith("mailto:") ? undefined : "_blank"}
            rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
            onClick={(e) => handleClick(e, href, openInTab)}
          >
            <Icon aria-hidden="true" size={14} />
            {label}
          </a>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-yellow-400 shadow-[0_10px_24px_rgba(255,212,0,0.2)]">
          <LogoMark size={17} variant="white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-950 dark:text-yellow-50">PastPage</p>
          <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">{t("footer.description")}</p>
        </div>
      </div>
    </footer>
  );
}
