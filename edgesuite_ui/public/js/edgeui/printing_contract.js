export const EDGE_PRINT_STATES = Object.freeze({
  UNSUPPORTED: "unsupported",
  NOT_CONFIGURED: "not_configured",
  PERMISSION_REQUIRED: "permission_required",
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  PRINTING: "printing",
  PRINTED: "printed",
  FAILED: "failed",
});

export const EDGE_PRINT_TRANSPORTS = Object.freeze({
  SERIAL: "serial",
  SYSTEM: "system",
  BROWSER: "browser",
});

export class EdgePrintError extends Error {
  constructor(code, message, { cause = null, details = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "EdgePrintError";
    this.code = String(code || "PRINT_ERROR");
    this.details = details;
  }
}

export function normalizePrintBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) return Uint8Array.from(value);
  throw new TypeError("Printer transport payload must be byte-oriented data.");
}
