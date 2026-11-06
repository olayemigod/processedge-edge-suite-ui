import {
  EDGE_PRINT_STATES,
  EDGE_PRINT_TRANSPORTS,
  EdgePrintError,
  normalizePrintBytes,
} from "./printing_contract";
import { detectPrintCapabilities } from "./printing_capabilities";

const USB_PRINTER_CLASS = 0x07;

function positiveInteger(value, fallback, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    if (fallback !== null) return fallback;
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return parsed;
}

function usbIdentity(device) {
  if (!device) return null;
  return Object.freeze({
    vendorId: Number(device.vendorId || 0),
    productId: Number(device.productId || 0),
    manufacturerName: String(device.manufacturerName || ""),
    productName: String(device.productName || ""),
    serialNumber: String(device.serialNumber || ""),
  });
}

function availableInterfaces(device) {
  const configuration = device?.configuration;
  if (!configuration?.interfaces) return [];
  const candidates = [];
  for (const iface of configuration.interfaces) {
    for (const alternate of iface.alternates || []) {
      const outEndpoint = (alternate.endpoints || []).find((endpoint) => endpoint.direction === "out");
      if (!outEndpoint) continue;
      candidates.push({
        interfaceNumber: iface.interfaceNumber,
        alternateSetting: alternate.alternateSetting,
        interfaceClass: alternate.interfaceClass,
        endpointNumber: outEndpoint.endpointNumber,
      });
    }
  }
  return candidates.sort((left, right) => {
    const leftPrinter = left.interfaceClass === USB_PRINTER_CLASS ? 1 : 0;
    const rightPrinter = right.interfaceClass === USB_PRINTER_CLASS ? 1 : 0;
    return rightPrinter - leftPrinter;
  });
}

export function createWebUsbTransport({
  target = globalThis,
  writeChunkSize = 4096,
  defaultRequestFilters = [{ classCode: USB_PRINTER_CLASS }],
} = {}) {
  const chunkSize = positiveInteger(writeChunkSize, 4096, "writeChunkSize");
  let device = null;
  let claimedInterfaceNumber = null;
  let endpointNumber = null;
  let state = detectPrintCapabilities(target).webUsb
    ? EDGE_PRINT_STATES.NOT_CONFIGURED
    : EDGE_PRINT_STATES.UNSUPPORTED;

  function usbApi() {
    return target?.navigator?.usb || null;
  }

  function assertSupported() {
    if (!detectPrintCapabilities(target).webUsb) {
      state = EDGE_PRINT_STATES.UNSUPPORTED;
      throw new EdgePrintError(
        "USB_UNSUPPORTED",
        "Direct USB printing is unavailable in this browser or security context.",
      );
    }
    return usbApi();
  }

  function sameDevice(left, right) {
    return Boolean(
      left &&
        right &&
        Number(left.vendorId) === Number(right.vendorId) &&
        Number(left.productId) === Number(right.productId) &&
        (!left.serialNumber || !right.serialNumber || left.serialNumber === right.serialNumber),
    );
  }

  function onUsbDisconnect(event) {
    if (device && sameDevice(event?.device, device)) {
      state = EDGE_PRINT_STATES.DISCONNECTED;
      claimedInterfaceNumber = null;
      endpointNumber = null;
    }
  }

  function attachUsbEvents() {
    usbApi()?.addEventListener?.("disconnect", onUsbDisconnect);
  }

  function detachUsbEvents() {
    usbApi()?.removeEventListener?.("disconnect", onUsbDisconnect);
  }

  function useDevice(nextDevice) {
    if (!nextDevice || typeof nextDevice !== "object") {
      throw new TypeError("A USBDevice object is required.");
    }
    if (device !== nextDevice) {
      detachUsbEvents();
      claimedInterfaceNumber = null;
      endpointNumber = null;
    }
    device = nextDevice;
    attachUsbEvents();
    state = EDGE_PRINT_STATES.DISCONNECTED;
    return device;
  }

  async function authorizedDevices() {
    const usb = assertSupported();
    return usb.getDevices();
  }

  async function requestDevice(requestOptions = {}) {
    const usb = assertSupported();
    const filters = Array.isArray(requestOptions.filters) && requestOptions.filters.length
      ? requestOptions.filters
      : defaultRequestFilters;
    state = EDGE_PRINT_STATES.PERMISSION_REQUIRED;
    try {
      return useDevice(await usb.requestDevice({ ...requestOptions, filters }));
    } catch (error) {
      state = EDGE_PRINT_STATES.NOT_CONFIGURED;
      throw new EdgePrintError(
        "USB_DEVICE_SELECTION_FAILED",
        "A USB receipt printer was not selected.",
        { cause: error },
      );
    }
  }

  async function connect({ device: requestedDevice = null, configurationValue = null } = {}) {
    assertSupported();
    if (requestedDevice) useDevice(requestedDevice);
    if (!device) {
      state = EDGE_PRINT_STATES.PERMISSION_REQUIRED;
      throw new EdgePrintError(
        "USB_DEVICE_REQUIRED",
        "Select or restore an authorized USB printer before connecting.",
      );
    }

    state = EDGE_PRINT_STATES.CONNECTING;
    try {
      if (!device.opened) await device.open();
      if (!device.configuration) {
        const available = device.configurations || [];
        const preferred = Number(configurationValue || available[0]?.configurationValue || 1);
        await device.selectConfiguration(preferred);
      }

      const candidates = availableInterfaces(device);
      if (!candidates.length) {
        throw new Error("The selected USB device does not expose a writable OUT endpoint.");
      }
      const selected = candidates[0];
      await device.claimInterface(selected.interfaceNumber);
      if (selected.alternateSetting !== undefined && selected.alternateSetting !== null) {
        const current = device.configuration?.interfaces
          ?.find((iface) => iface.interfaceNumber === selected.interfaceNumber)
          ?.alternate?.alternateSetting;
        if (current !== selected.alternateSetting && typeof device.selectAlternateInterface === "function") {
          await device.selectAlternateInterface(selected.interfaceNumber, selected.alternateSetting);
        }
      }
      claimedInterfaceNumber = selected.interfaceNumber;
      endpointNumber = selected.endpointNumber;
      state = EDGE_PRINT_STATES.CONNECTED;
      return getStatus();
    } catch (error) {
      state = EDGE_PRINT_STATES.FAILED;
      claimedInterfaceNumber = null;
      endpointNumber = null;
      throw new EdgePrintError(
        "USB_CONNECT_FAILED",
        "The browser could not claim this USB printer. Use normal system printing if the printer is controlled by a Windows driver.",
        { cause: error },
      );
    }
  }

  async function write(bytes) {
    assertSupported();
    if (!device?.opened || endpointNumber === null) {
      state = EDGE_PRINT_STATES.DISCONNECTED;
      throw new EdgePrintError("USB_NOT_CONNECTED", "Connect the USB printer before printing.");
    }

    const payload = normalizePrintBytes(bytes);
    state = EDGE_PRINT_STATES.PRINTING;
    try {
      let chunksWritten = 0;
      for (let offset = 0; offset < payload.byteLength; offset += chunkSize) {
        const chunk = payload.subarray(offset, Math.min(offset + chunkSize, payload.byteLength));
        const result = await device.transferOut(endpointNumber, chunk);
        if (result?.status && result.status !== "ok") {
          throw new Error(`USB transfer failed with status ${result.status}.`);
        }
        chunksWritten += 1;
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
      throw new EdgePrintError(
        "USB_WRITE_FAILED",
        "The USB printer did not accept the print data.",
        { cause: error },
      );
    }
  }

  async function disconnect() {
    if (!device) {
      state = detectPrintCapabilities(target).webUsb
        ? EDGE_PRINT_STATES.NOT_CONFIGURED
        : EDGE_PRINT_STATES.UNSUPPORTED;
      return getStatus();
    }

    try {
      if (device.opened && claimedInterfaceNumber !== null && typeof device.releaseInterface === "function") {
        try {
          await device.releaseInterface(claimedInterfaceNumber);
        } catch (_error) {
          // Best effort: closing the device is still required even if interface release fails.
        }
      }
      if (device.opened && typeof device.close === "function") await device.close();
      claimedInterfaceNumber = null;
      endpointNumber = null;
      state = EDGE_PRINT_STATES.DISCONNECTED;
      return getStatus();
    } catch (error) {
      state = EDGE_PRINT_STATES.FAILED;
      throw new EdgePrintError(
        "USB_DISCONNECT_FAILED",
        "The USB printer could not be disconnected.",
        { cause: error },
      );
    }
  }

  async function clearDevice() {
    if (device) await disconnect();
    detachUsbEvents();
    device = null;
    claimedInterfaceNumber = null;
    endpointNumber = null;
    state = detectPrintCapabilities(target).webUsb
      ? EDGE_PRINT_STATES.NOT_CONFIGURED
      : EDGE_PRINT_STATES.UNSUPPORTED;
    return getStatus();
  }

  function getStatus() {
    if (!device?.opened && [EDGE_PRINT_STATES.CONNECTED, EDGE_PRINT_STATES.PRINTING].includes(state)) {
      state = EDGE_PRINT_STATES.DISCONNECTED;
    }
    return Object.freeze({
      transport: EDGE_PRINT_TRANSPORTS.USB,
      state,
      supported: detectPrintCapabilities(target).webUsb,
      configured: Boolean(device),
      connected: Boolean(device?.opened) && endpointNumber !== null && state === EDGE_PRINT_STATES.CONNECTED,
      deviceConnected: device ? Boolean(device.opened) : null,
      deviceInfo: usbIdentity(device),
      interfaceNumber: claimedInterfaceNumber,
      endpointNumber,
    });
  }

  return Object.freeze({
    name: EDGE_PRINT_TRANSPORTS.USB,
    isSupported: () => detectPrintCapabilities(target).webUsb,
    authorizedDevices,
    requestDevice,
    useDevice,
    connect,
    write,
    disconnect,
    clearDevice,
    getStatus,
  });
}

export const printerUsbDeviceInfo = usbIdentity;
