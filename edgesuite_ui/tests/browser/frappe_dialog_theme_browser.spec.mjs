import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const FIXTURE = resolve(ROOT, "edgesuite_ui/tests/browser/frappe_dialog_theme_fixture.html");
const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
]);

let server;
let baseURL;

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
    response.writeHead(200, {
      "content-type": MIME.get(extname(path)) || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(await readFile(path));
  } catch (_error) {
    response.writeHead(404).end("Not found");
  }
}

function rgbChannels(value) {
  const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return match ? match.slice(1, 4).map(Number) : null;
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
    serve(request, response).catch((error) => response.writeHead(500).end(String(error)));
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  baseURL = `http://127.0.0.1:${server.address().port}/`;
});

test.afterAll(async () => {
  server?.closeIdleConnections?.();
  server?.closeAllConnections?.();
  if (server) await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
});

async function optionStyles(page, selector) {
  return page.locator(selector).evaluate((node) => {
    const style = getComputedStyle(node);
    const strong = getComputedStyle(node.querySelector("strong"));
    const secondary = getComputedStyle(node.querySelector(".small"));
    return {
      background: style.backgroundColor,
      color: style.color,
      strong: strong.color,
      secondary: secondary.color,
    };
  });
}

test("Frappe v16 Link options remain readable in dark mode across normal selected and hover states", async ({ page }) => {
  await page.goto(baseURL, { waitUntil: "networkidle" });

  const normal = await optionStyles(page, "#option-normal");
  const selected = await optionStyles(page, "#option-selected");

  for (const [state, styles] of Object.entries({ normal, selected })) {
    expect(styles.background, `${state} option must not use a white surface`).not.toBe("rgb(255, 255, 255)");
    expect(contrastRatio(styles.color, styles.background), `${state} base text contrast`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(styles.strong, styles.background), `${state} label contrast`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(styles.secondary, styles.background), `${state} description contrast`).toBeGreaterThanOrEqual(3);
  }

  await page.locator("#option-hover").hover();
  const hovered = await optionStyles(page, "#option-hover");
  expect(hovered.background).not.toBe("rgb(255, 255, 255)");
  expect(contrastRatio(hovered.color, hovered.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(hovered.strong, hovered.background)).toBeGreaterThanOrEqual(4.5);

  const close = await page.locator(".btn-modal-close").evaluate((node) => {
    const style = getComputedStyle(node);
    const icon = getComputedStyle(node.querySelector("svg"));
    return { color: style.color, iconStroke: icon.stroke, opacity: icon.opacity };
  });
  expect(close.opacity).toBe("1");
  expect(close.color).not.toBe("rgba(0, 0, 0, 0)");
  expect(close.iconStroke).not.toBe("none");
});