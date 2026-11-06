import {
  EDGE_PRINT_STATES,
  EDGE_PRINT_TRANSPORTS,
  EdgePrintError,
  normalizePrintBytes,
} from "./printing_contract";

function commandSummary(bytes) {
  const payload = normalizePrintBytes(bytes);
  let cuts = 0;
  let drawerPulses = 0;
  let qrCommands = 0;
  let barcodes = 0;
  let feedLines = 0;

  for (let index = 0; index < payload.length; index += 1) {
    const a = payload[index];
    const b = payload[index + 1];
    const c = payload[index + 2];
    if (a === 0x1d && b === 0x56) cuts += 1;
    if (a === 0x1b && b === 0x70) drawerPulses += 1;
    if (a === 0x1d && b === 0x28 && c === 0x6b) qrCommands += 1;
    if (a === 0x1d && b === 0x6b) barcodes += 1;
    if (a === 0x1b && b === 0x64 && Number.isInteger(c)) feedLines += c;
  }

  return Object.freeze({ cuts, drawerPulses, qrCommands, barcodes, feedLines });
}

function skipEscCommand(payload, index, output) {
  const command = payload[index + 1];
  if (command === 0x40) return index + 2; // ESC @ initialize
  if (command === 0x61 || command === 0x45) return index + 3; // ESC a / E
  if (command === 0x70) return index + 5; // ESC p drawer pulse
  if (command === 0x64) {
    const lines = Number(payload[index + 2] || 0);
    for (let offset = 0; offset < lines; offset += 1) output.push(0x0a);
    return index + 3; // ESC d feed
  }
  return index + 2;
}

function skipGsCommand(payload, index) {
  const command = payload[index + 1];
  if ([0x21, 0x56, 0x68, 0x77, 0x48].includes(command)) return index + 3;

  if (command === 0x28 && payload[index + 2] === 0x6b) {
    const low = Number(payload[index + 3] || 0);
    const high = Number(payload[index + 4] || 0);
    return Math.min(payload.length, index + 5 + low + (high << 8));
  }

  if (command === 0x6b) {
    const dataLength = Number(payload[index + 3] || 0);
    return Math.min(payload.length, index + 4 + dataLength);
  }

  if (command === 0x76 && payload[index + 2] === 0x30) {
    const widthBytes = Number(payload[index + 4] || 0) | (Number(payload[index + 5] || 0) << 8);
    const height = Number(payload[index + 6] || 0) | (Number(payload[index + 7] || 0) << 8);
    return Math.min(payload.length, index + 8 + widthBytes * height);
  }

  return index + 2;
}

export function stripEscPosControlBytes(bytes) {
  const payload = normalizePrintBytes(bytes);
  const output = [];

  for (let index = 0; index < payload.length;) {
    const byte = payload[index];
    if (byte === 0x1b) {
      index = skipEscCommand(payload, index, output);
      continue;
    }
    if (byte === 0x1d) {
      index = skipGsCommand(payload, index);
      continue;
    }
    if (byte === 0x0a || byte === 0x0d) {
      output.push(0x0a);
      index += 1;
      continue;
    }
    if (byte >= 0x20) output.push(byte);
    index += 1;
  }

  return Uint8Array.from(output);
}

function printablePreview(bytes) {
  const printable = stripEscPosControlBytes(bytes);
  const preview = new TextDecoder("utf-8", { fatal: false }).decode(printable);
  return preview
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, rows) => line || (index && rows[index - 1]))
    .join("\n")
    .trim();
}

function restoreVirtualJob(job) {
  if (!job || typeof job !== "object") return null;
  return Object.freeze({
    ...job,
    commands: Object.freeze({ ...(job.commands || {}) }),
  });
}

export function inspectVirtualPrintJob(bytes) {
  const payload = normalizePrintBytes(bytes);
  const commands = commandSummary(payload);
  return Object.freeze({
    bytesWritten: payload.byteLength,
    commands,
    previewText: printablePreview(payload),
    hexSample: [...payload.subarray(0, 96)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join(" "),
  });
}

export function createVirtualPrinterTransport({
  target = globalThis,
  initialState = {},
  onStateChange = null,
} = {}) {
  const restoredHistory = Array.isArray(initialState?.history)
    ? initialState.history.slice(-20).map(restoreVirtualJob).filter(Boolean)
    : [];
  let connected = Boolean(initialState?.connected);
  let state = connected ? EDGE_PRINT_STATES.CONNECTED : EDGE_PRINT_STATES.DISCONNECTED;
  let failureMode = ["connect", "write"].includes(initialState?.failureMode)
    ? initialState.failureMode
    : null;
  let lastJob = restoreVirtualJob(initialState?.lastJob) || restoredHistory.at(-1) || null;
  const history = [...restoredHistory];

  function sessionState() {
    return Object.freeze({
      connected,
      failureMode,
      lastJob,
      history: [...history],
    });
  }

  function notifyStateChange() {
    if (typeof onStateChange !== "function") return;
    try {
      onStateChange(sessionState());
    } catch (_error) {
      // Session persistence is best-effort and must never block printing.
    }
  }

  function getStatus() {
    return Object.freeze({
      transport: EDGE_PRINT_TRANSPORTS.SERIAL,
      state,
      supported: true,
      configured: true,
      connected,
      deviceConnected: connected,
      virtual: true,
      portInfo: Object.freeze({ simulation: true, label: "EdgeSuite Virtual Printer" }),
    });
  }

  async function connect() {
    state = EDGE_PRINT_STATES.CONNECTING;
    if (failureMode === "connect") {
      state = EDGE_PRINT_STATES.FAILED;
      notifyStateChange();
      throw new EdgePrintError(
        "VIRTUAL_PRINTER_CONNECT_FAILED",
        "The virtual printer simulated a connection failure.",
      );
    }
    connected = true;
    state = EDGE_PRINT_STATES.CONNECTED;
    notifyStateChange();
    return getStatus();
  }

  async function disconnect() {
    connected = false;
    state = EDGE_PRINT_STATES.DISCONNECTED;
    notifyStateChange();
    return getStatus();
  }

  async function write(bytes) {
    if (!connected) {
      state = EDGE_PRINT_STATES.DISCONNECTED;
      notifyStateChange();
      throw new EdgePrintError(
        "VIRTUAL_PRINTER_NOT_CONNECTED",
        "Connect the virtual printer before printing.",
      );
    }
    state = EDGE_PRINT_STATES.PRINTING;
    if (failureMode === "write") {
      state = EDGE_PRINT_STATES.FAILED;
      failureMode = null;
      notifyStateChange();
      throw new EdgePrintError(
        "VIRTUAL_PRINTER_WRITE_FAILED",
        "The virtual printer simulated a write failure.",
      );
    }

    const payload = normalizePrintBytes(bytes);
    const inspected = inspectVirtualPrintJob(payload);
    lastJob = Object.freeze({
      ...inspected,
      id: `virtual-print-${Date.now()}`,
      printedAt: new Date().toISOString(),
    });
    history.push(lastJob);
    if (history.length > 20) history.shift();
    state = EDGE_PRINT_STATES.CONNECTED;
    notifyStateChange();
    return {
      bytesWritten: payload.byteLength,
      chunksWritten: 1,
      chunkSize: payload.byteLength,
      completedState: EDGE_PRINT_STATES.PRINTED,
      status: getStatus(),
      virtual: true,
      job: lastJob,
    };
  }

  function setFailureMode(mode = null) {
    if (![null, "connect", "write"].includes(mode)) {
      throw new TypeError("Virtual printer failure mode must be connect, write, or null.");
    }
    failureMode = mode;
    notifyStateChange();
    return failureMode;
  }

  function clearHistory() {
    lastJob = null;
    history.splice(0, history.length);
    notifyStateChange();
  }

  return Object.freeze({
    name: EDGE_PRINT_TRANSPORTS.SERIAL,
    virtual: true,
    isSupported: () => true,
    authorizedPorts: async () => [],
    requestDevice: async () => ({ virtual: true }),
    usePort: () => null,
    connect,
    write,
    disconnect,
    clearDevice: disconnect,
    getStatus,
    setFailureMode,
    getFailureMode: () => failureMode,
    getLastJob: () => lastJob,
    getHistory: () => [...history],
    getSessionState: sessionState,
    clearHistory,
    target,
  });
}
