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

async function loadProviderIcons() {
  const iconDir = path.join(extensionDir, "public", "provider-icons");
  async function svgIcon(name) {
    const raw = await fs.readFile(path.join(iconDir, `${name}.svg`), "utf8");
    return raw
      .replace(/width="[^"]*"/, 'width="20"')
      .replace(/height="[^"]*"/, 'height="20"')
      .replace("<svg ", '<svg style="display:block" ');
  }
  const ghostPng = await fs.readFile(path.join(iconDir, "ghostarchive.png"));
  return {
    wayback:      await svgIcon("wayback"),
    archiveToday: await svgIcon("archive-today"),
    ghostarchive: `<img src="data:image/png;base64,${ghostPng.toString("base64")}" width="20" height="20" style="display:block;object-fit:contain;">`,
    permaCc:      await svgIcon("perma-cc"),
    webGyotaku:   await svgIcon("web-gyotaku"),
    yandexCache:  await svgIcon("yandex-cache"),
    archiveIt:    await svgIcon("archive-it"),
    webcite:      await svgIcon("webcite"),
  };
}

function buildPopupPanel(icons) {
  const providers = [
    [icons.wayback,      "Wayback Machine"],
    [icons.archiveToday, "Archive.today"],
    [icons.ghostarchive, "Ghostarchive"],
    [icons.permaCc,      "Perma.cc"],
    [icons.webGyotaku,   "Web Gyotaku"],
    [icons.yandexCache,  "Yandex Cache"],
    [icons.archiveIt,    "Archive-It"],
    [icons.webcite,      "WebCite"],
  ];
  const providerGrid = providers.map(([icon, name]) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:7px;">
      <div style="width:28px;height:28px;border-radius:6px;background:#f3f0ea;display:grid;place-items:center;flex-shrink:0;">${icon}</div>
      <span style="font-size:13px;color:#1c1917;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</span>
    </div>`).join("");

  return `
    <div style="position:relative;margin:-26px;min-height:600px;overflow:hidden;">
      <div style="position:absolute;inset:0;background:#fff;overflow:hidden;font-family:'Georgia',serif;">
        <div style="background:#fff;border-bottom:1px solid #dfdfdf;text-align:center;padding:16px 24px 14px;">
          <svg width="370" height="50" viewBox="0 0 185 25" xmlns="http://www.w3.org/2000/svg"><path d="M13.8 2.9c0-2-1.9-2.5-3.4-2.5v.3c.9 0 1.6.3 1.6 1 0 .4-.3 1-1.2 1-.7 0-2.2-.4-3.3-.8C6.2 1.4 5 1 4 1 2 1 .6 2.5.6 4.2c0 1.5 1.1 2 1.5 2.2l.1-.2c-.2-.2-.5-.4-.5-1 0-.4.4-1.1 1.4-1.1.9 0 2.1.4 3.7.9 1.4.4 2.9.7 3.7.8v3.1L9 10.2v.1l1.5 1.3v4.3c-.8.5-1.7.6-2.5.6-1.5 0-2.8-.4-3.9-1.6l4.1-2V6l-5 2.2C3.6 6.9 4.7 6 5.8 5.4l-.1-.3c-3 .8-5.7 3.6-5.7 7 0 4 3.3 7 7 7 4 0 6.6-3.2 6.6-6.5h-.2c-.6 1.3-1.5 2.5-2.6 3.1v-4.1l1.6-1.3v-.1l-1.6-1.3V5.8c1.5 0 3-1 3-2.9zm-8.7 11l-1.2.6c-.7-.9-1.1-2.1-1.1-3.8 0-.7 0-1.5.2-2.1l2.1-.9v6.2zm10.6 2.3l-1.3 1 .2.2.6-.5 2.2 2 3-2-.1-.2-.8.5-1-1V9.4l.8-.6 1.7 1.4v6.1c0 3.8-.8 4.4-2.5 5v.3c2.8.1 5.4-.8 5.4-5.7V9.3l.9-.7-.2-.2-.8.6-2.5-2.1L18.5 9V.8h-.2l-3.5 2.4v.2c.4.2 1 .4 1 1.5l-.1 11.3zM34 15.1L31.5 17 29 15v-1.2l4.7-3.2v-.1l-2.4-3.6-5.2 2.8v6.6l-1 .8.2.2.9-.7 3.4 2.5 4.5-3.6-.1-.4zm-5-1.7V8.5l.2-.1 2.2 3.5-2.4 1.5zM53.1 2c0-.3-.1-.6-.2-.9h-.2c-.3.8-.7 1.2-1.7 1.2-.9 0-1.5-.5-1.9-.9l-2.9 3.3.2.2 1-.9c.6.5 1.1.9 2.5 1v8.3L44 3.2c-.5-.8-1.2-1.9-2.6-1.9-1.6 0-3 1.4-2.8 3.6h.3c.1-.6.4-1.3 1.1-1.3.5 0 1 .5 1.3 1v3.3c-1.8 0-3 .8-3 2.3 0 .8.4 2 1.6 2.3v-.2c-.2-.2-.3-.4-.3-.7 0-.5.4-.9 1.1-.9h.5v4.2c-2.1 0-3.8 1.2-3.8 3.2 0 1.9 1.6 2.8 3.4 2.7v-.2c-1.1-.1-1.6-.6-1.6-1.3 0-.9.6-1.3 1.4-1.3.8 0 1.5.5 2 1.1l2.9-3.2-.2-.2-.7.8c-1.1-1-1.7-1.3-3-1.5V5l8 14h.6V5c1.5-.1 2.9-1.3 2.9-3zm7.3 13.1L57.9 17l-2.5-2v-1.2l4.7-3.2v-.1l-2.4-3.6-5.2 2.8v6.6l-1 .8.2.2.9-.7 3.4 2.5 4.5-3.6-.1-.4zm-5-1.7V8.5l.2-.1 2.2 3.5-2.4 1.5zM76.7 8l-.7.5-1.9-1.6-2.2 2 .9.9v7.5l-2.4-1.5V9.6l.8-.5-2.3-2.2-2.2 2 .9.9V17l-.3.2-2.1-1.5v-6c0-1.4-.7-1.8-1.5-2.3-.7-.5-1.1-.8-1.1-1.5 0-.6.6-.9.9-1.1v-.2c-.8 0-2.9.8-2.9 2.7 0 1 .5 1.4 1 1.9s1 .9 1 1.8v5.8l-1.1.8.2.2 1-.8 2.3 2 2.5-1.7 2.8 1.7 5.3-3.1V9.2l1.3-1-.2-.2zm18.6-5.5l-1 .9-2.2-2-3.3 2.4V1.6h-.3l.1 16.2c-.3 0-1.2-.2-1.9-.4l-.2-13.5c0-1-.7-2.4-2.5-2.4s-3 1.4-3 2.8h.3c.1-.6.4-1.1 1-1.1s1.1.4 1.1 1.7v3.9c-1.8.1-2.9 1.1-2.9 2.4 0 .8.4 2 1.6 2v-.2c-.4-.2-.5-.5-.5-.7 0-.6.5-.8 1.3-.8h.4v6.2c-1.5.5-2.1 1.6-2.1 2.8 0 1.7 1.3 2.9 3.3 2.9 1.4 0 2.6-.2 3.8-.5 1-.2 2.3-.5 2.9-.5.8 0 1.1.4 1.1.9 0 .7-.3 1-.7 1.1v.2c1.6-.3 2.6-1.3 2.6-2.8 0-1.5-1.5-2.4-3.1-2.4-.8 0-2.5.3-3.7.5-1.4.3-2.8.5-3.2.5-.7 0-1.5-.3-1.5-1.3 0-.8.7-1.5 2.4-1.5.9 0 2 .1 3.1.4 1.2.3 2.3.6 3.3.6 1.5 0 2.8-.5 2.8-2.6V3.7l1.2-1-.2-.2zm-4.1 6.1c-.3.3-.7.6-1.2.6s-1-.3-1.2-.6V4.2l1-.7 1.4 1.3v3.8zm0 3c-.2-.2-.7-.5-1.2-.5s-1 .3-1.2.5V9c.2.2.7.5 1.2.5s1-.3 1.2-.5v2.6zm0 4.7c0 .8-.5 1.6-1.6 1.6h-.8V12c.2-.2.7-.5 1.2-.5s.9.3 1.2.5v4.3zm13.7-7.1l-3.2-2.3-4.9 2.8v6.5l-1 .8.1.2.8-.6 3.2 2.4 5-3V9.2zm-5.4 6.3V8.3l2.5 1.8v7.1l-2.5-1.7zm14.9-8.4h-.2c-.3.2-.6.4-.9.4-.4 0-.9-.2-1.1-.5h-.2l-1.7 1.9-1.7-1.9-3 2 .1.2.8-.5 1 1.1v6.3l-1.3 1 .2.2.6-.5 2.4 2 3.1-2.1-.1-.2-.9.5-1.2-1V9c.5.5 1.1 1 1.8 1 1.4.1 2.2-1.3 2.3-2.9zm12 9.6L123 19l-4.6-7 3.3-5.1h.2c.4.4 1 .8 1.7.8s1.2-.4 1.5-.8h.2c-.1 2-1.5 3.2-2.5 3.2s-1.5-.5-2.1-.8l-.3.5 5 7.4 1-.6v.1zm-11-.5l-1.3 1 .2.2.6-.5 2.2 2 3-2-.2-.2-.8.5-1-1V.8h-.1l-3.6 2.4v.2c.4.2 1 .3 1 1.5v11.3zM143 2.9c0-2-1.9-2.5-3.4-2.5v.3c.9 0 1.6.3 1.6 1 0 .4-.3 1-1.2 1-.7 0-2.2-.4-3.3-.8-1.3-.4-2.5-.8-3.5-.8-2 0-3.4 1.5-3.4 3.2 0 1.5 1.1 2 1.5 2.2l.1-.2c-.3-.2-.6-.4-.6-1 0-.4.4-1.1 1.4-1.1.9 0 2.1.4 3.7.9 1.4.4 2.9.7 3.7.8V9l-1.5 1.3v.1l1.5 1.3V16c-.8.5-1.7.6-2.5.6-1.5 0-2.8-.4-3.9-1.6l4.1-2V6l-5 2.2c.5-1.3 1.6-2.2 2.6-2.9l-.1-.2c-3 .8-5.7 3.5-5.7 6.9 0 4 3.3 7 7 7 4 0 6.6-3.2 6.6-6.5h-.2c-.6 1.3-1.5 2.5-2.6 3.1v-4.1l1.6-1.3v-.1L140 8.8v-3c1.5 0 3-1 3-2.9zm-8.7 11l-1.2.6c-.7-.9-1.1-2.1-1.1-3.8 0-.7.1-1.5.3-2.1l2.1-.9-.1 6.2zm12.2-12h-.1l-2 1.7v.1l1.7 1.9h.2l2-1.7v-.1l-1.8-1.9zm3 14.8l-.8.5-1-1V9.3l1-.7-.2-.2-.7.6-1.8-2.1-2.9 2 .2.3.7-.5.9 1.1v6.5l-1.3 1 .1.2.7-.5 2.2 2 3-2-.1-.3zm16.7-.1l-.7.5-1.1-1V9.3l1-.8-.2-.2-.8.7-2.3-2.1-3 2.1-2.3-2.1L154 9l-1.8-2.1-2.9 2 .1.3.7-.5 1 1.1v6.5l-.8.8 2.3 1.9 2.2-2-.9-.9V9.3l.9-.6 1.5 1.4v6l-.8.8 2.3 1.9 2.2-2-.9-.9V9.3l.8-.5 1.6 1.4v6l-.7.7 2.3 2.1 3.1-2.1v-.3zm8.7-1.5l-2.5 1.9-2.5-2v-1.2l4.7-3.2v-.1l-2.4-3.6-5.2 2.8v6.8l3.5 2.5 4.5-3.6-.1-.3zm-5-1.7V8.5l.2-.1 2.2 3.5-2.4 1.5zm14.1-.9l-1.9-1.5c1.3-1.1 1.8-2.6 1.8-3.6v-.6h-.2c-.2.5-.6 1-1.4 1-.8 0-1.3-.4-1.8-1L176 9.3v3.6l1.7 1.3c-1.7 1.5-2 2.5-2 3.3 0 1 .5 1.7 1.3 2l.1-.2c-.2-.2-.4-.3-.4-.8 0-.3.4-.8 1.2-.8 1 0 1.6.7 1.9 1l4.3-2.6v-3.6h-.1zm-1.1-3c-.7 1.2-2.2 2.4-3.1 3l-1.1-.9V8.1c.4 1 1.5 1.8 2.6 1.8.7 0 1.1-.1 1.6-.4zm-1.7 8c-.5-1.1-1.7-1.9-2.9-1.9-.3 0-1.1 0-1.9.5.5-.8 1.8-2.2 3.5-3.2l1.2 1 .1 3.6z"/></svg>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;padding:24px 36px 0;">
          <div style="width:100%;max-width:580px;">
            <h2 style="font:700 italic 38px/1.1 'Georgia',serif;color:#111;margin:0 0 18px;letter-spacing:-0.02em;">Yvonne Brill, a Pioneering Rocket<br>Scientist, Dies at 88</h2>
            <div style="border-top:1px solid #dfdfdf;border-bottom:1px solid #dfdfdf;padding:12px 0;margin-bottom:14px;display:flex;align-items:center;gap:10px;">
              <div style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1px solid #ccc;border-radius:999px;font:400 13px/1 ui-sans-serif,sans-serif;color:#333;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                Share full article
              </div>
              <div style="width:36px;height:36px;border:1px solid #ccc;border-radius:50%;display:grid;place-items:center;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              </div>
            </div>
            <div style="margin-bottom:16px;">
              <div style="font:700 15px/1 ui-sans-serif,sans-serif;color:#333;text-decoration:underline;margin-bottom:4px;">By Douglas Martin</div>
              <div style="font:400 14px/1 ui-sans-serif,sans-serif;color:#666;">March 30, 2013</div>
            </div>
            <p style="font:400 19px/1.75 'Georgia',serif;color:#111;margin:0 0 18px;">She was a brilliant rocket scientist who followed her husband from job to job and took eight years off from work to raise three children. &#x201C;The world&#x2019;s best mom,&#x201D; her son Matthew said.</p>
            <p style="font:400 19px/1.75 'Georgia',serif;color:#111;margin:0 0 18px;">Yvonne Brill, who died on Wednesday at 88 in Princeton, N.J., in the early 1970s invented a propulsion system to help keep communications satellites from slipping out of their orbits.</p>
            <p style="font:400 19px/1.75 'Georgia',serif;color:#111;margin:0 0 18px;">The system became the industry standard, and it was the achievement President Obama mentioned in 2011 in presenting her with the National Medal of Technology and Innovation.</p>
            <p style="font:400 19px/1.75 'Georgia',serif;color:#111;margin:0;">Her personal and professional balancing act also won notice. In 1980, Harper&#x2019;s Bazaar magazine and the DeBeers Corporation gave her their Diamond Superwoman award for returning to a successful career after starting a family.</p>
          </div>
        </div>
      </div>
      <div style="
        position:absolute;top:12px;right:12px;width:375px;
        background:radial-gradient(circle at top left,rgba(245,200,0,0.07),transparent 42%),#f8f8f8;
        border-radius:14px;
        box-shadow:0 24px 64px rgba(0,0,0,0.22),0 0 0 1px rgba(0,0,0,0.07);
        padding:12px;font-family:ui-sans-serif,system-ui,sans-serif;
      ">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <div style="width:46px;height:46px;border-radius:11px;background:#ffd400;display:grid;place-items:center;flex-shrink:0;box-shadow:0 8px 20px rgba(255,212,0,0.28);">
            <svg aria-hidden="true" viewBox="0 0 1248 1248" width="25" height="25" style="display:block"><path fill="white" fill-rule="evenodd" d="M310 208 C310 197 319 188 330 188 L674 188 C846 188 962 302 962 486 C962 671 846 785 674 785 L535 785 L535 1038 C535 1049 526 1058 515 1058 L330 1058 C319 1058 310 1049 310 1038 Z M476 490 L635 360 C642 354 653 359 653 369 L653 431 L772 431 C781 431 788 438 788 447 L788 533 C788 542 781 549 772 549 L653 549 L653 612 C653 622 642 627 635 621 Z"/></svg>
          </div>
          <div>
            <div style="font-size:15px;font-weight:700;color:#0c0a09;line-height:1.2;">PastPage</div>
            <div style="font-size:13px;color:#78716c;margin-top:2px;">Find archived versions of pages.</div>
          </div>
          <div style="margin-left:auto;border:1px solid #d6d3d1;border-radius:7px;padding:5px 10px;font-size:13px;color:#78716c;display:flex;align-items:center;gap:4px;background:white;white-space:nowrap;">
            Tab <span style="font-size:10px;margin-left:2px;">▾</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 14px;border-radius:10px;background:#ffd400;color:#17130a;border:1px solid rgba(23,19,10,0.18);font:700 15px/1 ui-sans-serif,sans-serif;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/></svg>
            Check Archived Versions
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 14px;border-radius:10px;background:white;color:#1c1917;border:1px solid #d6d3d1;font:600 15px/1 ui-sans-serif,sans-serif;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Open All Archives in Tabs
          </div>
        </div>
        <div style="border-radius:10px;border:1px solid #e7e3db;background:white;padding:6px;margin-bottom:10px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;">${providerGrid}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border-radius:8px;border:1px solid #e5e2db;font:600 13px/1 ui-sans-serif,sans-serif;color:#ca8a04;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            History
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border-radius:8px;border:1px solid #e5e2db;font:500 13px/1 ui-sans-serif,sans-serif;color:#57534e;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Settings
          </div>
        </div>
      </div>
    </div>`;
}

function buildHistoryPanel() {
  const entries = [
    {
      outcome: "hit", border: "#34d399",
      badge: { bg: "#d1fae5", color: "#065f46", dot: "#10b981", label: "Hit" },
      domain: "nytimes.com", path: "/2013/03/31/science/space/yvonne-brill-rocket-scientist-dies-at-88.html",
      time: "3 hours ago", trigger: "Manual lookup",
      snapshots: [
        { provider: "Wayback Machine", ts: "20230814120432", url: "https://web.archive.org/web/20230814120432/https://nytimes.com/2013/03/31/science/space/yvonne-brill-rocket-scientist-dies-at-88.html" },
        { provider: "Archive.today", ts: "20220601083211", url: "https://archive.ph/xKq2T" }
      ]
    },
    {
      outcome: "hit", border: "#34d399",
      badge: { bg: "#d1fae5", color: "#065f46", dot: "#10b981", label: "Hit" },
      domain: "whitehouse.gov", path: "/the-record/climate",
      time: "1 day ago", trigger: "Broken page",
      snapshots: [{ provider: "Wayback Machine", ts: "20230101094512", url: "https://web.archive.org/web/20230101094512/https://whitehouse.gov/the-record/climate" }]
    },
    {
      outcome: "miss", border: "#d6d3d1",
      badge: { bg: "#f5f5f4", color: "#57534e", dot: "#a8a29e", label: "No hit" },
      domain: "washingtonpost.com", path: "/technology/2023/10/12/silicon-valley-ai-open-source-regulation",
      time: "2 days ago", trigger: "Manual lookup",
      snapshots: []
    },
    {
      outcome: "hit", border: "#34d399",
      badge: { bg: "#d1fae5", color: "#065f46", dot: "#10b981", label: "Hit" },
      domain: "theguardian.com", path: "/technology/2023/aug/12/ai-chatbot-journalism-newspapers-trust",
      time: "2 days ago", trigger: "Context menu",
      snapshots: [{ provider: "Wayback Machine", ts: "20231015110044", url: "https://web.archive.org/web/20231015110044/https://theguardian.com/technology/2023/aug/12/ai-chatbot-journalism-newspapers-trust" }]
    },
    {
      outcome: "unknown", border: "#fbbf24",
      badge: { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b", label: "Unknown" },
      domain: "bbc.co.uk", path: "/news/world-us-canada-66847230",
      time: "3 days ago", trigger: "Manual lookup",
      snapshots: []
    },
  ];

  const entryHtml = entries.map(e => {
    const snapshotToggle = e.snapshots.length > 0
      ? `<div style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:6px;font:400 11px/1 ui-sans-serif,sans-serif;color:#78716c;">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
           ${e.snapshots.length} snapshot${e.snapshots.length > 1 ? "s" : ""}
         </div>` : "";
    return `
      <li style="border-left:3px solid ${e.border};list-style:none;">
        <div style="display:flex;align-items:flex-start;gap:14px;padding:14px 20px;border-bottom:1px solid #f5f5f4;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:6px;">
              <div style="min-width:0;flex:1;">
                <p style="margin:0;font:600 14px/1.3 ui-sans-serif,sans-serif;color:#0c0a09;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.domain}</p>
                <p style="margin:2px 0 0;font:400 12px/1 ui-sans-serif,sans-serif;color:#78716c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.path}</p>
              </div>
              <time style="flex-shrink:0;font:400 12px/1 ui-sans-serif,sans-serif;color:#a8a29e;">${e.time}</time>
            </div>
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">
              <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font:600 11px/1 ui-sans-serif,sans-serif;background:${e.badge.bg};color:${e.badge.color};">
                <span style="width:6px;height:6px;border-radius:50%;background:${e.badge.dot};display:inline-block;"></span>
                ${e.badge.label}
              </span>
              <span style="display:inline-flex;padding:2px 8px;border-radius:999px;font:400 11px/1 ui-sans-serif,sans-serif;background:#f5f5f4;color:#57534e;">${e.trigger}</span>
              ${snapshotToggle}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;border:1px solid #e7e5e4;background:white;font:500 13px/1 ui-sans-serif,sans-serif;color:#44403c;flex-shrink:0;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            Rerun
          </div>
        </div>
      </li>`;
  }).join("");

  return `
    <div style="margin:-26px;overflow:hidden;background:radial-gradient(ellipse at top,rgba(245,200,0,0.06),transparent 55%),linear-gradient(160deg,#ffffff 0%,#f8f8f8 100%);padding:20px 24px;font-family:ui-sans-serif,system-ui,sans-serif;min-height:560px;">
      <header style="display:flex;align-items:flex-start;gap:12px;margin-bottom:20px;">
        <div style="width:40px;height:40px;border-radius:8px;background:#ffd400;display:grid;place-items:center;flex-shrink:0;margin-top:2px;box-shadow:0 10px 30px rgba(255,212,0,0.28);">
          <svg aria-hidden="true" viewBox="0 0 1248 1248" width="21" height="21" style="display:block"><path fill="white" fill-rule="evenodd" d="M310 208 C310 197 319 188 330 188 L674 188 C846 188 962 302 962 486 C962 671 846 785 674 785 L535 785 L535 1038 C535 1049 526 1058 515 1058 L330 1058 C319 1058 310 1049 310 1038 Z M476 490 L635 360 C642 354 653 359 653 369 L653 431 L772 431 C781 431 788 438 788 447 L788 533 C788 542 781 549 772 549 L653 549 L653 612 C653 622 642 627 635 621 Z"/></svg>
        </div>
        <div>
          <h1 style="margin:0;font:600 22px/1.2 ui-sans-serif,sans-serif;color:#0c0a09;">Archive Search History</h1>
          <p style="margin:4px 0 0;font:400 13px/1.5 ui-sans-serif,sans-serif;color:#57534e;max-width:560px;">Browse saved archive lookups in a dedicated, filterable table view.</p>
        </div>
      </header>

      <div style="border-radius:14px;border:1px solid #e7e5e4;background:rgba(255,255,255,0.9);margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.05);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 20px;">
          <div style="display:flex;align-items:center;gap:24px;">
            <div>
              <p style="margin:0;font:600 22px/1 ui-sans-serif,sans-serif;color:#0c0a09;">47</p>
              <p style="margin:3px 0 0;font:400 11px/1 ui-sans-serif,sans-serif;color:#78716c;">Stored search runs</p>
            </div>
            <div style="width:1px;height:36px;background:#e7e5e4;"></div>
            <div>
              <p style="margin:0;font:600 22px/1 ui-sans-serif,sans-serif;color:#0c0a09;">31</p>
              <p style="margin:3px 0 0;font:400 11px/1 ui-sans-serif,sans-serif;color:#78716c;">Search runs with confirmed hits</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;border:1px solid #e7e5e4;background:white;font:500 13px/1 ui-sans-serif,sans-serif;color:#57534e;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Clear history
          </div>
        </div>
      </div>

      <div style="border-radius:14px;border:1px solid #e7e5e4;background:rgba(255,255,255,0.92);margin-bottom:12px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,0.05);">
        <div style="display:flex;gap:8px;">
          <div style="position:relative;flex:1;">
            <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <div style="height:38px;border-radius:10px;border:1px solid #d6d3d1;background:white;padding:0 12px 0 34px;font:400 13px/38px ui-sans-serif,sans-serif;color:#a8a29e;">Search by source URL or archive URL</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;padding:0 12px;height:38px;border-radius:10px;border:1px solid #d6d3d1;background:white;font:500 13px/1 ui-sans-serif,sans-serif;color:#57534e;white-space:nowrap;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            Filters
          </div>
        </div>
      </div>

      <div style="border-radius:14px;border:1px solid #e7e5e4;background:rgba(255,255,255,0.94);overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.05);">
        <ul style="margin:0;padding:0;">${entryHtml}</ul>
      </div>
    </div>`;
}

function buildResolverPanel() {
  const targetUrl = "https://www.nytimes.com/2013/03/31/science/space/yvonne-brill-rocket-scientist-dies-at-88.html";
  const archiveUrl = "https://web.archive.org/web/20230814120432/https://www.nytimes.com/2013/03/31/science/space/yvonne-brill-rocket-scientist-dies-at-88.html";

  const iconExternal = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
  const iconCopy = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const iconFileSearch = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><circle cx="11.5" cy="14.5" r="2.5"/><path d="M13.3 16.3 15 18"/></svg>`;
  const iconCheck = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>`;

  const BASE_BTN = "display:inline-flex;align-items:center;justify-content:center;gap:8px;height:32px;padding:0 10px;border-radius:6px;font:600 12px/1 ui-sans-serif,sans-serif;text-decoration:none;white-space:nowrap;";
  const btnPrimary = (icon, label) => `<span style="${BASE_BTN}border:1px solid #fde047;background:#ffd400;color:#0c0a09;box-shadow:0 8px 24px rgba(255,212,0,0.22);">${icon}${label}</span>`;
  const btnSecondary = (icon, label) => `<span style="${BASE_BTN}border:1px solid #d6d3d1;background:#fff;color:#0c0a09;">${icon}${label}</span>`;
  const btnGhost = (icon, label) => `<span style="${BASE_BTN}border:1px solid transparent;background:transparent;color:#44403c;">${icon}${label}</span>`;

  const snapshotCard = (provider, ts, url) => `
    <div style="margin-top:12px;border-radius:6px;background:#f5f5f4;padding:8px;">
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding:0 4px;">
        <p style="margin:0;font:600 12px/1 ui-sans-serif,sans-serif;color:#0c0a09;">${provider}</p>
        <p style="margin:0;font:400 11px/1 ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:0.12em;color:#78716c;">${ts}</p>
      </div>
      <p style="margin:8px 0 0;padding:0 4px;font:400 12px/1.5 ui-sans-serif,sans-serif;color:#44403c;word-break:break-all;">${url}</p>
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">${btnPrimary(iconExternal, "Open archived version")}${btnSecondary(iconCopy, "Copy archive link")}</div>
    </div>`;

  const manualSourceCard = (provider, url) => `
    <div style="border-radius:6px;background:#f5f5f4;padding:8px;">
      <p style="margin:0;padding:0 4px;font:600 12px/1 ui-sans-serif,sans-serif;color:#0c0a09;">${provider}</p>
      <p style="margin:8px 0 0;padding:0 4px;font:400 12px/1.5 ui-sans-serif,sans-serif;color:#44403c;word-break:break-all;">${url}</p>
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">${btnGhost(iconExternal, `Check on ${provider}`)}${btnSecondary(iconCopy, "Copy archive link")}</div>
    </div>`;

  const footerLinks = [
    { label: "Settings",          icon: iconExternal },
    { label: "History",           icon: iconExternal },
    { label: "GitHub",            icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M15 6a9 9 0 0 0-9 9V3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/></svg>` },
    { label: "Chrome Web Store",  icon: iconExternal },
    { label: "License",           icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/></svg>` },
    { label: "Privacy",           icon: iconExternal },
    { label: "Support",           icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg>` },
    { label: "Send feedback",     icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>` },
  ];

  return `
    <div style="margin:-26px;overflow:hidden;background:radial-gradient(ellipse at top,rgba(245,200,0,0.06),transparent 55%),linear-gradient(160deg,#ffffff 0%,#f8f8f8 100%);padding:24px 16px;font-family:ui-sans-serif,system-ui,sans-serif;min-height:560px;">
      <header style="margin-bottom:24px;display:flex;align-items:flex-start;gap:12px;">
        <div style="margin-top:2px;display:grid;height:40px;width:40px;flex-shrink:0;place-items:center;border-radius:6px;background:#ffd400;box-shadow:0 10px 30px rgba(255,212,0,0.28);">
          <svg aria-hidden="true" viewBox="0 0 1248 1248" width="21" height="21" style="display:block"><path fill="white" fill-rule="evenodd" d="M310 208 C310 197 319 188 330 188 L674 188 C846 188 962 302 962 486 C962 671 846 785 674 785 L535 785 L535 1038 C535 1049 526 1058 515 1058 L330 1058 C319 1058 310 1049 310 1038 Z M476 490 L635 360 C642 354 653 359 653 369 L653 431 L772 431 C781 431 788 438 788 447 L788 533 C788 542 781 549 772 549 L653 549 L653 612 C653 622 642 627 635 621 Z"/></svg>
        </div>
        <div>
          <h1 style="margin:0;font:600 24px/1.3 ui-sans-serif,sans-serif;color:#0c0a09;">Checking archived versions</h1>
          <p style="margin:4px 0 0;max-width:640px;font:400 14px/1.5 ui-sans-serif,sans-serif;color:#57534e;">PastPage checks archived captures across multiple providers.</p>
        </div>
      </header>

      <div style="display:flex;flex-direction:column;gap:16px;">

        <!-- SourceSummary -->
        <section style="border-radius:6px;border:1px solid #e7e5e4;background:rgba(255,255,255,0.95);padding:16px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
          <div style="display:flex;gap:12px;">
            <div style="margin-top:2px;display:grid;height:36px;width:36px;flex-shrink:0;place-items:center;border-radius:6px;background:#ffd400;">${iconFileSearch}</div>
            <div style="min-width:0;">
              <h2 style="margin:0;font:600 16px/1.4 ui-sans-serif,sans-serif;color:#0c0a09;">Current source</h2>
              <p style="margin:4px 0 0;font:400 14px/1.5 ui-sans-serif,sans-serif;color:#57534e;">Checking archived versions for this page.</p>
              <div style="margin-top:12px;border-radius:6px;background:#f5f5f4;padding:8px;">
                <p style="margin:0;padding:0 4px;font:400 12px/1.5 ui-sans-serif,sans-serif;color:#44403c;word-break:break-all;">${targetUrl}</p>
                <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">${btnSecondary(iconExternal, "Open current page")}${btnSecondary(iconCopy, "Copy URL")}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Found results -->
        <section style="border-radius:6px;border:1px solid #e7e5e4;background:rgba(255,255,255,0.95);padding:16px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div style="display:flex;gap:12px;">
              <div style="margin-top:2px;display:grid;height:36px;width:36px;flex-shrink:0;place-items:center;border-radius:6px;background:#ffd400;">${iconCheck}</div>
              <div style="min-width:0;">
                <h2 style="margin:0;font:600 16px/1.4 ui-sans-serif,sans-serif;color:#0c0a09;">Archived version found on Wayback Machine</h2>
                ${snapshotCard("Wayback Machine", "20230814120432", archiveUrl)}
              </div>
            </div>
            <div style="border-top:1px solid #e7e5e4;padding-top:12px;display:flex;flex-direction:column;gap:8px;">
              <h3 style="margin:0;font:600 14px/1 ui-sans-serif,sans-serif;color:#1c1917;">Other archived versions found</h3>
              ${snapshotCard("Archive.today", "20220601083211", "https://archive.ph/6ZkLm")}
            </div>
            <div style="border-top:1px solid #e7e5e4;padding-top:12px;display:flex;flex-direction:column;gap:8px;">
              <h3 style="margin:0;font:600 14px/1 ui-sans-serif,sans-serif;color:#1c1917;">Check Other archive sources</h3>
              ${manualSourceCard("Ghostarchive", "https://ghostarchive.org/search?term=https://www.nytimes.com/2013/03/31/science/space/yvonne-brill-rocket-scientist-dies-at-88.html")}
              ${manualSourceCard("Arquivo.pt", "https://arquivo.pt/wayback/*/https://www.nytimes.com/2013/03/31/science/space/yvonne-brill-rocket-scientist-dies-at-88.html")}
              ${manualSourceCard("UK Web Archive", "https://webarchive.nationalarchives.gov.uk/ukgwa/*/https://www.nytimes.com/2013/03/31/science/space/yvonne-brill-rocket-scientist-dies-at-88.html")}
            </div>
          </div>
        </section>

        <!-- ResearcherFooter -->
        <footer style="border-top:1px solid #e7e5e4;padding-top:20px;">
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${footerLinks.map(({ label, icon }) => `<span style="display:inline-flex;align-items:center;gap:6px;border-radius:6px;padding:4px 8px;color:#57534e;font:400 14px/1 ui-sans-serif,sans-serif;">${icon}${label}</span>`).join("")}
          </div>
          <div style="margin-top:16px;display:flex;align-items:center;gap:8px;">
            <div style="display:grid;height:32px;width:32px;flex-shrink:0;place-items:center;border-radius:6px;background:#ffd400;box-shadow:0 10px 24px rgba(255,212,0,0.2);">
              <svg aria-hidden="true" viewBox="0 0 1248 1248" width="17" height="17" style="display:block"><path fill="white" fill-rule="evenodd" d="M310 208 C310 197 319 188 330 188 L674 188 C846 188 962 302 962 486 C962 671 846 785 674 785 L535 785 L535 1038 C535 1049 526 1058 515 1058 L330 1058 C319 1058 310 1049 310 1038 Z M476 490 L635 360 C642 354 653 359 653 369 L653 431 L772 431 C781 431 788 438 788 447 L788 533 C788 542 781 549 772 549 L653 549 L653 612 C653 622 642 627 635 621 Z"/></svg>
            </div>
            <div>
              <p style="margin:0;font:600 14px/1 ui-sans-serif,sans-serif;color:#0c0a09;">PastPage</p>
              <p style="margin:4px 0 0;font:400 12px/1.4 ui-sans-serif,sans-serif;color:#78716c;">PastPage is an open source tool for journalists and researchers to surface archived versions of vanished or changed pages.</p>
            </div>
          </div>
        </footer>

      </div>
    </div>`;
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
  const providerIcons = await loadProviderIcons();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await screenshotHtml(
      page,
      path.join(screenshotsDir, "popup.png"),
      cardShell({
        title: "Look up any page across multiple web archives",
        subtitle: "Click the PastPage icon on any tab to search archived versions — or paste a URL to look up any page directly.",
        chips: [],
        body: "",
        panel: buildPopupPanel(providerIcons)
      })
    );

    await screenshotHtml(
      page,
      path.join(screenshotsDir, "broken-page.png"),
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
      path.join(screenshotsDir, "resolver.png"),
      cardShell({
        title: "All archives searched. Best match surfaced instantly.",
        subtitle: "PastPage queries every enabled archive in parallel and shows the best available snapshot the moment results arrive.",
        chips: [],
        body: "",
        panel: buildResolverPanel()
      })
    );

    await screenshotHtml(
      page,
      path.join(screenshotsDir, "history.png"),
      cardShell({
        title: "Every archive lookup, saved and searchable",
        subtitle: "Keep a local record of every search — filter by domain, outcome, or date, and rerun any lookup with one click.",
        chips: [],
        body: "",
        panel: buildHistoryPanel()
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
      "screenshots/popup.png",
      "screenshots/broken-page.png",
      "screenshots/resolver.png",
      "screenshots/history.png"
    ]
  };
  await fs.writeFile(path.join(artifactsDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

await main();
