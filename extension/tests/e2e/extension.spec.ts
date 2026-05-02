import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../.output/chrome-mv3");
const testHost = "pastpage.test";

let server: Server;
let baseUrl: string;
let context: BrowserContext;

async function launchExtension() {
  const launched = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--host-resolver-rules=MAP ${testHost} 127.0.0.1`,
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  const serviceWorker = launched.serviceWorkers()[0] ?? (await launched.waitForEvent("serviceworker"));
  await serviceWorker.evaluate(
    () => (globalThis as unknown as { chrome: { runtime: { id: string } } }).chrome.runtime.id
  );
  return launched;
}

function startServer(): Promise<string> {
  server = createServer((request, response) => {
    if (request.url?.startsWith("/missing")) {
      response.writeHead(404, { "content-type": "text/html" });
      response.end("<!doctype html><title>Missing</title><h1>Not found</h1>");
      return;
    }

    if (request.url?.startsWith("/asset-missing")) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("missing");
      return;
    }

    if (request.url?.startsWith("/with-broken-img")) {
      response.writeHead(200, { "content-type": "text/html" });
      response.end('<!doctype html><title>OK</title><h1>OK</h1><img src="/asset-missing">');
      return;
    }

    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>OK</title><h1>OK</h1>");
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        resolve(`http://${testHost}:${address.port}`);
      }
    });
  });
}

test.beforeAll(async () => {
  baseUrl = await startServer();
  context = await launchExtension();
  await Promise.all(
    context
      .pages()
      .filter((page) => !page.isClosed())
      .map((page) => page.close().catch(() => undefined))
  );
  await context.route("https://web.archive.org/cdx**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
        ["20240102030405", `${baseUrl}/missing`, "text/html", "200", "digest", "120"]
      ])
    });
  });
  await context.route("https://web.archive.org/web/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Wayback</title><h1>Archived</h1>"
    });
  });
});

test.afterAll(async () => {
  await context?.close();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

test.afterEach(async () => {
  await Promise.all(
    context
      .pages()
      .filter((page) => !page.isClosed())
      .map((page) => page.close().catch(() => undefined))
  );
});

async function newPage(): Promise<Page> {
  const page = await context.newPage();
  return page;
}

test("main-frame 404 shows the top bar", async () => {
  const page = await newPage();
  await page.goto(`${baseUrl}/missing?case=topbar`);
  await expect(page.getByRole("button", { name: "Find Archived Version" }).first()).toBeVisible();
});

test("subresource 404 does not show the top bar", async () => {
  const page = await newPage();
  await page.goto(`${baseUrl}/with-broken-img`);
  await expect(page.getByRole("button", { name: "Find Archived Version" })).toHaveCount(0);
});

test("clicking Find Archived Version opens resolver and opens Wayback in a separate tab", async () => {
  const page = await newPage();
  await page.goto(`${baseUrl}/missing?case=topbar`);
  await expect(page.getByRole("button", { name: "Find Archived Version" }).first()).toBeVisible();

  const resolverPromise = context.waitForEvent("page");
  await page.getByRole("button", { name: "Find Archived Version" }).first().click({ force: true });
  const resolver = await resolverPromise;

  await expect(resolver).toHaveURL(/resolver\.html/);
  await expect(resolver.getByText(/Checking archived versions/i)).toBeVisible();
  await expect(resolver.getByText(/Archived version found/i)).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(() => context.pages().map((currentPage) => currentPage.url()))
    .toContainEqual(expect.stringMatching(/web\.archive\.org\/web\/20240102030405/));

  const archive = context
    .pages()
    .find((currentPage) => /web\.archive\.org\/web\/20240102030405/.test(currentPage.url()));

  if (!archive) {
    throw new Error("Expected an archive tab to open.");
  }

  await expect(archive).toHaveURL(/web\.archive\.org\/web\/20240102030405/);
  await expect(resolver).toHaveURL(/resolver\.html/);
});
