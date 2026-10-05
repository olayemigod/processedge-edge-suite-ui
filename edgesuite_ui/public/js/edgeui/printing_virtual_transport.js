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

function printablePreview(bytes) {
  const payload = normalizePrintBytes(bytes);
  let preview = "";
  for (const byte of payload) {
    if (byte === 0x0a || byte === 0x0d) {
      preview += "\n";
    } else if (byte >= 0x20 && byte <= 0x7e) {
      preview += String.fromCharCode(byte);
    }
  }
  return preview
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, rows) => line || (index && rows[index - 1]))
    .join("\n")
    .trim();
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

export function createVirtualPrinterTransport({ target = globalThis } = {}) {
  let state = EDGE_PRINT_STATES.DISCONNECTED;
  let connected = false;
  let failureMode = null;
  let lastJob = null;
  const history = [];

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
      throw new EdgePrintError(
        "VIRTUAL_PRINTER_CONNECT_FAILED",
        "The virtual printer simulated a connection failure.",
      );
    }
    connected = true;
    state = EDGE_PRINT_STATES.CONNECTED;
    return getStatus();
  }

  async function disconnect() {
    connected = false;
    state = EDGE_PRINT_STATES.DISCONNECTED;
    return getStatus();
  }

  async function write(bytes) {
    if (!connected) {
      state = EDGE_PRINT_STATES.DISCONNECTED;
      throw new EdgePrintError(
        "VIRTUAL_PRINTER_NOT_CONNECTED",
        "Connect the virtual printer before printing.",
      );
    }
    state = EDGE_PRINT_STATES.PRINTING;
    if (failureMode === "write") {
      state = EDGE_PRINT_STATES.FAILED;
      failureMode = null;
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
    return failureMode;
  }

  function clearHistory() {
    lastJob = null;
    history.splice(0, history.length);
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
    clearHistory,
    target,
  });
}
