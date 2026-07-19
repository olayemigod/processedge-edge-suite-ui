import { defineComponent, h } from "vue";

import { edgeIconMarkup, productInitials } from "./icons";

function slotValue(slots, name, fallback = null) {
  return slots[name] ? slots[name]() : fallback;
}

function normalizedGroups(menuItems = []) {
  const groups = [];
  const groupMap = new Map();

  (Array.isArray(menuItems) ? menuItems : []).forEach((item) => {
    if (!item || item.visible === false || item.hidden === 1) return;

    if (Array.isArray(item.items)) {
      const label = item.label || item.section || item.group || "Navigation";
      groups.push({
        key: item.key || item.sectionKey || label,
        label,
        icon: item.icon || "",
        defaultCollapsed: Boolean(item.defaultCollapsed || item.collapsed),
        items: item.items.filter(Boolean),
      });
      return;
    }

    const label = item.section || item.group || "Navigation";
    const key = item.sectionKey || label;
    if (!groupMap.has(key)) {
      const group = {
        key,
        label,
        icon: item.sectionIcon || "",
        defaultCollapsed: Boolean(item.sectionCollapsed),
        items: [],
      };
      groupMap.set(key, group);
      groups.push(group);
    }
    groupMap.get(key).items.push(item);
  });

  return groups.filter((group) => group.items.length);
}

export const EdgeIcon = defineComponent({
  name: "EdgeIcon",
  props: {
    name: { type: String, default: "list" },
    label: { type: String, default: "" },
    size: { type: String, default: "sm" },
  },
  setup(props) {
    return () =>
      h("span", {
        class: ["edge-icon", `edge-icon--${props.size}`],
        role: props.label ? "img" : undefined,
        "aria-label": props.label || undefined,
        "aria-hidden": props.label ? undefined : "true",
        innerHTML: edgeIconMarkup(props.name, { size: props.size }),
      });
  },
});

// EdgeAppShell intentionally uses the Options API. The component is distributed
// from a standalone Frappe app and may be installed into a consuming product app
// that owns a different Vue bundle. Options API state, watchers, and lifecycle
// hooks are therefore executed by the consuming app's Vue runtime, preventing
// split-runtime reactivity and lifecycle failures.
export const EdgeAppShell = defineComponent({
  name: "EdgeAppShell",
  props: {
    product: { type: String, default: "" },
    compact: { type: Boolean, default: false },
    menuItems: { type: Array, default: () => [] },
    activeRoute: { type: String, default: "" },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    tenantName: { type: String, default: "" },
    branchName: { type: String, default: "" },
    userName: { type: String, default: "" },
    sidebarTitle: { type: String, default: "Product navigation" },
    showSidebar: { type: Boolean, default: true },
    collapsibleSections: { type: Boolean, default: true },
    rememberSectionState: { type: Boolean, default: true },
    sectionStateKey: { type: String, default: "" },
  },
  emits: ["navigate"],
  data() {
    return {
      mobileSidebarOpen: false,
      collapsedSections: new Set(),
    };
  },
  mounted() {
    this.restoreSectionState();
  },
  watch: {
    activeRoute() {
      this.ensureActiveSectionExpanded();
    },
    product() {
      this.restoreSectionState();
    },
    menuItems: {
      deep: true,
      handler() {
        this.restoreSectionState();
      },
    },
  },
  methods: {
    storageKey() {
      if (this.sectionStateKey) return this.sectionStateKey;
      const product = String(this.product || this.title || "edgesuite")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      return `edgeui:${product || "edgesuite"}:sidebar-sections`;
    },

    activeGroupKey(groups = normalizedGroups(this.menuItems)) {
      const activeGroup = groups.find((group) =>
        group.items.some((item) => item?.route === this.activeRoute),
      );
      return activeGroup?.key || "";
    },

    persistSectionState() {
      if (!this.rememberSectionState || typeof window === "undefined") return;
      try {
        window.localStorage?.setItem(
          this.storageKey(),
          JSON.stringify([...this.collapsedSections]),
        );
      } catch (_error) {
        // Browser storage may be disabled. Sidebar behaviour must still work in memory.
      }
    },

    restoreSectionState() {
      const groups = normalizedGroups(this.menuItems);
      const defaults = new Set(
        groups.filter((group) => group.defaultCollapsed).map((group) => String(group.key)),
      );
      let restored = defaults;

      if (this.rememberSectionState && typeof window !== "undefined") {
        try {
          const stored = JSON.parse(window.localStorage?.getItem(this.storageKey()) || "[]");
          if (Array.isArray(stored)) restored = new Set(stored.map(String));
        } catch (_error) {
          restored = defaults;
        }
      }

      const activeKey = this.activeGroupKey(groups);
      if (activeKey) restored.delete(String(activeKey));
      this.collapsedSections = restored;
    },

    ensureActiveSectionExpanded() {
      const activeKey = this.activeGroupKey();
      if (!activeKey || !this.collapsedSections.has(String(activeKey))) return;
      const next = new Set(this.collapsedSections);
      next.delete(String(activeKey));
      this.collapsedSections = next;
      this.persistSectionState();
    },

    isSectionCollapsed(group) {
      return this.collapsibleSections && this.collapsedSections.has(String(group.key));
    },

    toggleSection(group) {
      if (!this.collapsibleSections) return;
      const key = String(group.key);
      const next = new Set(this.collapsedSections);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      this.collapsedSections = next;
      this.persistSectionState();
    },

    navigate(route) {
      if (!route) return;
      this.mobileSidebarOpen = false;
      this.$emit("navigate", route);
    },

    renderMenuItem(item) {
      const active = item?.route === this.activeRoute;
      return h(
        "button",
        {
          class: ["edge-sidebar-item", active ? "active" : ""],
          type: "button",
          title: item?.description || item?.label || "",
          "aria-current": active ? "page" : undefined,
          onClick: () => this.navigate(item?.route),
        },
        [
          h(EdgeIcon, { name: item?.icon || "list", size: "sm" }),
          h("span", { class: "edge-sidebar-item__copy" }, [
            h("span", { class: "edge-sidebar-item__label" }, item?.label || ""),
            item?.description
              ? h("small", { class: "edge-sidebar-item__description" }, item.description)
              : null,
          ]),
          item?.badge
            ? h("span", { class: "edge-sidebar-item__badge" }, String(item.badge))
            : null,
        ],
      );
    },
  },
  render() {
    const slots = this.$slots;
    const groups = normalizedGroups(this.menuItems);
    const contextChips = [
      this.tenantName ? { icon: "building", value: this.tenantName } : null,
      this.branchName ? { icon: "layers", value: this.branchName } : null,
    ].filter(Boolean);

    const builtInSidebar =
      this.showSidebar && groups.length
        ? h(
            "aside",
            {
              class: [
                "edge-app-shell__sidebar",
                "edge-sidebar",
                this.mobileSidebarOpen ? "is-open" : "",
              ],
              "aria-label": this.sidebarTitle,
            },
            [
              h("div", { class: "edge-sidebar__brand" }, [
                slotValue(
                  slots,
                  "brand",
                  h("span", { class: "edge-sidebar__mark", "aria-hidden": "true" }, [
                    h(EdgeIcon, {
                      name: this.product === "eduedge" ? "graduation" : "grid",
                      size: "md",
                    }),
                  ]),
                ),
                h("span", { class: "edge-sidebar__brand-copy" }, [
                  h("strong", this.title || this.product || "EdgeSuite"),
                  this.subtitle ? h("small", this.subtitle) : null,
                ]),
              ]),
              h(
                "nav",
                { class: "edge-sidebar__nav" },
                groups.map((group, index) => {
                  const collapsed = this.isSectionCollapsed(group);
                  const sectionId = `edge-sidebar-section-${String(group.key || index)
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")}`;
                  return h(
                    "section",
                    {
                      class: [
                        "edge-sidebar__section",
                        collapsed ? "is-collapsed" : "is-expanded",
                      ],
                      key: group.key || group.label,
                    },
                    [
                      h(
                        "button",
                        {
                          class: "edge-sidebar__section-toggle",
                          type: "button",
                          "aria-expanded": collapsed ? "false" : "true",
                          "aria-controls": sectionId,
                          disabled: !this.collapsibleSections,
                          onClick: () => this.toggleSection(group),
                        },
                        [
                          group.icon ? h(EdgeIcon, { name: group.icon, size: "xs" }) : null,
                          h("span", group.label),
                          this.collapsibleSections
                            ? h(EdgeIcon, {
                                name: "chevron-down",
                                size: "xs",
                                label: collapsed
                                  ? `Expand ${group.label}`
                                  : `Collapse ${group.label}`,
                              })
                            : null,
                        ],
                      ),
                      h(
                        "div",
                        {
                          id: sectionId,
                          class: "edge-sidebar__items",
                          hidden: collapsed,
                        },
                        group.items.map((item) => this.renderMenuItem(item)),
                      ),
                    ],
                  );
                }),
              ),
              this.userName
                ? h("div", { class: "edge-sidebar__user" }, [
                    h("span", { class: "edge-sidebar__avatar" }, productInitials(this.userName)),
                    h("span", { class: "edge-sidebar__user-copy" }, [
                      h("strong", this.userName),
                      h(
                        "small",
                        this.branchName || this.tenantName || this.product || "EdgeSuite",
                      ),
                    ]),
                  ])
                : null,
            ],
          )
        : null;

    const topbar = slots.topbar
      ? h("div", { class: "edge-app-shell__topbar" }, slots.topbar())
      : h("header", { class: "edge-topbar edge-app-shell__topbar" }, [
          builtInSidebar
            ? h(
                "button",
                {
                  class: "edge-sidebar-toggle",
                  type: "button",
                  "aria-label": this.mobileSidebarOpen
                    ? "Close product navigation"
                    : "Open product navigation",
                  "aria-expanded": this.mobileSidebarOpen ? "true" : "false",
                  onClick: () => {
                    this.mobileSidebarOpen = !this.mobileSidebarOpen;
                  },
                },
                [h(EdgeIcon, { name: this.mobileSidebarOpen ? "close" : "menu", size: "sm" })],
              )
            : null,
          h("div", { class: "edge-topbar__brand" }, [
            h("span", { class: "edge-topbar__mark", "aria-hidden": "true" }, [
              h(EdgeIcon, {
                name: this.product === "eduedge" ? "graduation" : "grid",
                size: "sm",
              }),
            ]),
            h("span", { class: "edge-topbar__title-copy" }, [
              h("strong", this.title || this.product || "EdgeSuite"),
              this.subtitle ? h("small", this.subtitle) : null,
            ]),
          ]),
          h(
            "div",
            { class: "edge-topbar-context", "aria-label": "Active context" },
            contextChips.map((chip) =>
              h("span", { class: "edge-context-chip", key: chip.value }, [
                h(EdgeIcon, { name: chip.icon, size: "xs" }),
                h("span", chip.value),
              ]),
            ),
          ),
          h("div", { class: "edge-topbar-actions" }, slotValue(slots, "notifications", [])),
        ]);

    return h(
      "div",
      {
        class: [
          "edge-app-shell",
          {
            "edge-app-shell--compact": this.compact,
            "edge-sidebar-open": this.mobileSidebarOpen,
          },
        ],
        "data-edge-product": this.product || undefined,
      },
      [
        topbar,
        h("div", { class: "edge-shell-body" }, [
          slots.sidebar
            ? h("aside", { class: "edge-app-shell__sidebar edge-sidebar" }, slots.sidebar())
            : builtInSidebar,
          this.mobileSidebarOpen && builtInSidebar
            ? h("button", {
                class: "edge-sidebar-backdrop",
                type: "button",
                "aria-label": "Close product navigation",
                onClick: () => {
                  this.mobileSidebarOpen = false;
                },
              })
            : null,
          h(
            "main",
            { class: "edge-app-shell__main edge-shell-main" },
            slotValue(slots, "default"),
          ),
        ]),
      ],
    );
  },
});

export const professionalComponents = {
  EdgeAppShell,
  EdgeIcon,
};
