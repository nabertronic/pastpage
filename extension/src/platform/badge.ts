import type { TabState } from "../core/tabState";
import { getSettings } from "./storage";

type BadgeApi = {
  setBadgeText(details: { tabId: number; text: string }): Promise<unknown>;
  setBadgeBackgroundColor(details: { tabId: number; color: string }): Promise<unknown>;
  setBadgeTextColor?(details: { tabId: number; color: string }): Promise<unknown>;
};

function getBadgeApi(): BadgeApi {
  const api = (
    browser as typeof browser & {
      action?: BadgeApi;
      browserAction?: BadgeApi;
    }
  ).action ?? (
    browser as typeof browser & {
      browserAction?: BadgeApi;
    }
  ).browserAction;

  if (!api) {
    throw new Error("No browser action API is available for badge updates");
  }

  return api;
}

export async function updateBadge(tabId: number, state: TabState): Promise<void> {
  const settings = await getSettings();
  const badgeApi = getBadgeApi();

  if (!settings.badgeEnabled || state.status === "idle") {
    await badgeApi.setBadgeText({ tabId, text: "" });
    return;
  }

  await badgeApi.setBadgeText({ tabId, text: "!" });
  await badgeApi.setBadgeBackgroundColor({ tabId, color: "#b91c1c" });
  await badgeApi.setBadgeTextColor?.({ tabId, color: "#ffffff" });
}
