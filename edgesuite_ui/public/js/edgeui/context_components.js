import { defineComponent, h } from "vue";

import { EdgeIcon } from "./professional_components";

function clean(value) {
  return String(value ?? "").trim();
}

export function normalizeBranchContextOption(option) {
  if (!option) return null;
  if (typeof option === "string") {
    const value = clean(option);
    return value
      ? { value, label: value, company: "", code: "", description: "", disabled: false, raw: option }
      : null;
  }

  const value = clean(option.value ?? option.name ?? option.id);
  if (!value) return null;
  return {
    value,
    label: clean(option.label ?? option.branch_name ?? option.title) || value,
    company: clean(option.company ?? option.company_name),
    code: clean(option.code ?? option.branch_code),
    description: clean(option.description ?? option.subtitle),
    disabled: Boolean(option.disabled),
    raw: option,
  };
}

function normalizedOptions(options) {
  const seen = new Set();
  return (Array.isArray(options) ? options : [])
    .map(normalizeBranchContextOption)
    .filter((option) => {
      if (!option || seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
}

export const EdgeBranchContextSwitcher = defineComponent({
  name: "EdgeBranchContextSwitcher",
  props: {
    modelValue: { type: String, default: "" },
    currentLabel: { type: String, default: "" },
    currentCompany: { type: String, default: "" },
    currentCode: { type: String, default: "" },
    label: { type: String, default: "Working branch" },
    helper: { type: String, default: "All branch-aware pages and new records use this context." },
    placeholder: { type: String, default: "Select working branch" },
    options: { type: Array, default: () => [] },
    canSwitch: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    busy: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    showCompany: { type: Boolean, default: true },
    icon: { type: String, default: "building" },
    emptyMessage: { type: String, default: "No permitted branch is available." },
    id: { type: String, default: "" },
  },
  emits: ["update:modelValue", "switch", "change"],
  computed: {
    normalizedOptions() {
      return normalizedOptions(this.options);
    },
    selectedOption() {
      return this.normalizedOptions.find((option) => option.value === this.modelValue) || null;
    },
    displayLabel() {
      return this.currentLabel || this.selectedOption?.label || this.placeholder;
    },
    displayCompany() {
      return this.currentCompany || this.selectedOption?.company || "";
    },
    displayCode() {
      return this.currentCode || this.selectedOption?.code || "";
    },
    controlDisabled() {
      return this.disabled || this.busy || !this.canSwitch || !this.normalizedOptions.length;
    },
    fieldId() {
      return this.id || `edge-branch-context-${Math.random().toString(36).slice(2, 9)}`;
    },
  },
  methods: {
    optionText(option) {
      const suffix = [option.code, this.showCompany ? option.company : ""].filter(Boolean).join(" · ");
      return suffix ? `${option.label} · ${suffix}` : option.label;
    },
    onChange(event) {
      const value = clean(event?.target?.value);
      const option = this.normalizedOptions.find((item) => item.value === value) || null;
      this.$emit("update:modelValue", value);
      this.$emit("change", option);
      this.$emit("switch", option);
    },
  },
  render() {
    const optionNodes = [];
    if (!this.required) optionNodes.push(h("option", { value: "" }, this.placeholder));
    this.normalizedOptions.forEach((option) => {
      optionNodes.push(h("option", { value: option.value, disabled: option.disabled }, this.optionText(option)));
    });

    const meta = [this.displayCode, this.showCompany ? this.displayCompany : ""].filter(Boolean).join(" · ");
    const noOptions = !this.normalizedOptions.length;

    return h("section", {
      class: ["edge-branch-context", { "edge-branch-context--compact": this.compact, "is-busy": this.busy }],
      "data-edge-working-branch": this.modelValue || "",
    }, [
      h("div", { class: "edge-branch-context__identity" }, [
        h("span", { class: "edge-branch-context__icon", "aria-hidden": "true" }, [h(EdgeIcon, { name: this.icon, size: "md" })]),
        h("div", { class: "edge-branch-context__copy" }, [
          h("span", { class: "edge-branch-context__eyebrow" }, this.label),
          h("strong", { class: "edge-branch-context__label" }, this.displayLabel),
          meta ? h("small", { class: "edge-branch-context__meta" }, meta) : null,
          this.helper ? h("small", { class: "edge-branch-context__helper" }, this.helper) : null,
        ]),
      ]),
      h("div", { class: "edge-branch-context__control" }, [
        h("label", { class: "sr-only", for: this.fieldId }, this.label),
        h("select", {
          id: this.fieldId,
          class: "form-control edge-branch-context__select",
          value: this.modelValue,
          disabled: this.controlDisabled,
          required: this.required,
          "aria-busy": this.busy ? "true" : "false",
          onChange: this.onChange,
        }, optionNodes),
        this.busy ? h("span", { class: "edge-branch-context__status", role: "status" }, "Switching…") : null,
        noOptions ? h("small", { class: "edge-branch-context__empty", role: "status" }, this.emptyMessage) : null,
      ]),
    ]);
  },
});

export const contextComponents = Object.freeze({ EdgeBranchContextSwitcher });
export default contextComponents;
