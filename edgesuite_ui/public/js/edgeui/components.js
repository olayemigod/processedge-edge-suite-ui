import { defineComponent, h } from "vue";

function slotOrText(slots, name, fallback = null) {
  return slots[name] ? slots[name]() : fallback;
}

function emitButton(label, emit, eventName, className = "edge-button edge-button--primary") {
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

function normalizeStatus(value) {
  return String(value || "neutral")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const EdgePageHeader = defineComponent({
  name: "EdgePageHeader",
  props: {
    eyebrow: { type: String, default: "" },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    actionLabel: { type: String, default: "" },
    withBackButton: { type: Boolean, default: false },
  },
  emits: ["action", "back"],
  setup(props, { slots, emit }) {
    return () =>
      h("header", { class: "edge-page-header" }, [
        props.withBackButton
          ? h(
              "button",
              {
                type: "button",
                class: "edge-page-header__back",
                "aria-label": "Go back",
                onClick: () => emit("back"),
              },
              "←",
            )
          : null,
        h("div", { class: "edge-page-header__copy" }, [
          props.eyebrow ? h("p", { class: "edge-eyebrow" }, props.eyebrow) : null,
          slotOrText(
            slots,
            "title",
            h("h1", { class: "edge-page-header__title edge-page-title" }, props.title),
          ),
          slotOrText(
            slots,
            "subtitle",
            props.subtitle
              ? h("p", { class: "edge-page-header__subtitle edge-page-subtitle" }, props.subtitle)
              : null,
          ),
        ]),
        h("div", { class: "edge-page-header__actions" }, [
          slotOrText(slots, "actions", emitButton(props.actionLabel, emit, "action")),
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
    icon: { type: String, default: "" },
    tooltip: { type: String, default: "" },
  },
  setup(props, { slots }) {
    return () =>
      h(
        "article",
        {
          class: ["edge-stat-card", `edge-stat-card--${normalizeStatus(props.tone)}`],
          title: props.tooltip || undefined,
        },
        [
          props.icon || slots.icon
            ? h("div", { class: "edge-stat-icon" }, slotOrText(slots, "icon", props.icon))
            : null,
          h("div", { class: "edge-stat-content" }, [
            slotOrText(
              slots,
              "label",
              h("p", { class: "edge-stat-card__label edge-stat-label" }, props.label),
            ),
            slotOrText(
              slots,
              "value",
              h("p", { class: "edge-stat-card__value edge-stat-value" }, String(props.value ?? "—")),
            ),
            slotOrText(
              slots,
              "helper",
              props.helper
                ? h("p", { class: "edge-stat-card__helper edge-stat-helper" }, props.helper)
                : null,
            ),
          ]),
        ],
      );
  },
});

export const EdgeStatusBadge = defineComponent({
  name: "EdgeStatusBadge",
  props: {
    label: { type: String, default: "" },
    status: { type: String, default: "" },
    tone: { type: String, default: "" },
  },
  setup(props, { slots }) {
    return () => {
      const text = props.label || props.status || "Unknown";
      const status = normalizeStatus(props.status || props.label);
      const tone = normalizeStatus(props.tone || "neutral");
      return h(
        "span",
        {
          class: [
            "edge-status-badge",
            `edge-status-badge--${tone}`,
            status ? `edge-status-${status}` : null,
          ],
        },
        slotOrText(slots, "default", text),
      );
    };
  },
});

export const EdgeEmptyState = defineComponent({
  name: "EdgeEmptyState",
  props: {
    title: { type: String, default: "Nothing here yet" },
    description: { type: String, default: "" },
    actionLabel: { type: String, default: "" },
    icon: { type: String, default: "" },
  },
  emits: ["action"],
  setup(props, { slots, emit }) {
    return () =>
      h("section", { class: "edge-state edge-state--empty edge-empty-state", role: "status" }, [
        props.icon || slots.icon
          ? h("div", { class: "edge-empty-icon" }, slotOrText(slots, "icon", props.icon))
          : null,
        h("h2", { class: "edge-state__title" }, props.title),
        props.description ? h("p", { class: "edge-state__description" }, props.description) : null,
        slotOrText(slots, "actions", emitButton(props.actionLabel, emit, "action")),
      ]);
  },
});

export const EdgeLoadingState = defineComponent({
  name: "EdgeLoadingState",
  props: {
    label: { type: String, default: "" },
    message: { type: String, default: "" },
    skeleton: { type: Boolean, default: false },
  },
  setup(props) {
    return () =>
      h(
        "section",
        {
          class: [
            "edge-state",
            "edge-state--loading",
            "edge-loading-state",
            { "with-skeleton": props.skeleton },
          ],
          role: "status",
          "aria-live": "polite",
        },
        [
          h("span", { class: "edge-spinner edge-loading-spinner", "aria-hidden": "true" }),
          h("p", { class: "edge-state__description" }, props.message || props.label || "Loading…"),
        ],
      );
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
      h("section", { class: "edge-state edge-state--error edge-error-state", role: "alert" }, [
        h("h2", { class: "edge-state__title" }, props.title),
        h("p", { class: "edge-state__description" }, props.message),
        slotOrText(
          slots,
          "actions",
          emitButton(props.actionLabel, emit, "retry", "edge-button edge-button--primary edge-primary-button"),
        ),
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
  props: {
    title: { type: String, default: "" },
  },
  setup(props, { slots }) {
    return () =>
      h("section", { class: "edge-filter-bar" }, [
        props.title ? h("h2", { class: "edge-filter-title" }, props.title) : null,
        h(
          "div",
          { class: "edge-filter-bar__fields edge-filter-body" },
          slotOrText(slots, "default"),
        ),
        slots.actions
          ? h("div", { class: "edge-filter-bar__actions" }, slotOrText(slots, "actions"))
          : null,
      ]);
  },
});

export const EdgePageLayout = defineComponent({
  name: "EdgePageLayout",
  setup(_props, { slots }) {
    return () =>
      h("section", { class: "edge-page-layout" }, [
        slots.header
          ? h("div", { class: "edge-page-layout__header edge-page-layout-header" }, slots.header())
          : null,
        slots.filters
          ? h("div", { class: "edge-page-layout__filters edge-page-layout-filters" }, slots.filters())
          : null,
        h(
          "main",
          { class: "edge-page-layout__content edge-page-layout-body" },
          slotOrText(slots, "default"),
        ),
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
    menuItems: { type: Array, default: () => [] },
    activeRoute: { type: String, default: "" },
    title: { type: String, default: "" },
    tenantName: { type: String, default: "" },
    branchName: { type: String, default: "" },
    userName: { type: String, default: "" },
  },
  emits: ["navigate"],
  setup(props, { slots, emit }) {
    return () => {
      const context = [props.tenantName, props.branchName, props.userName].filter(Boolean).join(" · ");
      const menu = props.menuItems.map((item) =>
        h(
          "button",
          {
            class: [
              "edge-sidebar-item",
              item?.route === props.activeRoute ? "active" : "",
            ],
            type: "button",
            onClick: () => emit("navigate", item?.route),
          },
          [
            item?.icon ? h("span", { class: "edge-sidebar-icon" }, item.icon) : null,
            h("span", item?.label || ""),
          ],
        ),
      );

      const builtInTopbar =
        props.title || context || slots.notifications
          ? h("div", { class: "edge-topbar edge-app-shell__topbar" }, [
              h("div", { class: "edge-topbar-title" }, props.title),
              context ? h("div", { class: "edge-topbar-context" }, context) : null,
              h(
                "div",
                { class: "edge-topbar-actions" },
                slotOrText(slots, "notifications", []),
              ),
            ])
          : null;

      const sidebar = slots.sidebar
        ? h("aside", { class: "edge-app-shell__sidebar edge-sidebar" }, slots.sidebar())
        : menu.length
          ? h("aside", { class: "edge-app-shell__sidebar edge-sidebar" }, menu)
          : null;

      return h(
        "div",
        {
          class: ["edge-app-shell", { "edge-app-shell--compact": props.compact }],
          "data-edge-product": props.product || undefined,
        },
        [
          slots.topbar
            ? h("div", { class: "edge-app-shell__topbar" }, slots.topbar())
            : builtInTopbar,
          h("div", { class: "edge-shell-body" }, [
            sidebar,
            h(
              "main",
              { class: "edge-app-shell__main edge-shell-main" },
              slotOrText(slots, "default"),
            ),
          ]),
        ],
      );
    };
  },
});

export const EdgeNotificationBell = defineComponent({
  name: "EdgeNotificationBell",
  props: {
    unreadCount: { type: Number, default: 0 },
    title: { type: String, default: "Notifications" },
  },
  emits: ["toggle"],
  setup(props, { emit, slots }) {
    return () =>
      h(
        "button",
        {
          class: "edge-notification-bell",
          type: "button",
          title: props.title,
          "aria-label": props.title,
          onClick: () => emit("toggle"),
        },
        [
          slotOrText(slots, "icon", h("span", { "aria-hidden": "true" }, "Notifications")),
          props.unreadCount > 0
            ? h("span", { class: "edge-notification-count" }, String(props.unreadCount))
            : null,
        ],
      );
  },
});

export const EdgeNotificationDrawer = defineComponent({
  name: "EdgeNotificationDrawer",
  props: {
    product: { type: String, default: "" },
    title: { type: String, default: "Notifications" },
    open: { type: Boolean, default: false },
    notifications: { type: Array, default: () => [] },
    unreadCount: { type: Number, default: 0 },
    filter: { type: String, default: "all" },
    loading: { type: Boolean, default: false },
    error: { type: String, default: "" },
  },
  emits: [
    "close",
    "update:filter",
    "retry",
    "refresh",
    "mark-all-read",
    "action",
    "open",
  ],
  setup(props, { emit }) {
    return () => {
      if (!props.open) return null;

      const filterButtons = ["all", "unread", "action_required", "done"].map((filter) =>
        h(
          "button",
          {
            class: ["edge-notification-filter", props.filter === filter ? "active" : ""],
            type: "button",
            onClick: () => emit("update:filter", filter),
          },
          filter.replace(/_/g, " "),
        ),
      );

      const items = props.notifications.map((item) =>
        h(
          "article",
          {
            class: ["edge-notification-item", item?.severity || "", item?.status || ""],
            key: item?.name || item?.id || item?.title,
          },
          [
            h(
              "button",
              {
                class: "edge-notification-title",
                type: "button",
                onClick: () => emit("open", item),
              },
              item?.title || item?.name || "Notification",
            ),
            item?.message
              ? h("p", { class: "edge-notification-message" }, item.message)
              : null,
            h(
              "div",
              { class: "edge-notification-meta" },
              [item?.category, item?.status, item?.created_at].filter(Boolean).join(" · "),
            ),
            h(
              "div",
              { class: "edge-notification-actions" },
              (item?.actions || []).map((action) =>
                h(
                  "button",
                  {
                    type: "button",
                    disabled: action?.enabled === false,
                    onClick: () => emit("action", { notification: item, action }),
                  },
                  action?.label || action?.key || "Action",
                ),
              ),
            ),
          ],
        ),
      );

      return h("div", { class: "edge-notification-drawer-backdrop" }, [
        h(
          "aside",
          {
            class: "edge-notification-drawer",
            "data-edge-product": props.product || undefined,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": props.title,
          },
          [
            h("header", { class: "edge-notification-header" }, [
              h("div", [
                h("h2", props.title),
                h("span", `${props.unreadCount} unread`),
              ]),
              h("button", { type: "button", onClick: () => emit("close") }, "Close"),
            ]),
            h("div", { class: "edge-notification-toolbar" }, [
              ...filterButtons,
              h("button", { type: "button", onClick: () => emit("refresh") }, "Refresh"),
              h(
                "button",
                { type: "button", onClick: () => emit("mark-all-read") },
                "Mark all read",
              ),
            ]),
            props.error
              ? h("div", { class: "edge-error-state" }, [
                  h("p", props.error),
                  h("button", { type: "button", onClick: () => emit("retry") }, "Retry"),
                ])
              : null,
            props.loading
              ? h("div", { class: "edge-loading-state" }, "Loading notifications...")
              : null,
            !props.loading && !props.error && !items.length
              ? h("div", { class: "edge-empty-state" }, "No notifications")
              : null,
            h("div", { class: "edge-notification-list" }, items),
          ],
        ),
      ]);
    };
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
  EdgeNotificationBell,
  EdgeNotificationDrawer,
};
