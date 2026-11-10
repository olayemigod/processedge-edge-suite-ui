import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "esbuild";

// Exercises real Chromium Web Locks + BroadcastChannel behavior across
// two same-origin tabs. No physical printer, product auth, or invoice data.
const ROOT = resolve(import.meta.dirname, "../../..");
let server;
let origin;
let bundle;

test.setTimeout(35_000);

test.beforeAll(async () => {
  const built = await build({
    entryPoints: [resolve(ROOT, "edgesuite_ui/public/js/edgeui/printing_serial_transport.js")],
    bundle: true,
    format: "iife",
    globalName: "EdgeSerialTabTest",
    platform: "browser",
    write: false,
  });
  bundle = built.outputFiles[0].text;
  server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Printer tab QA</title><body>Printer handoff QA</body>");
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  origin = "http://127.0.0.1:" + server.address().port;
});

test.afterAll(async () => {
  if (!server) return;
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => error ? rejectClose(error) : resolveClose()),
  );
});

async function makeTab(browserContext, tabId) {
  const page = await browserContext.newPage();
  await page.addInitScript(({ tabId }) => {
    window.__tabId = tabId;
    window.__writesWaiting = false;
    window.__pauseWrites = false;
    window.__releaseWrite = null;
    const port = {
      connected: true,
      readable: null,
      writable: null,
      async open() {
        // Simulate the single Windows RFCOMM socket; a second open would
        // raise the OS-level address-in-use error.
        const active = localStorage.getItem("edge-qa-printer-open");
        if (active && active !== tabId) {
          throw new Error("Windows Bluetooth socket address already in use");
        }
        localStorage.setItem("edge-qa-printer-open", tabId);
        this.writable = {
          getWriter: () => ({
            ready: Promise.resolve(),
            async write() {
              if (!window.__pauseWrites) return;
              window.__writesWaiting = true;
              await new Promise((resolve) => { window.__releaseWrite = resolve; });
              window.__writesWaiting = false;
            },
            releaseLock() {},
          }),
        };
      },
      async close() {
        this.writable = null;
        if (localStorage.getItem("edge-qa-printer-open") === tabId) {
          localStorage.removeItem("edge-qa-printer-open");
        }
      },
      getInfo() {
        return { bluetoothServiceClassId: "00001101-0000-1000-8000-00805f9b34fb" };
      },
      addEventListener() {},
      removeEventListener() {},
    };
    window.__serialPort = port;
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: {
        getPorts: async () => [port],
        requestPort: async () => port,
      },
    });
  }, { tabId });

  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    window.__serialTransport = EdgeSerialTabTest.createWebSerialTransport({ target: window });
    window.__serialTransport.usePort(window.__serialPort);
  });
  return page;
}

test("two browser tabs hand off an idle printer without concurrent RFCOMM opens", async ({ context }) => {
  const setup = await makeTab(context, "setup");
  const pos = await makeTab(context, "pos");
  expect(await setup.evaluate(() => !!navigator.locks && !!BroadcastChannel)).toBe(true);

  await setup.evaluate(() => window.__serialTransport.connect());
  expect(await setup.evaluate(() => window.__serialTransport.getStatus().connected)).toBe(true);

  // POSNext should request the printer; the idle setup tab releases it.
  await pos.evaluate(() => window.__serialTransport.connect());
  expect(await pos.evaluate(() => window.__serialTransport.getStatus().connected)).toBe(true);
  expect(await setup.evaluate(() => window.__serialTransport.getStatus().connected)).toBe(false);
  expect(await pos.evaluate(() => localStorage.getItem("edge-qa-printer-open"))).toBe("pos");

  // Switching focus alone must not disconnect the tab that owns the port.
  await setup.bringToFront();
  await pos.bringToFront();
  expect(await pos.evaluate(() => window.__serialTransport.getStatus().connected)).toBe(true);
  await pos.evaluate(() => window.__serialTransport.disconnect());

  // A tab in the middle of a write must never give up the device.
  await setup.evaluate(() => window.__serialTransport.connect());
  await setup.evaluate(() => { window.__pauseWrites = true; });
  const printJob = setup.evaluate(() =>
    window.__serialTransport.write(Uint8Array.from([0x1b, 0x40, 0x0a])),
  );
  await expect.poll(() => setup.evaluate(() => window.__writesWaiting)).toBe(true);
  const blocked = await pos.evaluate(async () => {
    try {
      await window.__serialTransport.connect();
      return null;
    } catch (error) {
      return error.code;
    }
  });
  expect(blocked).toBe("SERIAL_TAB_IN_USE");
  expect(await setup.evaluate(() => window.__serialTransport.getStatus().connected)).toBe(true);
  await setup.evaluate(() => window.__releaseWrite());
  await printJob;

  await pos.evaluate(() => window.__serialTransport.connect());
  expect(await pos.evaluate(() => localStorage.getItem("edge-qa-printer-open"))).toBe("pos");
  await pos.evaluate(() => window.__serialTransport.disconnect());
  await setup.close();
  await pos.close();
});
