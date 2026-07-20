import { defineComponent, h } from "vue";

let openModalCount = 0;

function normalizedType(field = {}) {
  return String(field.type || field.fieldtype || "Data").trim().toLowerCase();
}

function conditionMatches(condition, values = {}) {
  if (!condition || !condition.field) return true;
  const actual = values[condition.field];
  if (Object.prototype.hasOwnProperty.call(condition, "equals")) {
    return String(actual ?? "") === String(condition.equals ?? "");
  }
  if (Object.prototype.hasOwnProperty.call(condition, "not_equals")) {
    return String(actual ?? "") !== String(condition.not_equals ?? "");
  }
  if (Array.isArray(condition.in)) return condition.in.map(String).includes(String(actual ?? ""));
  if (condition.truthy) return Boolean(actual);
  if (condition.falsy) return !actual;
  return true;
}

function visibleField(field, values) {
  return field?.hidden !== true && conditionMatches(field?.visible_when, values);
}

function requiredField(field, values) {
  return Boolean(field?.required || field?.reqd || conditionMatches(field?.required_when, values) && field?.required_when);
}

function normalizedOptions(field = {}) {
  const options = field.options;
  if (Array.isArray(options)) {
    return options.map((option) =>
      typeof option === "object"
        ? {
            value: String(option.value ?? option.name ?? ""),
            label: String(option.label ?? option.title ?? option.value ?? option.name ?? ""),
            description: String(option.description ?? ""),
          }
        : { value: String(option), label: String(option), description: "" },
    );
  }
  if (typeof options === "string") {
    return options
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => ({ value, label: value, description: "" }));
  }
  return [];
}

function focusableElements(root) {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hidden && element.offsetParent !== null);
}

export const EdgeModal = defineComponent({
  name: "EdgeModal",
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    size: { type: String, default: "md" },
    busy: { type: Boolean, default: false },
    closeOnBackdrop: { type: Boolean, default: true },
  },
  emits: ["close"],
  data() {
    return { previousFocus: null, bodyLocked: false, portalRoot: null };
  },
  watch: {
    open(next) {
      if (next) {
        this.activate();
        this.$nextTick(this.portalToBody);
      } else {
        this.deactivate();
      }
    },
  },
  mounted() {
    if (this.open) {
      this.activate();
      this.$nextTick(this.portalToBody);
    }
  },
  updated() {
    if (this.open) this.portalToBody();
  },
  beforeUnmount() {
    this.deactivate();
    this.portalRoot = null;
  },
  methods: {
    portalToBody() {
      if (typeof document === "undefined" || !document.body) return;
      const root = this.$el;
      if (!root || root.nodeType !== 1 || !root.classList?.contains("edge-modal-backdrop")) return;
      this.portalRoot = root;
      if (root.parentNode !== document.body) document.body.appendChild(root);
    },
    activate() {
      if (this.bodyLocked || typeof document === "undefined") return;
      this.previousFocus = document.activeElement;
      openModalCount += 1;
      document.body.classList.add("edge-modal-open");
      this.bodyLocked = true;
      document.addEventListener("keydown", this.onDocumentKeydown);
      this.$nextTick(() => {
        this.portalToBody();
        const root = this.$refs.dialog;
        const target = root?.querySelector("[data-edge-autofocus]") || focusableElements(root)[0];
        target?.focus?.();
      });
    },
    deactivate() {
      if (!this.bodyLocked || typeof document === "undefined") return;
      document.removeEventListener("keydown", this.onDocumentKeydown);
      openModalCount = Math.max(0, openModalCount - 1);
      if (!openModalCount) document.body.classList.remove("edge-modal-open");
      this.bodyLocked = false;
      this.previousFocus?.focus?.();
      this.previousFocus = null;
    },
    requestClose() {
      if (!this.busy) this.$emit("close");
    },
    onBackdrop(event) {
      if (event.target === event.currentTarget && this.closeOnBackdrop) this.requestClose();
    },
    onDocumentKeydown(event) {
      if (!this.open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        this.requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableElements(this.$refs.dialog);
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
  },
  render() {
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
            ref: "dialog",
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
            slots.footer
              ? h("footer", { class: "edge-modal__footer" }, slots.footer())
              : null,
          ],
        ),
      ],
    );
  },
});

export const EdgeFormDialog = defineComponent({
  name: "EdgeFormDialog",
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    fields: { type: Array, default: () => [] },
    modelValue: { type: Object, default: () => ({}) },
    fieldErrors: { type: Object, default: () => ({}) },
    error: { type: String, default: "" },
    loading: { type: Boolean, default: false },
    busy: { type: Boolean, default: false },
    submitLabel: { type: String, default: "Save" },
    cancelLabel: { type: String, default: "Cancel" },
    fullFormLabel: { type: String, default: "Open full form" },
    showFullForm: { type: Boolean, default: false },
    size: { type: String, default: "lg" },
  },
  emits: [
    "close",
    "submit",
    "update:modelValue",
    "field-change",
    "search-options",
    "open-full-form",
  ],
  methods: {
    updateValue(field, value) {
      const next = { ...(this.modelValue || {}), [field.fieldname]: value };
      for (const dependent of field.clear_fields || []) next[dependent] = "";
      this.$emit("update:modelValue", next);
      this.$emit("field-change", { field, value, values: next });
    },
    searchOptions(field, query) {
      this.$emit("search-options", {
        field,
        query: String(query || ""),
        values: { ...(this.modelValue || {}) },
      });
    },
    renderField(field, index) {
      if (!visibleField(field, this.modelValue || {})) return null;
      const type = normalizedType(field);
      const value = this.modelValue?.[field.fieldname] ?? field.default ?? "";
      const required = requiredField(field, this.modelValue || {});
      const error = this.fieldErrors?.[field.fieldname] || "";
      const id = `edge-form-${field.fieldname}`;
      const common = {
        id,
        name: field.fieldname,
        class: ["edge-form-control", error ? "is-invalid" : ""],
        disabled: this.busy || field.disabled || field.read_only,
        required,
        "aria-invalid": error ? "true" : undefined,
        "aria-describedby": error ? `${id}-error` : field.description ? `${id}-help` : undefined,
        "data-edge-autofocus": index === 0 ? "true" : undefined,
      };
      let control;

      if (type === "check" || type === "checkbox") {
        control = h("label", { class: "edge-checkbox" }, [
          h("input", {
            ...common,
            class: error ? "is-invalid" : "",
            type: "checkbox",
            checked: Boolean(Number(value) || value === true),
            onChange: (event) => this.updateValue(field, event.target.checked ? 1 : 0),
          }),
          h("span", field.label || field.fieldname),
        ]);
      } else if (type === "select") {
        control = h(
          "select",
          {
            ...common,
            value,
            onChange: (event) => this.updateValue(field, event.target.value),
          },
          [
            field.allow_blank !== false ? h("option", { value: "" }, field.placeholder || "Select") : null,
            ...normalizedOptions(field).map((option) =>
              h("option", { value: option.value, key: option.value }, option.label),
            ),
          ],
        );
      } else if (type === "text" || type === "small text" || type === "textarea") {
        control = h("textarea", {
          ...common,
          rows: field.rows || 3,
          value,
          placeholder: field.placeholder || "",
          onInput: (event) => this.updateValue(field, event.target.value),
        });
      } else if (type === "link") {
        const listId = `${id}-options`;
        control = h("div", { class: "edge-link-control" }, [
          h("input", {
            ...common,
            type: "text",
            list: listId,
            value,
            autocomplete: "off",
            placeholder: field.placeholder || `Search ${field.label || "records"}`,
            onFocus: (event) => this.searchOptions(field, event.target.value),
            onInput: (event) => {
              this.updateValue(field, event.target.value);
              this.searchOptions(field, event.target.value);
            },
          }),
          h(
            "datalist",
            { id: listId },
            normalizedOptions(field).map((option) =>
              h("option", { value: option.value, key: option.value }, option.label),
            ),
          ),
          field.options_loading ? h("span", { class: "edge-link-control__loading" }, "Loading…") : null,
        ]);
      } else {
        const inputType =
          type === "date"
            ? "date"
            : ["int", "float", "currency", "number"].includes(type)
              ? "number"
              : type === "email"
                ? "email"
                : type === "phone"
                  ? "tel"
                  : "text";
        control = h("input", {
          ...common,
          type: inputType,
          value,
          min: field.min,
          max: field.max,
          step: ["float", "currency"].includes(type) ? field.step || "any" : field.step,
          placeholder: field.placeholder || "",
          onInput: (event) => this.updateValue(field, event.target.value),
        });
      }

      if (type === "check" || type === "checkbox") {
        return h("div", { class: ["edge-form-field", "edge-form-field--check"] }, [
          control,
          field.description ? h("small", { id: `${id}-help` }, field.description) : null,
          error ? h("small", { id: `${id}-error`, class: "edge-form-error" }, error) : null,
        ]);
      }

      return h("label", { class: ["edge-form-field", `edge-form-field--${type.replace(/\s+/g, "-")}`] }, [
        h("span", { class: "edge-form-field__label" }, [
          field.label || field.fieldname,
          required ? h("span", { class: "edge-form-required", "aria-hidden": "true" }, " *") : null,
        ]),
        control,
        field.description ? h("small", { id: `${id}-help` }, field.description) : null,
        error ? h("small", { id: `${id}-error`, class: "edge-form-error" }, error) : null,
      ]);
    },
  },
  render() {
    const visibleFields = (this.fields || []).filter((field) => field && field.fieldname);
    return h(
      EdgeModal,
      {
        open: this.open,
        title: this.title,
        subtitle: this.subtitle,
        size: this.size,
        busy: this.busy,
        onClose: () => this.$emit("close"),
      },
      {
        default: () => [
          this.loading
            ? h("div", { class: "edge-modal-state", role: "status" }, "Loading form…")
            : null,
          this.error ? h("div", { class: "edge-form-global-error", role: "alert" }, this.error) : null,
          !this.loading
            ? h(
                "form",
                {
                  class: "edge-form-dialog",
                  onSubmit: (event) => {
                    event.preventDefault();
                    this.$emit("submit", { ...(this.modelValue || {}) });
                  },
                },
                [h("div", { class: "edge-form-grid" }, visibleFields.map(this.renderField))],
              )
            : null,
        ],
        footer: () => [
          this.showFullForm
            ? h(
                "button",
                {
                  type: "button",
                  class: "edge-button edge-button--link edge-modal__full-form",
                  disabled: this.busy,
                  onClick: () => this.$emit("open-full-form"),
                },
                this.fullFormLabel,
              )
            : null,
          h("span", { class: "edge-modal__footer-spacer" }),
          h(
            "button",
            {
              type: "button",
              class: "edge-button",
              disabled: this.busy,
              onClick: () => this.$emit("close"),
            },
            this.cancelLabel,
          ),
          h(
            "button",
            {
              type: "button",
              class: "edge-button edge-button--primary",
              disabled: this.busy || this.loading,
              onClick: () => this.$emit("submit", { ...(this.modelValue || {}) }),
            },
            this.busy ? "Saving…" : this.submitLabel,
          ),
        ],
      },
    );
  },
});

export const modalComponents = {
  EdgeModal,
  EdgeFormDialog,
};
