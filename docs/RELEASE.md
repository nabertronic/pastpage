# Release

## Automated Store Submission

The complete release is started locally with:

```sh
pnpm run deploy
```

This command verifies that the working tree is clean, `main` is synchronized with `origin/main`, all version declarations match, the changelog contains release notes, and the GitHub release does not already exist. It then starts and monitors the `Release extension` GitHub Actions workflow.

The workflow builds and submits Chrome and Firefox releases without a manual ZIP upload. After both store submissions succeed, it creates the matching Git tag and GitHub Release, uses the changelog section as release notes, attaches all three ZIP packages, and marks the release as latest.

Before using it, create these repository secrets:

- `CHROME_EXTENSION_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`
- `FIREFOX_EXTENSION_ID`
- `FIREFOX_JWT_ISSUER`
- `FIREFOX_JWT_SECRET`

The Chrome values come from the Chrome Web Store API OAuth setup. The Firefox issuer and secret come from the AMO API credentials page. `FIREFOX_EXTENSION_ID` must match `browser_specific_settings.gecko.id` in `extension/wxt.config.ts`.

To verify the setup without uploading or publishing anything:

```sh
pnpm run deploy:dry-run
```

For a real release, `pnpm run deploy` uploads both packages and submits them for store review. Generated ZIP files are also retained as workflow artifacts for 30 days and attached to the GitHub Release.

The initial Chrome Web Store and Firefox Add-ons listings still need to exist before this update workflow can publish releases.

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
- `pnpm zip` and `pnpm zip:firefox` create the store submission packages locally.
- Store metadata, screenshots, and support links must all use the `PastPage` name.
- Do not ship placeholder or guessed store URLs in the extension UI.
- Keep `extension/src/core/constants.ts` aligned with the live store listings.

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
