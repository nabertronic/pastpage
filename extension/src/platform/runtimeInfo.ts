import { CHROME_WEB_STORE_URL, FIREFOX_ADDONS_URL, GITHUB_URL } from "../core/constants";

export type ExtensionBrowser = "chrome" | "firefox";

export type UpdateCheckResult =
  | {
      status: "available";
      browser: ExtensionBrowser;
      currentVersion: string;
      availableVersion: string | null;
    }
  | {
      status: "up-to-date";
      browser: ExtensionBrowser;
      currentVersion: string;
    }
  | {
      status: "throttled";
      browser: "chrome";
      currentVersion: string;
    }
  | {
      status: "manual";
      browser: ExtensionBrowser;
      currentVersion: string;
      openedUrl: string;
    };

export function getExtensionBrowser(): ExtensionBrowser {
  const extensionUrl = browser.runtime.getURL("");
  return extensionUrl.startsWith("moz-extension://") ? "firefox" : "chrome";
}

export function getExtensionVersion() {
  return browser.runtime.getManifest().version;
}

export function getExtensionStoreUrl(browserName = getExtensionBrowser()) {
  return browserName === "firefox" ? FIREFOX_ADDONS_URL : CHROME_WEB_STORE_URL;
}

export function hasExtensionStoreListing(browserName = getExtensionBrowser()) {
  return Boolean(getExtensionStoreUrl(browserName));
}

export async function openExtensionUpdatePage(browserName = getExtensionBrowser()) {
  const targetUrl = browserName === "firefox" ? "about:addons" : getExtensionStoreUrl(browserName) ?? GITHUB_URL;

  try {
    await browser.tabs.create({ url: targetUrl });
    return targetUrl;
  } catch {
    const fallbackUrl = getExtensionStoreUrl(browserName) ?? GITHUB_URL;
    await browser.tabs.create({ url: fallbackUrl });
    return fallbackUrl;
  }
}

export async function openExtensionShortcutSettings(browserName = getExtensionBrowser()) {
  const browserCommands = browser.commands as typeof browser.commands & {
    openShortcutSettings?: () => Promise<void>;
  };

  if (browserName === "firefox" && browserCommands.openShortcutSettings) {
    await browserCommands.openShortcutSettings();
    return "about:addons";
  }

  const targetUrl = "chrome://extensions/shortcuts";
  await browser.tabs.create({ url: targetUrl });
  return targetUrl;
}

export async function checkForExtensionUpdates(): Promise<UpdateCheckResult> {
  const browserName = getExtensionBrowser();
  const currentVersion = getExtensionVersion();

  if (browserName === "firefox") {
    const openedUrl = await openExtensionUpdatePage(browserName);
    return {
      status: "manual",
      browser: browserName,
      currentVersion,
      openedUrl
    };
  }

  const updateStatus = await requestChromeUpdateCheck();

  if (updateStatus.status === "manual") {
    return {
      status: "manual",
      browser: browserName,
      currentVersion,
      openedUrl: updateStatus.openedUrl
    };
  }

  if (updateStatus.status === "update_available") {
    return {
      status: "available",
      browser: browserName,
      currentVersion,
      availableVersion: updateStatus.version ?? null
    };
  }

  if (updateStatus.status === "throttled") {
    return {
      status: "throttled",
      browser: browserName,
      currentVersion
    };
  }

  return {
    status: "up-to-date",
    browser: browserName,
    currentVersion
  };
}

type ChromeUpdateCheckState =
  | { status: "update_available"; version?: string }
  | { status: "no_update" }
  | { status: "throttled" }
  | { status: "manual"; openedUrl: string };

async function requestChromeUpdateCheck(): Promise<ChromeUpdateCheckState> {
  const globalChrome = globalThis as typeof globalThis & {
    chrome?: {
      runtime?: {
        requestUpdateCheck?: (
          callback: (status: "update_available" | "no_update" | "throttled", details?: { version?: string }) => void
        ) => void;
      };
    };
  };

  const chromeRuntime = globalChrome.chrome?.runtime as
    | {
        requestUpdateCheck?: (
          callback: (status: "update_available" | "no_update" | "throttled", details?: { version?: string }) => void
        ) => void;
      }
    | undefined;

  if (chromeRuntime?.requestUpdateCheck) {
    return await new Promise((resolve) => {
      chromeRuntime.requestUpdateCheck?.((status, details) => {
        resolve({
          status,
          version: details?.version
        });
      });
    });
  }

  const browserRuntime = browser.runtime as typeof browser.runtime & {
    requestUpdateCheck?: () => Promise<"update_available" | "no_update" | "throttled">;
  };

  if (browserRuntime.requestUpdateCheck) {
    const status = (await browserRuntime.requestUpdateCheck()) as unknown as
      | "update_available"
      | "no_update"
      | "throttled";
    return {
      status
    };
  }

  const openedUrl = await openExtensionUpdatePage("chrome");
  return {
    status: "manual",
    openedUrl
  };
}
