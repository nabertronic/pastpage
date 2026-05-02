# Reviewer Notes

Last updated: 2026-05-02

These notes are intended for Chrome Web Store and Firefox Add-ons reviewers.

## Quick Summary

- No account is required.
- No PastPage backend service exists.
- No remote configuration exists.
- No telemetry or analytics exists.
- Archive requests happen only after the user explicitly starts a lookup.

## Fastest Functional Test

1. Install the extension.
2. Open any normal HTTP or HTTPS page.
3. Open the toolbar popup.
4. Click `Check Archived Versions`.
5. Confirm that the resolver page opens and starts checking archives for the current URL.

Expected result:

- a resolver page opens
- archive providers are queried
- if a provider has a snapshot, the resolver surfaces it and may auto-open the preferred archived version depending on the current settings

## Broken-Page Recovery Test

PastPage is designed to react to recoverable page failures such as:

- `404 Not Found`
- `410 Gone`
- `451 Unavailable For Legal Reasons`
- selected `5xx` server failures
- selected navigation errors such as DNS, timeout, connection, and certificate-related failures

Expected result:

- on eligible error pages, PastPage shows a recovery entry point
- clicking the recovery action starts the archive lookup flow

## Context Menu Test

Expected context menu actions:

- lookup for current page
- lookup for a link target
- lookup for selected text when the selection is a URL
- direct provider actions

## Privacy Expectations

- page-failure detection happens locally
- settings and optional history are stored in `browser.storage.local`
- PastPage does not send data to a PastPage server because no such server exists
- PastPage sends a URL to third-party archive providers only when the user explicitly requests an archive lookup or direct archive action

## Known Review-Relevant Behavior

- archive availability depends on third-party services and the target URL
- some URLs will not have archived captures
- provider-specific timing and availability can vary
- the extension may contact multiple enabled archives for one user-requested lookup in order to compare available matches

## Local Reproduction Harness

The repository includes automated coverage for the main recovery flow.

Recommended commands:

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm build:firefox
pnpm --dir extension test:e2e
```

The end-to-end harness uses a controlled local HTTP server and mocks the Wayback responses so the core broken-page recovery flow can be reproduced deterministically.
