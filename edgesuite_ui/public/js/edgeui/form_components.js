import {
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

function cleanText(value) {
  return String(value ?? "").trim();
}

export function normalizeLinkOption(option) {
  if (option == null) return null;
  if (typeof option === "string" || typeof option === "number") {
    const value = cleanText(option);
    return value ? { value, label: value, description: "", disabled: false, raw: option } : null;
  }
  if (Array.isArray(option)) {
    const value = cleanText(option[0]);
    if (!value) return null;
    return {
      value,
      label: cleanText(option[1]) || value,
      description: cleanText(option[2]),
      disabled: Boolean(option[3]),
      raw: option,
    };
  }
  if (typeof option === "object") {
    const value = cleanText(option.value ?? option.name ?? option.id);
    if (!value) return null;
    return {
      value,
      label: cleanText(option.label ?? option.title ?? option.display_value) || value,
      description: cleanText(option.description ?? option.subtitle ?? option.secondary_label),
      disabled: Boolean(option.disabled),
      raw: option,
    };
  }
  return null;
}

function normalizeOptions(options) {
  const seen = new Set();
  return (Array.isArray(options) ? options : [])
    .map(normalizeLinkOption)
    .filter((option) => {
      if (!option || seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
}

function optionMatches(option, query) {
  const term = cleanText(query).toLowerCase();
  if (!term) return true;
  return [option.value, option.label, option.description]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

function exactOption(options, query) {
  const term = cleanText(query).toLowerCase();
  if (!term) return null;
  return options.find(
    (option) => option.value.toLowerCase() === term || option.label.toLowerCase() === term,
  );
}

export const EdgeLinkField = defineComponent({
  name: "EdgeLinkField",
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number], default: "" },
    selectedLabel: { type: String, default: "" },
    label: { type: String, default: "" },
    placeholder: { type: String, default: "Search records" },
    description: { type: String, default: "" },
    error: { type: String, default: "" },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    allowClear: { type: Boolean, default: true },
    openOnFocus: { type: Boolean, default: true },
    minChars: { type: Number, default: 0 },
    debounceMs: { type: Number, default: 220 },
    options: { type: Array, default: () => [] },
    context: { type: Object, default: () => ({}) },
    searcher: { type: Function, default: null },
    creator: { type: Function, default: null },
    canCreate: { type: Boolean, default: false },
    createLabel: { type: String, default: "Create new" },
    noResultsLabel: { type: String, default: "No matching record" },
    loadingLabel: { type: String, default: "Searching…" },
    id: { type: String, default: "" },
    name: { type: String, default: "" },
  },
  emits: [
    "update:modelValue",
    "select",
    "clear",
    "query-change",
    "create",
    "create-success",
    "search-error",
  ],
  setup(props, { attrs, emit, slots }) {
    const root = ref(null);
    const input = ref(null);
    const query = ref(props.selectedLabel || cleanText(props.modelValue));
    const results = ref([]);
    const open = ref(false);
    const loading = ref(false);
    const creating = ref(false);
    const activeIndex = ref(-1);
    const focused = ref(false);
    let timer = null;
    let requestToken = 0;

    const fieldId = props.id || `edge-link-${Math.random().toString(36).slice(2, 10)}`;

    function currentStaticOptions(term = query.value) {
      return normalizeOptions(props.options).filter((option) => optionMatches(option, term));
    }

    function syncDisplayValue() {
      if (focused.value) return;
      query.value = props.selectedLabel || cleanText(props.modelValue);
    }

    function closeMenu() {
      open.value = false;
      activeIndex.value = -1;
    }

    async function runSearch(term = query.value) {
      const normalized = cleanText(term);
      emit("query-change", normalized);
      if (normalized.length < Math.max(0, Number(props.minChars) || 0)) {
        results.value = currentStaticOptions(normalized);
        loading.value = false;
        open.value = props.openOnFocus && focused.value;
        return;
      }

      const token = ++requestToken;
      loading.value = true;
      open.value = true;
      try {
        const found = props.searcher
          ? await props.searcher(normalized, { ...(props.context || {}) })
          : currentStaticOptions(normalized);
        if (token !== requestToken) return;
        results.value = normalizeOptions(found);
        activeIndex.value = results.value.length ? 0 : -1;
      } catch (error) {
        if (token !== requestToken) return;
        results.value = [];
        emit("search-error", error);
      } finally {
        if (token === requestToken) loading.value = false;
      }
    }

    function scheduleSearch() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => runSearch(), Math.max(0, Number(props.debounceMs) || 0));
    }

    function selectOption(option) {
      const normalized = normalizeLinkOption(option);
      if (!normalized || normalized.disabled) return;
      emit("update:modelValue", normalized.value);
      emit("select", normalized);
      query.value = normalized.label || normalized.value;
      closeMenu();
    }

    function clearSelection() {
      if (props.disabled || props.readonly) return;
      emit("update:modelValue", "");
      emit("clear");
      query.value = "";
      results.value = [];
      activeIndex.value = -1;
      nextTick(() => input.value?.focus());
    }

    async function createOption() {
      const term = cleanText(query.value);
      if (!term || !props.canCreate || creating.value) return;
      emit("create", term);
      if (!props.creator) {
        closeMenu();
        return;
      }
      creating.value = true;
      try {
        const created = normalizeLinkOption(await props.creator(term, { ...(props.context || {}) }));
        if (!created) return;
        emit("create-success", created);
        selectOption(created);
      } catch (error) {
        emit("search-error", error);
      } finally {
        creating.value = false;
      }
    }

    function onInput(event) {
      query.value = event.target.value;
      if (cleanText(props.modelValue)) emit("update:modelValue", "");
      scheduleSearch();
    }

    function onFocus() {
      focused.value = true;
      if (props.openOnFocus) runSearch();
    }

    function onBlur() {
      focused.value = false;
      setTimeout(() => {
        if (!root.value?.contains(document.activeElement)) {
          closeMenu();
          syncDisplayValue();
        }
      }, 0);
    }

    function onKeydown(event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        open.value = true;
        const count = results.value.length;
        activeIndex.value = count ? (activeIndex.value + 1 + count) % count : -1;
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        const count = results.value.length;
        activeIndex.value = count ? (activeIndex.value - 1 + count) % count : -1;
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Enter") return;
      event.preventDefault();
      const selected = results.value[activeIndex.value];
      if (selected) {
        selectOption(selected);
      } else if (props.canCreate && !exactOption(results.value, query.value)) {
        createOption();
      }
    }

    function onDocumentPointerDown(event) {
      if (!root.value?.contains(event.target)) closeMenu();
    }

    watch(() => props.modelValue, syncDisplayValue);
    watch(() => props.selectedLabel, syncDisplayValue);
    watch(
      () => props.options,
      () => {
        if (!props.searcher) results.value = currentStaticOptions();
      },
      { deep: true },
    );
    watch(
      () => props.context,
      () => {
        results.value = [];
        activeIndex.value = -1;
        if (focused.value) scheduleSearch();
      },
      { deep: true },
    );

    onMounted(() => document.addEventListener("pointerdown", onDocumentPointerDown));
    onBeforeUnmount(() => {
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      if (timer) clearTimeout(timer);
      requestToken += 1;
    });

    return () => {
      const hasExact = Boolean(exactOption(results.value, query.value));
      const showCreate = Boolean(
        props.canCreate && cleanText(query.value) && !hasExact && !loading.value,
      );
      const helper = props.error || props.description;
      const optionNodes = results.value.map((option, index) =>
        h(
          "button",
          {
            type: "button",
            class: [
              "edge-link-field__option",
              { "is-active": index === activeIndex.value, "is-disabled": option.disabled },
            ],
            role: "option",
            disabled: option.disabled,
            "aria-selected": index === activeIndex.value ? "true" : "false",
            onMouseenter: () => {
              activeIndex.value = index;
            },
            onMousedown: (event) => event.preventDefault(),
            onClick: () => selectOption(option),
          },
          [
            h("span", { class: "edge-link-field__option-label" }, option.label),
            option.description
              ? h("small", { class: "edge-link-field__option-description" }, option.description)
              : null,
          ],
        ),
      );

      if (showCreate) {
        optionNodes.push(
          h(
            "button",
            {
              type: "button",
              class: "edge-link-field__create",
              disabled: creating.value,
              onMousedown: (event) => event.preventDefault(),
              onClick: createOption,
            },
            slots.create
              ? slots.create({ query: cleanText(query.value), creating: creating.value })
              : `${creating.value ? "Creating…" : props.createLabel} “${cleanText(query.value)}”`,
          ),
        );
      }

      if (!loading.value && !results.value.length && !showCreate) {
        optionNodes.push(
          h("div", { class: "edge-link-field__empty", role: "status" }, props.noResultsLabel),
        );
      }

      return h(
        "div",
        {
          ref: root,
          class: ["edge-link-field", { "has-error": Boolean(props.error), "is-open": open.value }],
        },
        [
          props.label
            ? h("label", { class: "edge-link-field__label", for: fieldId }, [
                props.label,
                props.required ? h("span", { class: "edge-link-field__required" }, " *") : null,
              ])
            : null,
          h("div", { class: "edge-link-field__control" }, [
            h("input", {
              ...attrs,
              ref: input,
              id: fieldId,
              name: props.name || undefined,
              type: "search",
              class: ["form-control", "edge-link-field__input", attrs.class],
              value: query.value,
              placeholder: props.placeholder,
              disabled: props.disabled,
              readonly: props.readonly,
              required: props.required,
              autocomplete: "off",
              role: "combobox",
              "aria-autocomplete": "list",
              "aria-expanded": open.value ? "true" : "false",
              "aria-controls": `${fieldId}-listbox`,
              "aria-invalid": props.error ? "true" : "false",
              onInput,
              onFocus,
              onBlur,
              onKeydown,
            }),
            loading.value
              ? h("span", { class: "edge-link-field__spinner", "aria-label": props.loadingLabel })
              : null,
            props.allowClear && cleanText(props.modelValue) && !props.disabled && !props.readonly
              ? h(
                  "button",
                  {
                    type: "button",
                    class: "edge-link-field__clear",
                    "aria-label": `Clear ${props.label || "selection"}`,
                    onMousedown: (event) => event.preventDefault(),
                    onClick: clearSelection,
                  },
                  "×",
                )
              : null,
          ]),
          helper
            ? h(
                "p",
                { class: ["edge-link-field__helper", { "is-error": Boolean(props.error) }] },
                helper,
              )
            : null,
          open.value
            ? h(
                "div",
                {
                  id: `${fieldId}-listbox`,
                  class: "edge-link-field__menu",
                  role: "listbox",
                },
                loading.value
                  ? [h("div", { class: "edge-link-field__loading" }, props.loadingLabel)]
                  : optionNodes,
              )
            : null,
        ],
      );
    };
  },
});

export const formComponents = {
  EdgeLinkField,
};
