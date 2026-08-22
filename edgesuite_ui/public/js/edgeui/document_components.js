import { defineComponent, h } from "vue";

import { EdgeStatusBadge } from "./components";
import { EdgeLinkField } from "./form_components";
import { EdgeIcon } from "./professional_components";

function clean(value) {
  return String(value ?? "").trim();
}

function slug(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function fieldType(field = {}) {
  return clean(field.fieldtype || field.type || "Data").toLowerCase();
}

function asBoolean(value) {
  if (typeof value === "string") return !["", "0", "false", "no", "off"].includes(value.toLowerCase());
  return Boolean(value);
}

function compareValue(actual, operator, expected) {
  if (operator === "==" || operator === "===") return String(actual ?? "") === String(expected ?? "");
  if (operator === "!=" || operator === "!==") return String(actual ?? "") !== String(expected ?? "");
  return false;
}

export function evaluateDocumentDependency(expression, values = {}) {
  if (!expression) return true;
  if (typeof expression === "function") return Boolean(expression(values));
  if (typeof expression === "object") {
    const actual = values[expression.field];
    if (Object.prototype.hasOwnProperty.call(expression, "equals")) {
      return String(actual ?? "") === String(expression.equals ?? "");
    }
    if (Object.prototype.hasOwnProperty.call(expression, "not_equals")) {
      return String(actual ?? "") !== String(expression.not_equals ?? "");
    }
    if (Array.isArray(expression.in)) return expression.in.map(String).includes(String(actual ?? ""));
    if (expression.truthy) return asBoolean(actual);
    if (expression.falsy) return !asBoolean(actual);
    return true;
  }

  let source = clean(expression).replace(/^eval:/, "").trim();
  if (!source) return true;

  const orParts = source.split(/\s*\|\|\s*/);
  if (orParts.length > 1) return orParts.some((part) => evaluateDocumentDependency(part, values));
  const andParts = source.split(/\s*&&\s*/);
  if (andParts.length > 1) return andParts.every((part) => evaluateDocumentDependency(part, values));

  let match = source.match(/^(!)?\s*\[([^\]]*)\]\.includes\(doc\.([a-zA-Z0-9_]+)\)$/);
  if (match) {
    const options = match[2]
      .split(",")
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
    const included = options.includes(String(values[match[3]] ?? ""));
    return match[1] ? !included : included;
  }

  match = source.match(/^doc\.([a-zA-Z0-9_]+)\s*(===|!==|==|!=)\s*['"]?([^'"]*)['"]?$/);
  if (match) return compareValue(values[match[1]], match[2], match[3]);

  match = source.match(/^!\s*doc\.([a-zA-Z0-9_]+)$/);
  if (match) return !asBoolean(values[match[1]]);

  match = source.match(/^doc\.([a-zA-Z0-9_]+)$/);
  if (match) return asBoolean(values[match[1]]);

  return true;
}

function isVisible(field, values) {
  if (field.hidden === true || Number(field.hidden || 0) === 1) return false;
  return evaluateDocumentDependency(field.depends_on || field.visible_when, values);
}

function isRequired(field, values) {
  if (field.reqd || field.required) return true;
  return Boolean(
    (field.mandatory_depends_on || field.required_when) &&
      evaluateDocumentDependency(field.mandatory_depends_on || field.required_when, values),
  );
}

function isReadonly(field, values) {
  if (field.read_only || field.readonly || field.disabled) return true;
  return Boolean(
    field.read_only_depends_on && evaluateDocumentDependency(field.read_only_depends_on, values),
  );
}

function optionsFor(field = {}) {
  if (Array.isArray(field.options)) {
    return field.options.map((option) =>
      typeof option === "object"
        ? { value: clean(option.value ?? option.name), label: clean(option.label ?? option.title ?? option.value ?? option.name) }
        : { value: clean(option), label: clean(option) },
    );
  }
  if (typeof field.options === "string") {
    return field.options
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean)
      .map((option) => ({ value: option, label: option }));
  }
  return [];
}

function displayValue(column, value) {
  if (value === null || value === undefined || value === "") return "—";
  const type = fieldType(column);
  if (type === "check") return asBoolean(value) ? "Yes" : "No";
  if (["currency", "float", "int", "percent"].includes(type) && Number.isFinite(Number(value))) {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: type === "int" ? 0 : 2,
    }).format(Number(value));
  }
  return String(value);
}

export const EdgeDataTable = defineComponent({
  name: "EdgeDataTable",
  props: {
    columns: { type: Array, default: () => [] },
    rows: { type: Array, default: () => [] },
    rowKey: { type: String, default: "name" },
    actions: { type: Array, default: () => [] },
    selectable: { type: Boolean, default: false },
    selected: { type: Array, default: () => [] },
    emptyTitle: { type: String, default: "No records" },
    emptyDescription: { type: String, default: "No matching records were found." },
    compact: { type: Boolean, default: false },
  },
  emits: ["row-click", "action", "update:selected", "select"],
  methods: {
    keyFor(row, index) {
      return row?.[this.rowKey] ?? index;
    },
    isSelected(row) {
      return this.selected.map(String).includes(String(row?.[this.rowKey]));
    },
    toggle(row, checked) {
      const key = row?.[this.rowKey];
      const next = new Set(this.selected.map(String));
      if (checked) next.add(String(key));
      else next.delete(String(key));
      const values = [...next];
      this.$emit("update:selected", values);
      this.$emit("select", { row, checked, selected: values });
    },
    actionVisible(action, row) {
      if (typeof action.visible === "function") return Boolean(action.visible(row));
      if (action.visible_when) return evaluateDocumentDependency(action.visible_when, row || {});
      return action.hidden !== true;
    },
  },
  render() {
    if (!this.rows.length) {
      return h("section", { class: "edge-document-empty", role: "status" }, [
        h(EdgeIcon, { name: "list", size: "lg" }),
        h("h3", this.emptyTitle),
        h("p", this.emptyDescription),
      ]);
    }

    const headings = [];
    if (this.selectable) headings.push(h("th", { class: "edge-data-table__select" }, ""));
    this.columns.forEach((column) => headings.push(h("th", { key: column.fieldname }, column.label || column.fieldname)));
    if (this.actions.length) headings.push(h("th", { class: "edge-data-table__actions" }, "Actions"));

    const body = this.rows.map((row, index) => {
      const cells = [];
      if (this.selectable) {
        cells.push(
          h("td", { class: "edge-data-table__select" }, [
            h("input", {
              type: "checkbox",
              checked: this.isSelected(row),
              "aria-label": `Select ${this.keyFor(row, index)}`,
              onClick: (event) => event.stopPropagation(),
              onChange: (event) => this.toggle(row, event.target.checked),
            }),
          ]),
        );
      }
      this.columns.forEach((column) => {
        const value = row?.[column.fieldname];
        const status = column.status || ["status", "workflow_state", "docstatus"].includes(column.fieldname);
        cells.push(
          h(
            "td",
            { key: column.fieldname, "data-label": column.label || column.fieldname },
            status
              ? h(EdgeStatusBadge, {
                  label: displayValue(column, value),
                  status: displayValue(column, value),
                  tone: column.tone || "neutral",
                })
              : displayValue(column, value),
          ),
        );
      });
      if (this.actions.length) {
        const buttons = this.actions
          .filter((action) => this.actionVisible(action, row))
          .map((action) =>
            h(
              "button",
              {
                type: "button",
                class: [
                  "edge-button",
                  "edge-button--compact",
                  action.primary ? "edge-button--primary" : "",
                  action.danger ? "edge-button--danger" : "",
                ],
                disabled: typeof action.disabled === "function" ? action.disabled(row) : action.disabled,
                onClick: (event) => {
                  event.stopPropagation();
                  this.$emit("action", { action, row });
                },
              },
              action.label,
            ),
          );
        cells.push(h("td", { class: "edge-data-table__actions", "data-label": "Actions" }, buttons));
      }
      return h(
        "tr",
        {
          key: this.keyFor(row, index),
          tabindex: 0,
          onClick: () => this.$emit("row-click", row),
          onKeydown: (event) => {
            if (["Enter", " "].includes(event.key)) {
              event.preventDefault();
              this.$emit("row-click", row);
            }
          },
        },
        cells,
      );
    });

    return h("div", { class: ["edge-data-table-card", { "is-compact": this.compact }] }, [
      h("div", { class: "edge-data-table-scroll" }, [
        h("table", { class: "edge-data-table" }, [h("thead", [h("tr", headings)]), h("tbody", body)]),
      ]),
      this.$slots.footer ? h("footer", { class: "edge-data-table__footer" }, this.$slots.footer()) : null,
    ]);
  },
});

export const EdgeChildTable = defineComponent({
  name: "EdgeChildTable",
  props: {
    field: { type: Object, default: () => ({}) },
    rows: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    readonly: { type: Boolean, default: false },
    addLabel: { type: String, default: "Add row" },
    linkSearcher: { type: Function, default: null },
    linkCreator: { type: Function, default: null },
    linkCanCreate: { type: [Boolean, Function], default: false },
    linkCreateLabel: { type: [String, Function], default: "Create new" },
    newRowsFirst: { type: Boolean, default: false },
  },
  emits: ["update:rows", "change", "search-options"],
  methods: {
    addRow() {
      const row = Object.fromEntries(this.columns.map((column) => [column.fieldname, column.default ?? ""]));
      row.__temporary_key = `edge-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next = [...this.rows, row];
      this.$emit("update:rows", next);
      this.$emit("change", next);
    },
    displayedRows() {
      const indexed = this.rows.map((row, index) => ({ row, index }));
      return this.newRowsFirst ? indexed.reverse() : indexed;
    },
    removeRow(index) {
      const next = this.rows.filter((_row, rowIndex) => rowIndex !== index);
      this.$emit("update:rows", next);
      this.$emit("change", next);
    },
    updateCell(index, column, value) {
      const next = this.rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [column.fieldname]: value, __islocal: row.__islocal ?? 1 } : row,
      );
      this.$emit("update:rows", next);
      this.$emit("change", next);
    },
    canCreateLink(column, row) {
      return typeof this.linkCanCreate === "function"
        ? Boolean(this.linkCanCreate(column, row))
        : Boolean(this.linkCanCreate);
    },
    createLabelFor(column, row) {
      return typeof this.linkCreateLabel === "function"
        ? this.linkCreateLabel(column, row)
        : this.linkCreateLabel;
    },
    renderControl(row, index, column) {
      const type = fieldType(column);
      const readonly = this.readonly || isReadonly(column, row);
      const value = row?.[column.fieldname] ?? column.default ?? "";
      if (type === "check") {
        return h("input", {
          type: "checkbox",
          checked: asBoolean(value),
          disabled: readonly,
          onChange: (event) => this.updateCell(index, column, event.target.checked ? 1 : 0),
        });
      }
      if (type === "select") {
        return h(
          "select",
          {
            class: "form-control",
            value,
            disabled: readonly,
            onChange: (event) => this.updateCell(index, column, event.target.value),
          },
          [h("option", { value: "" }, ""), ...optionsFor(column).map((option) => h("option", { value: option.value }, option.label))],
        );
      }
      if (type === "link") {
        return h(EdgeLinkField, {
          modelValue: value,
          label: "",
          disabled: readonly,
          placeholder: column.placeholder || `Select ${column.label || column.fieldname}`,
          searcher: this.linkSearcher
            ? (query) => this.linkSearcher(column, query, row)
            : null,
          creator: this.linkCreator
            ? (query, context) => this.linkCreator(column, query, row, context)
            : null,
          canCreate: !readonly && this.canCreateLink(column, row),
          createLabel: this.createLabelFor(column, row),
          "onUpdate:modelValue": (next) => this.updateCell(index, column, next),
          onSelect: (option) => this.$emit("search-options", { field: column, row, option }),
        });
      }
      return h("input", {
        class: "form-control",
        type: ["date", "datetime-local", "time", "number"].includes(type)
          ? type
          : ["currency", "float", "int", "percent"].includes(type)
            ? "number"
            : "text",
        value,
        disabled: readonly,
        onInput: (event) => this.updateCell(index, column, event.target.value),
      });
    },
  },
  render() {
    const headings = this.columns.map((column) => h("th", column.label || column.fieldname));
    if (!this.readonly) headings.push(h("th", { class: "edge-child-table__actions" }, ""));
    const rows = this.displayedRows().map(({ row, index }) => {
      const cells = this.columns.map((column) =>
        h("td", { "data-label": column.label || column.fieldname }, [this.renderControl(row, index, column)]),
      );
      if (!this.readonly) {
        cells.push(
          h("td", { class: "edge-child-table__actions" }, [
            h(
              "button",
              {
                type: "button",
                class: "edge-button edge-button--compact edge-button--danger",
                onClick: () => this.removeRow(index),
              },
              "Remove",
            ),
          ]),
        );
      }
      return h("tr", { key: row.name || row.__temporary_key || index }, cells);
    });

    return h("section", { class: "edge-child-table" }, [
      h("div", { class: "edge-child-table__header" }, [
        h("div", [
          h("h4", this.field.label || "Rows"),
          this.field.description ? h("p", this.field.description) : null,
        ]),
        !this.readonly
          ? h("button", { type: "button", class: "edge-button", onClick: this.addRow }, this.addLabel)
          : null,
      ]),
      h("div", { class: "edge-child-table__scroll" }, [
        h("table", [h("thead", [h("tr", headings)]), h("tbody", rows)]),
      ]),
      !this.rows.length ? h("p", { class: "edge-child-table__empty" }, "No rows added yet.") : null,
    ]);
  },
});

export const EdgeWorkflowBar = defineComponent({
  name: "EdgeWorkflowBar",
  props: {
    state: { type: String, default: "" },
    docstatus: { type: Number, default: 0 },
    dirty: { type: Boolean, default: false },
    saving: { type: Boolean, default: false },
    canSave: { type: Boolean, default: true },
    canDelete: { type: Boolean, default: false },
    transitions: { type: Array, default: () => [] },
    saveLabel: { type: String, default: "Save" },
  },
  emits: ["save", "delete", "transition", "back", "more-action"],
  render() {
    const transitionButtons = this.transitions.map((transition) =>
      h(
        "button",
        {
          type: "button",
          class: [
            "edge-button",
            transition.primary ? "edge-button--primary" : "",
            transition.danger ? "edge-button--danger" : "",
          ],
          disabled: this.saving || transition.disabled,
          onClick: () => this.$emit("transition", transition),
        },
        transition.label || transition.action,
      ),
    );
    return h("section", { class: "edge-workflow-bar" }, [
      h("div", { class: "edge-workflow-bar__identity" }, [
        h("button", { type: "button", class: "edge-button edge-button--compact", onClick: () => this.$emit("back") }, "Back"),
        this.state
          ? h(EdgeStatusBadge, { label: this.state, status: this.state, tone: this.docstatus === 2 ? "danger" : "neutral" })
          : null,
        this.dirty ? h("span", { class: "edge-workflow-bar__dirty" }, "Unsaved changes") : null,
      ]),
      h("div", { class: "edge-workflow-bar__actions" }, [
        ...transitionButtons,
        this.canDelete
          ? h(
              "button",
              {
                type: "button",
                class: "edge-button edge-button--danger",
                disabled: this.saving,
                onClick: () => this.$emit("delete"),
              },
              "Delete",
            )
          : null,
        this.canSave
          ? h(
              "button",
              {
                type: "button",
                class: "edge-button edge-button--primary",
                disabled: this.saving || !this.dirty,
                onClick: () => this.$emit("save"),
              },
              this.saving ? "Saving…" : this.saveLabel,
            )
          : null,
      ]),
    ]);
  },
});

export const EdgeDocumentForm = defineComponent({
  name: "EdgeDocumentForm",
  props: {
    schema: { type: Object, default: () => ({ tabs: [] }) },
    modelValue: { type: Object, default: () => ({}) },
    errors: { type: Object, default: () => ({}) },
    readonly: { type: Boolean, default: false },
    linkSearcher: { type: Function, default: null },
    childLinkSearcher: { type: Function, default: null },
  },
  emits: ["update:modelValue", "change", "search-options"],
  data() {
    return { activeTab: "" };
  },
  computed: {
    tabs() {
      const tabs = Array.isArray(this.schema.tabs) ? this.schema.tabs : [];
      return tabs.length
        ? tabs
        : [{ key: "general", label: "General", sections: this.schema.sections || [] }];
    },
    selectedTab() {
      return this.tabs.find((tab) => tab.key === this.activeTab) || this.tabs[0] || null;
    },
  },
  mounted() {
    this.activeTab = this.tabs[0]?.key || "";
  },
  watch: {
    tabs: {
      deep: true,
      handler(next) {
        if (!next.some((tab) => tab.key === this.activeTab)) this.activeTab = next[0]?.key || "";
      },
    },
  },
  methods: {
    update(field, value) {
      const next = { ...(this.modelValue || {}), [field.fieldname]: value };
      for (const dependent of field.clear_fields || []) next[dependent] = "";
      this.$emit("update:modelValue", next);
      this.$emit("change", { field, value, values: next });
    },
    renderField(field) {
      if (!isVisible(field, this.modelValue || {})) return null;
      const type = fieldType(field);
      const value = this.modelValue?.[field.fieldname] ?? field.default ?? "";
      const required = isRequired(field, this.modelValue || {});
      const readonly = this.readonly || isReadonly(field, this.modelValue || {});
      const error = this.errors?.[field.fieldname] || "";
      const id = `edge-doc-${field.fieldname}`;

      if (type === "table") {
        return h(EdgeChildTable, {
          field,
          rows: Array.isArray(value) ? value : [],
          columns: field.child_fields || [],
          readonly,
          linkSearcher: this.childLinkSearcher || this.linkSearcher,
          "onUpdate:rows": (rows) => this.update(field, rows),
          onSearchOptions: (payload) => this.$emit("search-options", payload),
        });
      }

      let control;
      if (type === "check") {
        control = h("label", { class: "edge-document-check" }, [
          h("input", {
            id,
            type: "checkbox",
            checked: asBoolean(value),
            disabled: readonly,
            onChange: (event) => this.update(field, event.target.checked ? 1 : 0),
          }),
          h("span", field.checkbox_label || "Enabled"),
        ]);
      } else if (type === "select") {
        control = h(
          "select",
          {
            id,
            class: ["form-control", error ? "is-invalid" : ""],
            value,
            disabled: readonly,
            required,
            onChange: (event) => this.update(field, event.target.value),
          },
          [h("option", { value: "" }, field.placeholder || "Select"), ...optionsFor(field).map((option) => h("option", { value: option.value }, option.label))],
        );
      } else if (["small text", "text", "long text", "text editor", "code"].includes(type)) {
        control = h("textarea", {
          id,
          class: ["form-control", "edge-document-textarea", error ? "is-invalid" : ""],
          value,
          disabled: readonly,
          required,
          rows: field.rows || (type === "small text" ? 3 : 6),
          onInput: (event) => this.update(field, event.target.value),
        });
      } else if (type === "link") {
        control = h(EdgeLinkField, {
          id,
          modelValue: value,
          selectedLabel: field.selected_label || "",
          label: "",
          required,
          disabled: readonly,
          error,
          placeholder: field.placeholder || `Search ${field.label || field.options || "records"}`,
          context: { values: this.modelValue || {}, field },
          searcher: this.linkSearcher
            ? (query, context) => this.linkSearcher(field, query, context?.values || this.modelValue || {})
            : null,
          "onUpdate:modelValue": (next) => this.update(field, next),
          onSelect: (option) => this.$emit("search-options", { field, option }),
        });
      } else if (type === "attach" || type === "attach image") {
        control = h("div", { class: "edge-document-attachment" }, [
          value ? h("a", { href: value, target: "_blank", rel: "noopener noreferrer" }, clean(value).split("/").pop()) : h("span", "No file attached"),
          !readonly && this.$slots.attachment
            ? this.$slots.attachment({ field, value, update: (next) => this.update(field, next) })
            : null,
        ]);
      } else {
        const htmlType = {
          date: "date",
          datetime: "datetime-local",
          time: "time",
          int: "number",
          float: "number",
          currency: "number",
          percent: "number",
          email: "email",
          phone: "tel",
          password: "password",
        }[type] || "text";
        control = h("input", {
          id,
          class: ["form-control", error ? "is-invalid" : ""],
          type: htmlType,
          value,
          disabled: readonly,
          required,
          step: ["float", "currency", "percent"].includes(type) ? "any" : undefined,
          onInput: (event) => this.update(field, event.target.value),
        });
      }

      return h("div", { class: ["edge-document-field", `field-${slug(field.fieldname)}`, { "is-readonly": readonly, "has-error": Boolean(error) }] }, [
        type !== "check"
          ? h("label", { for: id }, [field.label || field.fieldname, required ? h("span", { class: "edge-required" }, " *") : null])
          : h("span", { class: "edge-document-field__check-label" }, [field.label || field.fieldname, required ? h("span", { class: "edge-required" }, " *") : null]),
        control,
        error ? h("p", { class: "edge-document-field__error" }, error) : field.description ? h("p", { class: "edge-document-field__description" }, field.description) : null,
      ]);
    },
  },
  render() {
    if (!this.selectedTab) return null;
    const nav = this.tabs.length > 1
      ? h(
          "nav",
          { class: "edge-document-tabs", "aria-label": "Document sections" },
          this.tabs.map((tab) =>
            h(
              "button",
              {
                type: "button",
                class: ["edge-document-tab", { active: tab.key === this.selectedTab.key }],
                "aria-current": tab.key === this.selectedTab.key ? "page" : undefined,
                onClick: () => {
                  this.activeTab = tab.key;
                },
              },
              tab.label || tab.key,
            ),
          ),
        )
      : null;
    const sections = (this.selectedTab.sections || [])
      .filter((section) => evaluateDocumentDependency(section.depends_on || section.visible_when, this.modelValue || {}))
      .map((section) => {
        const fields = (section.fields || []).map(this.renderField).filter(Boolean);
        if (!fields.length) return null;
        return h("section", { class: ["edge-document-section", { "is-collapsible": section.collapsible }] }, [
          section.label || section.description
            ? h("header", { class: "edge-document-section__header" }, [
                section.label ? h("h3", section.label) : null,
                section.description ? h("p", section.description) : null,
              ])
            : null,
          h("div", { class: "edge-document-section__grid", style: { "--edge-document-columns": section.columns || 2 } }, fields),
        ]);
      })
      .filter(Boolean);
    return h("div", { class: "edge-document-form" }, [nav, h("div", { class: "edge-document-form__sections" }, sections)]);
  },
});

export const EdgeSettingsLayout = defineComponent({
  name: "EdgeSettingsLayout",
  props: {
    groups: { type: Array, default: () => [] },
    active: { type: String, default: "" },
    title: { type: String, default: "Settings" },
    description: { type: String, default: "" },
  },
  emits: ["update:active", "change"],
  render() {
    const selected = this.groups.find((group) => group.key === this.active) || this.groups[0] || null;
    return h("div", { class: "edge-settings-layout" }, [
      h("aside", { class: "edge-settings-layout__sidebar" }, [
        h("div", { class: "edge-settings-layout__heading" }, [h("h2", this.title), this.description ? h("p", this.description) : null]),
        h(
          "nav",
          { "aria-label": "Settings groups" },
          this.groups.map((group) =>
            h(
              "button",
              {
                type: "button",
                class: ["edge-settings-layout__item", { active: selected?.key === group.key }],
                onClick: () => {
                  this.$emit("update:active", group.key);
                  this.$emit("change", group);
                },
              },
              [group.icon ? h(EdgeIcon, { name: group.icon }) : null, h("span", [h("strong", group.label || group.key), group.description ? h("small", group.description) : null])],
            ),
          ),
        ),
      ]),
      h("main", { class: "edge-settings-layout__content" }, this.$slots.default ? this.$slots.default({ group: selected }) : []),
    ]);
  },
});

export const documentComponents = Object.freeze({
  EdgeDataTable,
  EdgeChildTable,
  EdgeWorkflowBar,
  EdgeDocumentForm,
  EdgeSettingsLayout,
});