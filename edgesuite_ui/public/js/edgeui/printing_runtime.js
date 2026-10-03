import {
  EDGE_PRINT_STATES,
  EDGE_PRINT_TRANSPORTS,
  EdgePrintError,
} from "./printing_contract";
import { detectPrintCapabilities } from "./printing_capabilities";
import { createWebSerialTransport } from "./printing_serial_transport";
import { normalizeReceiptDocument } from "./printing_document";
import { edgeEscPos, encodeEscPosDocument } from "./printing_escpos";
import { createPrinterBindingStore, createPrinterDeviceManager } from "./printing_device_binding";
import { createPrintProfileClient } from "./printing_profile_runtime";

function normalizeTransportName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) throw new TypeError("Printer transport name is required.");
  return normalized;
}

function assertTransportContract(name, transport) {
  for (const method of ["isSupported", "connect", "disconnect", "write", "getStatus"]) {
    if (typeof transport?.[method] !== "function") {
      throw new TypeError(`Printer transport ${name} must implement ${method}().`);
    }
  }
  return transport;
}

export function createPrintManager({ target = globalThis } = {}) {
  const transports = new Map();
  const writeQueues = new Map();
  transports.set(
    EDGE_PRINT_TRANSPORTS.SERIAL,
    createWebSerialTransport({ target }),
  );

  function registerTransport(name, transport, { replace = false } = {}) {
    const normalized = normalizeTransportName(name);
    assertTransportContract(normalized, transport);
    if (transports.has(normalized) && !replace) {
      throw new Error(`Printer transport ${normalized} is already registered.`);
    }
    transports.set(normalized, transport);
    return transport;
  }

  function getTransport(name = EDGE_PRINT_TRANSPORTS.SERIAL) {
    const normalized = normalizeTransportName(name);
    const transport = transports.get(normalized);
    if (!transport) {
      throw new EdgePrintError(
        "PRINT_TRANSPORT_NOT_REGISTERED",
        `Printer transport ${normalized} is not registered.`,
      );
    }
    return transport;
  }

  function listTransports() {
    return [...transports.entries()].map(([name, transport]) => ({
      name,
      supported: Boolean(transport.isSupported()),
      status: transport.getStatus(),
    }));
  }

  async function connect(name = EDGE_PRINT_TRANSPORTS.SERIAL, options = {}) {
    return getTransport(name).connect(options);
  }

  async function disconnect(name = EDGE_PRINT_TRANSPORTS.SERIAL) {
    return getTransport(name).disconnect();
  }

  async function write(bytes, { transport = EDGE_PRINT_TRANSPORTS.SERIAL } = {}) {
    const normalized = normalizeTransportName(transport);
    const previous = writeQueues.get(normalized) || Promise.resolve();
    const queued = previous
      .catch(() => undefined)
      .then(() => getTransport(normalized).write(bytes));
    writeQueues.set(normalized, queued.catch(() => undefined));
    return queued;
  }

  function encodeReceipt(document, options = {}) {
    return encodeEscPosDocument(normalizeReceiptDocument(document), options);
  }

  async function printReceipt(
    document,
    { transport = EDGE_PRINT_TRANSPORTS.SERIAL, encodeText } = {},
  ) {
    const bytes = encodeReceipt(document, { encodeText });
    const result = await write(bytes, { transport });
    return Object.freeze({
      ...result,
      transport,
      documentType: "receipt",
    });
  }

  function getStatus(name = EDGE_PRINT_TRANSPORTS.SERIAL) {
    return getTransport(name).getStatus();
  }

  return Object.freeze({
    registerTransport,
    getTransport,
    listTransports,
    connect,
    disconnect,
    write,
    encodeReceipt,
    printReceipt,
    getStatus,
    detectCapabilities: () => detectPrintCapabilities(target),
  });
}

export function createEdgePrintAdapter({ target = globalThis } = {}) {
  const manager = createPrintManager({ target });
  const bindingStore = createPrinterBindingStore({ target });
  const devices = createPrinterDeviceManager({ target, printManager: manager, store: bindingStore });
  const profiles = createPrintProfileClient({ target });

  return Object.freeze({
    contractVersion: 1,
    states: EDGE_PRINT_STATES,
    transports: EDGE_PRINT_TRANSPORTS,
    detectCapabilities: () => detectPrintCapabilities(target),
    createManager: (options = {}) =>
      createPrintManager({ ...options, target: options.target || target }),
    createSerialTransport: (options = {}) =>
      createWebSerialTransport({ ...options, target: options.target || target }),
    createBindingStore: (options = {}) =>
      createPrinterBindingStore({ ...options, target: options.target || target }),
    createDeviceManager: (options = {}) =>
      createPrinterDeviceManager({
        ...options,
        target: options.target || target,
        printManager: options.printManager || manager,
      }),
    escpos: edgeEscPos,
    normalizeReceipt: normalizeReceiptDocument,
    encodeReceipt: (document, options) => manager.encodeReceipt(document, options),
    printReceipt: (document, options) => manager.printReceipt(document, options),
    bindingStore,
    devices,
    profiles,
    manager,
    connect: (name, options) => manager.connect(name, options),
    disconnect: (name) => manager.disconnect(name),
    writeBytes: (bytes, options) => manager.write(bytes, options),
    getStatus: (name) => manager.getStatus(name),
  });
}

export const edgePrintAdapter = createEdgePrintAdapter();
