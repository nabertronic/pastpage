# Development

## Setup

```sh
pnpm install
```

## Common Commands

```sh
pnpm dev
pnpm dev:firefox
pnpm test
pnpm test:e2e
pnpm typecheck
pnpm build
pnpm build:firefox
pnpm zip
pnpm zip:firefox
```

## Repository Layout

- `extension/`
  The shipped WebExtension app.
- `extension/entrypoints/`
  Browser entry points such as background, popup, resolver, history, options, onboarding, thanks, topbar, and fallback.
- `extension/src/components/`
  React UI components and page shells.
- `extension/src/core/`
  Lookup orchestration, provider registry, URL policy, settings, errors, history, and shared types.
- `extension/src/platform/`
  Browser integration helpers for storage, tabs, badges, runtime info, navigation, and extension URLs.
- `extension/public/`
  Icons, provider art, and manifest-facing localized strings.
- `extension/tests/`
  Unit, UI, background, platform, provider, and end-to-end tests.
- `docs/`
  Product, contributor, privacy, architecture, release, and store metadata docs.

## Current Product Surface To Keep In Mind

The codebase currently ships more than a simple popup:

- broken-page detection for selected HTTP and navigation failures
- resolver flow with automatic archive lookup and follow-up sources
- local history page with filters and clearing
- options for provider order, enabled providers, URL matching mode, host selection, and ignored domains
- onboarding and milestone-based thanks/review prompts
- localized UI in `en`, `de`, `es`, `fr`, `it`, `pl`, `pt`, and `uk`

When making behavior changes, check whether one or more of these surfaces need updates.

## Testing Guidance

- Add or update unit tests for provider parsing, lookup flow, storage, settings, or URL policy changes.
- Add UI tests when page behavior changes in popup, resolver, history, fallback, onboarding, or options.
- Consider background tests for error detection, context-menu logic, or tab-state transitions.
- Run `pnpm test` and `pnpm typecheck` before handing work off.
- Use `pnpm test:e2e` when changing extension flows that depend on browser integration.

## Localization

PastPage has two localization layers:

- `extension/src/i18n/locales/`
  In-extension UI copy.
- `extension/public/_locales/`
  Manifest-facing strings used by the browser store and browser chrome.

When adding or changing UI text:

- update the relevant locale files
- keep supported languages aligned
- run tests to catch missing keys or mismatches

## Privacy-Sensitive Changes

If you add, remove, or reorder archive providers, change archive host behavior, add new permissions, or change storage contents:

- update [PRIVACY.md](./PRIVACY.md)
- update [ARCHITECTURE.md](./ARCHITECTURE.md) when the flow changed
- update [README.md](../README.md) if the user-facing promise changed
- update [STORE_METADATA.md](./STORE_METADATA.md) if the listing copy should shift
- call out the privacy impact explicitly in the PR description

## Build Output

WXT writes build artifacts into `.output/`.

Keep local throwaway assets and mock archives out of Git. The repo intentionally ignores local `archive/` folders.
