import { defineComponent, h, onMounted, ref, watch } from "vue";

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
  setup(props, { slots, emit }) {
    const mobileSidebarOpen = ref(false);
    const collapsedSections = ref(new Set());

    function storageKey() {
      if (props.sectionStateKey) return props.sectionStateKey;
      const product = String(props.product || props.title || "edgesuite")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      return `edgeui:${product || "edgesuite"}:sidebar-sections`;
    }

    function activeGroupKey(groups = normalizedGroups(props.menuItems)) {
      const activeGroup = groups.find((group) =>
        group.items.some((item) => item?.route === props.activeRoute),
      );
      return activeGroup?.key || "";
    }

    function persistSectionState() {
      if (!props.rememberSectionState || typeof window === "undefined") return;
      try {
        window.localStorage?.setItem(storageKey(), JSON.stringify([...collapsedSections.value]));
      } catch (_error) {
        // Browser storage may be disabled. Sidebar behaviour must still work in memory.
      }
    }

    function restoreSectionState() {
      const groups = normalizedGroups(props.menuItems);
      const defaults = new Set(
        groups.filter((group) => group.defaultCollapsed).map((group) => String(group.key)),
      );
      let restored = defaults;

      if (props.rememberSectionState && typeof window !== "undefined") {
        try {
          const stored = JSON.parse(window.localStorage?.getItem(storageKey()) || "[]");
          if (Array.isArray(stored)) restored = new Set(stored.map(String));
        } catch (_error) {
          restored = defaults;
        }
      }

      const activeKey = activeGroupKey(groups);
      if (activeKey) restored.delete(String(activeKey));
      collapsedSections.value = restored;
    }

    function ensureActiveSectionExpanded() {
      const activeKey = activeGroupKey();
      if (!activeKey || !collapsedSections.value.has(String(activeKey))) return;
      const next = new Set(collapsedSections.value);
      next.delete(String(activeKey));
      collapsedSections.value = next;
      persistSectionState();
    }

    function isSectionCollapsed(group) {
      return props.collapsibleSections && collapsedSections.value.has(String(group.key));
    }

    function toggleSection(group) {
      if (!props.collapsibleSections) return;
      const key = String(group.key);
      const next = new Set(collapsedSections.value);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      collapsedSections.value = next;
      persistSectionState();
    }

    function navigate(route) {
      if (!route) return;
      mobileSidebarOpen.value = false;
      emit("navigate", route);
    }

    function renderMenuItem(item) {
      const active = item?.route === props.activeRoute;
      return h(
        "button",
        {
          class: ["edge-sidebar-item", active ? "active" : ""],
          type: "button",
          title: item?.description || item?.label || "",
          "aria-current": active ? "page" : undefined,
          onClick: () => navigate(item?.route),
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
    }

    onMounted(restoreSectionState);
    watch(() => props.activeRoute, ensureActiveSectionExpanded);
    watch(
      () => props.product,
      () => restoreSectionState(),
    );

    return () => {
      const groups = normalizedGroups(props.menuItems);
      const contextChips = [
        props.tenantName ? { icon: "building", value: props.tenantName } : null,
        props.branchName ? { icon: "layers", value: props.branchName } : null,
      ].filter(Boolean);

      const builtInSidebar =
        props.showSidebar && groups.length
          ? h(
              "aside",
              {
                class: [
                  "edge-app-shell__sidebar",
                  "edge-sidebar",
                  mobileSidebarOpen.value ? "is-open" : "",
                ],
                "aria-label": props.sidebarTitle,
              },
              [
                h("div", { class: "edge-sidebar__brand" }, [
                  slotValue(
                    slots,
                    "brand",
                    h("span", { class: "edge-sidebar__mark", "aria-hidden": "true" }, [
                      h(EdgeIcon, {
                        name: props.product === "eduedge" ? "graduation" : "grid",
                        size: "md",
                      }),
                    ]),
                  ),
                  h("span", { class: "edge-sidebar__brand-copy" }, [
                    h("strong", props.title || props.product || "EdgeSuite"),
                    props.subtitle ? h("small", props.subtitle) : null,
                  ]),
                ]),
                h(
                  "nav",
                  { class: "edge-sidebar__nav" },
                  groups.map((group, index) => {
                    const collapsed = isSectionCollapsed(group);
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
                            disabled: !props.collapsibleSections,
                            onClick: () => toggleSection(group),
                          },
                          [
                            group.icon ? h(EdgeIcon, { name: group.icon, size: "xs" }) : null,
                            h("span", group.label),
                            props.collapsibleSections
                              ? h(EdgeIcon, {
                                  name: "chevron-down",
                                  size: "xs",
                                  label: collapsed ? `Expand ${group.label}` : `Collapse ${group.label}`,
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
                          group.items.map(renderMenuItem),
                        ),
                      ],
                    );
                  }),
                ),
                props.userName
                  ? h("div", { class: "edge-sidebar__user" }, [
                      h("span", { class: "edge-sidebar__avatar" }, productInitials(props.userName)),
                      h("span", { class: "edge-sidebar__user-copy" }, [
                        h("strong", props.userName),
                        h("small", props.branchName || props.tenantName || props.product || "EdgeSuite"),
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
                    "aria-label": mobileSidebarOpen.value
                      ? "Close product navigation"
                      : "Open product navigation",
                    "aria-expanded": mobileSidebarOpen.value ? "true" : "false",
                    onClick: () => {
                      mobileSidebarOpen.value = !mobileSidebarOpen.value;
                    },
                  },
                  [h(EdgeIcon, { name: mobileSidebarOpen.value ? "close" : "menu", size: "sm" })],
                )
              : null,
            h("div", { class: "edge-topbar__brand" }, [
              h("span", { class: "edge-topbar__mark", "aria-hidden": "true" }, [
                h(EdgeIcon, {
                  name: props.product === "eduedge" ? "graduation" : "grid",
                  size: "sm",
                }),
              ]),
              h("span", { class: "edge-topbar__title-copy" }, [
                h("strong", props.title || props.product || "EdgeSuite"),
                props.subtitle ? h("small", props.subtitle) : null,
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
              "edge-app-shell--compact": props.compact,
              "edge-sidebar-open": mobileSidebarOpen.value,
            },
          ],
          "data-edge-product": props.product || undefined,
        },
        [
          topbar,
          h("div", { class: "edge-shell-body" }, [
            slots.sidebar
              ? h("aside", { class: "edge-app-shell__sidebar edge-sidebar" }, slots.sidebar())
              : builtInSidebar,
            mobileSidebarOpen.value && builtInSidebar
              ? h("button", {
                  class: "edge-sidebar-backdrop",
                  type: "button",
                  "aria-label": "Close product navigation",
                  onClick: () => {
                    mobileSidebarOpen.value = false;
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
    };
  },
});

export const professionalComponents = {
  EdgeAppShell,
  EdgeIcon,
};