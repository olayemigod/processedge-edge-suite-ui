import { defineComponent, h, ref } from "vue";

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
        label,
        icon: item.icon || "",
        items: item.items.filter(Boolean),
      });
      return;
    }

    const label = item.section || item.group || "Navigation";
    if (!groupMap.has(label)) {
      const group = { label, icon: item.sectionIcon || "", items: [] };
      groupMap.set(label, group);
      groups.push(group);
    }
    groupMap.get(label).items.push(item);
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
  },
  emits: ["navigate"],
  setup(props, { slots, emit }) {
    const mobileSidebarOpen = ref(false);

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
                  groups.map((group) =>
                    h("section", { class: "edge-sidebar__section", key: group.label }, [
                      h("h2", { class: "edge-sidebar__section-title" }, [
                        group.icon ? h(EdgeIcon, { name: group.icon, size: "xs" }) : null,
                        h("span", group.label),
                      ]),
                      h("div", { class: "edge-sidebar__items" }, group.items.map(renderMenuItem)),
                    ]),
                  ),
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

      const topbar =
        slots.topbar
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
