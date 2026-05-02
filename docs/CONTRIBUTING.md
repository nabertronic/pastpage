# Contributing

PastPage is privacy-first source-recovery tooling. Contributions should make the extension more reliable, more understandable, or more useful without weakening that trust boundary.

## Non-Negotiables

- Do not add telemetry, analytics, Sentry, remote configuration, or hidden metrics.
- Do not send page URLs to any third party before explicit user action.
- Do not add remote code.
- Do not add new permissions, storage keys, or provider network behavior without updating the docs.
- Keep the product name `PastPage` consistent in user-facing copy.
- Keep translations aligned across supported locales when UI text changes.

## What Good Contributions Usually Include

- tests for behavior changes where practical
- docs updates for user-visible, privacy, storage, provider, or permission changes
- localization updates when strings changed
- careful naming and copy review so old branding or inaccurate promises do not slip back in

## Areas Where Accuracy Matters Most

- archive-provider relevance and prioritization
- broken-page and navigation-error detection
- resolver behavior and automatic opening rules
- history persistence and clearing
- privacy claims and permissions

## Workflow

Use the setup and command reference in [DEVELOPMENT.md](./DEVELOPMENT.md).

Before opening a PR:

1. Run `pnpm test`.
2. Run `pnpm typecheck`.
3. Run the relevant build command if the change affects shipped assets or manifest behavior.
4. Re-read the affected docs and confirm they still describe the product accurately.

## Pull Requests

PRs should explain:

- what changed
- why it changed
- whether user-facing behavior changed
- whether privacy, storage, providers, or permissions changed
- which tests were added or run
