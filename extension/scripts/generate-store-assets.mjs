import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(__dirname, "..");
const extensionPath = path.resolve(extensionDir, ".output/chrome-mv3");
const artifactsDir = path.resolve(extensionDir, "..", "artifacts", "store-assets");
const screenshotsDir = path.join(artifactsDir, "screenshots");
const chromeDir = path.join(artifactsDir, "chrome");
const testHost = "pastpage.test";

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function startServer() {
  const server = createServer((request, response) => {
    if (request.url?.startsWith("/missing")) {
      response.writeHead(404, { "content-type": "text/html" });
      response.end(`<!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>Missing</title>
            <style>
              body { font-family: ui-sans-serif, system-ui, sans-serif; background: #faf7ef; color: #1c1917; margin: 0; }
              main { max-width: 960px; margin: 96px auto; padding: 0 32px; }
              h1 { font-size: 52px; margin: 0 0 16px; }
              p { font-size: 20px; line-height: 1.6; color: #57534e; }
            </style>
          </head>
          <body>
            <main>
              <h1>404</h1>
              <p>This page is missing. PastPage should offer archive recovery on top of this error page.</p>
            </main>
          </body>
        </html>`);
      return;
    }

    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Reference Story</title>
          <style>
            body { font-family: ui-sans-serif, system-ui, sans-serif; background: linear-gradient(180deg, #fffbeb 0%, #ffffff 100%); color: #1c1917; margin: 0; }
            article { max-width: 760px; margin: 80px auto; padding: 0 28px; }
            h1 { font-size: 48px; line-height: 1.1; margin: 0 0 18px; }
            p { font-size: 19px; line-height: 1.7; color: #57534e; }
          </style>
        </head>
        <body>
          <article>
            <h1>Reference page for archive lookup</h1>
            <p>PastPage uses this local page to demonstrate popup lookup and resolver output for store screenshots.</p>
          </article>
        </body>
      </html>`);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://${testHost}:${address.port}` });
    });
  });
}

async function launchExtensionContext() {
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      "--lang=en-US",
      `--host-resolver-rules=MAP ${testHost} 127.0.0.1`,
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const serviceWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const extensionId = await serviceWorker.evaluate(
    () => globalThis.chrome.runtime.id
  );

  await context.route("https://web.archive.org/cdx**", async (route) => {
    const url = new URL(route.request().url());
    const target = url.searchParams.get("url") ?? "http://pastpage.test/unknown";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
        ["20240102030405", target, "text/html", "200", "digest", "120"]
      ])
    });
  });

  await context.route("https://web.archive.org/web/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Wayback</title><body><h1>Archived</h1></body>"
    });
  });

  return { context, extensionId };
}

async function closeExtraPages(context) {
  await Promise.all(
    context
      .pages()
      .filter((page) => !page.isClosed())
      .map((page) => page.close().catch(() => undefined))
  );
}

async function capturePopup(context, extensionId) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.screenshot({
    path: path.join(screenshotsDir, "popup-manual-lookup.png"),
    fullPage: true
  });
  await page.close();
}

async function captureOptions(context, extensionId) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 1600 });
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.screenshot({
    path: path.join(screenshotsDir, "options-privacy-settings.png"),
    fullPage: true
  });
  await page.close();
}

async function captureBrokenPage(context, extensionId, baseUrl) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.goto(
    `chrome-extension://${extensionId}/fallback.html?url=${encodeURIComponent(
      `${baseUrl}/missing?case=fallback-shot`
    )}&kind=http&statusCode=404`
  );
  await page.getByRole("button", { name: "Find Archived Version" }).waitFor({ state: "visible" });
  await page.screenshot({
    path: path.join(screenshotsDir, "broken-page-fallback.png"),
    fullPage: true
  });
  await page.close();
}

async function captureResolver(context, extensionId, baseUrl) {
  const resolver = await context.newPage();
  await resolver.setViewportSize({ width: 1440, height: 1100 });
  await resolver.goto(
    `chrome-extension://${extensionId}/resolver.html?url=${encodeURIComponent(
      `${baseUrl}/story?case=resolver-shot`
    )}&trigger=manual-page`
  );
  await resolver.getByText(/Archived version found/i).waitFor({ state: "visible", timeout: 10000 });
  await resolver.screenshot({
    path: path.join(screenshotsDir, "resolver-results.png"),
    fullPage: true
  });

  await resolver.close().catch(() => undefined);
}

async function capturePromoTile() {
  const page = await chromium.launch({ headless: true }).then((browser) => browser.newPage());
  const iconSvg = await fs.readFile(path.resolve(extensionDir, "public", "icon.svg"), "utf8");
  await page.setViewportSize({ width: 440, height: 280 });
  await page.setContent(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            width: 440px;
            height: 280px;
            overflow: hidden;
            font-family: Georgia, "Iowan Old Style", "Palatino Linotype", serif;
            background:
              radial-gradient(circle at top right, rgba(255, 212, 0, 0.85), transparent 34%),
              linear-gradient(135deg, #13100d 0%, #2f2415 55%, #5e4313 100%);
            color: #fff8dd;
          }
          .frame {
            position: relative;
            width: 100%;
            height: 100%;
            padding: 24px;
            display: grid;
            grid-template-columns: 88px 1fr;
            gap: 18px;
            align-items: center;
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
    </html>`);
  await page.screenshot({ path: path.join(chromeDir, "promo-tile-440x280.png") });
  await page.context().browser().close();
}

async function writeManifest() {
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

async function main() {
  await ensureDir(screenshotsDir);
  await ensureDir(chromeDir);
  const { server, baseUrl } = await startServer();
  const { context, extensionId } = await launchExtensionContext();

  try {
    await closeExtraPages(context);
    await capturePopup(context, extensionId);
    await captureBrokenPage(context, extensionId, baseUrl);
    await captureResolver(context, extensionId, baseUrl);
    await captureOptions(context, extensionId);
    await capturePromoTile();
    await writeManifest();
  } finally {
    await context.close().catch(() => undefined);
    await new Promise((resolve) => server.close(() => resolve()));
  }
}

await main();
