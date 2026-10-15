export function detectPrintCapabilities(target = globalThis) {
  const secure = Boolean(target?.isSecureContext);
  const serial = target?.navigator?.serial;
  const usb = target?.navigator?.usb;
  const hasSerial = Boolean(serial);
  const hasUsb = Boolean(usb);
  const webSerial = secure && hasSerial;
  const webUsb = secure && hasUsb;

  return Object.freeze({
    secureContext: secure,
    webSerial,
    webUsb,
    serialRequest: webSerial && typeof serial.requestPort === "function",
    serialAuthorizedPorts: webSerial && typeof serial.getPorts === "function",
    usbRequest: webUsb && typeof usb.requestDevice === "function",
    usbAuthorizedDevices: webUsb && typeof usb.getDevices === "function",
    systemPrint: typeof target?.print === "function",
    serialReason: webSerial ? null : secure ? "api_unavailable" : "insecure_context",
    usbReason: webUsb ? null : secure ? "api_unavailable" : "insecure_context",
  });
}
