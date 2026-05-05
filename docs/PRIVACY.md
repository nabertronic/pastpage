# Privacy Policy

Last updated: 2026-05-02

PastPage is a browser extension for recovering missing or changed web pages through public web archives.

This policy explains what PastPage stores locally, when data leaves the browser, and what does not happen at all.

## Operator

PastPage is maintained by Alexander Nabert.

- Contact email: `nabert@pm.me`
- Project repository: <https://github.com/nabertronic/pastpage>
- Support page: <https://github.com/nabertronic/pastpage/blob/main/docs/SUPPORT.md>

## Core Privacy Position

PastPage is designed around a simple rule:

`No tracking. No analytics. No telemetry.`

PastPage does not run its own backend service. It does not create user accounts, does not sync data to a PastPage server, and does not use remote configuration or advertising technology.

## What PastPage Does Locally

PastPage performs these functions locally in the browser:

- detects certain recoverable main-frame page failures, such as `404`, `410`, `451`, and selected `5xx` responses
- detects certain recoverable navigation failures, such as DNS, timeout, connection, and certificate-related errors
- checks whether the current tab is eligible for archive lookup
- cleans URLs for archive lookup when the selected matching mode allows it
- stores user settings and, if enabled, local lookup history

These checks happen on the device and are not sent to a PastPage-operated server.

## When Data Leaves The Browser

PastPage sends a URL to third-party archive providers only when the user explicitly starts an archive lookup or explicitly opens a provider action.

Examples of user-triggered actions include:

- clicking the recovery bar on a broken page
- starting a lookup from the popup
- using the context menu for a page, link, or selected URL
- choosing a provider-specific action
- using the action to open all enabled archives

During a lookup, PastPage may contact more than one enabled archive provider for the same URL so it can compare available matches and present the best result.

## What PastPage Sends

When the user starts a lookup, PastPage may send:

- the URL the user chose to check
- minimal query parameters required by the selected archive provider

PastPage does not send:

- page contents
- form entries
- passwords
- cookies on behalf of a PastPage server
- complete browsing history exports
- analytics identifiers created by PastPage
- account profiles for a PastPage service

## Third-Party Recipients

Depending on user settings, URL type, and chosen action, lookups may contact public archive services such as:

- Wayback Machine
- Archive.today mirrors
- Ghostarchive
- Arquivo.pt
- UK Government Web Archive
- Library of Congress Web Archives
- Perma.cc
- Megalodon/Web Gyotaku
- WebCite
- Software Heritage
- Yandex Cache

Each archive provider operates under its own terms and privacy practices.

## Local Storage

PastPage stores data in `browser.storage.local`.

### Settings

`pastPage.settings` stores preferences such as:

- enabled providers
- provider order
- URL matching mode
- open behavior
- language and theme
- badge and UI preferences
- ignored domains

### Local Metadata

`pastPage.meta` stores small extension-state markers such as:

- first successful archive open timing
- local search-count milestones
- review-prompt timing

### Optional Lookup History

If history is enabled, `pastPage.history` may store records such as:

- target URL
- lookup start and finish times
- trigger type
- attempted providers
- whether a hit was found
- returned archive snapshots
- provider failures or misses

## Retention And User Control

PastPage stores data locally until the user removes it.

Users can:

- change settings at any time
- disable future history writing
- clear saved history from the extension UI
- remove the extension to delete extension-managed local data according to browser behavior

PastPage does not retain a separate server-side copy because PastPage does not run its own backend.

## Permissions And Scope

PastPage requests browser permissions needed to:

- detect relevant page failures
- start lookups from the current tab
- inject its recovery UI on eligible pages
- save local settings and history
- provide context menu actions

PastPage is not designed to collect or monetize browsing activity. Any transmitted URL is used only to perform the archive action the user requested.

## Firefox Data Collection Declaration

For Firefox distribution, the manifest declares:

`browser_specific_settings.gecko.data_collection_permissions.required = ["none"]`

This reflects that PastPage does not collect and transmit data for storage or processing outside the extension except user-initiated requests sent directly to third-party archive providers to perform the requested lookup.

## Children

PastPage is a general-purpose productivity and research tool. It is not directed to children.

## Changes To This Policy

If PastPage privacy behavior changes, this policy will be updated and the new version will be published at this URL.

## Contact

Questions about this policy can be sent to `nabert@pm.me`.
