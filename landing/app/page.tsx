import { PopupCard } from "./PopupCard";

const CHROME_URL =
  "https://chromewebstore.google.com/detail/pastpage-query-10+-web-ar/icpegbecignmplpkjjcegmjmfadpcpoo";
const FIREFOX_URL =
  "https://addons.mozilla.org/en-US/firefox/addon/pastpage-query-10-web-archives/";

const ALL_ARCHIVES = [
  "Wayback Machine",
  "Archive.today",
  "Ghostarchive",
  "Perma.cc",
  "Arquivo.pt",
  "Megalodon",
  "UK Government Web Archive",
  "Library of Congress",
  "Software Heritage",
  "WebCite",
  "Yandex Cache",
];

function PMark() {
  return (
    <svg viewBox="0 0 1248 1248" aria-hidden="true">
      <path
        fill="#fffdf9"
        fillRule="evenodd"
        d="M310 208C310 197 319 188 330 188L674 188C846 188 962 302 962 486C962 671 846 785 674 785L535 785L535 1038C535 1049 526 1058 515 1058L330 1058C319 1058 310 1049 310 1038Z M476 490L635 360C642 354 653 359 653 369L653 431L772 431C781 431 788 438 788 447L788 533C788 542 781 549 772 549L653 549L653 612C653 622 642 627 635 621Z"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ico-check">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="page">
      <div className="frame">
        {/* masthead */}
        <header className="masthead reveal d1">
          <a className="brand" href="/" aria-label="PastPage">
            <span className="brand-mark">
              <PMark />
            </span>
            <span className="brand-name">PastPage</span>
          </a>
        </header>

        {/* hero */}
        <section className="hero">
          <div className="hero-copy">
            <h1>
              <span className="line">The page isn&rsquo;t gone.</span>
              <span className="line">
                It&rsquo;s <em>archived</em>.
              </span>
            </h1>
            <p className="lede reveal d4">
              The moment a page breaks or disappears, PastPage{" "}
              <strong>automatically</strong> checks the Wayback Machine,
              Archive.today, Ghostarchive and other web archives in parallel —
              and surfaces the version that still exists.
            </p>

            <div className="cta reveal d5">
              <a
                className="btn btn-primary"
                href={CHROME_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/chrome-logo.svg" alt="" width={22} height={22} />
                <span>
                  Add to <b>Chrome</b>
                </span>
              </a>
              <a
                className="btn btn-secondary"
                href={FIREFOX_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/firefox-logo.svg" alt="" width={22} height={22} />
                <span>
                  Get for <b>Firefox</b>
                </span>
              </a>
            </div>

            <ul className="privacy">
              {["No tracking", "No analytics", "No telemetry"].map((t) => (
                <li key={t}>
                  <Check />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* real extension popup screenshot */}
          <div className="visual reveal d4">
            <PopupCard />
          </div>
        </section>

        {/* archive marquee */}
        <footer className="ticker reveal d6">
          <span className="label">Searches</span>
          <div className="names">
            <div className="track">
              {ALL_ARCHIVES.map((a) => (
                <span key={a}>{a}</span>
              ))}
            </div>
            <div className="track" aria-hidden="true">
              {ALL_ARCHIVES.map((a) => (
                <span key={`dup-${a}`}>{a}</span>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
