import { h } from "vue";

function normalizedType(field = {}) {
  return String(field.type || field.fieldtype || "Data").trim().toLowerCase();
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
  return [];
}

function normalizedValues(value) {
  if (Array.isArray(value)) return [...new Set(value.map(String).filter(Boolean))];
  if (value === undefined || value === null || value === "") return [];
  return [...new Set(String(value).split(",").map((item) => item.trim()).filter(Boolean))];
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

function requiredField(field, values = {}) {
  return Boolean(
    field?.required ||
      field?.reqd ||
      (field?.required_when && conditionMatches(field.required_when, values)),
  );
}

export function applyMultiSelectCompatibility(modalComponents = {}) {
  const EdgeFormDialog = modalComponents.EdgeFormDialog;
  if (!EdgeFormDialog || EdgeFormDialog.__edgeMultiSelectCompatible) return modalComponents;

  const originalMethods = EdgeFormDialog.methods || {};
  const originalRenderField = originalMethods.renderField;

  EdgeFormDialog.methods = {
    ...originalMethods,
    renderField(field, index) {
      const type = normalizedType(field);
      if (!["multiselect", "multi select", "multi-select", "multicheck"].includes(type)) {
        return originalRenderField?.call(this, field, index) || null;
      }

      const values = this.modelValue || {};
      const selected = normalizedValues(values[field.fieldname] ?? field.default ?? []);
      const required = requiredField(field, values);
      const error = this.fieldErrors?.[field.fieldname] || "";
      const id = `edge-form-${field.fieldname}`;
      const disabled = this.busy || field.disabled || field.read_only;
      const options = normalizedOptions(field);

      const toggle = (optionValue, checked) => {
        const next = checked
          ? [...new Set([...selected, optionValue])]
          : selected.filter((value) => value !== optionValue);
        this.updateValue(field, next);
      };

      return h("div", { class: ["edge-form-field", "edge-form-field--multiselect"] }, [
        h("span", { class: "edge-form-field__label" }, [
          field.label || field.fieldname,
          required ? h("span", { class: "edge-form-required", "aria-hidden": "true" }, " *") : null,
        ]),
        h(
          "div",
          {
            id,
            class: ["edge-multiselect", error ? "is-invalid" : ""],
            role: "group",
            "aria-invalid": error ? "true" : undefined,
            "aria-describedby": error ? `${id}-error` : field.description ? `${id}-help` : undefined,
            "data-edge-autofocus": index === 0 ? "true" : undefined,
          },
          options.length
            ? options.map((option) =>
                h("label", { class: "edge-multiselect__option", key: option.value }, [
                  h("input", {
                    type: "checkbox",
                    checked: selected.includes(option.value),
                    disabled,
                    onChange: (event) => toggle(option.value, event.target.checked),
                  }),
                  h("span", { class: "edge-multiselect__copy" }, [
                    h("strong", option.label),
                    option.description ? h("small", option.description) : null,
                  ]),
                ]),
              )
            : [
                h(
                  "div",
                  { class: "edge-multiselect__empty" },
                  field.empty_message || "No valid options are available for the selected context.",
                ),
              ],
        ),
        field.options_loading ? h("small", { class: "edge-multiselect__loading" }, "Refreshing options…") : null,
        field.description ? h("small", { id: `${id}-help` }, field.description) : null,
        error ? h("small", { id: `${id}-error`, class: "edge-form-error" }, error) : null,
      ]);
    },
  };

  EdgeFormDialog.__edgeMultiSelectCompatible = true;
  return modalComponents;
}
