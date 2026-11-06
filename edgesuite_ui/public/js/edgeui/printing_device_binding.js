import { EDGE_PRINT_TRANSPORTS, EdgePrintError } from "./printing_contract";

const DEFAULT_STORAGE_KEY = "edgesuite.printing.bindings.v1";

function safePortInfo(port) {
  let info = {};
  try {
    info = typeof port?.getInfo === "function" ? port.getInfo() || {} : {};
  } catch (_error) {
    info = {};
  }
  const normalized = {};
  if (info.usbVendorId !== undefined && info.usbVendorId !== null) {
    normalized.usbVendorId = Number(info.usbVendorId);
  }
  if (info.usbProductId !== undefined && info.usbProductId !== null) {
    normalized.usbProductId = Number(info.usbProductId);
  }
  if (info.bluetoothServiceClassId) {
    normalized.bluetoothServiceClassId = String(info.bluetoothServiceClassId);
  }
  return Object.freeze(normalized);
}

function samePortInfo(left = {}, right = {}) {
  const keys = ["usbVendorId", "usbProductId", "bluetoothServiceClassId"];
  const compared = keys.filter(
    (key) => left[key] !== undefined || right[key] !== undefined,
  );
  if (!compared.length) return false;
  return compared.every((key) => left[key] === right[key]);
}

function safeUsbDeviceInfo(device) {
  if (!device || typeof device !== "object") return Object.freeze({});
  const normalized = {};
  if (device.vendorId !== undefined && device.vendorId !== null) {
    normalized.vendorId = Number(device.vendorId);
  }
  if (device.productId !== undefined && device.productId !== null) {
    normalized.productId = Number(device.productId);
  }
  if (device.serialNumber) normalized.serialNumber = String(device.serialNumber);
  if (device.manufacturerName) normalized.manufacturerName = String(device.manufacturerName);
  if (device.productName) normalized.productName = String(device.productName);
  return Object.freeze(normalized);
}

function sameUsbDeviceInfo(left = {}, right = {}) {
  if (
    left.vendorId === undefined ||
    left.productId === undefined ||
    right.vendorId === undefined ||
    right.productId === undefined
  ) {
    return false;
  }
  if (Number(left.vendorId) !== Number(right.vendorId)) return false;
  if (Number(left.productId) !== Number(right.productId)) return false;
  if (left.serialNumber || right.serialNumber) {
    return Boolean(left.serialNumber && right.serialNumber && left.serialNumber === right.serialNumber);
  }
  return true;
}

function profileKey(value) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError("Printer binding profile key is required.");
  return normalized;
}

function storageAdapter(target, storageKey) {
  const memory = new Map();

  function readAll() {
    try {
      const raw = target?.localStorage?.getItem(storageKey);
      if (!raw) return Object.fromEntries(memory);
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      return Object.fromEntries(memory);
    }
  }

  function writeAll(payload) {
    memory.clear();
    Object.entries(payload).forEach(([key, value]) => memory.set(key, value));
    try {
      target?.localStorage?.setItem(storageKey, JSON.stringify(payload));
    } catch (_error) {
      // Browser privacy/storage restrictions must not prevent current-session printing.
    }
  }

  return { readAll, writeAll };
}

export function createPrinterBindingStore({
  target = globalThis,
  storageKey = DEFAULT_STORAGE_KEY,
} = {}) {
  const storage = storageAdapter(target, storageKey);

  function save(key, binding = {}) {
    const normalizedKey = profileKey(key);
    const transport = String(binding.transport || EDGE_PRINT_TRANSPORTS.SERIAL).toLowerCase();
    const portInfo = Object.freeze({ ...(binding.portInfo || {}) });
    const deviceInfo = Object.freeze({ ...(binding.deviceInfo || {}) });
    if (transport === EDGE_PRINT_TRANSPORTS.SERIAL && !Object.keys(portInfo).length) {
      throw new EdgePrintError(
        "SERIAL_BINDING_UNIDENTIFIABLE",
        "This browser did not expose enough printer identity information for automatic reconnection.",
      );
    }
    if (
      transport === EDGE_PRINT_TRANSPORTS.USB &&
      (deviceInfo.vendorId === undefined || deviceInfo.productId === undefined)
    ) {
      throw new EdgePrintError(
        "USB_BINDING_UNIDENTIFIABLE",
        "This browser did not expose enough USB printer identity information for automatic reconnection.",
      );
    }
    const payload = storage.readAll();
    const saved = Object.freeze({
      version: 1,
      profileKey: normalizedKey,
      transport,
      portInfo,
      deviceInfo,
      updatedAt: new Date().toISOString(),
    });
    payload[normalizedKey] = saved;
    storage.writeAll(payload);
    return saved;
  }

  function get(key) {
    const normalizedKey = profileKey(key);
    const value = storage.readAll()[normalizedKey];
    return value
      ? Object.freeze({
          ...value,
          portInfo: Object.freeze({ ...(value.portInfo || {}) }),
          deviceInfo: Object.freeze({ ...(value.deviceInfo || {}) }),
        })
      : null;
  }

  function remove(key) {
    const normalizedKey = profileKey(key);
    const payload = storage.readAll();
    const existed = Object.prototype.hasOwnProperty.call(payload, normalizedKey);
    delete payload[normalizedKey];
    storage.writeAll(payload);
    return existed;
  }

  function list() {
    return Object.values(storage.readAll()).map((value) =>
      Object.freeze({
        ...value,
        portInfo: Object.freeze({ ...(value.portInfo || {}) }),
        deviceInfo: Object.freeze({ ...(value.deviceInfo || {}) }),
      }),
    );
  }

  return Object.freeze({ save, get, remove, list });
}

export function createPrinterDeviceManager({
  target = globalThis,
  printManager,
  store = createPrinterBindingStore({ target }),
} = {}) {
  if (!printManager || typeof printManager.getTransport !== "function") {
    throw new TypeError("Printer device manager requires a shared print manager.");
  }

  function serialTransport() {
    return printManager.getTransport(EDGE_PRINT_TRANSPORTS.SERIAL);
  }

  function usbTransport() {
    return printManager.getTransport(EDGE_PRINT_TRANSPORTS.USB);
  }

  function bindSerial(key, port) {
    const info = safePortInfo(port);
    return store.save(key, {
      transport: EDGE_PRINT_TRANSPORTS.SERIAL,
      portInfo: info,
    });
  }

  function bindUsb(key, device) {
    const info = safeUsbDeviceInfo(device);
    return store.save(key, {
      transport: EDGE_PRINT_TRANSPORTS.USB,
      deviceInfo: info,
    });
  }

  function bindingMatchesStatus(key, status = {}) {
    const binding = store.get(key);
    if (!binding) return false;
    const statusTransport = String(status?.transport || "").trim().toLowerCase();
    if (statusTransport && statusTransport !== binding.transport) return false;
    if (binding.transport === EDGE_PRINT_TRANSPORTS.SERIAL) {
      return samePortInfo(status?.portInfo || {}, binding.portInfo || {});
    }
    if (binding.transport === EDGE_PRINT_TRANSPORTS.USB) {
      return sameUsbDeviceInfo(status?.deviceInfo || {}, binding.deviceInfo || {});
    }
    return false;
  }

  async function requestAndBindSerial(key, requestOptions = {}) {
    const transport = serialTransport();
    const port = await transport.requestDevice(requestOptions);
    const binding = bindSerial(key, port);
    return Object.freeze({ port, binding });
  }

  async function requestAndBindUsb(key, requestOptions = {}) {
    const transport = usbTransport();
    const device = await transport.requestDevice(requestOptions);
    const binding = bindUsb(key, device);
    return Object.freeze({ device, binding });
  }

  async function restoreSerial(key) {
    const binding = store.get(key);
    if (!binding) return null;
    if (binding.transport !== EDGE_PRINT_TRANSPORTS.SERIAL) {
      throw new EdgePrintError(
        "PRINT_BINDING_TRANSPORT_MISMATCH",
        `Printer binding ${binding.profileKey} is not a serial binding.`,
      );
    }

    const transport = serialTransport();
    const ports = await transport.authorizedPorts();
    const matches = ports.filter((port) => samePortInfo(safePortInfo(port), binding.portInfo));
    if (matches.length > 1) {
      throw new EdgePrintError(
        "SERIAL_BINDING_AMBIGUOUS",
        "More than one authorized printer matches this device binding. Select the printer again.",
        { details: { matchCount: matches.length } },
      );
    }
    if (!matches.length) return null;
    transport.usePort(matches[0]);
    return Object.freeze({ port: matches[0], binding });
  }

  async function restoreUsb(key) {
    const binding = store.get(key);
    if (!binding) return null;
    if (binding.transport !== EDGE_PRINT_TRANSPORTS.USB) {
      throw new EdgePrintError(
        "PRINT_BINDING_TRANSPORT_MISMATCH",
        `Printer binding ${binding.profileKey} is not a USB binding.`,
      );
    }

    const transport = usbTransport();
    const devices = await transport.authorizedDevices();
    const matches = devices.filter((device) =>
      sameUsbDeviceInfo(safeUsbDeviceInfo(device), binding.deviceInfo),
    );
    if (matches.length > 1) {
      throw new EdgePrintError(
        "USB_BINDING_AMBIGUOUS",
        "More than one authorized USB printer matches this device binding. Select the printer again.",
        { details: { matchCount: matches.length } },
      );
    }
    if (!matches.length) return null;
    transport.useDevice(matches[0]);
    return Object.freeze({ device: matches[0], binding });
  }

  async function connectBoundSerial(key, options = {}) {
    const restored = await restoreSerial(key);
    if (!restored) {
      throw new EdgePrintError(
        "SERIAL_BOUND_DEVICE_UNAVAILABLE",
        "The saved printer is not currently authorized or available on this device.",
      );
    }
    const status = await printManager.connect(EDGE_PRINT_TRANSPORTS.SERIAL, options);
    return Object.freeze({ ...restored, status });
  }

  async function connectBoundUsb(key, options = {}) {
    const restored = await restoreUsb(key);
    if (!restored) {
      throw new EdgePrintError(
        "USB_BOUND_DEVICE_UNAVAILABLE",
        "The saved USB printer is not currently authorized or available on this device.",
      );
    }
    const status = await printManager.connect(EDGE_PRINT_TRANSPORTS.USB, options);
    return Object.freeze({ ...restored, status });
  }

  function forget(key) {
    return store.remove(key);
  }

  return Object.freeze({
    store,
    bindSerial,
    bindUsb,
    bindingMatchesStatus,
    requestAndBindSerial,
    requestAndBindUsb,
    restoreSerial,
    restoreUsb,
    connectBoundSerial,
    connectBoundUsb,
    forget,
  });
}

export const printerPortInfo = safePortInfo;
export const printerPortInfoMatches = samePortInfo;
export const printerUsbDeviceInfo = safeUsbDeviceInfo;
export const printerUsbDeviceInfoMatches = sameUsbDeviceInfo;
