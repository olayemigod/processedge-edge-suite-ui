import { defineComponent, h } from "vue";

import { EdgeNotificationBell } from "./components";
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

function shellRegistry() {
  if (!(globalThis.__edgeSuiteShellRegistry instanceof Map)) {
    globalThis.__edgeSuiteShellRegistry = new Map();
  }
  return globalThis.__edgeSuiteShellRegistry;
}

function normalizedProduct(value) {
  return String(value || "edgesuite")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "edgesuite";
}

function syncShellBodyClasses() {
  if (typeof document === "undefined" || !document.body) return;
  const registry = shellRegistry();
  const active = [...registry.entries()].filter(([, entry]) => entry?.count > 0);

  document.body.classList.toggle("edge-suite-shell-active", active.length > 0);
  document.body.classList.toggle(
    "edge-suite-native-sidebar-hidden",
    active.some(([, entry]) => entry?.hideNativeSidebar),
  );

  for (const className of [...document.body.classList]) {
    if (className.startsWith("edge-suite-product-")) document.body.classList.remove(className);
  }
  active.forEach(([product]) => document.body.classList.add(`edge-suite-product-${product}`));
}

function stripMarkup(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

// Options API is intentional. Product apps can consume this component through
// their own Vue bundle without relying on EdgeSuite UI's Vue runtime instance.
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
    userImage: { type: String, default: "" },
    sidebarTitle: { type: String, default: "Product navigation" },
    showSidebar: { type: Boolean, default: true },
    showNotifications: { type: Boolean, default: true },
    showUserMenu: { type: Boolean, default: true },
    hideNativeSidebar: { default: null },
    notificationLimit: { type: Number, default: 12 },
    collapsibleSections: { type: Boolean, default: true },
    rememberSectionState: { type: Boolean, default: true },
    sectionStateKey: { type: String, default: "" },
  },
  emits: ["navigate"],
  data() {
    return {
      mobileSidebarOpen: false,
      collapsedSections: new Set(),
      profileMenuOpen: false,
      notificationsOpen: false,
      notificationLoading: false,
      notificationError: "",
      notificationLogs: [],
      unreadCount: 0,
      registeredProduct: "",
    };
  },
  mounted() {
    this.restoreSectionState();
    this.registerShell();
    document.addEventListener("click", this.onDocumentClick);
    document.addEventListener("keydown", this.onDocumentKeydown);
    this.bindRealtimeNotifications();
    this.loadNotificationCount();
  },
  beforeUnmount() {
    this.unregisterShell();
    document.removeEventListener("click", this.onDocumentClick);
    document.removeEventListener("keydown", this.onDocumentKeydown);
    this.unbindRealtimeNotifications();
  },
  watch: {
    activeRoute() {
      this.ensureActiveSectionExpanded();
      this.closeTopbarMenus();
    },
    product(newProduct, oldProduct) {
      this.unregisterShell(oldProduct);
      this.registerShell(newProduct);
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
      return `edgeui:${normalizedProduct(this.product || this.title)}:sidebar-sections`;
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
        // Browser storage may be unavailable. In-memory state remains usable.
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

    shouldHideNativeSidebar() {
      if (this.hideNativeSidebar !== null && this.hideNativeSidebar !== undefined) {
        return Boolean(this.hideNativeSidebar);
      }
      return normalizedProduct(this.product) === "eduedge";
    },

    registerShell(product = this.product) {
      if (typeof document === "undefined") return;
      const key = normalizedProduct(product);
      const registry = shellRegistry();
      const current = registry.get(key) || { count: 0, hideNativeSidebar: false };
      registry.set(key, {
        count: current.count + 1,
        hideNativeSidebar: current.hideNativeSidebar || this.shouldHideNativeSidebar(),
      });
      this.registeredProduct = key;
      syncShellBodyClasses();
    },

    unregisterShell(product = this.registeredProduct || this.product) {
      if (typeof document === "undefined") return;
      const key = normalizedProduct(product);
      const registry = shellRegistry();
      const current = registry.get(key);
      if (current) {
        if (current.count <= 1) registry.delete(key);
        else registry.set(key, { ...current, count: current.count - 1 });
      }
      if (this.registeredProduct === key) this.registeredProduct = "";
      syncShellBodyClasses();
    },

    navigate(route) {
      if (!route) return;
      this.mobileSidebarOpen = false;
      this.closeTopbarMenus();
      this.$emit("navigate", route);
    },

    currentUserId() {
      return globalThis.frappe?.session?.user || "";
    },

    currentUserInfo() {
      const frappe = globalThis.frappe || {};
      const user = this.currentUserId();
      const bootInfo = frappe.boot?.user_info?.[user] || {};
      const edgeIdentity = frappe.boot?.eduedge_ui_identity?.user || {};
      return {
        id: user,
        name:
          this.userName ||
          edgeIdentity.full_name ||
          bootInfo.fullname ||
          bootInfo.full_name ||
          frappe.session?.user_fullname ||
          user,
        email: edgeIdentity.email || bootInfo.email || frappe.session?.user_email || user,
        image:
          this.userImage ||
          edgeIdentity.image ||
          edgeIdentity.user_image ||
          bootInfo.image ||
          bootInfo.user_image ||
          frappe.boot?.user?.user_image ||
          "",
      };
    },

    closeTopbarMenus() {
      this.profileMenuOpen = false;
      this.notificationsOpen = false;
    },

    toggleProfileMenu() {
      this.profileMenuOpen = !this.profileMenuOpen;
      if (this.profileMenuOpen) this.notificationsOpen = false;
    },

    async toggleNotifications() {
      this.notificationsOpen = !this.notificationsOpen;
      if (this.notificationsOpen) {
        this.profileMenuOpen = false;
        await this.loadNotifications();
      }
    },

    onDocumentClick(event) {
      const target = event?.target;
      if (!target?.closest?.(".edge-user-menu-wrap")) this.profileMenuOpen = false;
      if (!target?.closest?.(".edge-notification-menu-wrap")) this.notificationsOpen = false;
    },

    onDocumentKeydown(event) {
      if (event?.key === "Escape") this.closeTopbarMenus();
    },

    bindRealtimeNotifications() {
      const realtime = globalThis.frappe?.realtime;
      realtime?.on?.("notification", this.handleRealtimeNotification);
      realtime?.on?.("indicator_hide", this.handleNotificationIndicatorHide);
    },

    unbindRealtimeNotifications() {
      const realtime = globalThis.frappe?.realtime;
      realtime?.off?.("notification", this.handleRealtimeNotification);
      realtime?.off?.("indicator_hide", this.handleNotificationIndicatorHide);
    },

    handleRealtimeNotification() {
      this.loadNotificationCount();
      if (this.notificationsOpen) this.loadNotifications();
    },

    handleNotificationIndicatorHide() {
      this.unreadCount = 0;
    },

    async loadNotificationCount() {
      if (!this.showNotifications || !this.currentUserId() || !globalThis.frappe?.call) return;
      try {
        const response = await globalThis.frappe.call("frappe.client.get_count", {
          doctype: "Notification Log",
          filters: {
            for_user: this.currentUserId(),
            read: 0,
          },
        });
        this.unreadCount = Number(response?.message || 0);
      } catch (_error) {
        // Notifications must never prevent the product shell from rendering.
      }
    },

    async loadNotifications() {
      if (!globalThis.frappe?.call) return;
      this.notificationLoading = true;
      this.notificationError = "";
      try {
        const response = await globalThis.frappe.call(
          "frappe.desk.doctype.notification_log.notification_log.get_notification_logs",
          { limit: this.notificationLimit },
        );
        this.notificationLogs = response?.message?.notification_logs || [];
        await this.loadNotificationCount();
      } catch (error) {
        this.notificationError =
          error?.message || "Notifications could not be loaded. Please try again.";
      } finally {
        this.notificationLoading = false;
      }
    },

    async markAllNotificationsRead() {
      if (!globalThis.frappe?.call) return;
      try {
        await globalThis.frappe.call(
          "frappe.desk.doctype.notification_log.notification_log.mark_all_as_read",
        );
        this.notificationLogs = this.notificationLogs.map((item) => ({ ...item, read: 1 }));
        this.unreadCount = 0;
      } catch (error) {
        this.notificationError =
          error?.message || "Notifications could not be marked as read.";
      }
    },

    notificationTarget(item) {
      if (item?.link) return item.link;
      if (item?.document_type && item?.document_name) {
        const slug = String(item.document_type)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-");
        return `/app/${slug}/${encodeURIComponent(item.document_name)}`;
      }
      return "";
    },

    async openNotification(item) {
      if (!item) return;
      if (!item.read && item.name && globalThis.frappe?.call) {
        try {
          await globalThis.frappe.call(
            "frappe.desk.doctype.notification_log.notification_log.mark_as_read",
            { docname: item.name },
          );
          item.read = 1;
          this.unreadCount = Math.max(0, this.unreadCount - 1);
        } catch (_error) {
          // The destination should still open if the read-state update fails.
        }
      }
      const target = this.notificationTarget(item);
      if (target) this.openInNewTab(target);
      this.notificationsOpen = false;
    },

    formatNotificationTime(value) {
      const formatter = globalThis.frappe?.datetime?.prettyDate;
      if (typeof formatter === "function") {
        try {
          return formatter(value);
        } catch (_error) {
          // Use the raw timestamp below.
        }
      }
      return String(value || "");
    },

    openInNewTab(route) {
      const value = String(route || "").trim();
      if (!value) return;
      const allowed =
        value.startsWith("/") ||
        value.startsWith("https://") ||
        value.startsWith("http://");
      if (!allowed) return;
      globalThis.open?.(value, "_blank", "noopener,noreferrer");
    },

    openProfile() {
      const user = this.currentUserId();
      if (user) this.openInNewTab(`/app/user/${encodeURIComponent(user)}`);
      this.profileMenuOpen = false;
    },

    openUserSettings() {
      this.openInNewTab("/app/user-settings");
      this.profileMenuOpen = false;
    },

    logout() {
      this.profileMenuOpen = false;
      if (typeof globalThis.frappe?.app?.logout === "function") {
        globalThis.frappe.app.logout();
        return;
      }
      globalThis.location?.assign?.("/api/method/logout");
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

    renderNotificationPanel() {
      if (!this.notificationsOpen) return null;
      const content = this.notificationLoading
        ? h("div", { class: "edge-topbar-menu__state", role: "status" }, "Loading notifications…")
        : this.notificationError
          ? h("div", { class: "edge-topbar-menu__state edge-topbar-menu__state--error" }, [
              h("span", this.notificationError),
              h(
                "button",
                {
                  type: "button",
                  class: "edge-topbar-menu__link",
                  onClick: () => this.loadNotifications(),
                },
                "Try again",
              ),
            ])
          : this.notificationLogs.length
            ? h(
                "div",
                { class: "edge-notification-list" },
                this.notificationLogs.map((item) =>
                  h(
                    "button",
                    {
                      type: "button",
                      class: ["edge-notification-row", item?.read ? "" : "is-unread"],
                      key: item?.name || item?.creation || item?.subject,
                      onClick: () => this.openNotification(item),
                    },
                    [
                      h("span", { class: "edge-notification-row__indicator", "aria-hidden": "true" }),
                      h("span", { class: "edge-notification-row__copy" }, [
                        h(
                          "strong",
                          stripMarkup(item?.subject || item?.email_header || "Notification"),
                        ),
                        item?.creation
                          ? h("small", this.formatNotificationTime(item.creation))
                          : null,
                      ]),
                    ],
                  ),
                ),
              )
            : h("div", { class: "edge-topbar-menu__state" }, "You have no notifications.");

      return h(
        "section",
        {
          class: "edge-topbar-menu edge-notification-menu",
          role: "dialog",
          "aria-label": "Notifications",
        },
        [
          h("header", { class: "edge-topbar-menu__header" }, [
            h("div", [
              h("strong", "Notifications"),
              h("small", this.unreadCount ? `${this.unreadCount} unread` : "You are up to date"),
            ]),
            this.unreadCount
              ? h(
                  "button",
                  {
                    type: "button",
                    class: "edge-topbar-menu__link",
                    onClick: () => this.markAllNotificationsRead(),
                  },
                  "Mark all read",
                )
              : null,
          ]),
          content,
          h("footer", { class: "edge-topbar-menu__footer" }, [
            h(
              "button",
              {
                type: "button",
                class: "edge-topbar-menu__link",
                onClick: () => {
                  this.openInNewTab("/app/notification-log");
                  this.notificationsOpen = false;
                },
              },
              "View all notifications",
            ),
          ]),
        ],
      );
    },

    renderNotificationControl() {
      return h("div", { class: "edge-topbar-action-wrap edge-notification-menu-wrap" }, [
        h(
          EdgeNotificationBell,
          {
            unreadCount: this.unreadCount,
            title: "Notifications",
            "aria-expanded": this.notificationsOpen ? "true" : "false",
            onToggle: () => this.toggleNotifications(),
          },
          {
            icon: () => h(EdgeIcon, { name: "bell", size: "sm" }),
          },
        ),
        this.renderNotificationPanel(),
      ]);
    },

    renderProfileMenu() {
      if (!this.profileMenuOpen) return null;
      const user = this.currentUserInfo();
      return h(
        "section",
        {
          class: "edge-topbar-menu edge-user-menu",
          role: "menu",
          "aria-label": "User menu",
        },
        [
          h("header", { class: "edge-user-menu__identity" }, [
            this.renderAvatar(false),
            h("span", { class: "edge-user-menu__copy" }, [
              h("strong", user.name || "User"),
              h("small", user.email || ""),
            ]),
          ]),
          h("div", { class: "edge-user-menu__items" }, [
            h(
              "button",
              { type: "button", role: "menuitem", onClick: () => this.openProfile() },
              [h(EdgeIcon, { name: "user", size: "sm" }), h("span", "My profile")],
            ),
            h(
              "button",
              { type: "button", role: "menuitem", onClick: () => this.openUserSettings() },
              [h(EdgeIcon, { name: "settings", size: "sm" }), h("span", "User settings")],
            ),
            h(
              "button",
              {
                type: "button",
                role: "menuitem",
                class: "edge-user-menu__logout",
                onClick: () => this.logout(),
              },
              [h(EdgeIcon, { name: "close", size: "sm" }), h("span", "Log out")],
            ),
          ]),
        ],
      );
    },

    renderAvatar(withChevron = true) {
      const user = this.currentUserInfo();
      const content = user.image
        ? h("img", {
            class: "edge-user-avatar__image",
            src: user.image,
            alt: user.name || "User profile",
            loading: "eager",
            decoding: "async",
          })
        : h("span", { class: "edge-user-avatar__initials" }, productInitials(user.name || user.id));

      if (!withChevron) {
        return h("span", { class: "edge-user-avatar edge-user-avatar--static" }, [content]);
      }

      return h(
        "button",
        {
          type: "button",
          class: "edge-user-avatar-button",
          title: user.name || "User menu",
          "aria-label": "Open user menu",
          "aria-expanded": this.profileMenuOpen ? "true" : "false",
          onClick: () => this.toggleProfileMenu(),
        },
        [
          h("span", { class: "edge-user-avatar" }, [content]),
          h(EdgeIcon, { name: "chevron-down", size: "xs" }),
        ],
      );
    },

    renderUserControl() {
      return h("div", { class: "edge-topbar-action-wrap edge-user-menu-wrap" }, [
        this.renderAvatar(true),
        this.renderProfileMenu(),
      ]);
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
            ],
          )
        : null;

    const customNotificationContent = slots.notifications
      ? slotValue(slots, "notifications", [])
      : this.showNotifications
        ? this.renderNotificationControl()
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
          h("div", { class: "edge-topbar-actions" }, [
            customNotificationContent,
            this.showUserMenu ? this.renderUserControl() : null,
          ]),
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
