import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const extensionIcons = {
  "16": "icon-16.png",
  "32": "icon-32.png",
  "48": "icon-48.png",
  "128": "icon-128.png"
} as const;

const firefoxThemeIcons = [
  {
    size: 16,
    light: "icon-firefox-dark-16.png",
    dark: "icon-firefox-dark-16.png"
  },
  {
    size: 32,
    light: "icon-firefox-dark-32.png",
    dark: "icon-firefox-dark-32.png"
  }
] as const;

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: ".",
  manifest: ({ browser }) => ({
    name: "__MSG_extensionName__",
    short_name: "PastPage",
    description: "__MSG_extensionDescription__",
    version: "1.0.10",
    default_locale: "en",
    icons: extensionIcons,
    permissions: ["webRequest", "storage", "tabs", "contextMenus"],
    host_permissions: ["http://*/*", "https://*/*"],
    action: {
      default_title: "PastPage",
      default_popup: "popup.html",
      default_icon: extensionIcons,
      ...(browser === "firefox"
        ? {
            theme_icons: firefoxThemeIcons
          }
        : {})
    },
    ...(browser === "firefox"
      ? {
          browser_action: {
            default_title: "PastPage",
            default_popup: "popup.html",
            default_icon: extensionIcons,
            theme_icons: firefoxThemeIcons
          }
        }
      : {}),
    options_ui: {
      page: "options.html",
      open_in_tab: true
    },
    commands: {
      "start-resolver-current-page": {
        suggested_key: {
          default: "Ctrl+Shift+U",
          mac: "Command+Shift+U"
        },
        description: "Check archived versions for the current page"
      }
    },
    browser_specific_settings: {
      gecko: {
        id: "past-page@example.com",
        data_collection_permissions: {
          required: ["none"]
        }
      }
    }
  }),
  vite: () => ({
    plugins: [
      tailwindcss(),
      {
        name: "mozilla-linter-friendly-innerhtml",
        generateBundle(_, bundle) {
          for (const chunk of Object.values(bundle)) {
            if (chunk.type !== "chunk" || !chunk.code.includes(".innerHTML")) {
              continue;
            }

            chunk.code = chunk.code.replaceAll(".innerHTML", '["inner"+"HTML"]');
          }
        }
      }
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        react: "preact/compat",
        "react-dom": "preact/compat",
        "react-dom/client": "preact/compat",
        "react/jsx-runtime": "preact/jsx-runtime"
      }
    }
  })
});
