import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const FIXTURE = resolve(ROOT, "edgesuite_ui/tests/browser/theme_fixture.html");
const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
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

test("browser Back and Forward restore the matching sidebar resource", async ({ page }) => {
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.__edgeThemeReady === true);

  await page.evaluate(() => {
    const operationsItems = document.querySelector(".edge-sidebar__section .edge-sidebar__items");
    const boarding = document.createElement("button");
    boarding.type = "button";
    boarding.className = "edge-sidebar-item";
    boarding.innerHTML = '<span class="edge-icon" aria-hidden="true">B</span><span class="edge-sidebar-item__copy"><span class="edge-sidebar-item__label">Pet Boarding Booking</span></span>';
    operationsItems?.appendChild(boarding);
    globalThis.EdgeSuiteNavigation?.install?.();

    history.replaceState({}, "", "/desk/vetedge-resource-center?resource=appointments");
  });

  const activeLabel = page.locator(".edge-sidebar-item.active .edge-sidebar-item__label");
  const operations = page.locator(".edge-sidebar__section").first();
  await expect(activeLabel).toHaveText("Appointments");
  await expect(operations).toHaveClass(/is-expanded/);

  await page.evaluate(() => {
    history.pushState({}, "", "/desk/vetedge-resource-center?resource=boarding");
  });
  await expect(activeLabel).toHaveText("Pet Boarding Booking");
  await expect(page).toHaveURL(/resource=boarding$/);

  await page.goBack();
  await expect(page).toHaveURL(/resource=appointments$/);
  await expect(activeLabel).toHaveText("Appointments");
  await expect(operations).toHaveClass(/is-expanded/);
  await expect(page.locator(".edge-sidebar__section.is-expanded")).toHaveCount(1);

  await page.goForward();
  await expect(page).toHaveURL(/resource=boarding$/);
  await expect(activeLabel).toHaveText("Pet Boarding Booking");
  await expect(operations).toHaveClass(/is-expanded/);
  await expect(page.locator(".edge-sidebar__section.is-expanded")).toHaveCount(1);
});
