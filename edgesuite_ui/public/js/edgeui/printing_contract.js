export const EDGE_PRINT_STATES = Object.freeze({
  UNSUPPORTED: "unsupported",
  NOT_CONFIGURED: "not_configured",
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  PRINTING: "printing",
  ERROR: "error",
});

export const EDGE_PRINT_TRANSPORTS = Object.freeze({
  SERIAL: "serial",
  USB: "usb",
  SYSTEM: "system",
  BROWSER: "browser",
});

export class EdgePrintError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "EdgePrintError";
    this.code = code;
    this.recoverable = options.recoverable !== false;
    this.details = options.details || null;
  }
}

export function normalizePrintBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) return Uint8Array.from(value);
  throw new TypeError("Print payload must be binary data.");
}

export function immutableStatus(status) {
  return Object.freeze({ ...status });
}
