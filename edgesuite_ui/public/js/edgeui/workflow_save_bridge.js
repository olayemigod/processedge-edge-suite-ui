const STANDARD_SAVE_LABELS = new Set(["save", "save changes", "update", "apply changes"]);
const FORBIDDEN_SAVE_WORDS = /\b(submit|approve|cancel|delete|publish|finalize|complete)\b/i;

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

function controlLabel(control) {
  return normalizedLabel(
    control?.dataset?.label ||
      control?.getAttribute?.("aria-label") ||
      control?.textContent,
  );
}

function safeSaveLabel(label) {
  if (STANDARD_SAVE_LABELS.has(label)) return true;
  if (!label.startsWith("save ") || FORBIDDEN_SAVE_WORDS.test(label)) return false;
  return label.split(" ").length <= 6;
}

function saveCandidates(container, target) {
  if (!container?.querySelectorAll) return [];
  return [
    ...container.querySelectorAll(
      "[data-edgesuite-save]:not([disabled]), button.edge-button--primary:not([disabled])",
    ),
  ].filter((control) => {
    if (!visible(control, target)) return false;
    return control.hasAttribute("data-edgesuite-save") || safeSaveLabel(controlLabel(control));
  });
}

function uniqueSaveButton(container, target) {
  const candidates = saveCandidates(container, target);
  return candidates.length === 1 ? candidates[0] : null;
}

function focusedEditContainer(target) {
  const active = target?.document?.activeElement;
  if (!active?.closest) return null;
  return active.closest(
    ".modal.show, .edge-modal[open], .edge-modal.is-open, form, section, .edge-panel, .edge-card",
  );
}

function workflowSaveButton(target = globalThis) {
  const document = target?.document;
  if (!document) return null;

  const focusedContainer = focusedEditContainer(target);
  const contextual = uniqueSaveButton(focusedContainer, target);
  if (contextual) return contextual;

  const activeModal = [
    ...document.querySelectorAll(".modal.show, .edge-modal[open], .edge-modal.is-open"),
  ]
    .reverse()
    .find((modal) => visible(modal, target));
  const modalSave = uniqueSaveButton(activeModal, target);
  if (modalSave) return modalSave;

  const workflowButtons = [
    ...document.querySelectorAll(
      ".edge-workflow-bar__actions button.edge-button--primary:not([disabled])",
    ),
  ].filter((button) => visible(button, target));
  return workflowButtons.reverse().find((button) => STANDARD_SAVE_LABELS.has(controlLabel(button))) || null;
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
