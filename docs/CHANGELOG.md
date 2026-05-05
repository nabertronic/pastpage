# Changelog

## v1.0.3

- Renamed the local history page entry point to `archive-history` so Chrome and Firefox use the same regular extension page instead of relying on a browser-history override that Firefox does not support.
- Added an explicit PNG favicon to all extension tabs so Firefox reliably shows the PastPage tab icon across popup-adjacent pages like settings, resolver, onboarding, and history.
- Simplified the Firefox update area in settings so it now shows only a single `Check for updates` button that opens the Firefox Add-ons listing directly, removing the redundant extra listing link and explanatory fallback copy.

## v1.0.2

- Removed the broken Archive-It provider and all related direct-link surfaces, icons, and tests.
- Limited automatic Arquivo.pt checks to Portuguese domains.
- Added a central per-provider timeout, defaulting to 60 seconds and configurable down to the second in settings.
- Renamed Web Gyotaku to Megalodon across the UI and docs, while keeping `Megalodon/Web Gyotaku` as the visible archive label outside the popup and context menu.
- Added automatic Software Heritage resolver support for repository URLs and supported code pages.
- Adjusted the first thanks-page view to use first-time wording instead of repeat/milestone copy, and removed the awkward `1 searches` phrasing.
- Updated Perma.cc so automatic hits now come only from the public Perma.cc API, while manual popup/context-menu actions open a provider-scoped resolver lookup instead of sending users to the generic Perma.cc landing page.
- Updated the resolver copy for provider-scoped Perma.cc lookups so the page clearly says that only Perma.cc is being checked, rather than implying that all archive providers were searched.
- Moved Perma.cc behind Megalodon and WebCite in the popup and context menu, and disabled it by default; it can still be re-enabled in the settings.

## v1.0.1

- Added live links to the Chrome Web Store and Firefox Add-ons store listing in the extension and repository documentation.
