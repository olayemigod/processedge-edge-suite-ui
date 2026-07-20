import { h } from "vue";

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

function renderRuntimeNeutralModal() {
  if (!this.open) return null;
  const slots = this.$slots;
  return h(
    "div",
    {
      class: "edge-modal-backdrop",
      role: "presentation",
      onMousedown: this.onBackdrop,
    },
    [
      h(
        "section",
        {
          class: ["edge-modal", `edge-modal--${this.size}`],
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "edge-modal-title",
          "aria-describedby": this.subtitle ? "edge-modal-subtitle" : undefined,
        },
        [
          h("header", { class: "edge-modal__header" }, [
            h("div", { class: "edge-modal__heading" }, [
              h("h2", { id: "edge-modal-title" }, this.title),
              this.subtitle ? h("p", { id: "edge-modal-subtitle" }, this.subtitle) : null,
            ]),
            h(
              "button",
              {
                type: "button",
                class: "edge-modal__close",
                disabled: this.busy,
                "aria-label": "Close dialog",
                onClick: this.requestClose,
              },
              "×",
            ),
          ]),
          h("div", { class: "edge-modal__body" }, slots.default ? slots.default() : []),
          slots.footer ? h("footer", { class: "edge-modal__footer" }, slots.footer()) : null,
        ],
      ),
    ],
  );
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
      if (!this.open) return;
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

  EdgeModal.render = renderRuntimeNeutralModal;
  EdgeModal.__edgeCrossRuntimeCompatible = true;
  return modalComponents;
}
