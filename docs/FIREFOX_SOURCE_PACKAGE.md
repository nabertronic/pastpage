# Firefox Source Package Notes

Last updated: 2026-05-02

This document accompanies Firefox Add-ons submission when a readable source package or build instructions are requested.

## Source Location

Human-readable source code is in this repository:

- workspace root: `/Users/macbookair/Documents/PastPage/pastpage`
- extension app: `/Users/macbookair/Documents/PastPage/pastpage/extension`

## Toolchain

- Node.js: `v25.9.0`
- pnpm: `10.0.0`
- framework: `WXT`
- UI: `React`
- language: `TypeScript`

## Build Commands

Install dependencies:

```sh
pnpm install
```

Build Chrome package output:

```sh
pnpm build
```

Build Firefox package output:

```sh
pnpm build:firefox
```

Create submission archives:

```sh
pnpm --dir extension zip
pnpm --dir extension zip:firefox
```

## Output

WXT writes built outputs under:

- `extension/.output/chrome-mv3`
- `extension/.output/firefox-mv2`

Archive files are written under:

- `extension/.output/`

## Review Notes

- Production packages are generated from this source tree.
- The repository does not depend on a proprietary backend service.
- Review-specific functional notes are in `docs/REVIEW_NOTES.md`.
