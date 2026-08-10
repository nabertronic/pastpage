# PastPage

PastPage helps you recover missing pages, changed pages, and broken links by checking the Wayback Machine on `archive.org` and other relevant archive and cache providers for you.

If an archived version of a disappeared or changed page still exists in a relevant archive, PastPage is built to find it fast.

<p align="center">
  <br><br>
  <a href="https://chromewebstore.google.com/detail/pastpage-query-10+-web-ar/icpegbecignmplpkjjcegmjmfadpcpoo" style="display: inline-block; line-height: 0; text-decoration: none;"><img height="58" src="docs/assets/chrome-web-store-badge.png" alt="Chrome Web Store" style="display: block;"></a><!--
  --><a href="https://addons.mozilla.org/en-US/firefox/addon/pastpage-query-10-web-archives/" style="display: inline-block; line-height: 0; text-decoration: none;"><img height="58" src="docs/assets/firefox-addons-badge.png" alt="Firefox Add-ons" style="display: block;"></a>
  <br><br>
</p>

## Install

- Chrome Web Store: <https://chromewebstore.google.com/detail/pastpage-query-10+-web-ar/icpegbecignmplpkjjcegmjmfadpcpoo>
- Firefox Add-ons: <https://addons.mozilla.org/en-US/firefox/addon/pastpage-query-10-web-archives/>
- Development builds: package locally from this repository

## Why Install PastPage

Most `web archive` tools make you check one archive after another and guess which `archive` or `archives` might have a capture.

PastPage does that work for you.

- It notices when a page is gone, broken, blocked, or no longer loading normally.
- It checks the current page in one click from the toolbar, popup, or context menu.
- It can search up to 15 archive and cache providers, prioritizing the ones that fit the URL.
- It shows confirmed matches, unverified archive candidates, provider failures, and follow-up links as results arrive.
- It remembers your past searches locally so you can revisit, filter, export, or rerun recovery checks later.

## What Makes PastPage Different

### Smarter Than A Single `archive.org` Lookup

PastPage does not stop at the first `Wayback Machine` query. It can check up to 15 archive and cache providers and adapts the search to the URL:

- `Wayback Machine` on `archive.org`
- `Archive.today`
- `Ghostarchive`
- `Perma.cc`
- `Arquivo.pt` for Portuguese domains
- `Megalodon/Web Gyotaku`
- `UK Government Web Archive` for `gov.uk`
- `Library of Congress Web Archives` for `gov`, `mil`, `loc.gov`, and `congress.gov`
- `Government of Canada Web Archive` for `canada.ca` and `gc.ca`
- `Icelandic Web Archive / Vefsafn` for `.is`
- `NTU Web Archiving System / NTUWAS` for `.tw`, `gov.tw`, and `edu.tw`
- `PADICAT / Web Archive of Catalonia` for `.cat`
- `Software Heritage` for repository URLs and supported code pages
- `WebCite`
- `Yandex Cache`

General archives stay available for broad lookups, while regional and specialist archives are promoted only when they are relevant to the current URL. You can also customize which providers PastPage uses and the order in which they appear.

### Built For Missing Pages, Not Just Manual Searching

PastPage can react when a page breaks and help you recover it from a `web archive` right away. It is designed for the cases where people usually start hunting manually through `archive.org` or other `archives`:

- `403 Forbidden`
- `404 Not Found`
- `410 Gone`
- `451 Unavailable For Legal Reasons`
- common `5xx` server failures

### Better URL Matching

Archived pages are often stored under a cleaner version of the URL than the one in your tab. PastPage accounts for that automatically.

- It can check both the original URL and a cleaned version.
- It removes common tracking, referrer, and sensitive parameters before follow-up searches when needed.
- After primary checks miss, it can try protocol, `www`, and trailing-slash URL variants in a bounded fallback stage.
- It can offer provider-specific `Check cleaned URL` follow-up links when a query-heavy URL needs a simpler archive search.
- It ignores fragments that usually do not matter for archived captures.

That means you do not have to manually trim links before checking the `Wayback Machine`, `archive.org`, or another `web archive`.

## What You Get

- One-click lookup from the current page
- Broken-page recovery for disappeared sites
- Archive lookup from the context menu for pages, links, and selected URLs
- Confirmed and unverified archive matches, including multiple captures from the same provider
- A searchable local history with saved filters, sorting, CSV export, bulk deletion, and reruns
- Interface languages: English, German, Spanish, French, Italian, Polish, Portuguese, and Ukrainian
- Customizable archive providers, archive order, provider timeout, tab-opening behavior, and ignored domains

## Privacy

PastPage is built around a simple rule:

`No tracking. No analytics. No telemetry.`

Broken-page detection and lookup history stay local in your browser. URLs are only sent to archive providers after you explicitly start a lookup yourself.

PastPage also keeps extension permissions narrow and avoids background tracking scripts or analytics services.

Full details: [Privacy](docs/PRIVACY.md)

## Support

- Support hub: [docs/SUPPORT.md](docs/SUPPORT.md)
- Issues and feedback: [GitHub Issues](https://github.com/nabertronic/pastpage/issues)

Contributors can find the technical docs in [docs/](docs/).
