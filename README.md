# PastPage

PastPage helps you recover missing pages, changed pages, and broken links by checking the Wayback Machine on `archive.org` and other relevant web archives for you.

If an archived version of a disappeared or changed page still exists in a relevant archive, PastPage is built to find it fast.

<p align="center">
  <br><br>
  <a href="https://chromewebstore.google.com/detail/pastpage-query-10+-web-ar/icpegbecignmplpkjjcegmjmfadpcpoo" style="text-decoration: none;">
    <picture>
      <source srcset="https://i.imgur.com/XBIE9pk.png" media="(prefers-color-scheme: dark)">
      <img height="58" src="https://i.imgur.com/oGxig2F.png" alt="Chrome Web Store" style="display: block;">
    </picture>
  </a>
  <a href="https://addons.mozilla.org/en-US/firefox/addon/pastpage-query-10-web-archives/" style="text-decoration: none;">
    <picture>
      <source srcset="https://i.imgur.com/ZluoP7T.png" media="(prefers-color-scheme: dark)">
      <img height="58" src="https://i.imgur.com/4PobQqE.png" alt="Firefox Add-ons" style="display: block;">
    </picture>
  </a>
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
- It searches multiple relevant `web archives` in parallel.
- It keeps looking and shows alternative archives and follow-up links.
- It remembers your past searches so you can revisit successful recoveries later.

## What Makes PastPage Different

### Smarter Than A Single `archive.org` Lookup

PastPage does not stop at the first `Wayback Machine` query. It checks multiple archives and adapts the search to the URL:

- `Wayback Machine` on `archive.org`
- `Archive.today`
- `Ghostarchive`
- `Perma.cc`
- `Arquivo.pt`
- `Web Gyotaku`

And when useful, it also adds specialized follow-up sources such as:

- `UK Government Web Archive` for `gov.uk`
- `Library of Congress Web Archives` for `gov`, `mil`, `loc.gov`, and `congress.gov`
- `Software Heritage` for code and repository URLs
- `Archive-It`
- `WebCite`
- `Yandex Cache`

### Built For Missing Pages, Not Just Manual Searching

PastPage can react when a page breaks and help you recover it from a `web archive` right away. It is designed for the cases where people usually start hunting manually through `archive.org` or other `archives`:

- `404 Not Found`
- `410 Gone`
- `451 Unavailable For Legal Reasons`
- common `5xx` server failures
- DNS, timeout, connection, and certificate-related load failures

### Better URL Matching

Archived pages are often stored under a cleaner version of the URL than the one in your tab. PastPage accounts for that automatically.

- It can retry a cleaned version of the URL.
- It removes common tracking parameters before follow-up searches when needed.
- It ignores fragments that usually do not matter for archived captures.

That means you do not have to manually trim links before checking the `Wayback Machine`, `archive.org`, or another `web archive`.

## What You Get

- One-click lookup from the current page
- Broken-page recovery for disappeared sites
- Archive lookup from the context menu for pages, links, and selected URLs
- Additional archive matches when more than one source has the page
- A searchable local history of previous recovery runs
- Interface languages: English, German, Spanish, French, Italian, Polish, Portuguese, and Ukrainian
- Customizable archive order, behavior, and ignored domains

## Privacy

PastPage is built around a simple rule:

`No tracking. No analytics. No telemetry.`

Broken-page detection stays local in your browser. URLs are only sent to archive providers after you explicitly start a lookup yourself.

Full details: [Privacy](docs/PRIVACY.md)

## Support

- Support hub: [docs/SUPPORT.md](docs/SUPPORT.md)
- Issues and feedback: [GitHub Issues](https://github.com/nabertronic/pastpage/issues)

Contributors can find the technical docs in [docs/](docs/).
