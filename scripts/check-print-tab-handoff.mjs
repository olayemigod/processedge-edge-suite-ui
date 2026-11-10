import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const bundled = await build({
  entryPoints: [resolve(root, "edgesuite_ui/public/js/edgeui/printing_serial_transport.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const tmpDir = await mkdtemp(join(tmpdir(), "edge-serial-tab-handoff-"));
const modulePath = join(tmpDir, "transport.mjs");
await writeFile(modulePath, bundled.outputFiles[0].text);
const { createWebSerialTransport } = await import(pathToFileURL(modulePath).href);

// Two independent tab contexts share the origin's browser locks and a
// channel, but do not share JavaScript SerialPort objects.
class Locks {
  owner = null;
  async request(name, options, callback) {
    if (this.owner !== null && options.ifAvailable) return callback(null);
    assert.equal(this.owner, null, "Only one RFCOMM owner is allowed");
    this.owner = name;
    try {
      return await callback({ name, mode: options.mode });
    } finally {
      this.owner = null;
    }
  }
}
const locks = new Locks();
const listeners = new Map();
class Channel {
  constructor(name) {
    this.name = name;
    this.closed = false;
    const group = listeners.get(name) || new Set();
    group.add(this);
    listeners.set(name, group);
  }
  postMessage(data) {
    if (this.closed) return;
    for (const peer of listeners.get(this.name) || []) {
      if (peer !== this && !peer.closed) {
        queueMicrotask(() => peer.onmessage?.({ data }));
      }
    }
  }
  close() {
    this.closed = true;
    listeners.get(this.name)?.delete(this);
  }
}
let physicalOwner = null;
function port(label, writeHook = null) {
  return {
    label,
    connected: true,
    readable: null,
    writable: null,
    async open() {
      assert.equal(physicalOwner, null, "Concurrent port.open blocked");
      physicalOwner = label;
      this.writable = {
        getWriter: () => ({
          ready: Promise.resolve(),
          async write(bytes) {
            if (writeHook) await writeHook(bytes);
          },
          releaseLock() {},
        }),
      };
    },
    async close() {
      assert.equal(physicalOwner, label);
      physicalOwner = null;
      this.writable = null;
    },
    getInfo() {
      return { bluetoothServiceClassId: "00001101-0000-1000-8000-00805f9b34fb" };
    },
    addEventListener() {},
    removeEventListener() {},
  };
}
function tab() {
  const events = new Map();
  const target = {
    isSecureContext: true,
    navigator: {
      locks,
      serial: { getPorts: async () => [], requestPort: async () => null },
    },
    BroadcastChannel: Channel,
    setTimeout,
    clearTimeout,
    addEventListener(name, callback) { events.set(name, callback); },
  };
  return { target, events, transport: createWebSerialTransport({ target }) };
}

// Two callers in one browser tab must share a single SerialPort.open().
const simultaneous = tab();
simultaneous.transport.usePort(port("SINGLEFLIGHT"));
const [firstConnect, secondConnect] = await Promise.all([
  simultaneous.transport.connect(),
  simultaneous.transport.connect(),
]);
assert.equal(firstConnect.connected && secondConnect.connected, true);
assert.equal(physicalOwner, "SINGLEFLIGHT");
await simultaneous.transport.disconnect();

const a = tab();
const b = tab();
a.transport.usePort(port("A"));
b.transport.usePort(port("B"));
assert.equal((await a.transport.connect()).connected, true);
assert.equal(physicalOwner, "A");
assert.equal((await b.transport.connect()).connected, true);
assert.equal(physicalOwner, "B");
assert.equal(a.transport.getStatus().connected, false);
assert.equal(b.transport.getStatus().connected, true);
await b.transport.disconnect();
assert.equal(physicalOwner, null);

// Tab focus alone is not a page navigation; the connection persists.
assert.equal((await a.transport.connect()).connected, true);
assert.equal(physicalOwner, "A");
await new Promise((r) => setTimeout(r, 10));
assert.equal(a.transport.getStatus().connected, true);
await a.transport.disconnect();

// Busy printer cannot be stolen while a job is being transmitted.
let resolveWrite;
let notifyWrite;
const writeStarted = new Promise((resolve) => { notifyWrite = resolve; });
const busyPort = port("BUSY", async () => {
  notifyWrite();
  await new Promise((resolve) => { resolveWrite = resolve; });
});
const owner = tab();
const contender = tab();
owner.transport.usePort(busyPort);
contender.transport.usePort(port("CONTENDER"));
await owner.transport.connect();
const inFlight = owner.transport.write(Uint8Array.from([0x1b, 0x40, 0x0a]));
await writeStarted;
await assert.rejects(
  contender.transport.connect(),
  (error) => error.code === "SERIAL_TAB_IN_USE",
);
assert.equal(physicalOwner, "BUSY");
resolveWrite();
await inFlight;
assert.equal(owner.transport.getStatus().connected, true);
assert.equal((await contender.transport.connect()).connected, true);
assert.equal(physicalOwner, "CONTENDER");
await contender.transport.disconnect();

// Without Web Locks, fail closed instead of uncoordinated serial access.
const unsupported = createWebSerialTransport({
  target: {
    isSecureContext: true,
    navigator: { serial: { getPorts: async () => [] } },
    BroadcastChannel: Channel,
  },
});
unsupported.usePort(port("UNCOORDINATED"));
await assert.rejects(
  unsupported.connect(),
  (error) => error.code === "SERIAL_TAB_COORDINATION_UNAVAILABLE",
);

console.log("EdgeSuite serial tab ownership: handoff, busy, release, unsupported PASS");
await rm(tmpDir, { recursive: true, force: true });
