import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, isBrokenPageAssistActive, parseSettings } from "@/core/settings";

describe("settings", () => {
  it("uses privacy-preserving defaults", () => {
    expect(DEFAULT_SETTINGS.openBehavior).toBe("new-tab-foreground");
    expect(DEFAULT_SETTINGS.providerMenuOpenBehavior).toBe("new-tab-foreground");
    expect(DEFAULT_SETTINGS.brokenPageAssistEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.enabledProviders.length).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.enabledProviders).toContain("arquivo-pt");
    expect(DEFAULT_SETTINGS.enabledProviders).not.toContain("perma-cc");
    expect(DEFAULT_SETTINGS.archiveDisplayOrder).toEqual([
      "wayback",
      "archive-today",
      "ghostarchive",
      "webcite",
      "uk-gov-web-archive",
      "loc-web-archives",
      "canada-gov-web-archive",
      "vefsafn",
      "ntuwas",
      "padicat",
      "arquivo-pt",
      "web-gyotaku",
      "yandex-cache",
      "perma-cc",
      "software-heritage"
    ]);
    expect(DEFAULT_SETTINGS.historyEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.popupArchiveListEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.waybackHost).toBe("web.archive.org");
    expect(DEFAULT_SETTINGS.archiveTodayHost).toBe("archive.ph");
    expect(DEFAULT_SETTINGS.urlMatchingMode).toBe("exact-then-cleaned");
    expect(DEFAULT_SETTINGS.providerTimeoutSeconds).toBe(30);
    expect(DEFAULT_SETTINGS.themeMode).toBe("browser");
    expect(DEFAULT_SETTINGS.badgeEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.bannerTheme).toBe("auto-contrast");
    expect(DEFAULT_SETTINGS.bannerColor).toBe("#11100c");
    expect(DEFAULT_SETTINGS.actionColor).toBe("#ffd400");
    expect(DEFAULT_SETTINGS.resolverSuccessBehavior).toBe("manual-open-only");
  });

  it("falls back when settings are invalid", () => {
    expect(parseSettings({ openBehavior: "bad" })).toEqual(DEFAULT_SETTINGS);
  });

  it("normalizes the obsolete cleaned-first URL matching mode to the parallel fallback mode", () => {
    expect(parseSettings({ urlMatchingMode: "cleaned-first" })).toEqual({
      ...DEFAULT_SETTINGS,
      urlMatchingMode: "exact-then-cleaned"
    });
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

  it("accepts a stored broken-page snooze timestamp", () => {
    expect(parseSettings({ brokenPageAssistSnoozedUntil: 1234567890 })).toEqual({
      ...DEFAULT_SETTINGS,
      brokenPageAssistSnoozedUntil: 1234567890
    });
  });

  it("ignores invalid broken-page snooze timestamps", () => {
    expect(parseSettings({ brokenPageAssistSnoozedUntil: -1 })).toEqual(DEFAULT_SETTINGS);
  });

  it("treats expired snooze timestamps as active", () => {
    expect(
      isBrokenPageAssistActive(
        {
          ...DEFAULT_SETTINGS,
          brokenPageAssistSnoozedUntil: 5
        },
        10
      )
    ).toBe(true);
  });

  it("preserves configured enabled providers", () => {
    const settings = parseSettings({ enabledProviders: ["wayback", "perma-cc"] });

    expect(settings.enabledProviders).toEqual(["wayback", "perma-cc"]);
    expect(settings.enabledProviders).not.toContain("arquivo-pt");
  });

  it("accepts stored settings that explicitly enable Arquivo.pt", () => {
    const settings = parseSettings({
      enabledProviders: ["wayback", "arquivo-pt", "perma-cc"],
      archiveDisplayOrder: ["arquivo-pt", "perma-cc", "wayback"]
    });

    expect(settings.enabledProviders).toEqual(
      expect.arrayContaining([
        ...DEFAULT_SETTINGS.enabledProviders,
        "arquivo-pt",
        "perma-cc"
      ])
    );
    expect(settings.archiveDisplayOrder).toEqual([
      "arquivo-pt",
      "perma-cc",
      "wayback",
      "archive-today",
      "ghostarchive",
      "webcite",
      "uk-gov-web-archive",
      "loc-web-archives",
      "canada-gov-web-archive",
      "vefsafn",
      "ntuwas",
      "padicat",
      "web-gyotaku",
      "yandex-cache",
      "software-heritage"
    ]);
  });

  it("preserves configured archive display order and inserts missing providers", () => {
    expect(parseSettings({ archiveDisplayOrder: ["perma-cc", "wayback"] })).toEqual({
      ...DEFAULT_SETTINGS,
      archiveDisplayOrder: [
        "perma-cc",
        "wayback",
        "archive-today",
        "ghostarchive",
        "webcite",
        "uk-gov-web-archive",
        "loc-web-archives",
        "canada-gov-web-archive",
        "vefsafn",
        "ntuwas",
        "padicat",
        "arquivo-pt",
        "web-gyotaku",
        "yandex-cache",
        "software-heritage"
      ]
    });
  });

  it("adds newly shipped archive providers to a legacy saved archive list", () => {
    const settings = parseSettings({
      enabledProviders: [
        "wayback",
        "archive-today",
        "ghostarchive",
        "webcite",
        "uk-gov-web-archive",
        "loc-web-archives",
        "web-gyotaku",
        "yandex-cache",
        "software-heritage"
      ],
      archiveDisplayOrder: [
        "wayback",
        "archive-today",
        "ghostarchive",
        "webcite",
        "uk-gov-web-archive",
        "loc-web-archives",
        "arquivo-pt",
        "web-gyotaku",
        "yandex-cache",
        "perma-cc",
        "software-heritage"
      ]
    });

    expect(settings.enabledProviders).toEqual(expect.arrayContaining(DEFAULT_SETTINGS.enabledProviders));
    expect(settings.enabledProviders).toContain("arquivo-pt");
    expect(settings.enabledProviders).not.toContain("perma-cc");
    expect(settings.archiveDisplayOrder).toEqual([
      "wayback",
      "archive-today",
      "ghostarchive",
      "webcite",
      "uk-gov-web-archive",
      "loc-web-archives",
      "canada-gov-web-archive",
      "vefsafn",
      "ntuwas",
      "padicat",
      "arquivo-pt",
      "web-gyotaku",
      "yandex-cache",
      "perma-cc",
      "software-heritage"
    ]);
  });

  it("accepts stored history filter presets", () => {
    expect(
      parseSettings({
        historyFilterPresets: [
          {
            id: "preset_1",
            name: "Hits",
            query: "example",
            outcomeFilter: "hit",
            triggerFilter: "all",
            providerFilter: "wayback",
            dateFrom: "2026-01-01",
            dateTo: "2026-01-31"
          }
        ]
      })
    ).toEqual({
      ...DEFAULT_SETTINGS,
      historyFilterPresets: [
        {
          id: "preset_1",
          name: "Hits",
          query: "example",
          outcomeFilter: "hit",
          triggerFilter: "all",
          providerFilter: "wayback",
          dateFrom: "2026-01-01",
          dateTo: "2026-01-31"
        }
      ]
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

  it("accepts the configured resolver success behavior", () => {
    expect(parseSettings({ resolverSuccessBehavior: "manual-open-only" })).toEqual({
      ...DEFAULT_SETTINGS,
      resolverSuccessBehavior: "manual-open-only"
    });
  });

  it("accepts the configured resolver success behavior", () => {
    expect(parseSettings({ resolverSuccessBehavior: "manual-open-only" })).toEqual({
      ...DEFAULT_SETTINGS,
      resolverSuccessBehavior: "manual-open-only"
    });
  });

  it("falls back to the default provider timeout when the stored value is invalid", () => {
    expect(parseSettings({ providerTimeoutSeconds: 0 })).toEqual(DEFAULT_SETTINGS);
  });
});
