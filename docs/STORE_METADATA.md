# Store Metadata

Last updated: 2026-05-02

This document is the submission source of truth for the first public PastPage launch on Chrome Web Store and Firefox Add-ons.

## Product Positioning

PastPage helps people recover missing pages and changed pages by checking the Wayback Machine on `archive.org` and other relevant web archives from the page they are already viewing.

Core differentiators:

- built for broken-page and source-recovery workflows, not just manual archive search
- checks multiple relevant archives from one flow
- retries cleaned URLs when archived captures are stored under simpler addresses
- keeps settings and history local in the browser
- no tracking, analytics, or telemetry

## Chrome Web Store

### Title

`PastPage: Recover Missing Pages`

### Summary

`Recover missing pages with the Wayback Machine and other public web archives.`

### Detailed Description

`PastPage helps you recover missing pages, changed pages, and broken links without manually checking one archive after another. From the page you are already viewing, PastPage can search the Wayback Machine on archive.org and other relevant web archives to surface archived versions quickly.`

`It is especially useful when a page returns 404, disappears after publication, or changes after you cited it. PastPage can react to broken pages, retry cleaner versions of the same URL when needed, and keep alternative archives close at hand so you can verify what was previously published.`

`Key features`

- `Recover archived pages from the current tab, popup, or context menu.`
- `Check Wayback Machine and other relevant web archives from one flow.`
- `Retry cleaned URLs automatically when archives store simpler versions of a page address.`
- `Support broken-page recovery for 404, gone, legal-block, and common server or navigation failures.`
- `Keep settings and optional lookup history locally in the browser.`
- `No tracking. No analytics. No telemetry.`

### Single Purpose Statement

`PastPage helps users recover archived versions of missing or changed web pages by searching public web archives from the page, link, or URL they choose.`

### Permission Justifications

- `webRequest`
  Detect relevant main-frame HTTP error responses so PastPage can offer recovery only on recoverable page failures.
- `webNavigation`
  Detect recoverable navigation failures and keep the lookup flow tied to the affected tab.
- `storage`
  Save local settings, lightweight extension metadata, and optional local lookup history.
- `tabs`
  Read the current tab URL for user-triggered lookups and open archive results, settings, onboarding, and support pages.
- `scripting`
  Inject the recovery bar on eligible broken pages where extension UI can run.
- `contextMenus`
  Provide page, link, and selected-URL archive actions from the browser context menu.
- `host_permissions: http://*/*, https://*/*`
  Allow user-triggered archive lookup and broken-page detection across normal web pages regardless of site.

### Privacy Practices Answers

Data collected:

- browsing activity or website URLs: `Yes, but only the URL the user explicitly chooses to check`
- personal communications: `No`
- location: `No`
- health information: `No`
- financial information: `No`
- authentication information: `No`
- personally identifying information for a PastPage service: `No`
- web page content: `No`

How the data is used:

- to perform the user-requested archive lookup against public archive providers
- not sold
- not used for advertising
- not used for creditworthiness or lending decisions
- not shared with data brokers

Certifications:

- data use is limited to the user-facing archive-recovery functionality described in the listing and UI
- no unrelated transfer, sale, or advertising use
- privacy-policy URL must match the final published `docs/PRIVACY.md` URL

### Listing Status Notes

- Chrome listing URL is not live yet.
- Do not add a Chrome Web Store URL to the shipped extension until the item exists.

## Firefox Add-ons

### Summary

`Recover missing pages with Wayback Machine and other public web archives.`

### Description

`PastPage is a source-recovery extension for people who work with pages that disappear, move, or change. It helps you search the Wayback Machine on archive.org and other relevant web archives from the page you are already on, so you can find archived versions faster.`

`PastPage is especially useful for research, journalism, fact-checking, investigations, and careful citation work. It can react to broken pages, search multiple archives, retry cleaned URLs automatically, and surface archive sources that make sense for government pages or repository URLs.`

`Key features`

- `Recover archived pages from the toolbar, popup, or context menu.`
- `Search the Wayback Machine and other web archives from one flow.`
- `Find archived versions when a source changed after publication.`
- `Help with 404 pages and other recoverable load failures.`
- `Keep archive lookups local until the user explicitly starts them.`
- `No tracking. No analytics. No telemetry.`

### Suggested Tags

- `web archive`
- `research`
- `journalism`
- `fact checking`
- `history`

### Firefox Submission Notes

- Manifest includes `browser_specific_settings.gecko.id`.
- Manifest includes `browser_specific_settings.gecko.data_collection_permissions.required = ["none"]`.
- Listing URL is not live yet and should be filled in only after AMO creates the public page.

## Media Checklist

### Chrome

- required extension icon in package: present
- at least one screenshot: prepare from release build
- 440x280 promo tile: prepare from release assets

### Firefox

- screenshots should show the extension clearly in English
- preferred set:
  - popup manual lookup
  - broken-page recovery bar or fallback page
  - resolver results
  - options page showing privacy-first settings

## Submission Links

- Privacy policy: <https://github.com/nabertronic/pastpage/blob/main/docs/PRIVACY.md>
- Support: <https://github.com/nabertronic/pastpage/blob/main/docs/SUPPORT.md>
- Reviewer notes: <https://github.com/nabertronic/pastpage/blob/main/docs/REVIEW_NOTES.md>
- Firefox source notes: <https://github.com/nabertronic/pastpage/blob/main/docs/FIREFOX_SOURCE_PACKAGE.md>
