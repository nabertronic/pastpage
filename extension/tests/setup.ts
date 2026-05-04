import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined)
  },
  writable: true,
  configurable: true
});

Object.defineProperty(globalThis, "browser", {
  value: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined)
      }
    },
    runtime: {
      onInstalled: {
        addListener: vi.fn()
      },
      onMessage: {
        addListener: vi.fn()
      },
      getManifest: vi.fn(() => ({ version: "1.0.1" })),
      requestUpdateCheck: vi.fn().mockResolvedValue("no_update"),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      getURL: vi.fn((path: string) => `moz-extension://test/${path}`),
      openOptionsPage: vi.fn().mockResolvedValue(undefined)
    },
    commands: {
      onCommand: {
        addListener: vi.fn()
      },
      openShortcutSettings: vi.fn().mockResolvedValue(undefined)
    },
    i18n: {
      getUILanguage: vi.fn(() => "en-US"),
      getMessage: vi.fn((key: string) => key)
    },
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 1 }]),
      get: vi.fn().mockResolvedValue({ id: 1, active: true, url: "https://example.com" }),
      create: vi.fn().mockResolvedValue({ id: 2 }),
      update: vi.fn().mockResolvedValue({ id: 1 }),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      onActivated: {
        addListener: vi.fn()
      },
      onRemoved: {
        addListener: vi.fn()
      }
    },
    windows: {
      create: vi.fn().mockResolvedValue({ id: 1 })
    },
    webRequest: {
      onCompleted: {
        addListener: vi.fn()
      },
      onErrorOccurred: {
        addListener: vi.fn()
      }
    },
    contextMenus: {
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn((_, __, callback) => callback?.()),
      refresh: vi.fn(),
      removeAll: vi.fn().mockResolvedValue(undefined),
      onClicked: {
        addListener: vi.fn()
      },
      onShown: {
        addListener: vi.fn()
      }
    },
    action: {
      setBadgeText: vi.fn().mockResolvedValue(undefined),
      setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      setBadgeTextColor: vi.fn().mockResolvedValue(undefined)
    },
    browserAction: {
      setBadgeText: vi.fn().mockResolvedValue(undefined),
      setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      setBadgeTextColor: vi.fn().mockResolvedValue(undefined)
    }
  },
  writable: true
});
