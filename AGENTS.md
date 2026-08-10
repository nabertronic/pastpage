# PastPage Agent Instructions

## Releases

When the user asks to deploy, publish, or release PastPage:

1. Select the next semantic version and update it consistently in `package.json`, `extension/package.json`, and `extension/wxt.config.ts`.
2. Add a matching `## vX.Y.Z` section to `docs/CHANGELOG.md`; these entries become the GitHub Release notes.
3. Run the relevant tests and builds.
4. Commit all intended release changes and push `main`.
5. Run `pnpm run deploy` and monitor it until completion.

`pnpm run deploy` requires a clean, synchronized `main` branch. It triggers the GitHub Actions workflow that builds and submits Chrome and Firefox packages, then creates the matching Git tag and GitHub Release with all ZIP artifacts. Do not upload ZIP files or create the GitHub Release separately.

Use `pnpm run deploy:dry-run` when only validating the workflow and store credentials.
