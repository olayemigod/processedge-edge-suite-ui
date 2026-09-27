import { defineComponent, h } from "vue";

const MONTHS = Object.freeze({
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8,
  sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
});

const DEFAULT_PRESETS = Object.freeze([
  { label: "Today", expression: "today" },
  { label: "Yesterday", expression: "yesterday" },
  { label: "This Week", expression: "this week" },
  { label: "Last Week", expression: "last week" },
  { label: "This Month", expression: "this month" },
  { label: "Last Month", expression: "last month" },
  { label: "Last 7 Days", expression: "last 7 days" },
  { label: "Last 30 Days", expression: "last 30 days" },
  { label: "Last 90 Days", expression: "last 90 days" },
  { label: "YTD", expression: "YTD" },
]);

function localDate(value = null) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function iso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function startOfWeek(date) {
  const day = date.getDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function quarterStart(date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function makeResult(expression, fromDate, toDate, { label = "", ambiguous = false, kind = "range" } = {}) {
  const from = iso(fromDate);
  const to = iso(toDate || fromDate);
  return {
    valid: true,
    expression,
    kind: kind === "date" || from === to ? "date" : "range",
    from_date: from,
    to_date: to,
    label: label || (from === to ? from : `${from} – ${to}`),
    ambiguous: Boolean(ambiguous),
    requires_confirmation: Boolean(ambiguous),
  };
}

function invalid(expression, message) {
  return { valid: false, expression, message, ambiguous: false, requires_confirmation: false };
}

function monthRange(month, year, expression) {
  const start = new Date(year, month, 1);
  return makeResult(expression, start, endOfMonth(start));
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = localDate(value);
  return iso(date) === value;
}

function displayDate(value, dateOrder = "DMY") {
  if (!validIsoDate(value)) return value || "";
  const [year, month, day] = value.split("-");
  return String(dateOrder || "DMY").toUpperCase() === "MDY"
    ? `${month}-${day}-${year}`
    : `${day}-${month}-${year}`;
}

export function interpretSmartDate(expression, { referenceDate = null, dateOrder = "DMY" } = {}) {
  const raw = String(expression || "").trim();
  const text = raw.toLowerCase().replace(/\s+/g, " ");
  const today = localDate(referenceDate);
  if (!text) return invalid(raw, "Enter a date or date range.");

  if (text === "today") return makeResult(raw, today, today, { kind: "date" });
  if (text === "yesterday") return makeResult(raw, addDays(today, -1), addDays(today, -1), { kind: "date" });
  if (text === "tomorrow") return makeResult(raw, addDays(today, 1), addDays(today, 1), { kind: "date" });

  const relativePeriod = text.match(/^(this|last|next) (week|month|quarter|year)$/);
  if (relativePeriod) {
    const [, direction, unit] = relativePeriod;
    const offset = direction === "last" ? -1 : direction === "next" ? 1 : 0;
    if (unit === "week") {
      const start = addDays(startOfWeek(today), offset * 7);
      return makeResult(raw, start, addDays(start, 6));
    }
    if (unit === "month") {
      const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      return makeResult(raw, start, endOfMonth(start));
    }
    if (unit === "quarter") {
      const current = quarterStart(today);
      const start = new Date(current.getFullYear(), current.getMonth() + offset * 3, 1);
      return makeResult(raw, start, new Date(start.getFullYear(), start.getMonth() + 3, 0));
    }
    const start = new Date(today.getFullYear() + offset, 0, 1);
    return makeResult(raw, start, new Date(start.getFullYear(), 11, 31));
  }

  if (["ytd", "year to date"].includes(text)) {
    return makeResult(raw, new Date(today.getFullYear(), 0, 1), today);
  }
  if (["mtd", "month to date"].includes(text)) {
    return makeResult(raw, new Date(today.getFullYear(), today.getMonth(), 1), today);
  }
  if (["qtd", "quarter to date"].includes(text)) return makeResult(raw, quarterStart(today), today);

  const rolling = text.match(/^(?:last|past|next) (\d{1,4}) (day|days|week|weeks)$/);
  if (rolling) {
    const count = Math.max(1, Number(rolling[1]));
    const days = count * (rolling[2].startsWith("week") ? 7 : 1);
    if (text.startsWith("next ")) return makeResult(raw, today, addDays(today, days - 1));
    return makeResult(raw, addDays(today, -(days - 1)), today);
  }

  const quarter = text.match(/^q([1-4])\s+(\d{4})$/);
  if (quarter) {
    const start = new Date(Number(quarter[2]), (Number(quarter[1]) - 1) * 3, 1);
    return makeResult(raw, start, new Date(start.getFullYear(), start.getMonth() + 3, 0));
  }

  const monthYear = text.match(/^([a-z]+)\s+(\d{4})$/);
  if (monthYear && Object.prototype.hasOwnProperty.call(MONTHS, monthYear[1])) {
    return monthRange(MONTHS[monthYear[1]], Number(monthYear[2]), raw);
  }

  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const date = localDate(text);
    if (iso(date) !== text) return invalid(raw, "That date is not valid.");
    return makeResult(raw, date, date, { kind: "date" });
  }

  const numeric = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    let year = Number(numeric[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const order = String(dateOrder || "DMY").toUpperCase() === "MDY" ? "MDY" : "DMY";
    const ambiguous = first <= 12 && second <= 12 && first !== second;
    const day = order === "DMY" ? first : second;
    const month = order === "DMY" ? second : first;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return invalid(raw, "That date is not valid.");
    }
    return makeResult(raw, date, date, { kind: "date", ambiguous });
  }

  return invalid(raw, "Date phrase not recognized. Try today, last month, Q2 2026, last 30 days, or YYYY-MM-DD.");
}

export const EdgeSmartDateRange = defineComponent({
  name: "EdgeSmartDateRange",
  props: {
    modelValue: { type: Object, default: () => ({}) },
    label: { type: String, default: "Date range" },
    placeholder: { type: String, default: "e.g. last month, Q2 2026, last 30 days" },
    referenceDate: { type: [String, Date], default: null },
    dateOrder: { type: String, default: "DMY" },
    disabled: { type: Boolean, default: false },
    presets: { type: Array, default: () => DEFAULT_PRESETS.map((preset) => ({ ...preset })) },
  },
  emits: ["update:modelValue", "resolved", "invalid"],
  data() {
    return {
      selectedValue: {},
      expression: "",
      interpretation: null,
      confirmedAmbiguousExpression: "",
      pickerOpen: false,
      customFrom: "",
      customTo: "",
      customError: "",
    };
  },
  watch: {
    modelValue: {
      deep: true,
      immediate: true,
      handler(value) {
        this.syncFromModel(value || {});
      },
    },
  },
  mounted() {
    document.addEventListener("pointerdown", this.onDocumentPointerDown);
  },
  beforeUnmount() {
    document.removeEventListener("pointerdown", this.onDocumentPointerDown);
  },
  methods: {
    syncFromModel(value) {
      this.selectedValue = { ...value };
      if (validIsoDate(value.from_date)) this.customFrom = value.from_date;
      if (validIsoDate(value.to_date)) this.customTo = value.to_date;
      if (value.expression && value.expression !== "custom") this.expression = value.expression;
      if (value.from_date && value.to_date) {
        this.interpretation = {
          valid: true,
          expression: value.expression || "custom",
          from_date: value.from_date,
          to_date: value.to_date,
          label: value.label || (value.from_date === value.to_date ? value.from_date : `${value.from_date} – ${value.to_date}`),
          ambiguous: false,
          requires_confirmation: false,
        };
      }
    },
    selectedRangeLabel() {
      const from = this.selectedValue?.from_date;
      const to = this.selectedValue?.to_date;
      if (!from || !to) return "Select date range";
      const first = displayDate(from, this.dateOrder);
      const second = displayDate(to, this.dateOrder);
      return first === second ? first : `${first} – ${second}`;
    },
    selectedPeriodLabel() {
      const expression = String(this.selectedValue?.expression || "").trim();
      if (!expression) return "Date";
      if (expression === "custom") return "Custom";
      const preset = (this.presets || []).find(
        (item) => String(item.expression || "").toLowerCase() === expression.toLowerCase(),
      );
      return preset?.label || expression;
    },
    emitResolved(value) {
      this.selectedValue = { ...value };
      this.customFrom = value.from_date;
      this.customTo = value.to_date;
      this.customError = "";
      this.$emit("update:modelValue", value);
      this.$emit("resolved", value);
    },
    resolve() {
      const result = interpretSmartDate(this.expression, {
        referenceDate: this.referenceDate,
        dateOrder: this.dateOrder,
      });
      this.interpretation = result;
      if (!result.valid) {
        this.$emit("invalid", result);
        return;
      }
      if (result.requires_confirmation && this.confirmedAmbiguousExpression !== result.expression) return;
      const value = {
        expression: result.expression,
        from_date: result.from_date,
        to_date: result.to_date,
        label: result.label,
      };
      this.emitResolved(value);
      this.pickerOpen = false;
    },
    applyPreset(expression) {
      this.expression = expression;
      this.confirmedAmbiguousExpression = "";
      this.interpretation = interpretSmartDate(expression, {
        referenceDate: this.referenceDate,
        dateOrder: this.dateOrder,
      });
      this.resolve();
    },
    applyCustomRange() {
      this.customError = "";
      if (!validIsoDate(this.customFrom) || !validIsoDate(this.customTo)) {
        this.customError = "Choose both a valid start date and end date.";
        return;
      }
      if (this.customFrom > this.customTo) {
        this.customError = "The start date cannot be after the end date.";
        return;
      }
      const value = {
        expression: "custom",
        from_date: this.customFrom,
        to_date: this.customTo,
        label: this.customFrom === this.customTo ? this.customFrom : `${this.customFrom} – ${this.customTo}`,
      };
      this.expression = "";
      this.interpretation = null;
      this.confirmedAmbiguousExpression = "";
      this.emitResolved(value);
      this.pickerOpen = false;
    },
    confirmAmbiguous() {
      if (!this.interpretation?.valid || !this.interpretation.requires_confirmation) return;
      this.confirmedAmbiguousExpression = this.interpretation.expression;
      this.resolve();
    },
    onInput(event) {
      this.expression = event.target.value;
      this.confirmedAmbiguousExpression = "";
      this.interpretation = this.expression
        ? interpretSmartDate(this.expression, { referenceDate: this.referenceDate, dateOrder: this.dateOrder })
        : null;
    },
    togglePicker() {
      if (this.disabled) return;
      if (!this.pickerOpen) {
        this.customFrom = this.selectedValue?.from_date || "";
        this.customTo = this.selectedValue?.to_date || "";
        this.customError = "";
      }
      this.pickerOpen = !this.pickerOpen;
    },
    onDocumentPointerDown(event) {
      if (!this.pickerOpen || this.$refs.root?.contains(event.target)) return;
      this.pickerOpen = false;
    },
    renderInterpretationPreview() {
      const result = this.interpretation;
      if (!result) return null;
      if (!result.valid) {
        return h("div", { class: "edge-smart-date__error", role: "alert" }, result.message);
      }
      return h("div", { class: ["edge-smart-date__interpretation", { "is-warning": result.requires_confirmation }] }, [
        h("span", {}, `Interpreted as: ${displayDate(result.from_date, this.dateOrder)}${result.from_date === result.to_date ? "" : ` – ${displayDate(result.to_date, this.dateOrder)}`}`),
        result.requires_confirmation
          ? h("button", {
              type: "button",
              class: "edge-smart-date__confirm",
              disabled: this.disabled,
              onClick: this.confirmAmbiguous,
            }, `Confirm ${String(this.dateOrder || "DMY").toUpperCase()} interpretation`)
          : null,
      ]);
    },
    renderPicker() {
      if (!this.pickerOpen) return null;
      return h("div", {
        class: "edge-smart-date__picker",
        role: "dialog",
        "aria-label": "Choose date range",
        onKeydown: (event) => {
          if (event.key === "Escape") this.pickerOpen = false;
        },
      }, [
        h("div", { class: "edge-smart-date__smart-section" }, [
          h("span", { class: "edge-smart-date__section-label" }, "Smart date"),
          h("div", { class: "edge-smart-date__smart-row" }, [
            h("input", {
              class: "edge-smart-date__input",
              type: "text",
              value: this.expression,
              placeholder: this.placeholder,
              disabled: this.disabled,
              onInput: this.onInput,
              onKeydown: (event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  this.resolve();
                }
              },
            }),
            h("button", {
              type: "button",
              class: "edge-button edge-button--primary edge-smart-date__apply",
              disabled: this.disabled || !this.expression || !this.interpretation?.valid,
              onClick: this.resolve,
            }, "Apply"),
          ]),
          this.renderInterpretationPreview(),
        ]),
        h("div", { class: "edge-smart-date__preset-section" }, [
          h("span", { class: "edge-smart-date__section-label" }, "Quick periods"),
          h("div", { class: "edge-smart-date__presets" }, (this.presets || []).map((preset) =>
            h("button", {
              type: "button",
              class: ["edge-smart-date__preset", {
                "is-active": String(this.selectedValue?.expression || "").toLowerCase() === String(preset.expression || "").toLowerCase(),
              }],
              disabled: this.disabled,
              onClick: () => this.applyPreset(preset.expression),
            }, preset.label || preset.expression),
          )),
        ]),
        h("div", { class: "edge-smart-date__custom" }, [
          h("span", { class: "edge-smart-date__section-label" }, "Custom range"),
          h("div", { class: "edge-smart-date__custom-fields" }, [
            h("label", { class: "edge-smart-date__custom-field" }, [
              h("span", "From"),
              h("input", {
                type: "date",
                value: this.customFrom,
                disabled: this.disabled,
                onInput: (event) => { this.customFrom = event.target.value; this.customError = ""; },
              }),
            ]),
            h("label", { class: "edge-smart-date__custom-field" }, [
              h("span", "To"),
              h("input", {
                type: "date",
                value: this.customTo,
                disabled: this.disabled,
                onInput: (event) => { this.customTo = event.target.value; this.customError = ""; },
              }),
            ]),
          ]),
          this.customError ? h("div", { class: "edge-smart-date__custom-error", role: "alert" }, this.customError) : null,
          h("div", { class: "edge-smart-date__picker-actions" }, [
            h("button", {
              type: "button",
              class: "edge-button edge-button--secondary",
              disabled: this.disabled,
              onClick: () => { this.pickerOpen = false; },
            }, "Cancel"),
            h("button", {
              type: "button",
              class: "edge-button edge-button--primary",
              disabled: this.disabled || !this.customFrom || !this.customTo,
              onClick: this.applyCustomRange,
            }, "Apply custom range"),
          ]),
        ]),
      ]);
    },
  },
  render() {
    const hasRange = Boolean(this.selectedValue?.from_date && this.selectedValue?.to_date);
    return h("div", { ref: "root", class: ["edge-smart-date", { "is-open": this.pickerOpen }] }, [
      h("label", { class: "edge-smart-date__label" }, this.label),
      h("button", {
        type: "button",
        class: "edge-smart-date__trigger",
        disabled: this.disabled,
        "aria-expanded": this.pickerOpen ? "true" : "false",
        onClick: this.togglePicker,
      }, [
        h("span", { class: "edge-smart-date__trigger-text" }, [
          h("span", { class: "edge-smart-date__period-label" }, this.selectedPeriodLabel()),
          h("span", { class: ["edge-smart-date__range-value", { "is-placeholder": !hasRange }] }, this.selectedRangeLabel()),
        ]),
        h("span", { class: "edge-smart-date__range-chevron", "aria-hidden": "true" }, "▾"),
      ]),
      this.renderPicker(),
    ]);
  },
});

export const reportSmartDateComponents = Object.freeze({ EdgeSmartDateRange });
