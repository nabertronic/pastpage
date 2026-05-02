import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const LOGO_MARK_SVG = `<svg aria-hidden="true" viewBox="0 0 1248 1248" width="54" height="54" style="display:block">
  <path fill="#FDC700" fill-rule="evenodd" d="M310 208 C310 197 319 188 330 188 L674 188 C846 188 962 302 962 486 C962 671 846 785 674 785 L535 785 L535 1038 C535 1049 526 1058 515 1058 L330 1058 C319 1058 310 1049 310 1038 Z M476 490 L635 360 C642 354 653 359 653 369 L653 431 L772 431 C781 431 788 438 788 447 L788 533 C788 542 781 549 772 549 L653 549 L653 612 C653 622 642 627 635 621 Z"/>
</svg>`;

const LOGO_MARK_SVG_SMALL = `<svg aria-hidden="true" viewBox="0 0 1248 1248" width="17" height="17" style="display:block">
  <path fill="#17130a" fill-rule="evenodd" d="M310 208 C310 197 319 188 330 188 L674 188 C846 188 962 302 962 486 C962 671 846 785 674 785 L535 785 L535 1038 C535 1049 526 1058 515 1058 L330 1058 C319 1058 310 1049 310 1038 Z M476 490 L635 360 C642 354 653 359 653 369 L653 431 L772 431 C781 431 788 438 788 447 L788 533 C788 542 781 549 772 549 L653 549 L653 612 C653 622 642 627 635 621 Z"/>
</svg>`;

const PASTPAGE_TOPBAR_HTML = `
  <div style="
    background: #f5f5f5;
    color: #111111;
    border-bottom: 2px solid #ffd400;
    box-shadow: 0 10px 30px rgba(0,0,0,0.12);
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    font-size: 15px;
    font-family: ui-sans-serif, system-ui, sans-serif;
    line-height: 1.45;
  ">
    <span style="
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: #ffd400;
      flex: 0 0 auto;
    ">${LOGO_MARK_SVG_SMALL}</span>
    <div style="min-width: 0; flex: 1 1 auto; font-weight: 750;">
      404: Page not found. Find an archived version?
    </div>
    <div style="
      border: 1px solid rgba(23,19,10,0.22);
      border-radius: 6px;
      background: #ffd400;
      color: #17130a;
      padding: 8px 12px;
      font-weight: 800;
      font-size: 15px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      white-space: nowrap;
    ">Find Archived Version</div>
    <div style="
      width: 30px;
      height: 30px;
      border-radius: 6px;
      display: grid;
      place-items: center;
      color: #525252;
      font-size: 16px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      flex: 0 0 auto;
    ">✕</div>
  </div>`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const extensionDir = path.resolve(__dirname, "..");
const artifactsDir = path.join(rootDir, "artifacts", "store-assets");
const screenshotsDir = path.join(artifactsDir, "screenshots");
const chromeDir = path.join(artifactsDir, "chrome");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function cardShell({ title, subtitle, body, chips = [], panel, notificationBar = "" }) {
  const chipHtml = chips.map((chip) => `<span class="chip">${chip}</span>`).join("");
  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            width: 1440px;
            height: 1024px;
            overflow: hidden;
            font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
            background:
              radial-gradient(circle at top right, rgba(255, 212, 0, 0.18), transparent 28%),
              linear-gradient(180deg, #fffbeb 0%, #fffef8 48%, #f6f3ea 100%);
            color: #1c1917;
          }
          .page {
            padding: 44px;
            display: grid;
            grid-template-rows: auto auto 1fr;
            gap: 22px;
            width: 100%;
            height: 100%;
          }
          .eyebrow {
            font: 700 12px/1.2 ui-sans-serif, system-ui, sans-serif;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #a16207;
          }
          h1 {
            margin: 8px 0 0;
            font-size: 54px;
            line-height: 0.97;
            letter-spacing: -0.035em;
            max-width: 880px;
          }
          .subtitle {
            margin: 10px 0 0;
            max-width: 940px;
            font: 500 22px/1.5 ui-sans-serif, system-ui, sans-serif;
            color: #57534e;
          }
          .chips { display: flex; flex-wrap: wrap; gap: 10px; }
          .chip {
            padding: 8px 12px;
            border-radius: 999px;
            border: 1px solid rgba(161, 98, 7, 0.18);
            background: rgba(255, 255, 255, 0.72);
            font: 700 13px/1.2 ui-sans-serif, system-ui, sans-serif;
            color: #92400e;
          }
          .frame {
            border: 1px solid rgba(28, 25, 23, 0.08);
            border-radius: 28px;
            background: rgba(255, 255, 255, 0.9);
            box-shadow: 0 28px 80px rgba(28, 25, 23, 0.12);
            overflow: hidden;
          }
          .topbar {
            height: 54px;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 0 20px;
            border-bottom: 1px solid rgba(28, 25, 23, 0.08);
            background: linear-gradient(180deg, #fffefc 0%, #f8f5ee 100%);
          }
          .dot {
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background: #d6d3d1;
          }
          .bar {
            flex: 1;
            height: 12px;
            border-radius: 999px;
            background: #ece7dd;
          }
          .panel {
            padding: 26px;
            font-family: ui-sans-serif, system-ui, sans-serif;
          }
          .panel h2 {
            margin: 0 0 10px;
            font-size: 32px;
            line-height: 1.1;
            color: #1c1917;
          }
          .panel p {
            margin: 0;
            font-size: 18px;
            line-height: 1.6;
            color: #57534e;
          }
          .buttonRow { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
          .buttonPrimary, .buttonSecondary {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 12px 18px;
            border-radius: 14px;
            font: 700 16px/1 ui-sans-serif, system-ui, sans-serif;
          }
          .buttonPrimary {
            background: #ffd400;
            color: #1c1917;
            border: 1px solid #eab308;
          }
          .buttonSecondary {
            background: #ffffff;
            color: #1c1917;
            border: 1px solid #d6d3d1;
          }
          .grid { display: grid; gap: 16px; margin-top: 18px; }
          .twoCol { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .item {
            border: 1px solid rgba(28, 25, 23, 0.08);
            border-radius: 18px;
            background: #fcfbf8;
            padding: 18px;
          }
          .item strong {
            display: block;
            margin-bottom: 8px;
            font-size: 18px;
            color: #1c1917;
          }
          .item span {
            font-size: 15px;
            line-height: 1.55;
            color: #57534e;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div>
            <div class="eyebrow">PastPage</div>
            <h1>${title}</h1>
            <p class="subtitle">${subtitle}</p>
          </div>
          <div class="chips">${chipHtml}</div>
          <div class="frame">
            <div class="topbar">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
              <div class="bar"></div>
            </div>
            ${notificationBar}
            <div class="panel">
              <h2>${body}</h2>
              ${panel}
            </div>
          </div>
        </div>
      </body>
    </html>`;
}

async function screenshotHtml(page, filePath, html, viewport = { width: 1440, height: 1024 }) {
  await page.setViewportSize(viewport);
  await page.setContent(html);
  await page.screenshot({ path: filePath, fullPage: true });
}

async function renderPromoTile(page) {
  const iconSvg = LOGO_MARK_SVG;
  await screenshotHtml(
    page,
    path.join(chromeDir, "promo-tile-440x280.png"),
    `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <style>
            body {
              margin: 0;
              width: 440px;
              height: 280px;
              overflow: hidden;
              font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
              background:
                radial-gradient(circle at top right, rgba(255, 212, 0, 0.9), transparent 34%),
                linear-gradient(135deg, #13100d 0%, #2f2415 55%, #5e4313 100%);
              color: #fff8dd;
            }
            .frame {
              width: 100%;
              height: 100%;
              padding: 24px;
              display: grid;
              grid-template-columns: 88px 1fr;
              gap: 18px;
              align-items: center;
              box-sizing: border-box;
            }
            .badge {
              width: 88px;
              height: 88px;
              border-radius: 22px;
              background: rgba(255, 212, 0, 0.14);
              border: 1px solid rgba(255, 248, 221, 0.22);
              display: grid;
              place-items: center;
              box-shadow: 0 24px 40px rgba(0, 0, 0, 0.28);
              backdrop-filter: blur(10px);
            }
            .badge svg { width: 54px; height: 54px; }
            .eyebrow {
              font: 700 11px/1.2 ui-sans-serif, system-ui, sans-serif;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              color: #ffe27a;
              margin-bottom: 10px;
            }
            h1 {
              margin: 0;
              font-size: 34px;
              line-height: 0.97;
              letter-spacing: -0.03em;
              max-width: 280px;
            }
            p {
              margin: 12px 0 0;
              font: 500 15px/1.45 ui-sans-serif, system-ui, sans-serif;
              color: rgba(255, 248, 221, 0.9);
              max-width: 290px;
            }
          </style>
        </head>
        <body>
          <div class="frame">
            <div class="badge">${iconSvg}</div>
            <div>
              <div class="eyebrow">PastPage</div>
              <h1>Recover missing pages fast</h1>
              <p>Search Wayback Machine and other web archives from the page you are already viewing.</p>
            </div>
          </div>
        </body>
      </html>`,
    { width: 440, height: 280 }
  );
}

async function main() {
  await ensureDir(screenshotsDir);
  await ensureDir(chromeDir);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await screenshotHtml(
      page,
      path.join(screenshotsDir, "broken-page-fallback.png"),
      cardShell({
        title: "Recover missing pages from the failure screen",
        subtitle: "PastPage detects error pages and offers archive recovery right where the original page failed.",
        chips: ["404 ready", "No account required", "Starts lookup on click"],
        notificationBar: PASTPAGE_TOPBAR_HTML,
        body: "404 / Page Not Found",
        panel: `
          <p style="margin: 0 0 24px; font-size: 18px; line-height: 1.6; color: #57534e;">
            We couldn't find that page. <span style="text-decoration: underline; color: #1c1917;">Back to home</span>.
          </p>
          <div style="
            background: #f0ede6;
            border-radius: 10px;
            height: 44px;
            display: flex;
            align-items: center;
            padding: 0 16px;
            gap: 12px;
            max-width: 560px;
          ">
            <span style="color: #78716c; font-size: 15px; flex: 1; font-family: ui-sans-serif, system-ui, sans-serif;">Search the site…</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#78716c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>`
      })
    );

    await screenshotHtml(
      page,
      path.join(screenshotsDir, "resolver-results.png"),
      cardShell({
        title: "Compare archive providers from one resolver",
        subtitle: "Resolver results show the preferred archived version first and keep follow-up sources close at hand.",
        body: "One lookup can compare Wayback Machine and other relevant web archives without leaving the workflow.",
        chips: ["Preferred hit", "Additional matches", "URL-aware search"],
        panel: `
          <div class="grid twoCol">
            <div class="item">
              <strong>Archived version found on Wayback Machine</strong>
              <span>Preferred capture found and ready to open, with cleaned-URL handling when archives stored a simpler address.</span>
            </div>
            <div class="item">
              <strong>Other archive sources</strong>
              <span>Additional providers stay visible for verification, comparison, and follow-up research.</span>
            </div>
            <div class="item">
              <strong>Open archived version</strong>
              <span>Open the best result directly, while the resolver can remain available based on user settings.</span>
            </div>
            <div class="item">
              <strong>Copy archive link</strong>
              <span>Capture direct archive URLs for citation, fact-checking, and evidence preservation workflows.</span>
            </div>
          </div>`
      })
    );

    await screenshotHtml(
      page,
      path.join(screenshotsDir, "options-privacy-settings.png"),
      cardShell({
        title: "Tune how PastPage works for you",
        subtitle: "All settings stay in your browser. Control how results open, which archives to use, how the extension looks, and whether lookups are saved.",
        body: "PastPage puts you in control — adjust every detail to fit your workflow.",
        chips: ["Local settings", "Optional history", "Provider controls"],
        panel: `
          <div class="grid twoCol">
            <div class="item">
              <strong>Recovery behavior</strong>
              <span>Choose how archive results open and whether the resolver stays visible after finding a match.</span>
            </div>
            <div class="item">
              <strong>Archive settings</strong>
              <span>Enable or disable providers and reorder them to prioritize the archives most relevant to you.</span>
            </div>
            <div class="item">
              <strong>Appearance</strong>
              <span>Pick a light or dark notification bar, or set a custom color to match your taste.</span>
            </div>
            <div class="item">
              <strong>History</strong>
              <span>Save lookups locally for later reference, or keep the extension stateless — your choice.</span>
            </div>
          </div>`
      })
    );

    await renderPromoTile(page);
  } finally {
    await browser.close();
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    files: [
      "chrome/promo-tile-440x280.png",
      "screenshots/popup-manual-lookup.png",
      "screenshots/broken-page-fallback.png",
      "screenshots/resolver-results.png",
      "screenshots/options-privacy-settings.png"
    ]
  };
  await fs.writeFile(path.join(artifactsDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

await main();
