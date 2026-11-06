import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
let server;
let address;

test.beforeAll(async () => {
  const bundle = await build({
    stdin: { contents: `import { createApp, h } from 'vue';
      import { EdgeAppShell } from './edgesuite_ui/public/js/edgeui/professional_components.js';
      let app;
      window.mountShell = (access, communication = null) => {
        app?.unmount();
        window.frappe = {boot: {edgesuite_ui_access: access, allowed_workspaces: [{name:'Accounting', public:1}]}};
        app = createApp({render: () => h(EdgeAppShell, {product:'retailedge', title:'RetailEdge',
          showSidebar:false, showNotifications:false, showUserMenu:false, communication},
          {default: () => h('h1', 'Stock Position')})});
        app.mount('#app');
      };`, resolveDir: ROOT },
    bundle: true, format: "iife", write: false,
  });
  const css = await Promise.all(["edgeui.bundle.css", "edgeui_professional.css", "edgeui_theme.css", "edgeui_sidebar_focus.css"].map(name => readFile(resolve(ROOT, "edgesuite_ui/public/css", name), "utf8")));
  server = createServer((request, response) => {
    if (request.url === "/fixture.js") {
      response.writeHead(200, {"content-type":"text/javascript"}).end(bundle.outputFiles[0].text);
    } else {
      response.writeHead(200, {"content-type":"text/html"}).end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.join("\n")}</style></head><body class="edge-suite-shell-focused"><div class="page-container"><header class="page-head">Duplicate native title</header><div id="app"></div></div><script src="/fixture.js"></script></body></html>`);
    }
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  address = `http://127.0.0.1:${server.address().port}/`;
});

test.afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise(done => server.close(done));
});

async function mount(page, access, communication = null) {
  await page.goto(address);
  await page.evaluate(({access, communication}) => window.mountShell(access, communication), {access, communication});
}

for (const theme of ["light", "dark"]) {
  test(`native Desk action and reserved communications region in ${theme}`, async ({page}) => {
    await mount(page, {mode:"native_desk", can_use_native_desk:true});
    await page.locator("html").evaluate((html, theme) => html.setAttribute("data-edge-appearance", theme), theme);
    const link = page.getByRole("link", {name:/Back to Desk/});
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/desk");
    await expect(page.locator("[data-edge-shell-communications]")).toHaveCount(1);
    await expect(page.locator("[data-edge-shell-communications]")).toHaveText("");
    await expect(page.locator(".page-head")).toBeHidden();
    await link.focus?.();
    await page.locator("body").evaluate(body => body.classList.remove("edge-suite-shell-focused"));
    await expect(page.locator(".page-head")).toBeVisible();
  });
}

for (const access of [null, {}, {mode:"edgesuite_only", can_use_native_desk:false}, {mode:"website", can_use_native_desk:false}, {mode:"native_desk", can_use_native_desk:false}]) {
  test(`native action fails closed for ${JSON.stringify(access)}`, async ({page}) => {
    await mount(page, access);
    await expect(page.getByRole("link", {name:/Back to Desk/})).toHaveCount(0);
    await expect(page.locator("[data-edge-shell-communications]")).toHaveCount(1);
  });
}

test("communications render as text without executable markup", async ({page}) => {
  await mount(page, {mode:"edgesuite_only", can_use_native_desk:false}, {title:"Service update", message:'<img src=x onerror="window.injected=true"> Maintenance at 22:00'});
  const region = page.getByRole("status");
  await expect(region).toContainText("Service update");
  await expect(region).toContainText("Maintenance at 22:00");
  await expect(region.locator("img")).toHaveCount(0);
  await expect(page.getByRole("link", {name:/Back to Desk/})).toHaveCount(0);
});

test("reserved bar fits narrow screens without horizontal scrolling", async ({page}) => {
  await page.setViewportSize({width:360, height:780});
  await mount(page, {mode:"native_desk", can_use_native_desk:true}, {title:"News", message:"An update for merchants"});
  await expect(page.getByRole("link", {name:/Back to Desk/})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
