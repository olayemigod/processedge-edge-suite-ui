import { defineComponent, h } from "vue";

function slotOrText(slots, name, fallback = null) {
  return slots[name] ? slots[name]() : fallback;
}

function button(label, emit, eventName, className = "edge-button edge-button--primary") {
  if (!label) return null;
  return h(
    "button",
    {
      type: "button",
      class: className,
      onClick: () => emit(eventName),
    },
    label,
  );
}

export const EdgePageHeader = defineComponent({
  name: "EdgePageHeader",
  props: {
    eyebrow: { type: String, default: "" },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    actionLabel: { type: String, default: "" },
  },
  emits: ["action"],
  setup(props, { slots, emit }) {
    return () =>
      h("header", { class: "edge-page-header" }, [
        h("div", { class: "edge-page-header__copy" }, [
          props.eyebrow ? h("p", { class: "edge-eyebrow" }, props.eyebrow) : null,
          slotOrText(slots, "title", h("h1", { class: "edge-page-header__title" }, props.title)),
          slotOrText(
            slots,
            "subtitle",
            props.subtitle ? h("p", { class: "edge-page-header__subtitle" }, props.subtitle) : null,
          ),
        ]),
        h("div", { class: "edge-page-header__actions" }, [
          slotOrText(slots, "actions", button(props.actionLabel, emit, "action")),
        ]),
      ]);
  },
});

export const EdgeStatCard = defineComponent({
  name: "EdgeStatCard",
  props: {
    label: { type: String, default: "" },
    value: { type: [String, Number], default: "—" },
    helper: { type: String, default: "" },
    tone: { type: String, default: "neutral" },
  },
  setup(props, { slots }) {
    return () =>
      h("article", { class: ["edge-stat-card", `edge-stat-card--${props.tone}`] }, [
        slotOrText(slots, "label", h("p", { class: "edge-stat-card__label" }, props.label)),
        slotOrText(slots, "value", h("p", { class: "edge-stat-card__value" }, String(props.value))),
        slotOrText(
          slots,
          "helper",
          props.helper ? h("p", { class: "edge-stat-card__helper" }, props.helper) : null,
        ),
      ]);
  },
});

export const EdgeStatusBadge = defineComponent({
  name: "EdgeStatusBadge",
  props: {
    label: { type: String, default: "" },
    status: { type: String, default: "" },
    tone: { type: String, default: "neutral" },
  },
  setup(props, { slots }) {
    return () =>
      h(
        "span",
        { class: ["edge-status-badge", `edge-status-badge--${props.tone}`] },
        slotOrText(slots, "default", props.label || props.status || "Unknown"),
      );
  },
});

export const EdgeEmptyState = defineComponent({
  name: "EdgeEmptyState",
  props: {
    title: { type: String, default: "Nothing here yet" },
    description: { type: String, default: "" },
    actionLabel: { type: String, default: "" },
  },
  emits: ["action"],
  setup(props, { slots, emit }) {
    return () =>
      h("section", { class: "edge-state edge-state--empty", role: "status" }, [
        slotOrText(slots, "icon"),
        h("h2", { class: "edge-state__title" }, props.title),
        props.description ? h("p", { class: "edge-state__description" }, props.description) : null,
        slotOrText(slots, "actions", button(props.actionLabel, emit, "action")),
      ]);
  },
});

export const EdgeLoadingState = defineComponent({
  name: "EdgeLoadingState",
  props: {
    label: { type: String, default: "Loading…" },
  },
  setup(props) {
    return () =>
      h("section", { class: "edge-state edge-state--loading", role: "status", "aria-live": "polite" }, [
        h("span", { class: "edge-spinner", "aria-hidden": "true" }),
        h("p", { class: "edge-state__description" }, props.label),
      ]);
  },
});

export const EdgeErrorState = defineComponent({
  name: "EdgeErrorState",
  props: {
    title: { type: String, default: "Something went wrong" },
    message: { type: String, default: "Please try again." },
    actionLabel: { type: String, default: "Try again" },
  },
  emits: ["retry"],
  setup(props, { slots, emit }) {
    return () =>
      h("section", { class: "edge-state edge-state--error", role: "alert" }, [
        h("h2", { class: "edge-state__title" }, props.title),
        h("p", { class: "edge-state__description" }, props.message),
        slotOrText(slots, "actions", button(props.actionLabel, emit, "retry")),
      ]);
  },
});

export const EdgeActionBar = defineComponent({
  name: "EdgeActionBar",
  props: {
    label: { type: String, default: "" },
  },
  setup(props, { slots }) {
    return () =>
      h("div", { class: "edge-action-bar" }, [
        h("div", { class: "edge-action-bar__content" }, slotOrText(slots, "default", props.label)),
        h("div", { class: "edge-action-bar__actions" }, slotOrText(slots, "actions")),
      ]);
  },
});

export const EdgeFilterBar = defineComponent({
  name: "EdgeFilterBar",
  setup(_props, { slots }) {
    return () =>
      h("section", { class: "edge-filter-bar" }, [
        h("div", { class: "edge-filter-bar__fields" }, slotOrText(slots, "default")),
        h("div", { class: "edge-filter-bar__actions" }, slotOrText(slots, "actions")),
      ]);
  },
});

export const EdgePageLayout = defineComponent({
  name: "EdgePageLayout",
  setup(_props, { slots }) {
    return () =>
      h("div", { class: "edge-page-layout" }, [
        slots.header ? h("div", { class: "edge-page-layout__header" }, slots.header()) : null,
        slots.filters ? h("div", { class: "edge-page-layout__filters" }, slots.filters()) : null,
        h("main", { class: "edge-page-layout__content" }, slotOrText(slots, "default")),
      ]);
  },
});

export const EdgeDashboardLayout = defineComponent({
  name: "EdgeDashboardLayout",
  props: {
    minColumnWidth: { type: String, default: "15rem" },
  },
  setup(props, { slots }) {
    return () =>
      h(
        "section",
        {
          class: "edge-dashboard-layout",
          style: { "--edge-dashboard-min-column": props.minColumnWidth },
        },
        slotOrText(slots, "default"),
      );
  },
});

export const EdgeAppShell = defineComponent({
  name: "EdgeAppShell",
  props: {
    product: { type: String, default: "" },
    compact: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () =>
      h(
        "div",
        {
          class: ["edge-app-shell", { "edge-app-shell--compact": props.compact }],
          "data-edge-product": props.product || undefined,
        },
        [
          slots.topbar ? h("div", { class: "edge-app-shell__topbar" }, slots.topbar()) : null,
          slots.sidebar ? h("aside", { class: "edge-app-shell__sidebar" }, slots.sidebar()) : null,
          h("div", { class: "edge-app-shell__main" }, slotOrText(slots, "default")),
        ],
      );
  },
});

export const baseComponents = {
  EdgePageHeader,
  EdgeStatCard,
  EdgeStatusBadge,
  EdgeEmptyState,
  EdgeLoadingState,
  EdgeErrorState,
  EdgeActionBar,
  EdgeFilterBar,
  EdgePageLayout,
  EdgeDashboardLayout,
  EdgeAppShell,
};
