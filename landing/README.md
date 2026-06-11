# PastPage — Landing Page

A very short, single-screen landing page for the PastPage browser extension.
Built with **Next.js (App Router) + TypeScript**.

## Design

Editorial / archival aesthetic that echoes the product's purpose — recovering
pages from the past:

- **Palette** taken from the extension brand: warm paper `#f3efe7`, ink
  `#14110a`, signature yellow `#fdc700`.
- **Type**: Fraunces (display serif) · Newsreader (body serif) · JetBrains Mono
  (archival metadata labels), via `next/font`.
- A ruled "document" frame, a 404 → recovered card, and an archive ticker.
- Real brand assets reused from the repo (logo, store badges) in `public/`.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```
