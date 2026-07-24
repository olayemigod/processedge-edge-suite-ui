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

function fuzzySubsequenceScore(source, query) {
  let sourceIndex = 0;
  let queryIndex = 0;
  let gapPenalty = 0;
  let lastMatch = -1;
  while (sourceIndex < source.length && queryIndex < query.length) {
    if (source[sourceIndex] === query[queryIndex]) {
      if (lastMatch >= 0) gapPenalty += Math.max(0, sourceIndex - lastMatch - 1);
      lastMatch = sourceIndex;
      queryIndex += 1;
    }
    sourceIndex += 1;
  }
  return queryIndex === query.length ? 40 - Math.min(30, gapPenalty) : -1;
}

export function fuzzyOptionScore(option, query) {
  const term = cleanText(query).toLowerCase();
  if (!term) return 1;
  const candidates = [option.value, option.label, option.description]
    .filter(Boolean)
    .map((value) => cleanText(value).toLowerCase());
  let score = -1;
  for (const candidate of candidates) {
    if (candidate === term) score = Math.max(score, 1000);
    else if (candidate.startsWith(term)) score = Math.max(score, 800 - candidate.length);
    else if (candidate.split(/\s+/).some((word) => word.startsWith(term))) score = Math.max(score, 650 - candidate.length);
    else if (candidate.includes(term)) score = Math.max(score, 500 - candidate.indexOf(term));
    else score = Math.max(score, fuzzySubsequenceScore(candidate, term));
  }
  return score;
}

export function fuzzyFilterOptions(options, query) {
  return normalizeOptions(options)
    .map((option, index) => ({ option, index, score: fuzzyOptionScore(option, query) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.option);
}

function exactOption(options, query) {
  const term = cleanText(query).toLowerCase();
  if (!term) return null;
  return options.find(
    (option) => option.value.toLowerCase() === term || option.label.toLowerCase() === term,
  );
}

export const EdgeDropdown = defineComponent({
  name: "EdgeDropdown",
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number], default: "" },
    options: { type: Array, default: () => [] },
    label: { type: String, default: "" },
    placeholder: { type: String, default: "Select" },
    description: { type: String, default: "" },
    error: { type: String, default: "" },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    id: { type: String, default: "" },
    name: { type: String, default: "" },
  },
  emits: ["update:modelValue", "select", "change"],
  setup(props, { attrs, emit }) {
    const root = ref(null);
    const button = ref(null);
    const open = ref(false);
    const activeIndex = ref(-1);
    const fieldId = props.id || `edge-dropdown-${Math.random().toString(36).slice(2, 10)}`;

    const normalized = () => normalizeOptions(props.options);
    const selected = () => normalized().find((option) => String(option.value) === String(props.modelValue)) || null;

    function closeMenu({ restoreFocus = false } = {}) {
      open.value = false;
      activeIndex.value = -1;
      if (restoreFocus) nextTick(() => button.value?.focus());
    }

    function openMenu() {
      if (props.disabled || props.readonly) return;
      open.value = true;
      const options = normalized();
      activeIndex.value = Math.max(0, options.findIndex((option) => String(option.value) === String(props.modelValue)));
    }

    function choose(option) {
      if (!option || option.disabled) return;
      emit("update:modelValue", option.value);
      emit("select", option);
      emit("change", option);
      closeMenu({ restoreFocus: true });
    }

    function onKeydown(event) {
      const options = normalized();
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        if (!open.value) openMenu();
        if (!options.length) return;
        if (event.key === "Home") activeIndex.value = 0;
        else if (event.key === "End") activeIndex.value = options.length - 1;
        else if (event.key === "ArrowDown") activeIndex.value = (activeIndex.value + 1 + options.length) % options.length;
        else activeIndex.value = (activeIndex.value - 1 + options.length) % options.length;
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
        return;
      }
      if (["Enter", " "].includes(event.key)) {
        event.preventDefault();
        if (!open.value) openMenu();
        else choose(options[activeIndex.value]);
      }
    }

    function onDocumentPointerDown(event) {
      if (!root.value?.contains(event.target)) closeMenu();
    }

    onMounted(() => document.addEventListener("pointerdown", onDocumentPointerDown));
    onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocumentPointerDown));

    return () => {
      const options = normalized();
      const current = selected();
      return h("div", { ref: root, class: ["edge-dropdown", { "has-error": Boolean(props.error), "is-open": open.value }] }, [
        props.label
          ? h("label", { class: "edge-dropdown__label", for: fieldId }, [
              props.label,
              props.required ? h("span", { class: "edge-dropdown__required" }, " *") : null,
            ])
          : null,
        h("div", { class: "edge-dropdown__control" }, [
          h(
            "button",
            {
              ...attrs,
              ref: button,
              id: fieldId,
              name: props.name || undefined,
              type: "button",
              class: ["form-control", "edge-dropdown__trigger", attrs.class],
              disabled: props.disabled,
              "aria-haspopup": "listbox",
              "aria-expanded": open.value ? "true" : "false",
              "aria-controls": `${fieldId}-listbox`,
              "aria-invalid": props.error ? "true" : "false",
              onClick: () => (open.value ? closeMenu() : openMenu()),
              onKeydown,
            },
            [
              h("span", { class: ["edge-dropdown__value", { "is-placeholder": !current }] }, current?.label || props.placeholder),
              h("span", { class: "edge-dropdown__chevron", "aria-hidden": "true" }, "▾"),
            ],
          ),
          open.value
            ? h(
                "div",
                { id: `${fieldId}-listbox`, class: "edge-dropdown__menu", role: "listbox" },
                options.map((option, index) =>
                  h(
                    "button",
                    {
                      type: "button",
                      class: ["edge-dropdown__option", { "is-active": index === activeIndex.value, "is-disabled": option.disabled }],
                      role: "option",
                      disabled: option.disabled,
                      "aria-selected": String(option.value) === String(props.modelValue) ? "true" : "false",
                      onMouseenter: () => { activeIndex.value = index; },
                      onClick: () => choose(option),
                    },
                    [
                      h("span", { class: "edge-dropdown__option-label" }, option.label),
                      option.description ? h("small", { class: "edge-dropdown__option-description" }, option.description) : null,
                    ],
                  ),
                ),
              )
            : null,
        ]),
        props.error || props.description
          ? h("p", { class: ["edge-dropdown__helper", { "is-error": Boolean(props.error) }] }, props.error || props.description)
          : null,
      ]);
    };
  },
});

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
  emits: ["update:modelValue", "select", "clear", "query-change", "create", "create-success", "search-error"],
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
      return fuzzyFilterOptions(props.options, term);
    }
    function syncDisplayValue() {
      if (!focused.value) query.value = props.selectedLabel || cleanText(props.modelValue);
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
          : props.options;
        if (token !== requestToken) return;
        results.value = fuzzyFilterOptions(found, normalized);
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
      if (!props.creator) return closeMenu();
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
      if (cleanText(props.modelValue)) {
        emit("update:modelValue", "");
        emit("clear");
      }
      scheduleSearch();
    }
    function onFocus() {
      focused.value = true;
      if (props.openOnFocus) runSearch(cleanText(props.modelValue) ? "" : query.value);
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
      const count = results.value.length;
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        open.value = true;
        if (!count) return;
        if (event.key === "Home") activeIndex.value = 0;
        else if (event.key === "End") activeIndex.value = count - 1;
        else if (event.key === "ArrowDown") activeIndex.value = (activeIndex.value + 1 + count) % count;
        else activeIndex.value = (activeIndex.value - 1 + count) % count;
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
      if (selected) selectOption(selected);
      else if (props.canCreate && !exactOption(results.value, query.value)) createOption();
    }
    function onDocumentPointerDown(event) {
      if (!root.value?.contains(event.target)) closeMenu();
    }

    watch(() => props.modelValue, syncDisplayValue);
    watch(() => props.selectedLabel, syncDisplayValue);
    watch(() => props.options, () => { if (!props.searcher) results.value = currentStaticOptions(); }, { deep: true });
    watch(() => props.context, () => {
      results.value = [];
      activeIndex.value = -1;
      if (focused.value) scheduleSearch();
    }, { deep: true });
    onMounted(() => document.addEventListener("pointerdown", onDocumentPointerDown));
    onBeforeUnmount(() => {
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      if (timer) clearTimeout(timer);
      requestToken += 1;
    });

    return () => {
      const hasExact = Boolean(exactOption(results.value, query.value));
      const showCreate = Boolean(props.canCreate && cleanText(query.value) && !hasExact && !loading.value);
      const helper = props.error || props.description;
      const optionNodes = results.value.map((option, index) => h("button", {
        type: "button",
        class: ["edge-link-field__option", { "is-active": index === activeIndex.value, "is-disabled": option.disabled }],
        role: "option",
        disabled: option.disabled,
        "aria-selected": index === activeIndex.value ? "true" : "false",
        onMouseenter: () => { activeIndex.value = index; },
        onMousedown: (event) => event.preventDefault(),
        onClick: () => selectOption(option),
      }, [
        h("span", { class: "edge-link-field__option-label" }, option.label),
        option.description ? h("small", { class: "edge-link-field__option-description" }, option.description) : null,
      ]));
      if (showCreate) optionNodes.push(h("button", {
        type: "button",
        class: "edge-link-field__create",
        disabled: creating.value,
        onMousedown: (event) => event.preventDefault(),
        onClick: createOption,
      }, slots.create
        ? slots.create({ query: cleanText(query.value), creating: creating.value })
        : `${creating.value ? "Creating…" : props.createLabel} “${cleanText(query.value)}”`));
      if (!loading.value && !results.value.length && !showCreate) {
        optionNodes.push(h("div", { class: "edge-link-field__empty", role: "status" }, props.noResultsLabel));
      }
      return h("div", { ref: root, class: ["edge-link-field", { "has-error": Boolean(props.error), "is-open": open.value }] }, [
        props.label ? h("label", { class: "edge-link-field__label", for: fieldId }, [
          props.label,
          props.required ? h("span", { class: "edge-link-field__required" }, " *") : null,
        ]) : null,
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
          loading.value ? h("span", { class: "edge-link-field__spinner", "aria-label": props.loadingLabel }) : null,
          props.allowClear && cleanText(props.modelValue) && !props.disabled && !props.readonly
            ? h("button", {
                type: "button",
                class: "edge-link-field__clear",
                "aria-label": `Clear ${props.label || "selection"}`,
                onMousedown: (event) => event.preventDefault(),
                onClick: clearSelection,
              }, "×")
            : null,
          open.value ? h("div", {
            id: `${fieldId}-listbox`,
            class: "edge-link-field__menu",
            role: "listbox",
          }, loading.value ? [h("div", { class: "edge-link-field__loading" }, props.loadingLabel)] : optionNodes) : null,
        ]),
        helper ? h("p", { class: ["edge-link-field__helper", { "is-error": Boolean(props.error) }] }, helper) : null,
      ]);
    };
  },
});

export const formComponents = {
  EdgeDropdown,
  EdgeLinkField,
};
