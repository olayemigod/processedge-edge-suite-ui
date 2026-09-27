export const REPORT_PRINT_VERSION = "1.0.0";

export function validateReportPrintHtml(html) {
  const content = String(html || "").trim();
  if (!content) throw new Error("The generated print document is empty.");
  const lowered = content.slice(0, 512).toLowerCase();
  if (!lowered.includes("<html") && !lowered.includes("<!doctype html")) {
    throw new Error("The server did not return a valid report print document.");
  }
  if (lowered.startsWith("{") || lowered.startsWith("[")) {
    throw new Error("The server returned data/error content instead of a print document.");
  }
  return content;
}

export function openReportPrintWindow({ html, title = "Report", printWindow = null } = {}, target = globalThis) {
  const content = validateReportPrintHtml(html);
  const win = printWindow || target?.open?.("", "_blank", "noopener,noreferrer");
  if (!win) throw new Error("The print window could not be opened. Please allow pop-ups for this site and try again.");
  try {
    win.document.open();
    win.document.write(content);
    win.document.close();
    if (title && win.document) win.document.title = title;
    const trigger = () => {
      try {
        win.focus?.();
        win.print?.();
      } catch (_error) {
        // Browser print UI is user-controlled; document remains open if print cannot start.
      }
    };
    if (win.document?.readyState === "complete") target?.setTimeout?.(trigger, 0);
    else win.addEventListener?.("load", trigger, { once: true });
    return win;
  } catch (error) {
    win.close?.();
    throw error;
  }
}

export function installEdgeSuiteReportPrintRuntime(runtime, target = globalThis) {
  if (!runtime) return null;
  const api = Object.freeze({
    version: REPORT_PRINT_VERSION,
    validateHtml: validateReportPrintHtml,
    open: (options) => openReportPrintWindow(options, target),
  });
  runtime.reportPrint = api;
  if (target) target.EdgeSuiteReportPrint = api;
  return api;
}
