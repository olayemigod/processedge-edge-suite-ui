function normalizedLabel(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function visible(element, target) {
  if (!element || element.hidden || !element.getClientRects?.().length) return false;
  const style = target?.getComputedStyle?.(element);
  return style?.display !== "none" && style?.visibility !== "hidden";
}

function workflowSaveButton(target = globalThis) {
  const document = target?.document;
  if (!document) return null;
  const buttons = [
    ...document.querySelectorAll(
      ".edge-workflow-bar__actions button.edge-button--primary:not([disabled])",
    ),
  ].filter((button) => visible(button, target));
  return buttons.reverse().find((button) => {
    const label = normalizedLabel(button.textContent);
    return label === "save" || label === "save changes" || label === "update";
  }) || null;
}

export function installWorkflowSaveBridge(target = globalThis) {
  if (!target?.addEventListener || target.__edgeWorkflowSaveBridgeBound) return;
  target.__edgeWorkflowSaveBridgeBound = true;
  target.addEventListener("edgesuite:save-request", (event) => {
    if (event?.detail?.handled) return;
    const button = workflowSaveButton(target);
    if (!button) return;
    event.detail.handled = true;
    event.detail.promise = Promise.resolve().then(() => button.click());
  });
}

export { workflowSaveButton };
