export function detectPrintCapabilities(target = globalThis) {
  const serial = target?.navigator?.serial || null;
  const secureContext = target?.isSecureContext === true;
  const serialRequest = typeof serial?.requestPort === "function";
  const serialAuthorizedPorts = typeof serial?.getPorts === "function";

  return Object.freeze({
    secureContext,
    webSerial: secureContext && serialRequest && serialAuthorizedPorts,
    serialRequest,
    serialAuthorizedPorts,
    systemPrint: typeof target?.print === "function",
  });
}
