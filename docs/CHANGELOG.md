# Changelog

## v1.0.4

- Added an `Export CSV` action below the history list so the currently filtered local history can be downloaded as a CSV file.
- Added support for unverified archive candidates across automatic providers, so provider-reported snapshot URLs are now shown in the resolver even when PastPage cannot automatically verify the replay page.
- Updated mixed resolver results so confirmed snapshots stay first and any unverified candidates are listed after them instead of being dropped.
- Revised resolver copy in all supported languages to distinguish between `could not confirm automatically` and `no archive exists`, and to guide users toward manual verification when needed.
- Added an explicit resolver progress phase for snapshot verification, so status text can now show steps like checking a provider first and verifying a reported snapshot afterward.
- Hid `original URL` / strategy wording in resolver status and not-found copy when the lookup runs in `exact-only` mode, while keeping it visible when cleaned-URL fallback is actually in play.

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
