# Release

## Release Checklist

1. Run `pnpm test`.
2. Run `pnpm typecheck`.
3. Run `pnpm build`.
4. Run `pnpm build:firefox`.
5. If browser-level flows changed, run `pnpm test:e2e`.
6. Verify README, privacy text, permissions, provider lists, and feature claims still match the shipped extension.
7. Check both localization layers:
   - `extension/src/i18n/`
   - `extension/public/_locales/`
8. Review [STORE_METADATA.md](./STORE_METADATA.md) and refresh listing copy if the positioning changed.
9. Confirm `extension/src/core/constants.ts` still points to the correct support, privacy, license, and store URLs.

## Versioning

Update the release version consistently in:

- [package.json](../package.json)
- [extension/package.json](../extension/package.json)
- [extension/wxt.config.ts](../extension/wxt.config.ts)

## Current Packaging Notes

- Chrome and Firefox builds are generated separately.
- Store metadata, screenshots, and support links must all use the `PastPage` name.
- Do not ship placeholder or guessed store URLs in the extension UI.
- Add store URLs to `extension/src/core/constants.ts` only after the corresponding listing is live.

## Regression Checks Worth Doing Before Publish

- broken-page recovery on a relevant HTTP error
- fallback page behavior for a navigation error
- manual lookup from popup
- context-menu lookup for page, link, and selected URL
- provider-specific direct actions
- history creation, filtering, and clearing
- settings persistence for provider order, URL matching mode, and ignored domains

## If Providers Changed

Before release, make sure all of these are still aligned:

- [README.md](../README.md)
- [PRIVACY.md](./PRIVACY.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [STORE_METADATA.md](./STORE_METADATA.md)
