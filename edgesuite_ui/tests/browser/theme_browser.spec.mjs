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

async function openThemePage(context, user, { preference = null, colorScheme = null, viewport = null } = {}) {
  const page = await context.newPage();
  if (viewport) await page.setViewportSize(viewport);
  if (colorScheme) await page.emulateMedia({ colorScheme });
  await page.addInitScript(
    ({ userId, initialPreference }) => {
      globalThis.frappe = {
        session: { user: userId },
        boot: { user: { name: userId } },
      };
      if (initialPreference) {
        globalThis.localStorage.setItem(`edgeui:theme:v1:${userId}`, JSON.stringify(initialPreference));
      }
    },
    { userId: user, initialPreference: preference },
  );
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.__edgeThemeReady === true);
  await expect(page.locator(".edge-theme-menu")).toBeVisible();
  return page;
}

function rgbChannels(value) {
  const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return null;
  return match.slice(1, 4).map(Number);
}

function luminance(rgb) {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground, background) {
  const fg = rgbChannels(foreground);
  const bg = rgbChannels(background);
  if (!fg || !bg) return 0;
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
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
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
});

test("remembered theme is applied by bootstrap before runtime installation", async ({ browser }) => {
  const context = await browser.newContext();
  const preference = {
    palette: "edge-teal",
    appearance: "dark",
    autoLightStart: "06:00",
    autoDarkStart: "18:00",
  };
  const page = await openThemePage(context, "bootstrap@example.com", { preference });

  expect(await page.evaluate(() => globalThis.__edgeThemeBootstrapSnapshot)).toEqual({
    palette: "edge-teal",
    appearanceMode: "dark",
    appearance: "dark",
  });
  await expect(page.locator("html")).toHaveAttribute("data-edge-palette", "edge-teal");
  await expect(page.locator("html")).toHaveAttribute("data-edge-appearance", "dark");
  await context.close();
});

test("avatar controls switch all palettes and persist appearance across reload", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openThemePage(context, "palette@example.com");
  const palettes = ["edge-blue", "edge-indigo", "edge-teal", "edge-emerald", "edge-slate"];

  for (const palette of palettes) {
    await page.locator(`.edge-theme-menu__palette-list [data-value="${palette}"]`).click();
    await expect(page.locator("html")).toHaveAttribute("data-edge-palette", palette);
  }

  await page.locator('.edge-theme-menu__choices [data-value="dark"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-edge-appearance-mode", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-edge-appearance", "dark");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.__edgeThemeReady === true);
  await expect(page.locator("html")).toHaveAttribute("data-edge-palette", "edge-slate");
  await expect(page.locator("html")).toHaveAttribute("data-edge-appearance", "dark");

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("edgeui:theme:v1:palette@example.com")));
  expect(stored.palette).toBe("edge-slate");
  expect(stored.appearance).toBe("dark");
  await context.close();
});

test("system mode follows browser color scheme changes", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openThemePage(context, "system@example.com", { colorScheme: "dark" });

  await page.locator('.edge-theme-menu__choices [data-value="system"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-edge-appearance-mode", "system");
  await expect(page.locator("html")).toHaveAttribute("data-edge-appearance", "dark");

  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => page.locator("html").getAttribute("data-edge-appearance")).toBe("light");
  await context.close();
});

test("auto mode exposes editable schedule and survives reload", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openThemePage(context, "auto@example.com", { viewport: { width: 390, height: 844 } });

  await page.locator('.edge-theme-menu__choices [data-value="auto"]').click();
  await expect(page.locator(".edge-theme-menu__auto-schedule")).toBeVisible();
  const inputs = page.locator(".edge-theme-menu__auto-schedule input[type='time']");
  await inputs.nth(0).fill("07:15");
  await inputs.nth(0).dispatchEvent("change");
  await page.locator(".edge-theme-menu__auto-schedule input[type='time']").nth(1).fill("19:45");
  await page.locator(".edge-theme-menu__auto-schedule input[type='time']").nth(1).dispatchEvent("change");

  expect(await page.evaluate(() => globalThis.EdgeUI.theme.getPreference())).toMatchObject({
    appearance: "auto",
    autoLightStart: "07:15",
    autoDarkStart: "19:45",
  });

  const columns = await page.locator(".edge-theme-menu__time-fields").evaluate((node) => getComputedStyle(node).gridTemplateColumns);
  expect(columns.trim().split(/\s+/)).toHaveLength(1);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.__edgeThemeReady === true);
  await expect(page.locator(".edge-theme-menu__auto-schedule input[type='time']").nth(0)).toHaveValue("07:15");
  await expect(page.locator(".edge-theme-menu__auto-schedule input[type='time']").nth(1)).toHaveValue("19:45");
  await context.close();
});

test("theme changes synchronize across tabs while preferences remain isolated by user", async ({ browser }) => {
  const context = await browser.newContext();
  const first = await openThemePage(context, "shared@example.com");
  const second = await openThemePage(context, "shared@example.com");

  await first.locator('.edge-theme-menu__choices [data-value="dark"]').click();
  await first.locator('.edge-theme-menu__palette-list [data-value="edge-emerald"]').click();
  await expect.poll(() => second.locator("html").getAttribute("data-edge-appearance")).toBe("dark");
  await expect.poll(() => second.locator("html").getAttribute("data-edge-palette")).toBe("edge-emerald");

  const otherUser = await openThemePage(context, "other@example.com");
  await expect(otherUser.locator("html")).toHaveAttribute("data-edge-appearance", "light");
  await expect(otherUser.locator("html")).toHaveAttribute("data-edge-palette", "edge-blue");
  expect(await otherUser.evaluate(() => localStorage.getItem("edgeui:theme:v1:other@example.com"))).toBeNull();
  await context.close();
});

test("dark mode keeps representative shared surfaces readable", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openThemePage(context, "contrast@example.com");
  await page.locator('.edge-theme-menu__choices [data-value="dark"]').click();

  for (const selector of [".edge-stat-card", ".edge-input__control", "#qa-product-menu", "#qa-modal"]) {
    const styles = await page.locator(selector).evaluate((node) => {
      const style = getComputedStyle(node);
      return { background: style.backgroundColor, color: style.color };
    });
    expect(styles.background).not.toBe("rgb(255, 255, 255)");
    expect(contrastRatio(styles.color, styles.background)).toBeGreaterThanOrEqual(4.5);
  }

  const primaryColor = await page.locator(".edge-button--primary").evaluate((node) => getComputedStyle(node).color);
  expect(primaryColor).toBe("rgb(255, 255, 255)");
  await expect(page.locator(".edge-sidebar-item.active")).toBeVisible();
  await expect(page.locator(".edge-product-menu__item.is-active")).toBeVisible();
  await expect(page.locator(".edge-notification-row.is-unread")).toBeVisible();
  await context.close();
});
