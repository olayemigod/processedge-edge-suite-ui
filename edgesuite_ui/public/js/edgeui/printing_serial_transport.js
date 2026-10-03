import {
  EDGE_PRINT_STATES,
  EDGE_PRINT_TRANSPORTS,
  EdgePrintError,
  normalizePrintBytes,
} from "./printing_contract";
import { detectPrintCapabilities } from "./printing_capabilities";

function normalizedOpenOptions(defaults, overrides) {
  const options = { ...(defaults || {}), ...(overrides || {}) };
  const baudRate = Number(options.baudRate || 0);
  if (!Number.isFinite(baudRate) || baudRate <= 0) {
    throw new TypeError("Web Serial transport requires a positive baudRate.");
  }
  return { ...options, baudRate };
}

function positiveInteger(value, fallback, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    if (fallback !== null) return fallback;
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return parsed;
}

function nonNegativeInteger(value, fallback, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    if (fallback !== null) return fallback;
    throw new TypeError(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

function sleep(target, milliseconds) {
  if (!milliseconds) return Promise.resolve();
  const schedule = typeof target?.setTimeout === "function" ? target.setTimeout.bind(target) : setTimeout;
  return new Promise((resolve) => schedule(resolve, milliseconds));
}

export function createWebSerialTransport({
  target = globalThis,
  defaultOpenOptions = { baudRate: 9600 },
  writeChunkSize = 256,
  interChunkDelayMs = 0,
} = {}) {
  const chunkSize = positiveInteger(writeChunkSize, 256, "writeChunkSize");
  const chunkDelay = nonNegativeInteger(interChunkDelayMs, 0, "interChunkDelayMs");
  let port = null;
  let state = detectPrintCapabilities(target).webSerial
    ? EDGE_PRINT_STATES.NOT_CONFIGURED
    : EDGE_PRINT_STATES.UNSUPPORTED;

  function onPortDisconnect() {
    if (port) state = EDGE_PRINT_STATES.DISCONNECTED;
  }

  function detachPortEvents(currentPort = port) {
    currentPort?.removeEventListener?.("disconnect", onPortDisconnect);
  }

  function attachPortEvents(nextPort) {
    nextPort?.addEventListener?.("disconnect", onPortDisconnect);
  }

  function serialApi() {
    return target?.navigator?.serial || null;
  }

  function assertSupported() {
    if (!detectPrintCapabilities(target).webSerial) {
      state = EDGE_PRINT_STATES.UNSUPPORTED;
      throw new EdgePrintError(
        "SERIAL_UNSUPPORTED",
        "Direct serial printing is unavailable in this browser or security context.",
      );
    }
    return serialApi();
  }

  function usePort(nextPort) {
    if (!nextPort || typeof nextPort !== "object") {
      throw new TypeError("A SerialPort object is required.");
    }
    if (port !== nextPort) detachPortEvents(port);
    port = nextPort;
    attachPortEvents(port);
    state = EDGE_PRINT_STATES.DISCONNECTED;
    return port;
  }

  async function authorizedPorts() {
    const serial = assertSupported();
    return serial.getPorts();
  }

  async function requestDevice(requestOptions = {}) {
    const serial = assertSupported();
    state = EDGE_PRINT_STATES.PERMISSION_REQUIRED;
    try {
      return usePort(await serial.requestPort(requestOptions));
    } catch (error) {
      state = EDGE_PRINT_STATES.NOT_CONFIGURED;
      throw new EdgePrintError("SERIAL_DEVICE_SELECTION_FAILED", "A printer was not selected.", {
        cause: error,
      });
    }
  }

  async function connect({ port: requestedPort = null, openOptions = {} } = {}) {
    assertSupported();
    if (requestedPort) usePort(requestedPort);
    if (!port) {
      state = EDGE_PRINT_STATES.PERMISSION_REQUIRED;
      throw new EdgePrintError(
        "SERIAL_DEVICE_REQUIRED",
        "Select or restore an authorized printer before connecting.",
      );
    }

    state = EDGE_PRINT_STATES.CONNECTING;
    try {
      if (!port.readable && !port.writable) {
        await port.open(normalizedOpenOptions(defaultOpenOptions, openOptions));
      }
      if (!port.writable || typeof port.writable.getWriter !== "function") {
        throw new Error("The selected serial device did not expose a writable stream.");
      }
      state = EDGE_PRINT_STATES.CONNECTED;
      return getStatus();
    } catch (error) {
      state = EDGE_PRINT_STATES.FAILED;
      throw new EdgePrintError("SERIAL_CONNECT_FAILED", "The printer could not be connected.", {
        cause: error,
      });
    }
  }

  async function write(bytes) {
    assertSupported();
    if (!port?.writable || typeof port.writable.getWriter !== "function") {
      state = EDGE_PRINT_STATES.DISCONNECTED;
      throw new EdgePrintError("SERIAL_NOT_CONNECTED", "Connect the printer before printing.");
    }

    const payload = normalizePrintBytes(bytes);
    const writer = port.writable.getWriter();
    state = EDGE_PRINT_STATES.PRINTING;
    try {
      let chunksWritten = 0;
      for (let offset = 0; offset < payload.byteLength; offset += chunkSize) {
        const chunk = payload.subarray(offset, Math.min(offset + chunkSize, payload.byteLength));
        if (writer.ready && typeof writer.ready.then === "function") {
          await writer.ready;
        }
        await writer.write(chunk);
        chunksWritten += 1;
        if (chunkDelay && offset + chunkSize < payload.byteLength) {
          await sleep(target, chunkDelay);
        }
      }
      const completedState = EDGE_PRINT_STATES.PRINTED;
      state = EDGE_PRINT_STATES.CONNECTED;
      return {
        bytesWritten: payload.byteLength,
        chunksWritten,
        chunkSize,
        completedState,
        status: getStatus(),
      };
    } catch (error) {
      state = EDGE_PRINT_STATES.FAILED;
      throw new EdgePrintError("SERIAL_WRITE_FAILED", "The printer did not accept the print data.", {
        cause: error,
      });
    } finally {
      writer.releaseLock();
    }
  }

  async function disconnect() {
    if (!port) {
      state = detectPrintCapabilities(target).webSerial
        ? EDGE_PRINT_STATES.NOT_CONFIGURED
        : EDGE_PRINT_STATES.UNSUPPORTED;
      return getStatus();
    }

    try {
      if ((port.readable || port.writable) && typeof port.close === "function") {
        await port.close();
      }
      state = EDGE_PRINT_STATES.DISCONNECTED;
      return getStatus();
    } catch (error) {
      state = EDGE_PRINT_STATES.FAILED;
      throw new EdgePrintError("SERIAL_DISCONNECT_FAILED", "The printer could not be disconnected.", {
        cause: error,
      });
    }
  }

  async function clearDevice() {
    if (port) await disconnect();
    detachPortEvents(port);
    port = null;
    state = detectPrintCapabilities(target).webSerial
      ? EDGE_PRINT_STATES.NOT_CONFIGURED
      : EDGE_PRINT_STATES.UNSUPPORTED;
    return getStatus();
  }

  function getStatus() {
    if (
      port?.connected === false &&
      [EDGE_PRINT_STATES.CONNECTED, EDGE_PRINT_STATES.PRINTING, EDGE_PRINT_STATES.PRINTED].includes(
        state,
      )
    ) {
      state = EDGE_PRINT_STATES.DISCONNECTED;
    }

    let portInfo = null;
    try {
      portInfo = typeof port?.getInfo === "function" ? port.getInfo() : null;
    } catch (_error) {
      portInfo = null;
    }

    return Object.freeze({
      transport: EDGE_PRINT_TRANSPORTS.SERIAL,
      state,
      supported: detectPrintCapabilities(target).webSerial,
      configured: Boolean(port),
      connected: state === EDGE_PRINT_STATES.CONNECTED || state === EDGE_PRINT_STATES.PRINTING,
      deviceConnected: typeof port?.connected === "boolean" ? port.connected : null,
      portInfo,
    });
  }

  return Object.freeze({
    name: EDGE_PRINT_TRANSPORTS.SERIAL,
    isSupported: () => detectPrintCapabilities(target).webSerial,
    authorizedPorts,
    requestDevice,
    usePort,
    connect,
    write,
    disconnect,
    clearDevice,
    getStatus,
  });
}
