import type { WhatsNewEntry } from "../core/whatsNew";

// This file is generated from docs/CHANGELOG.md by extension/scripts/generate-changelog.mjs.
export const WHATS_NEW_ENTRIES: WhatsNewEntry[] = [
  {
    "version": "v1.0.11",
    "changes": [
      "Automatic broken-page help now recognizes Cloudflare verification and challenge pages across arbitrary domains from Cloudflare's dedicated response marker, so Turnstile-style security checks are no longer mistaken for offline or broken pages.",
      "Completed the localized History interface in French, Spanish, Italian, Polish, Portuguese, and Ukrainian, including selection, deletion, export, sorting, view, preset, rerun, and result-detail controls.",
      "Added automated accessibility checks for resolver progress, live archive results, and History bulk actions, plus accessible bulk-confirmation dialogs with trapped focus, Escape handling, and focus restoration.",
      "Added a bounded URL-variant fallback after primary archive misses, covering HTTP/HTTPS, with/without `www`, and trailing-slash combinations while sharing one timeout window and stopping after the first variant hit per provider."
    ]
  },
  {
    "version": "v1.0.10",
    "changes": [
      "New archive providers: `Government of Canada Web Archive` for `gc.ca` and `canada.ca` URLs, `Icelandic Web Archive / Vefsafn` for `.is` URLs, `NTU Web Archiving System / NTUWAS` for `.tw` URLs, and `PADICAT / Web Archive of Catalonia` for `.cat` URLs; each includes automatic resolver lookups, direct links, settings support, and matching provider icons.",
      "Automatic broken-page help now also appears on `403 Forbidden` pages, using the same recovery banner flow as other supported HTTP error pages.",
      "Cleaned archive lookups now also try a query-free canonical URL after removing known tracking, referrer, and sensitive parameters, and providers keep checking cleaned variants after an original-URL hit.",
      "Manual follow-up archive source cards now include a `Check cleaned URL` link whenever the original URL had query parameters, so each provider can be checked against the query-free URL too.",
      "The resolver can now display multiple archived matches from the same archive provider.",
      "Arquivo.pt is now enabled by default and its direct provider action opens Arquivo.pt's page-versions UI with a cleaned host/path query instead of the older full-URL `page/search` link.",
      "Replaced the Arquivo.pt provider icon with a cleaner symbol-only mark based on Arquivo.pt's official site artwork."
    ]
  },
  {
    "version": "v1.0.9",
    "changes": [
      "Archive lookups are now more reliable on difficult services such as `Archive.today`, `Perma.cc`, and `WebCite`: PastPage checks original and cleaned URLs more carefully per provider, with separate time limits for querying and replay validation, which reduces rate-limit issues, session mix-ups, and missed fallback checks.",
      "Snapshot confirmation is now more accurate across automatic archives, so confirmed results are less likely to be challenge pages or broken replays. This also fixes `Archive.today` choosing impossible future-dated captures and accepts equivalent archive redirects such as `http` to `https` on the same snapshot.",
      "When an archive rate-limits, times out, or shows a challenge page, PastPage now stops retrying that provider sooner, falls back to manual follow-up faster, and explains the issue more clearly in resolver badges and unverified result cards with details such as `Retry-After`, `challenge page`, `query timeout`, or `replay timeout`.",
      "Lookup runs are now more stable overall: PastPage waits for your saved settings before starting, so a lookup no longer launches a duplicate second round of archive checks when your configuration differs from the defaults.",
      "Local history is now more reliable during simultaneous lookups. Opening several archives at once no longer overwrites, truncates, or quietly drops saved entries, and the History page refreshes more consistently after history or settings changes.",
      "Resolver results are easier to scan when several archives respond, with a more consistent multi-archive result layout instead of splitting one top result away from the rest.",
      "Cleaned fallback URL checks now remove more tracking and sensitive parameters without changing exact URL searches, and domains such as `fda.gov`, `fcc.gov`, or `fdic.gov` are no longer misread as private network addresses.",
      "Updated localization and release copy across the resolver, onboarding, footer, and `What's new` page. New installations now also open `What's new`, and Firefox pinning guidance uses Mozilla's actual extensions icon."
    ]
  },
  {
    "version": "v1.0.8",
    "changes": [
      "Added per-entry deletion and multi-select bulk deletion on the local history page, so saved lookup runs can now be removed individually or in batches.",
      "Split the history CSV export into a full-history download and a filtered-results download, with the filtered export action shown only while filters are active.",
      "Reworked history CSV snapshot columns to group results by archive provider, so each provider now gets its own timestamp and URL columns instead of packing multiple snapshots into shared fields.",
      "Expanded the history page into a more capable work view with saved filter presets, sortable results, compact and detailed entry modes, plus new bulk actions for exporting or rerunning selected entries.",
      "Upgraded history CSV exports with UTF-8 BOM, export metadata, repeated provider snapshot columns, and structured per-provider failure and checked-attempt fields for easier spreadsheet analysis.",
      "Changed history reruns to create fresh history entries before reopening the resolver, so repeated checks are now tracked as separate lookup runs instead of disappearing from the saved history."
    ]
  },
  {
    "version": "v1.0.7",
    "changes": [
      "Added a `What's new` page that opens after updates and is also available from Settings.",
      "Refined the light theme surfaces so resolver cards, settings panels, history sections, and related controls now use clearer but calmer contrast instead of blending into white-on-white layouts.",
      "New installations now use `Browser default` as the theme, so PastPage follows the browser appearance unless you choose a fixed light or dark theme.",
      "Manual archive links now show clearer failure reasons, including `Not Found`, `Timeout`, `Service Error`, and `Too Many Requests`, with short explanations when automatic checking could not finish.",
      "The default result behavior is now `Only show results in the lookup page`, so archive hits are not opened automatically unless you want that.",
      "The result-opening options were renamed to make the differences clearer: only show results, open automatically and keep the lookup page open, or open automatically in the lookup tab.",
      "Archive lookups now use the first confirmed hit as soon as it is ready instead of effectively favoring Wayback by waiting longer.",
      "Provider-reported snapshots can now appear earlier as unverified results and are upgraded automatically if PastPage confirms them a moment later.",
      "While archive checks are still running, completed provider outcomes now appear in the resolver immediately instead of waiting for the slowest remaining provider to finish first.",
      "Manual follow-up sources now stay visible incrementally during ongoing lookups, and `Yandex Cache` is always listed first among the sources to verify manually.",
      "The default timeout per archive provider was reduced from 60 seconds to 30 seconds so slow services block the final result for less time.",
      "When PastPage also tries a cleaned URL fallback, those checks now run in parallel instead of one after another, which makes these lookups feel faster.",
      "Automatic broken-page help now appears only for real website error pages, not for local connection problems like DNS, timeout, or certificate errors.",
      "Automatic broken-page help can now be paused for 1 hour or 24 hours, resumed later, or turned off completely in Settings.",
      "Fixed WebCite automatic lookups so they no longer trust stale topframe.php session data and therefore stop surfacing unrelated captures when WebCite's direct URL query actually has no snapshot for the requested page."
    ]
  },
  {
    "version": "v1.0.6",
    "changes": [
      "Simplified the onboarding flow around the two primary actions, removed the duplicated lead card, and tightened the German onboarding copy to use clearer archive-search wording.",
      "Added the same simplified onboarding flow and dedicated localized copy for Italian, Polish, Portuguese, and Ukrainian instead of falling back to English.",
      "Corrected the onboarding pinning copy in all supported onboarding languages so it consistently refers to the toolbar instead of the address bar.",
      "Replaced the generic onboarding puzzle icon with the actual browser-specific extensions icon, so Chrome/Chromium and Firefox now each show the symbol users see in their own browser UI.",
      "Unified resolver follow-up action styling so manual archive providers now always use bordered check buttons, archive-copy buttons match the yellow action-link treatment, and the not-found action order now shows `Open current page` before `Copy original URL`.",
      "Changed the default archive-search tab behavior to open new tabs in the foreground, while keeping the setting configurable so users can switch it back to background tabs or another open mode."
    ]
  },
  {
    "version": "v1.0.5",
    "changes": [
      "Added durable automatic WebCite resolver support, so PastPage now checks WebCite alongside the other automatic archives instead of exposing it only as a manual follow-up source.",
      "Kept the direct WebCite popup and context-menu action, while also letting automatic lookups surface confirmed or unverified WebCite captures in resolver results.",
      "Hardened WebCite capture handling around its legacy frameset flow by parsing capture lists, skipping failed saves, and verifying the archived main-frame HTML before treating a hit as confirmed.",
      "Added a `Do not open automatically` resolver setting, so PastPage can keep the resolver open without auto-opening confirmed or unverified archive hits and let users choose results manually.",
      "Removed the unused `webNavigation` and `scripting` extension permissions to satisfy Chrome Web Store review requirements and keep the manifest aligned with the shipped feature set."
    ]
  },
  {
    "version": "v1.0.4",
    "changes": [
      "Added an `Export CSV` action below the history list so the currently filtered local history can be downloaded as a CSV file.",
      "Added support for unverified archive candidates across automatic providers, so provider-reported snapshot URLs are now shown in the resolver even when PastPage cannot automatically verify the replay page.",
      "Updated mixed resolver results so confirmed snapshots stay first and any unverified candidates are listed after them instead of being dropped.",
      "Revised resolver copy in all supported languages to distinguish between `could not confirm automatically` and `no archive exists`, and to guide users toward manual verification when needed.",
      "Added an explicit resolver progress phase for snapshot verification, so status text can now show steps like checking a provider first and verifying a reported snapshot afterward.",
      "Hid `original URL` / strategy wording in resolver status and not-found copy when the lookup runs in exact-only mode, while keeping it visible when cleaned-URL fallback is actually in play."
    ]
  },
  {
    "version": "v1.0.3",
    "changes": [
      "Renamed the local history page entry point to `archive-history` so Chrome and Firefox use the same regular extension page instead of relying on a browser-history override that Firefox does not support.",
      "Added an explicit PNG favicon to all extension tabs so Firefox reliably shows the PastPage tab icon across popup-adjacent pages like settings, resolver, onboarding, and history.",
      "Simplified the Firefox update area in settings so it now shows only a single `Check for updates` button that opens the Firefox Add-ons listing directly, removing the redundant extra listing link and explanatory fallback copy."
    ]
  },
  {
    "version": "v1.0.2",
    "changes": [
      "Removed the broken Archive-It provider and all related direct-link surfaces, icons, and tests.",
      "Limited automatic Arquivo.pt checks to Portuguese domains.",
      "Added a central per-provider timeout, defaulting to 60 seconds and configurable down to the second in settings.",
      "Renamed Web Gyotaku to Megalodon across the UI and docs, while keeping `Megalodon/Web Gyotaku` as the visible archive label outside the popup and context menu.",
      "Added automatic Software Heritage resolver support for repository URLs and supported code pages.",
      "Adjusted the first thanks-page view to use first-time wording instead of repeat/milestone copy, and removed the awkward 1 searches phrasing.",
      "Updated Perma.cc so automatic hits now come only from the public Perma.cc API, while manual popup/context-menu actions open a provider-scoped resolver lookup instead of sending users to the generic Perma.cc landing page.",
      "Updated the resolver copy for provider-scoped Perma.cc lookups so the page clearly says that only Perma.cc is being checked, rather than implying that all archive providers were searched.",
      "Moved Perma.cc behind Megalodon and WebCite in the popup and context menu, and disabled it by default; it can still be re-enabled in the settings."
    ]
  },
  {
    "version": "v1.0.1",
    "changes": [
      "Added live links to the Chrome Web Store and Firefox Add-ons store listing in the extension and repository documentation."
    ]
  }
];
