import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const FIXTURE = resolve(ROOT, "edgesuite_ui/tests/browser/smart_date_fixture.html");
const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
]);

let server;
let baseURL;

test.setTimeout(12_000);

function insideRoot(path) {
  return path === ROOT || path.startsWith(`${ROOT}${sep}`);
}

async function serve(request, response) {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const path = url.pathname === "/" ? FIXTURE : resolve(ROOT, `.${decodeURIComponent(url.pathname)}`);
  if (!insideRoot(path)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error("Not a file");
    const content = await readFile(path);
    response.writeHead(200, {
      "content-type": MIME.get(extname(path)) || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(content);
  } catch (_error) {
    response.writeHead(404).end("Not found");
  }
}

test.beforeAll(async () => {
  server = createServer((request, response) => {
    serve(request, response).catch((error) => {
      response.writeHead(500).end(String(error));
    });
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  baseURL = `http://127.0.0.1:${address.port}/`;
});

test.afterAll(async () => {
  if (!server) return;
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
});

async function openPicker(page) {
  const trigger = page.locator(".edge-smart-date__trigger");
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await expect(page.locator(".edge-smart-date__picker")).toBeVisible();
}

async function expectResolved(page, expected) {
  await expect.poll(() => page.evaluate(() => globalThis.__edgeSmartDateResolved)).toMatchObject(expected);
  await expect.poll(() => page.evaluate(() => globalThis.__edgeSmartDateModel)).toMatchObject(expected);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.__edgeSmartDateReady === true);
  await page.evaluate(() => window.scrollTo(0, 430));
});

test("quick-period buttons resolve and emit exact date ranges", async ({ page }) => {
  await openPicker(page);
  await expect(page.getByText("Quick periods", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Last 30 Days", exact: true }).click();

  await expectResolved(page, {
    expression: "last 30 days",
    from_date: "2026-09-20",
    to_date: "2026-10-19",
  });
  await expect(page.locator(".edge-smart-date__period-label")).toHaveText("Last 30 Days");
  await expect(page.locator(".edge-smart-date__range-value")).toHaveText("20-09-2026 – 19-10-2026");

  await openPicker(page);
  await page.getByRole("button", { name: "This Month", exact: true }).click();
  await expectResolved(page, {
    expression: "this month",
    from_date: "2026-10-01",
    to_date: "2026-10-31",
  });
  await expect(page.locator(".edge-smart-date__period-label")).toHaveText("This Month");
});

test("typed business phrases resolve through the same selector", async ({ page }) => {
  const cases = [
    ["May to June 2026", "2026-05-01", "2026-06-30"],
    ["last 2 months", "2026-08-19", "2026-10-19"],
    ["last 5 years", "2021-10-19", "2026-10-19"],
  ];

  for (const [expression, fromDate, toDate] of cases) {
    await openPicker(page);
    const input = page.locator(".edge-smart-date__input");
    await input.fill(expression);
    await expect(page.locator(".edge-smart-date__interpretation")).toBeVisible();
    await page.locator(".edge-smart-date__apply").click();
    await expectResolved(page, {
      expression,
      from_date: fromDate,
      to_date: toDate,
    });
  }

  expect(await page.evaluate(() => globalThis.__edgeSmartDateEvents.length)).toBe(3);
});

test("open picker keeps a stable width across repeated scrolling", async ({ page }) => {
  await openPicker(page);
  const picker = page.locator(".edge-smart-date__picker");
  await page.waitForFunction(() => Boolean(document.querySelector(".edge-smart-date")?.dataset.edgeSmartDateMode));
  const initialWidth = await picker.evaluate((element) => element.getBoundingClientRect().width);
  expect(initialWidth).toBeGreaterThan(500);

  for (const y of [470, 510, 455, 525, 440, 500]) {
    await page.evaluate((nextY) => window.scrollTo(0, nextY), y);
    await page.waitForTimeout(50);
    const width = await picker.evaluate((element) => element.getBoundingClientRect().width);
    expect(Math.abs(width - initialWidth)).toBeLessThan(1);
  }
});

test("responsive picker remains field-sized while scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 720 });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.__edgeSmartDateReady === true);
  await page.evaluate(() => window.scrollTo(0, 430));
  await openPicker(page);

  const trigger = page.locator(".edge-smart-date__trigger");
  const picker = page.locator(".edge-smart-date__picker");
  await page.waitForFunction(() => Boolean(document.querySelector(".edge-smart-date")?.dataset.edgeSmartDateMode));
  const triggerWidth = await trigger.evaluate((element) => element.getBoundingClientRect().width);
  const initialWidth = await picker.evaluate((element) => element.getBoundingClientRect().width);
  expect(Math.abs(initialWidth - triggerWidth)).toBeLessThan(1);

  for (const y of [460, 500, 450, 520]) {
    await page.evaluate((nextY) => window.scrollTo(0, nextY), y);
    await page.waitForTimeout(50);
    const width = await picker.evaluate((element) => element.getBoundingClientRect().width);
    expect(Math.abs(width - initialWidth)).toBeLessThan(1);
  }
});
