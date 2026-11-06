import { createEdgePrintAdapter } from "./edgeui/printing_runtime";

export function installEdgeSuitePrintRuntime(target = globalThis) {
  if (target?.EdgeSuitePrint?.printReceipt) return target.EdgeSuitePrint;

  const existing =
    target?.EdgeSuiteUI?.print ||
    target?.EdgeSuiteUI?.getAdapter?.("print") ||
    null;
  const adapter = existing || createEdgePrintAdapter({ target });

  if (target) {
    target.EdgeSuitePrint = adapter;
  }
  return adapter;
}

if (typeof window !== "undefined") {
  installEdgeSuitePrintRuntime(window);
}
