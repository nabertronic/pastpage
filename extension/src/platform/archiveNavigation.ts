import type { ProviderMenuOpenBehavior } from "../core/settings";

export async function openArchiveUrl(
  url: string,
  behavior: ProviderMenuOpenBehavior,
  sourceTabId?: number
) {
  switch (behavior) {
    case "current-tab":
      if (sourceTabId !== undefined && sourceTabId >= 0) {
        await browser.tabs.update(sourceTabId, { url });
        return;
      }
      await browser.tabs.create({ url, active: true });
      return;

    case "new-tab-foreground":
      await browser.tabs.create({
        url,
        active: true,
        openerTabId: sourceTabId
      });
      return;

    case "new-tab-background":
      await browser.tabs.create({
        url,
        active: false,
        openerTabId: sourceTabId
      });
      return;

    case "new-window":
      await browser.windows.create({ url, focused: true });
      return;
  }
}
