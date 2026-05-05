# Architecture

PastPage is a WXT-based WebExtension built with TypeScript, React, and Tailwind CSS.

## Product Model

PastPage is a client-side source-recovery extension. It detects recoverable failures locally, opens a resolver flow on user action, queries relevant archive providers, and keeps the results in local browser storage.

The product is centered around three ideas:

- local-first broken-page detection
- multi-provider archive recovery
- privacy-preserving user control over when URLs are sent out

## Entry Points

- `entrypoints/background.ts`
  Detects broken pages, manages tab state, builds context menus, starts resolver flows, and records history.
- `entrypoints/topbar.content/index.tsx`
  Injects the recovery bar into eligible HTTP error pages that can host extension UI.
- `entrypoints/fallback/*`
  Renders the fallback recovery page for navigation failures or browser error pages where the top bar cannot run.
- `entrypoints/popup/*`
  Offers manual lookup, status, and quick actions for the current tab.
- `entrypoints/resolver/*`
  Runs the archive lookup flow, auto-opens the preferred hit, and shows additional matches and follow-up sources.
- `entrypoints/archive-history/*`
  Shows locally stored lookup history with search and filters.
- `entrypoints/options/*`
  Manages user settings, provider order, host selection, history, and update/help actions.
- `entrypoints/onboarding/*`
  Introduces the product after install.
- `entrypoints/thanks/*`
  One-time follow-up page after the first successful auto-open.

## Core Modules

- `src/core/lookup.ts`
  Multi-provider lookup orchestration, preferred-hit selection, progress reporting, and manual-source generation.
- `src/core/urlPolicy.ts`
  URL eligibility checks, private/archive-loop blocking, URL cleaning, and exact/cleaned candidate generation.
- `src/core/providers/*`
  Provider adapters, priority logic, snapshot parsing, and validation.
- `src/core/errors.ts`
  Error relevance rules plus user-facing explanations for HTTP and navigation failures.
- `src/core/settings.ts`
  Settings schema, defaults, and supported behavior modes.
- `src/core/history.ts`
  Schemas for stored lookup history and outcomes.
- `src/platform/storage.ts`
  Local storage helpers for settings, history, and one-time meta records.

## Lookup Flow

1. The background script detects a relevant broken-page condition locally or the user starts a manual lookup.
2. A history entry is created if history is enabled.
3. The resolver opens with the target URL, trigger metadata, and optional provider scope.
4. `lookupArchives()` builds one or two search candidates depending on URL matching mode:
   - exact URL
   - cleaned URL with common tracking parameters removed and hash stripped
5. Automatic providers are queried in parallel.
6. The resolver prefers Wayback when it returns a valid hit, but it can fall back to the best non-Wayback snapshot if Wayback misses or errors.
7. Additional snapshots are collected and shown even after the first preferred hit is found.
8. Manual follow-up sources are generated for relevant providers that were not already satisfied by an automatic hit.
9. The first preferred archived URL is auto-opened according to the user’s open behavior and resolver success behavior.
10. The history entry is completed with outcome, attempts, failed providers, and snapshots.

## Provider Strategy

PastPage has two provider groups:

- automatic providers that PastPage can query directly
- direct-link/manual providers that PastPage surfaces as follow-up actions

Automatic provider order is URL-aware:

- general default: Wayback, Archive.today, Ghostarchive, Perma.cc, Megalodon/Web Gyotaku
- Portugal-focused URLs promote `Arquivo.pt`
- Japan-focused URLs promote `Megalodon/Web Gyotaku`
- `gov.uk` URLs inject the `UK Government Web Archive`
- `.gov`, `.mil`, `loc.gov`, and `congress.gov` URLs inject `Library of Congress Web Archives`

Manual follow-up sources also adapt to context:

- repository URLs can include `Software Heritage`
- general follow-up sources include `Yandex Cache` and `WebCite`

## Error Handling Model

PastPage handles two broad categories:

- HTTP failures such as `404`, `410`, `451`, and selected `5xx`
- navigation failures such as DNS, timeout, certificate, and connection errors

For archive results, providers can return:

- hit
- miss
- error

The resolver keeps failed providers separate from not-found results so the UI can still show useful follow-up links.

## User Settings

Current settings include:

- where archived pages open
- where provider-specific actions open
- whether the resolver stays open or is replaced after a hit
- URL matching mode
- enabled providers
- archive display order
- history on or off
- popup archive list visibility
- search-engine/context-menu icon visibility
- selected Wayback and Archive.today host
- language and theme
- badge visibility
- recovery-bar theme colors
- ignored domains

## Local Storage

`browser.storage.local` currently stores:

- `pastPage.settings`
- `pastPage.meta`
- `pastPage.history`

`pastPage.meta` holds lightweight UX markers such as the first successful archive open, the local search count, and review-prompt timestamps.

## Privacy Boundary

PastPage has no backend service.

Broken-page detection, error classification, and settings/history storage stay local. URLs are sent to archive providers only after explicit user action.
