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

test("browser route overrides stale dashboard activeRoute", async ({ page }) => {
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.__edgeThemeReady === true);

  const resolved = await page.evaluate(() => {
    history.replaceState({}, "", "/desk/veterinary-medical-history");
    return globalThis.EdgeSuiteNavigationComponentBridge.resolveActiveRoute({
      activeRoute: "/app/vetedge-executive-dashboard",
      menuItems: [
        {
          label: "Dashboard",
          items: [
            { label: "Executive Dashboard", route: "/desk/vetedge-executive-dashboard" },
          ],
        },
        {
          label: "Clinical",
          items: [
            { label: "Medical History", route: "/desk/veterinary-medical-history" },
            { label: "Consultations", route: "/desk/veterinary-consultation" },
          ],
        },
      ],
    });
  });
  expect(resolved).toBe("/desk/veterinary-medical-history");

  const childResolved = await page.evaluate(() => {
    history.replaceState({}, "", "/desk/veterinary-consultation/VCON-0001");
    return globalThis.EdgeSuiteNavigationComponentBridge.resolveActiveRoute({
      activeRoute: "/app/vetedge-executive-dashboard",
      menuItems: [
        {
          label: "Dashboard",
          items: [
            { label: "Executive Dashboard", route: "/desk/vetedge-executive-dashboard" },
          ],
        },
        {
          label: "Clinical",
          items: [
            { label: "Consultations", route: "/desk/veterinary-consultation" },
          ],
        },
      ],
    });
  });
  expect(childResolved).toBe("/desk/veterinary-consultation");
});

test("navigation handoff collapses old section and opens current section", async ({ page }) => {
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.__edgeThemeReady === true);

  const sections = page.locator(".edge-sidebar__section");
  const operations = sections.nth(0);
  const clinical = sections.nth(1);
  const reports = sections.nth(2);

  await expect(operations).toHaveClass(/is-expanded/);

  // Manual exploration is allowed: Reports may temporarily replace Operations.
  await reports.locator(".edge-sidebar__section-toggle").click();
  await expect(reports).toHaveClass(/is-expanded/);
  await expect(operations).toHaveClass(/is-collapsed/);

  // A real navigation must override that manual preference and hand focus to Clinical.
  await page.evaluate(() => {
    const sections = [...document.querySelectorAll(".edge-sidebar__section")];
    const oldActive = document.querySelector(".edge-sidebar-item.active");
    oldActive?.classList.remove("active");
    oldActive?.removeAttribute("aria-current");
    const clinicalItem = sections[1]?.querySelector(".edge-sidebar-item");
    clinicalItem?.classList.add("active");
    clinicalItem?.setAttribute("aria-current", "page");
    document.dispatchEvent(new CustomEvent("edgesuite-navigation-route-change"));
  });

  await expect(clinical).toHaveClass(/is-expanded/);
  await expect(clinical.locator(".edge-sidebar-item").first()).toHaveAttribute("aria-current", "page");
  await expect(operations).toHaveClass(/is-collapsed/);
  await expect(reports).toHaveClass(/is-collapsed/);
});
