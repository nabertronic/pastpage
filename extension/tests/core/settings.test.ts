import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "@/core/settings";

describe("settings", () => {
  it("uses privacy-preserving defaults", () => {
    expect(DEFAULT_SETTINGS.openBehavior).toBe("new-tab-background");
    expect(DEFAULT_SETTINGS.providerMenuOpenBehavior).toBe("new-tab-foreground");
    expect(DEFAULT_SETTINGS.enabledProviders.length).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.enabledProviders).not.toContain("arquivo-pt");
    expect(DEFAULT_SETTINGS.enabledProviders).not.toContain("perma-cc");
    expect(DEFAULT_SETTINGS.archiveDisplayOrder).toEqual([
      "wayback",
      "archive-today",
      "ghostarchive",
      "yandex-cache",
      "uk-gov-web-archive",
      "loc-web-archives",
      "arquivo-pt",
      "web-gyotaku",
      "webcite",
      "perma-cc",
      "software-heritage"
    ]);
    expect(DEFAULT_SETTINGS.historyEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.popupArchiveListEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.waybackHost).toBe("web.archive.org");
    expect(DEFAULT_SETTINGS.archiveTodayHost).toBe("archive.ph");
    expect(DEFAULT_SETTINGS.urlMatchingMode).toBe("exact-then-cleaned");
    expect(DEFAULT_SETTINGS.providerTimeoutSeconds).toBe(60);
    expect(DEFAULT_SETTINGS.themeMode).toBe("dark");
    expect(DEFAULT_SETTINGS.badgeEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.bannerTheme).toBe("auto-contrast");
    expect(DEFAULT_SETTINGS.bannerColor).toBe("#11100c");
    expect(DEFAULT_SETTINGS.actionColor).toBe("#ffd400");
    expect(DEFAULT_SETTINGS.resolverSuccessBehavior).toBe("keep-resolver");
  });

  it("falls back when settings are invalid", () => {
    expect(parseSettings({ openBehavior: "bad" })).toEqual(DEFAULT_SETTINGS);
  });

  it("accepts custom banner and action colors", () => {
    expect(
      parseSettings({
        bannerTheme: "custom",
        bannerColor: "#123456",
        actionColor: "#abcdef"
      })
    ).toEqual({
      ...DEFAULT_SETTINGS,
      bannerTheme: "custom",
      bannerColor: "#123456",
      actionColor: "#abcdef"
    });
  });

  it("accepts the configured providerMenuOpenBehavior setting", () => {
    expect(parseSettings({ providerMenuOpenBehavior: "new-window" })).toEqual({
      ...DEFAULT_SETTINGS,
      providerMenuOpenBehavior: "new-window"
    });
  });

  it("accepts the configured popupArchiveListEnabled setting", () => {
    expect(parseSettings({ popupArchiveListEnabled: false })).toEqual({
      ...DEFAULT_SETTINGS,
      popupArchiveListEnabled: false
    });
  });

  it("accepts the configured historyEnabled setting", () => {
    expect(parseSettings({ historyEnabled: false })).toEqual({
      ...DEFAULT_SETTINGS,
      historyEnabled: false
    });
  });

  it("accepts the configured enabledProviders setting", () => {
    expect(parseSettings({ enabledProviders: ["wayback", "perma-cc"] })).toEqual({
      ...DEFAULT_SETTINGS,
      enabledProviders: ["wayback", "perma-cc"]
    });
  });

  it("accepts stored settings that explicitly enable Arquivo.pt", () => {
    expect(
      parseSettings({
        enabledProviders: ["wayback", "arquivo-pt", "perma-cc"],
        archiveDisplayOrder: ["arquivo-pt", "perma-cc", "wayback"]
      })
    ).toEqual({
      ...DEFAULT_SETTINGS,
      enabledProviders: ["wayback", "arquivo-pt", "perma-cc"],
      archiveDisplayOrder: ["arquivo-pt", "perma-cc", "wayback"]
    });
  });

  it("accepts the configured archive display order", () => {
    expect(parseSettings({ archiveDisplayOrder: ["perma-cc", "wayback"] })).toEqual({
      ...DEFAULT_SETTINGS,
      archiveDisplayOrder: ["perma-cc", "wayback"]
    });
  });

  it("accepts the configured showSearchEngineIcons setting", () => {
    expect(parseSettings({ showSearchEngineIcons: false })).toEqual({
      ...DEFAULT_SETTINGS,
      showSearchEngineIcons: false
    });
  });

  it("accepts the configured showContextMenuIcons setting", () => {
    expect(parseSettings({ showContextMenuIcons: false })).toEqual({
      ...DEFAULT_SETTINGS,
      showContextMenuIcons: false
    });
  });

  it("accepts the configured archive host settings", () => {
    expect(
      parseSettings({
        waybackHost: "web.archivep75mbjunhxc6x4j5mwjmomyxb573v42baldlqu56ruil2oiad.onion",
        archiveTodayHost: "archive.today"
      })
    ).toEqual({
      ...DEFAULT_SETTINGS,
      waybackHost: "web.archivep75mbjunhxc6x4j5mwjmomyxb573v42baldlqu56ruil2oiad.onion",
      archiveTodayHost: "archive.today"
    });
  });

  it("accepts the configured themeMode setting", () => {
    expect(parseSettings({ themeMode: "dark" })).toEqual({
      ...DEFAULT_SETTINGS,
      themeMode: "dark"
    });
  });

  it("accepts the expanded openBehavior setting", () => {
    expect(parseSettings({ openBehavior: "new-window" })).toEqual({
      ...DEFAULT_SETTINGS,
      openBehavior: "new-window"
    });
  });

  it("accepts the configured provider timeout in seconds", () => {
    expect(parseSettings({ providerTimeoutSeconds: 90 })).toEqual({
      ...DEFAULT_SETTINGS,
      providerTimeoutSeconds: 90
    });
  });

  it("falls back to the default provider timeout when the stored value is invalid", () => {
    expect(parseSettings({ providerTimeoutSeconds: 0 })).toEqual(DEFAULT_SETTINGS);
  });
});
