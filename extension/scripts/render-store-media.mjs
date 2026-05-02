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
              ${body ? `<h2>${body}</h2>` : ""}
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
      path.join(screenshotsDir, "popup-manual-lookup.png"),
      cardShell({
        title: "Look up any page across multiple web archives",
        subtitle: "Click the PastPage icon on any tab to search archived versions — or paste a URL to look up any page directly.",
        chips: ["Works on any page", "Multiple archives", "No setup needed"],
        body: "",
        panel: `
          <div style="position: relative; margin: -26px; overflow: hidden; min-height: 340px; background: linear-gradient(180deg, #faf9f6 0%, #f2efe8 100%);">
            <div style="padding: 28px 32px; opacity: 0.45; user-select: none; pointer-events: none;">
              <div style="font: 600 11px/1 ui-sans-serif, sans-serif; color: #78716c; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px;">Reuters · World</div>
              <div style="font: 700 26px/1.2 Georgia, serif; color: #1c1917; max-width: 580px; margin-bottom: 12px;">European leaders call for renewed diplomatic talks amid ongoing tensions</div>
              <div style="font: 400 15px/1.65 ui-sans-serif, sans-serif; color: #57534e; max-width: 540px;">Senior officials from multiple countries gathered in Brussels on Monday to discuss a framework for renewed dialogue. The talks, described as preliminary, aim to establish communication channels that have been largely dormant since earlier this year...</div>
            </div>
            <div style="
              position: absolute;
              top: 14px;
              right: 14px;
              width: 340px;
              background: radial-gradient(circle at top left, rgba(245,200,0,0.07), transparent 42%), #f8f8f8;
              border-radius: 14px;
              box-shadow: 0 24px 64px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.07);
              padding: 12px;
              font-family: ui-sans-serif, system-ui, sans-serif;
            ">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <div style="width: 36px; height: 36px; border-radius: 8px; background: #ffd400; display: grid; place-items: center; flex-shrink: 0; box-shadow: 0 8px 20px rgba(255,212,0,0.28);">
                  <svg aria-hidden="true" viewBox="0 0 1248 1248" width="19" height="19" style="display:block"><path fill="#17130a" fill-rule="evenodd" d="M310 208 C310 197 319 188 330 188 L674 188 C846 188 962 302 962 486 C962 671 846 785 674 785 L535 785 L535 1038 C535 1049 526 1058 515 1058 L330 1058 C319 1058 310 1049 310 1038 Z M476 490 L635 360 C642 354 653 359 653 369 L653 431 L772 431 C781 431 788 438 788 447 L788 533 C788 542 781 549 772 549 L653 549 L653 612 C653 622 642 627 635 621 Z"/></svg>
                </div>
                <div>
                  <div style="font-size: 14px; font-weight: 600; color: #0c0a09;">PastPage</div>
                  <div style="font-size: 12px; color: #78716c;">Search web archives</div>
                </div>
                <div style="margin-left: auto; border: 1px solid #e5e2db; border-radius: 6px; padding: 4px 8px; font-size: 12px; color: #78716c; display: flex; align-items: center; gap: 3px; white-space: nowrap; background: white;">
                  Tab <span style="font-size: 10px; margin-left: 1px;">▾</span>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;">
                <div style="
                  width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px;
                  padding: 9px 14px; border-radius: 8px; background: #ffd400; color: #17130a;
                  border: 1px solid rgba(23,19,10,0.18); font: 700 14px/1 ui-sans-serif, sans-serif;
                ">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  Check Archived Versions
                </div>
                <div style="
                  width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px;
                  padding: 9px 14px; border-radius: 8px; background: white; color: #1c1917;
                  border: 1px solid #e5e2db; font: 600 14px/1 ui-sans-serif, sans-serif;
                ">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Open in All Archives
                </div>
              </div>
              <div style="border-radius: 8px; border: 1px solid #e7e3db; background: rgba(255,255,255,0.95); padding: 8px; margin-bottom: 10px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px;">
                  ${[
                    ["WB", "Wayback Machine"],
                    ["AT", "archive.today"],
                    ["GA", "Ghostarchive"],
                    ["PT", "Arquivo.pt"],
                    ["LC", "Lib. of Congress"],
                    ["UK", "UK Web Archive"]
                  ].map(([abbr, name]) => `
                    <div style="display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:6px;">
                      <div style="width:26px;height:26px;border-radius:5px;background:#f0ede6;display:grid;place-items:center;flex-shrink:0;">
                        <span style="font-size:8px;font-weight:700;color:#78716c;letter-spacing:-0.02em;">${abbr}</span>
                      </div>
                      <span style="font-size:12px;color:#1c1917;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</span>
                    </div>
                  `).join("")}
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div style="display:flex;align-items:center;justify-content:center;gap:5px;padding:6px;border-radius:6px;background:transparent;border:1px solid #e5e2db;font:500 13px/1 ui-sans-serif,sans-serif;color:#78716c;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  History
                </div>
                <div style="display:flex;align-items:center;justify-content:center;gap:5px;padding:6px;border-radius:6px;background:transparent;border:1px solid #e5e2db;font:500 13px/1 ui-sans-serif,sans-serif;color:#78716c;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Settings
                </div>
              </div>
            </div>
          </div>`
      })
    );

    await screenshotHtml(
      page,
      path.join(screenshotsDir, "broken-page-fallback.png"),
      cardShell({
        title: "Recover missing pages from the failure screen",
        subtitle: "PastPage detects error pages and offers archive recovery right where the original page failed.",
        chips: [],
        notificationBar: PASTPAGE_TOPBAR_HTML,
        body: "",
        panel: `
          <div style="margin: -26px; overflow: hidden; font-family: 'Georgia', serif; background: #fff;">
            <nav style="background: #1a2744; padding: 0 28px; display: flex; align-items: center; gap: 0; height: 52px;">
              <div style="display: flex; align-items: center; gap: 6px; color: #fff; font: 600 13px/1 ui-sans-serif, sans-serif; margin-right: 24px; opacity: 0.9;">
                <svg width="16" height="12" viewBox="0 0 16 12" fill="white"><rect y="0" width="16" height="2"/><rect y="5" width="16" height="2"/><rect y="10" width="16" height="2"/></svg>
                MENU
              </div>
              <div style="flex: 1; text-align: center; color: white; line-height: 1.1;">
                <div style="font: 700 15px/1 'Georgia', serif; letter-spacing: 0.12em; text-transform: uppercase;">The White House</div>
                <div style="font: 400 10px/1 ui-sans-serif, sans-serif; letter-spacing: 0.22em; text-transform: uppercase; margin-top: 3px; opacity: 0.75;">Washington</div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; color: #fff; font: 600 13px/1 ui-sans-serif, sans-serif; margin-left: 24px; opacity: 0.9;">
                SEARCH
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </div>
            </nav>
            <nav style="background: #1a2744; border-top: 1px solid rgba(255,255,255,0.12); display: flex; justify-content: center; gap: 0;">
              ${["NEWS","GALLERY","LIVESTREAM","INVESTMENTS","SAVE AMERICA","WH WIRE","CONTACT"].map(item =>
                `<div style="color: rgba(255,255,255,0.88); font: 600 12px/1 ui-sans-serif, sans-serif; letter-spacing: 0.08em; padding: 13px 18px; white-space: nowrap;">${item}</div>`
              ).join("")}
            </nav>
            <div style="padding: 72px 40px 64px; text-align: center;">
              <h2 style="margin: 0 0 16px; font: 400 52px/1.1 'Georgia', serif; color: #1a1a1a; letter-spacing: -0.01em;">404 / Page Not Found</h2>
              <p style="margin: 0 0 40px; font: 400 18px/1.6 ui-sans-serif, sans-serif; color: #444;">
                We couldn't find that page. <span style="text-decoration: underline; color: #1a1a1a; cursor: pointer;">Back to home</span>.
              </p>
              <div style="
                max-width: 540px; margin: 0 auto;
                background: #edeae3; border-radius: 4px; height: 52px;
                display: flex; align-items: center; padding: 0 18px; gap: 12px;
              ">
                <span style="flex: 1; font: 400 16px/1 ui-sans-serif, sans-serif; color: #888;">Search WhiteHouse.gov</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </div>
            </div>
          </div>`
      })
    );

    await screenshotHtml(
      page,
      path.join(screenshotsDir, "resolver-results.png"),
      cardShell({
        title: "All archives searched at once — original and cleaned URLs",
        subtitle: "PastPage queries every enabled archive in parallel, using both the exact URL and optimised clean variants to surface results that a direct lookup would miss.",
        body: "Parallel searches across all archives — no waiting, no manual switching.",
        chips: ["Parallel queries", "URL cleaning", "Cache lookup"],
        panel: `
          <div class="grid twoCol">
            <div class="item">
              <strong>Parallel archive queries</strong>
              <span>All enabled archives are searched simultaneously — results appear as they arrive, with no sequential waiting.</span>
            </div>
            <div class="item">
              <strong>Original and clean URLs</strong>
              <span>Each archive is queried with the exact URL and with a stripped, canonical version to catch captures stored under a simpler address.</span>
            </div>
            <div class="item">
              <strong>Manual archive search</strong>
              <span>For every archive without an automatic result, a direct search link is offered so nothing is left unexamined.</span>
            </div>
            <div class="item">
              <strong>Cache lookup (Yandex)</strong>
              <span>Beyond classic archives, cached page sources are included in the search to maximise the chance of finding a saved version.</span>
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
