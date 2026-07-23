function focusableElements(root) {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hidden && element.offsetParent !== null);
}

function dialogElement(instance) {
  const root =
    instance?.portalRoot ||
    (instance?.$el?.nodeType === 1 && instance.$el.classList?.contains("edge-modal-backdrop")
      ? instance.$el
      : null);
  return root?.querySelector?.(".edge-modal") || null;
}

export function applyModalCrossRuntimeCompatibility(modalComponents = {}) {
  const EdgeModal = modalComponents.EdgeModal;
  if (!EdgeModal || EdgeModal.__edgeCrossRuntimeCompatible) return modalComponents;

  const originalMethods = EdgeModal.methods || {};
  const originalActivate = originalMethods.activate;

  EdgeModal.methods = {
    ...originalMethods,
    dialogElement() {
      return dialogElement(this);
    },
    activate() {
      originalActivate?.call(this);
      this.$nextTick(() => {
        this.portalToBody?.();
        const root = this.dialogElement();
        const target = root?.querySelector("[data-edge-autofocus]") || focusableElements(root)[0];
        target?.focus?.();
      });
    },
    onDocumentKeydown(event) {
      if (!this.open || event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        this.requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableElements(this.dialogElement());
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
  };

  // Keep EdgeModal's original render function. Replacing it here strips or
  // invalidates slot VNodes when product pages and EdgeSuite UI are mounted
  // through different Vue entry points, which results in an empty dialog body.
  // The compatibility layer only augments focus and portal behaviour.
  EdgeModal.__edgeCrossRuntimeCompatible = true;
  return modalComponents;
}
