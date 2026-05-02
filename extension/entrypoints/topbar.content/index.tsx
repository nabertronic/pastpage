import "../../src/styles/topbar.css";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { TopBar } from "../../src/components/TopBar";
import { createBrokenPageLookupRequest } from "../../src/core/lookupRequest";
import type { TabState } from "../../src/core/tabState";
import { DEFAULT_SETTINGS, type Settings } from "../../src/core/settings";
import { supportsOverlayUi } from "../../src/platform/htmlDocument";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  cssInjectionMode: "ui",
  async main(ctx) {
    if (!supportsOverlayUi(document)) {
      return;
    }

    const TOPBAR_SPACER_ID = "past-page-topbar-spacer";
    let root: Root | null = null;
    let ui: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;
    let spacer: HTMLDivElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let currentState: TabState = { status: "idle" };
    let settings: Settings = DEFAULT_SETTINGS;

    function withoutHash(rawUrl: string) {
      try {
        const parsed = new URL(rawUrl);
        parsed.hash = "";
        return parsed.toString();
      } catch {
        return rawUrl;
      }
    }

    function shouldRender(state: TabState) {
      const currentUrl = withoutHash(window.location.href);
      return (
        state.status === "broken" &&
        state.error.kind === "http" &&
        withoutHash(state.error.originalUrl) === currentUrl &&
        withoutHash(state.dismissedForUrl ?? "") !== currentUrl
      );
    }

    async function ensureUi() {
      if (ui) return ui;
      ui = await createShadowRootUi(ctx, {
        name: "past-page-topbar",
        position: "overlay",
        zIndex: 2147483647,
        anchor: "body",
        append: "first",
        onMount(container) {
          root = createRoot(container);
          return root;
        },
        onRemove(mountedRoot) {
          mountedRoot?.unmount();
          resizeObserver?.disconnect();
          resizeObserver = null;
          spacer?.remove();
          spacer = null;
          root = null;
        }
      });
      ui.mount();
      return ui;
    }

    function ensureSpacer() {
      if (spacer?.isConnected) return spacer;
      const existing = document.getElementById(TOPBAR_SPACER_ID);
      if (existing instanceof HTMLDivElement) {
        spacer = existing;
        return spacer;
      }

      spacer = document.createElement("div");
      spacer.id = TOPBAR_SPACER_ID;
      spacer.setAttribute("aria-hidden", "true");
      spacer.style.display = "block";
      spacer.style.width = "100%";
      spacer.style.height = "0";
      spacer.style.margin = "0";
      spacer.style.padding = "0";
      spacer.style.border = "0";
      spacer.style.pointerEvents = "none";
      document.body.prepend(spacer);
      return spacer;
    }

    function syncSpacerHeight() {
      if (!ui) return;
      const nextSpacer = ensureSpacer();
      nextSpacer.style.height = `${Math.ceil(ui.shadowHost.getBoundingClientRect().height)}px`;
    }

    function ensureResizeObserver() {
      if (!ui || resizeObserver) return;
      resizeObserver = new ResizeObserver(() => {
        syncSpacerHeight();
      });
      resizeObserver.observe(ui.shadowHost);
    }

    async function render(state: TabState) {
      currentState = state;

      if (!shouldRender(state)) {
        if (ui) {
          ui.remove();
          ui = null;
        }
        spacer?.remove();
        spacer = null;
        resizeObserver?.disconnect();
        resizeObserver = null;
        return;
      }

      if (state.status !== "broken") return;
      const error = state.error;

      await ensureUi();
      ensureResizeObserver();
      syncSpacerHeight();

      root?.render(
        <TopBar
          error={error}
          settings={settings}
          onFind={() => {
            void browser.runtime.sendMessage({
              type: "START_RESOLVER",
              request: createBrokenPageLookupRequest(error),
              historyTrigger: "broken-page"
            });
          }}
          onDismiss={() => {
            void browser.runtime
              .sendMessage({ type: "DISMISS_TOPBAR", url: error.originalUrl })
              .then(() => render({ ...state, dismissedForUrl: error.originalUrl }));
          }}
        />
      );
    }

    browser.runtime.onMessage.addListener((message) => {
      if (message?.type === "STATE_UPDATED") {
        void render(message.state);
      }
    });

    const response = await browser.runtime.sendMessage({ type: "GET_TAB_STATE" }).catch(() => undefined);
    const settingsResponse = await browser.runtime.sendMessage({ type: "GET_SETTINGS" }).catch(() => undefined);
    settings = settingsResponse?.settings ?? DEFAULT_SETTINGS;
    await render(response?.state ?? currentState);
  }
});
