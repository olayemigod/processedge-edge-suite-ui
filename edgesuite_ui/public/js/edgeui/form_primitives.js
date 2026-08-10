import { defineComponent, h } from "vue";

function fieldId(prefix, id) {
  return id || `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function helperNode(baseClass, error, description) {
  const text = error || description;
  if (!text) return null;
  return h("p", { class: [`${baseClass}__helper`, { "is-error": Boolean(error) }] }, text);
}

function labelNode(baseClass, id, label, required) {
  if (!label) return null;
  return h("label", { class: `${baseClass}__label`, for: id }, [
    label,
    required ? h("span", { class: `${baseClass}__required` }, " *") : null,
  ]);
}

export const EdgeInput = defineComponent({
  name: "EdgeInput",
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number], default: "" },
    label: { type: String, default: "" },
    placeholder: { type: String, default: "" },
    description: { type: String, default: "" },
    error: { type: String, default: "" },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    type: { type: String, default: "text" },
    id: { type: String, default: "" },
    name: { type: String, default: "" },
    step: { type: [String, Number], default: undefined },
    min: { type: [String, Number], default: undefined },
    max: { type: [String, Number], default: undefined },
    autocomplete: { type: String, default: "" },
    inputmode: { type: String, default: "" },
  },
  emits: ["update:modelValue", "input", "change", "blur", "focus"],
  setup(props, { attrs, emit }) {
    const id = fieldId("edge-input", props.id);
    const base = "edge-input";
    return () => h("div", { class: [base, { "has-error": Boolean(props.error), "is-readonly": props.readonly }] }, [
      labelNode(base, id, props.label, props.required),
      h("input", {
        ...attrs,
        id,
        name: props.name || undefined,
        type: props.type || "text",
        value: props.modelValue ?? "",
        placeholder: props.placeholder || undefined,
        required: props.required,
        disabled: props.disabled,
        readonly: props.readonly,
        step: props.step,
        min: props.min,
        max: props.max,
        autocomplete: props.autocomplete || undefined,
        inputmode: props.inputmode || undefined,
        "aria-invalid": props.error ? "true" : "false",
        class: ["edge-input__control", attrs.class],
        onInput: (event) => {
          emit("update:modelValue", event.target.value);
          emit("input", event.target.value);
        },
        onChange: (event) => emit("change", event.target.value),
        onBlur: (event) => emit("blur", event),
        onFocus: (event) => emit("focus", event),
      }),
      helperNode(base, props.error, props.description),
    ]);
  },
});

export const EdgeTextarea = defineComponent({
  name: "EdgeTextarea",
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number], default: "" },
    label: { type: String, default: "" },
    placeholder: { type: String, default: "" },
    description: { type: String, default: "" },
    error: { type: String, default: "" },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    rows: { type: [String, Number], default: 3 },
    id: { type: String, default: "" },
    name: { type: String, default: "" },
  },
  emits: ["update:modelValue", "input", "change", "blur", "focus"],
  setup(props, { attrs, emit }) {
    const id = fieldId("edge-textarea", props.id);
    const base = "edge-textarea";
    return () => h("div", { class: [base, { "has-error": Boolean(props.error), "is-readonly": props.readonly }] }, [
      labelNode(base, id, props.label, props.required),
      h("textarea", {
        ...attrs,
        id,
        name: props.name || undefined,
        rows: props.rows,
        value: props.modelValue ?? "",
        placeholder: props.placeholder || undefined,
        required: props.required,
        disabled: props.disabled,
        readonly: props.readonly,
        "aria-invalid": props.error ? "true" : "false",
        class: ["edge-textarea__control", attrs.class],
        onInput: (event) => {
          emit("update:modelValue", event.target.value);
          emit("input", event.target.value);
        },
        onChange: (event) => emit("change", event.target.value),
        onBlur: (event) => emit("blur", event),
        onFocus: (event) => emit("focus", event),
      }),
      helperNode(base, props.error, props.description),
    ]);
  },
});

export const EdgeCheckbox = defineComponent({
  name: "EdgeCheckbox",
  inheritAttrs: false,
  props: {
    modelValue: { type: [Boolean, Number, String], default: false },
    label: { type: String, default: "" },
    description: { type: String, default: "" },
    error: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    id: { type: String, default: "" },
    name: { type: String, default: "" },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { attrs, emit }) {
    const id = fieldId("edge-checkbox", props.id);
    const checked = () => props.modelValue === true || props.modelValue === 1 || props.modelValue === "1";
    return () => h("div", { class: ["edge-checkbox", { "has-error": Boolean(props.error), "is-readonly": props.readonly }] }, [
      h("label", { class: "edge-checkbox__surface", for: id }, [
        h("input", {
          ...attrs,
          id,
          name: props.name || undefined,
          type: "checkbox",
          checked: checked(),
          disabled: props.disabled || props.readonly,
          class: ["edge-checkbox__control", attrs.class],
          onChange: (event) => {
            const value = Boolean(event.target.checked);
            emit("update:modelValue", value);
            emit("change", value);
          },
        }),
        h("span", { class: "edge-checkbox__copy" }, [
          props.label ? h("strong", { class: "edge-checkbox__label" }, props.label) : null,
          props.description ? h("small", { class: "edge-checkbox__description" }, props.description) : null,
        ]),
      ]),
      props.error ? h("p", { class: "edge-checkbox__helper is-error" }, props.error) : null,
    ]);
  },
});

export const formPrimitiveComponents = Object.freeze({
  EdgeInput,
  EdgeTextarea,
  EdgeCheckbox,
});
