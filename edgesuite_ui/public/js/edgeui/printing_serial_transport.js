import {
  EDGE_PRINT_STATES,
  EDGE_PRINT_TRANSPORTS,
  EdgePrintError,
  normalizePrintBytes,
} from "./printing_contract";
import { detectPrintCapabilities } from "./printing_capabilities";
import { createSerialTabLease } from "./printing_tab_lease";

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
  let opening = false;
  let writing = false;
  let disconnecting = null;
  const tabLease = createSerialTabLease({
    target,
    onHandoffRequested: async () => {
      // Never hand off the port while a job, open, or close is in progress.
      if (!tabLease.isHeld() || opening || writing || disconnecting) return;
      await disconnect();
    },
  });

  function onPortDisconnect() {
    if (!port) return;
    state = EDGE_PRINT_STATES.DISCONNECTED;
    // Physical disconnect makes the exclusive port lease unnecessary.
    void tabLease.release().catch(() => undefined);
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
    if (port === nextPort) return port;
    if (port && (port.readable || port.writable)) {
      throw new EdgePrintError(
        "SERIAL_SWITCH_REQUIRES_DISCONNECT",
        "Disconnect the current receipt printer before choosing another printer.",
      );
    }
    detachPortEvents(port);
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

    if (writing || disconnecting) {
      throw new EdgePrintError(
        "SERIAL_BUSY",
        "The receipt printer is busy. Finish the current operation before reconnecting.",
      );
    }
    opening = true;
    state = EDGE_PRINT_STATES.CONNECTING;
    try {
      // The exclusive browser-wide lease is held for the entire open-port
      // lifetime, not merely the duration of port.open().
      await tabLease.acquire();
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
      if (!port?.readable && !port?.writable) await tabLease.release();
      if (
        error?.code === "SERIAL_TAB_IN_USE" ||
        error?.code === "SERIAL_TAB_COORDINATION_UNAVAILABLE"
      ) {
        throw error;
      }
      throw new EdgePrintError("SERIAL_CONNECT_FAILED", "The printer could not be connected.", {
        cause: error,
      });
    } finally {
      opening = false;
    }
  }

  async function write(bytes) {
    assertSupported();
    if (!tabLease.isHeld()) {
      throw new EdgePrintError(
        "SERIAL_TAB_NOT_OWNER",
        "This browser tab does not own the receipt printer connection. Reconnect before printing.",
      );
    }
    if (!port?.writable || typeof port.writable.getWriter !== "function") {
      state = EDGE_PRINT_STATES.DISCONNECTED;
      throw new EdgePrintError("SERIAL_NOT_CONNECTED", "Connect the printer before printing.");
    }

    const payload = normalizePrintBytes(bytes);
    const writer = port.writable.getWriter();
    writing = true;
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
      writing = false;
    }
  }

  async function disconnect() {
    if (writing) {
      throw new EdgePrintError(
        "SERIAL_PRINT_IN_PROGRESS",
        "The receipt printer is currently printing. Complete that job before disconnecting.",
      );
    }
    if (disconnecting) return disconnecting;
    disconnecting = (async () => {
      try {
        if (port && (port.readable || port.writable) && typeof port.close === "function") {
          await port.close();
        }
        state = port
          ? EDGE_PRINT_STATES.DISCONNECTED
          : detectPrintCapabilities(target).webSerial
            ? EDGE_PRINT_STATES.NOT_CONFIGURED
            : EDGE_PRINT_STATES.UNSUPPORTED;
        await tabLease.release();
        return getStatus();
      } catch (error) {
        state = EDGE_PRINT_STATES.FAILED;
        throw new EdgePrintError("SERIAL_DISCONNECT_FAILED", "The printer could not be disconnected.", {
          cause: error,
        });
      }
    })();
    try {
      return await disconnecting;
    } finally {
      disconnecting = null;
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

  // Page navigation/closure should relinquish an idle printer where possible.
  // Switching to a different visible tab is NOT a pagehide navigation.
  target?.addEventListener?.("pagehide", () => {
    if (!writing) void disconnect().catch(() => undefined);
  });

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
