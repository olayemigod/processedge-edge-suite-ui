export function detectPrintCapabilities(target = globalThis) {
  const serial = target?.navigator?.serial || null;
  const secureContext = target?.isSecureContext === true;
  const serialRequest = typeof serial?.requestPort === "function";
  const serialAuthorizedPorts = typeof serial?.getPorts === "function";

  const webSerial = secureContext && serialRequest && serialAuthorizedPorts;
  const serialReason = !secureContext
    ? "insecure_context"
    : !serialRequest || !serialAuthorizedPorts
      ? "api_unavailable"
      : "available";

  return Object.freeze({
    secureContext,
    webSerial,
    serialReason,
    serialRequest,
    serialAuthorizedPorts,
    systemPrint: typeof target?.print === "function",
  });
}
