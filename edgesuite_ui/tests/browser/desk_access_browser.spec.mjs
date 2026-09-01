import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const FIXTURE = resolve(ROOT, "edgesuite_ui/tests/browser/desk_access_fixture.html");
const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
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
    serve(request, response).catch((error) => response.writeHead(500).end(String(error)));
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

test("EdgeSuite-only user is redirected away from native Desk route", async ({ page }) => {
  await page.goto(`${baseURL}?route=List%2FSales%20Invoice`, { waitUntil: "domcontentloaded" });

  await page.evaluate(() => {
    globalThis.EdgeSuiteUI.registerProductMenu({
      sections: [
        {
          label: "Operations",
          items: [
            {
              label: "Veterinary Home",
              link_type: "Page",
              link_to: "vetedge-home",
            },
          ],
        },
      ],
    });
  });

  await expect.poll(() => page.evaluate(() => globalThis.__mockRoute.join("/"))).toBe("vetedge-home");
  await expect(page.locator("#native-content")).toBeHidden();

  await page.evaluate(() => {
    const shell = document.createElement("section");
    shell.className = "edge-app-shell";
    shell.dataset.edgeProduct = "VetEdge";
    document.body.appendChild(shell);
  });

  await expect(page.locator("html")).toHaveAttribute("data-edgesuite-route-approved", "true");
  await expect(page.locator("#edgesuite-access-blocked")).toHaveCount(0);
});

test("delayed EdgeSuite shell is accepted without false redirect", async ({ page }) => {
  await page.goto(`${baseURL}?route=vetedge-operations`, { waitUntil: "domcontentloaded" });

  await expect(page.locator("#native-content")).toBeHidden();
  await page.evaluate(() => {
    setTimeout(() => {
      const shell = document.createElement("section");
      shell.className = "edge-app-shell";
      shell.dataset.edgeProduct = "VetEdge";
      document.body.appendChild(shell);
    }, 800);
  });

  await expect(page.locator("html")).toHaveAttribute("data-edgesuite-route-approved", "true", {
    timeout: 3_000,
  });
  expect(await page.evaluate(() => globalThis.__mockRouteChanges)).toEqual([]);
  await expect(page.locator("#edgesuite-access-blocked")).toHaveCount(0);
});

test("native Desk mode remains untouched", async ({ page }) => {
  await page.goto(`${baseURL}?route=List%2FSales%20Invoice&mode=native_desk`, {
    waitUntil: "domcontentloaded",
  });

  await page.waitForTimeout(700);
  await expect(page.locator("html")).toHaveAttribute("data-edgesuite-access-mode", "native_desk");
  await expect(page.locator("#native-content")).toBeVisible();
  await expect(page.locator(".desk-sidebar")).toBeVisible();
  expect(await page.evaluate(() => globalThis.__mockRouteChanges)).toEqual([]);
  await expect(page.locator("#edgesuite-access-blocked")).toHaveCount(0);
});
