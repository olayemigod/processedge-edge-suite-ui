import { defineComponent, h } from "vue";

import { EdgeNotificationBell } from "./components";
import { edgeIconMarkup } from "./icons";
import { EdgeIcon } from "./professional_components";

function normalizedProduct(value) {
  return (
    String(value || "edgesuite")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "edgesuite"
  );
}

function normalizedText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripMarkup(value) {
  return normalizedText(String(value || "").replace(/<[^>]*>/g, " "));
}

function invokeListeners(listener, ...args) {
  const listeners = Array.isArray(listener) ? listener : [listener];
  listeners.forEach((candidate) => {
    if (typeof candidate === "function") candidate(...args);
  });
}

function runtime() {
  return globalThis.EdgeSuiteUI || globalThis.EdgeUI || null;
}

function frappeCall(method, args = {}) {
  const call = globalThis.frappe?.call;
  if (typeof call !== "function") {
    return Promise.reject(new Error("Frappe Desk is not ready."));
  }
  return call(method, args);
}

function notificationTarget(item) {
  if (item?.target || item?.action_url || item?.link) {
    return item.target || item.action_url || item.link;
  }
  const doctype = item?.reference_doctype || item?.document_type;
  const name = item?.reference_name || item?.document_name;
  if (!doctype || !name) return "";
  const slug = String(doctype)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return `/app/${slug}/${encodeURIComponent(name)}`;
}

function normalizeNotification(item = {}) {
  const unread = item.unread ?? item.read === 0 ?? false;
  const target = notificationTarget(item);
  const actions = Array.isArray(item.actions)
    ? item.actions
    : [
        target ? { key: "open", label: "Open", primary: true } : null,
        unread ? { key: "read", label: "Mark read" } : null,
      ].filter(Boolean);
  return {
    ...item,
    id: item.id || item.name || item.creation || item.subject,
    name: item.name || item.id || "",
    title: stripMarkup(item.title || item.subject || item.email_header || "Notification"),
    message: stripMarkup(item.message || item.email_content || item.description || ""),
    category: item.category || item.document_type || item.reference_doctype || "",
    status: item.status || (unread ? "Unread" : "Read"),
    created_at: item.created_at || item.creation || "",
    unread: Boolean(unread),
    target,
    actions,
  };
}

const defaultNotificationProvider = {
  async getCount() {
    const user = globalThis.frappe?.session?.user;
    if (!user) return 0;
    const response = await frappeCall("frappe.client.get_count", {
      doctype: "Notification Log",
      filters: { for_user: user, read: 0 },
    });
    return Number(response?.message || 0);
  },

  async getItems({ limit = 20 } = {}) {
    const response = await frappeCall(
      "frappe.desk.doctype.notification_log.notification_log.get_notification_logs",
      { limit },
    );
    return (response?.message?.notification_logs || []).map(normalizeNotification);
  },

  async markAllRead() {
    await frappeCall("frappe.desk.doctype.notification_log.notification_log.mark_all_as_read");
  },

  async performAction(action, item) {
    if (action === "read" && item?.name) {
      await frappeCall("frappe.desk.doctype.notification_log.notification_log.mark_as_read", {
        docname: item.name,
      });
      return { refresh: true };
    }
    return { refresh: false };
  },
};

function resolveNotificationProvider(product) {
  const edgeUI = runtime();
  const key = normalizedProduct(product);
  return (
    edgeUI?.getAdapter?.(`notifications:${key}`) ||
    edgeUI?.getAdapter?.("notifications:default") ||
    defaultNotificationProvider
  );
}

function openInNewTab(route) {
  const value = String(route || "").trim();
  if (!value) return false;
  const allowed = value.startsWith("/") || value.startsWith("https://") || value.startsWith("http://");
  if (!allowed) return false;
  globalThis.open?.(value, "_blank", "noopener,noreferrer");
  return true;
}

export const EdgeNotificationCenter = defineComponent({
  name: "EdgeNotificationCenter",
  props: {
    product: { type: String, default: "edgesuite" },
    limit: { type: Number, default: 24 },
  },
  data() {
    return {
      open: false,
      loading: false,
      error: "",
      items: [],
      unreadCount: 0,
    };
  },
  mounted() {
    document.addEventListener("click", this.onDocumentClick);
    document.addEventListener("keydown", this.onDocumentKeydown);
    globalThis.frappe?.realtime?.on?.("notification", this.onRealtimeNotification);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.refreshCount();
  },
  beforeUnmount() {
    document.removeEventListener("click", this.onDocumentClick);
    document.removeEventListener("keydown", this.onDocumentKeydown);
    globalThis.frappe?.realtime?.off?.("notification", this.onRealtimeNotification);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  },
  methods: {
    provider() {
      return resolveNotificationProvider(this.product);
    },

    async refreshCount() {
      try {
        this.unreadCount = Number((await this.provider().getCount?.()) || 0);
      } catch (_error) {
        this.unreadCount = 0;
      }
    },

    async loadItems() {
      this.loading = true;
      this.error = "";
      try {
        const rows = (await this.provider().getItems?.({ limit: this.limit })) || [];
        this.items = rows.map(normalizeNotification);
        await this.refreshCount();
      } catch (error) {
        this.error = error?.message || "Notifications could not be loaded.";
      } finally {
        this.loading = false;
      }
    },

    async toggle() {
      this.open = !this.open;
      if (this.open) await this.loadItems();
    },

    close() {
      this.open = false;
    },

    onDocumentClick(event) {
      if (!event?.target?.closest?.(".edge-shared-notification-center")) this.close();
    },

    onDocumentKeydown(event) {
      if (event?.key === "Escape") this.close();
    },

    onRealtimeNotification() {
      this.refreshCount();
      if (this.open) this.loadItems();
    },

    onVisibilityChange() {
      if (!document.hidden) this.refreshCount();
    },

    async markAllRead() {
      try {
        await this.provider().markAllRead?.();
        this.items = this.items.map((item) => ({ ...item, unread: false, status: "Read" }));
        this.unreadCount = 0;
      } catch (error) {
        this.error = error?.message || "Notifications could not be marked as read.";
      }
    },

    async runAction(item, action) {
      const key = action?.key || action;
      if (key === "open") {
        try {
          await this.provider().performAction?.("read", item);
        } catch (_error) {
          // Opening the destination remains useful even if read-state sync fails.
        }
        if (typeof this.provider().open === "function") {
          const handled = await this.provider().open(item);
          if (handled !== true) openInNewTab(item.target);
        } else {
          openInNewTab(item.target);
        }
        this.close();
        await this.refreshCount();
        return;
      }

      try {
        const result = (await this.provider().performAction?.(key, item)) || {};
        if (key === "read") {
          item.unread = false;
          item.status = "Read";
        }
        if (result.remove) this.items = this.items.filter((row) => row.id !== item.id);
        if (result.refresh !== false) await this.loadItems();
        else await this.refreshCount();
      } catch (error) {
        this.error = error?.message || "The notification action could not be completed.";
      }
    },

    formatTime(value) {
      const formatter = globalThis.frappe?.datetime?.prettyDate;
      if (typeof formatter === "function") {
        try {
          return formatter(value);
        } catch (_error) {
          // Use the raw value below.
        }
      }
      return String(value || "");
    },
  },
  render() {
    const panel = !this.open
      ? null
      : h(
          "section",
          {
            class: "edge-shared-notification-panel",
            role: "dialog",
            "aria-label": "Notifications",
          },
          [
            h("header", { class: "edge-shared-notification-panel__header" }, [
              h("div", [
                h("strong", "Notifications"),
                h("small", this.unreadCount ? `${this.unreadCount} unread` : "You are up to date"),
              ]),
              this.unreadCount
                ? h(
                    "button",
                    {
                      type: "button",
                      class: "edge-notification-text-action",
                      onClick: () => this.markAllRead(),
                    },
                    "Mark all read",
                  )
                : null,
            ]),
            this.error
              ? h("div", { class: "edge-shared-notification-state is-error" }, [
                  h("span", this.error),
                  h(
                    "button",
                    {
                      type: "button",
                      class: "edge-notification-text-action",
                      onClick: () => this.loadItems(),
                    },
                    "Try again",
                  ),
                ])
              : this.loading
                ? h("div", { class: "edge-shared-notification-state", role: "status" }, "Loading notifications…")
                : this.items.length
                  ? h(
                      "div",
                      { class: "edge-shared-notification-list" },
                      this.items.map((item) =>
                        h(
                          "article",
                          {
                            class: ["edge-shared-notification-item", item.unread ? "is-unread" : ""],
                            key: item.id,
                          },
                          [
                            h("span", { class: "edge-shared-notification-item__indicator", "aria-hidden": "true" }),
                            h("div", { class: "edge-shared-notification-item__body" }, [
                              h("strong", item.title),
                              item.message ? h("p", item.message) : null,
                              h(
                                "div",
                                { class: "edge-shared-notification-item__meta" },
                                [item.category, item.status, this.formatTime(item.created_at)]
                                  .filter(Boolean)
                                  .map((value) => h("span", String(value))),
                              ),
                              h(
                                "div",
                                { class: "edge-shared-notification-item__actions" },
                                (item.actions || []).map((action) =>
                                  h(
                                    "button",
                                    {
                                      type: "button",
                                      class: [
                                        "edge-notification-action",
                                        action.primary ? "is-primary" : "",
                                      ],
                                      disabled: action.enabled === false,
                                      onClick: () => this.runAction(item, action),
                                    },
                                    action.label || action.key || "Action",
                                  ),
                                ),
                              ),
                            ]),
                          ],
                        ),
                      ),
                    )
                  : h("div", { class: "edge-shared-notification-state" }, "No active notifications."),
          ],
        );

    return h("div", { class: "edge-shared-notification-center" }, [
      h(
        EdgeNotificationBell,
        {
          unreadCount: this.unreadCount,
          title: "Notifications",
          "aria-expanded": this.open ? "true" : "false",
          onToggle: () => this.toggle(),
        },
        { icon: () => h(EdgeIcon, { name: "bell", size: "sm" }) },
      ),
      panel,
    ]);
  },
});

function identityForProduct(product) {
  const key = normalizedProduct(product);
  const boot = globalThis.frappe?.boot || {};
  const shared = boot.edgesuite_ui_identity || {};
  if (shared[key]) return shared[key];
  if (shared.product || shared.product_name || shared.tenant_name) return shared;
  return boot[`${key.replace(/-/g, "_")}_ui_identity`] || {};
}

function setText(element, value) {
  if (!element) return;
  const next = normalizedText(value);
  if (next && normalizedText(element.textContent) !== next) element.textContent = next;
}

function setMark(mark, { logo = "", icon = "grid", alt = "" } = {}) {
  if (!mark) return;
  const signature = `${logo}|${icon}|${alt}`;
  if (mark.dataset.edgeIdentitySignature === signature) return;
  mark.dataset.edgeIdentitySignature = signature;
  mark.replaceChildren();
  mark.classList.toggle("edge-identity-mark--image", Boolean(logo));

  if (logo) {
    const image = document.createElement("img");
    image.className = "edge-identity-logo";
    image.src = logo;
    image.alt = alt;
    image.loading = "eager";
    image.decoding = "async";
    mark.appendChild(image);
    return;
  }

  const iconNode = document.createElement("span");
  iconNode.className = "edge-icon edge-icon--sm";
  iconNode.setAttribute("aria-hidden", "true");
  iconNode.innerHTML = edgeIconMarkup(icon || "grid", { size: "sm" });
  mark.appendChild(iconNode);
}

function applyShellIdentity(shell) {
  const product = shell.getAttribute("data-edge-product") || "edgesuite";
  const identity = identityForProduct(product);
  if (!identity || typeof identity !== "object") return;

  const topbar = shell.querySelector(".edge-app-shell__topbar.edge-topbar");
  const topbarBrand = topbar?.querySelector(".edge-topbar__brand");
  const tenantName = normalizedText(identity.tenant_name || identity.organization_name);
  if (topbarBrand && tenantName) {
    setMark(topbarBrand.querySelector(".edge-topbar__mark"), {
      logo: identity.tenant_logo || identity.organization_logo || "",
      icon: identity.tenant_icon || "building",
      alt: tenantName,
    });
    setText(topbarBrand.querySelector(".edge-topbar__title-copy strong"), tenantName);
    setText(
      topbarBrand.querySelector(".edge-topbar__title-copy small"),
      identity.tenant_subtitle || identity.organization_subtitle || "Workspace",
    );
  }

  const sidebarBrand = shell.querySelector(".edge-sidebar__brand");
  const productName = normalizedText(identity.product_name || identity.product_label);
  if (sidebarBrand && productName) {
    setMark(sidebarBrand.querySelector(".edge-sidebar__mark"), {
      logo: identity.product_logo || "",
      icon: identity.product_icon || "grid",
      alt: productName,
    });
    setText(sidebarBrand.querySelector(".edge-sidebar__brand-copy strong"), productName);
    setText(
      sidebarBrand.querySelector(".edge-sidebar__brand-copy small"),
      identity.product_subtitle || "EdgeSuite product",
    );
  }

  if (tenantName && topbar) {
    for (const chip of topbar.querySelectorAll(".edge-context-chip")) {
      chip.toggleAttribute(
        "data-edge-tenant-chip",
        normalizedText(chip.textContent) === tenantName,
      );
    }
  }
}

let identityObserver = null;
let identityScheduled = false;

function applyAllShellIdentities() {
  identityScheduled = false;
  document
    .querySelectorAll(".edge-app-shell[data-edge-product]")
    .forEach((shell) => applyShellIdentity(shell));
}

function scheduleIdentityRefresh() {
  if (identityScheduled) return;
  identityScheduled = true;
  globalThis.requestAnimationFrame?.(applyAllShellIdentities) ||
    globalThis.setTimeout?.(applyAllShellIdentities, 0);
}

function startIdentityEnhancer() {
  if (identityObserver || typeof document === "undefined" || !document.body) return;
  identityObserver = new MutationObserver(scheduleIdentityRefresh);
  identityObserver.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("page-change", scheduleIdentityRefresh);
  globalThis.frappe?.router?.on?.("change", scheduleIdentityRefresh);
  scheduleIdentityRefresh();
}

export function installSharedShellEnhancements(edgeUI) {
  if (!edgeUI || edgeUI.__sharedShellEnhancementsInstalled) return edgeUI;
  const OriginalShell = edgeUI.components?.EdgeAppShell;
  if (!OriginalShell || typeof edgeUI.registerComponent !== "function") return edgeUI;

  const EnhancedEdgeAppShell = defineComponent({
    name: "EnhancedEdgeAppShell",
    inheritAttrs: false,
    setup(_props, context) {
      return () => {
        const attrs = { ...(context.attrs || {}) };
        const product = normalizedProduct(attrs.product);
        const suppliedNavigate = attrs.onNavigate;
        const useSharedNotifications = attrs.useSharedNotifications !== false;
        delete attrs.useSharedNotifications;

        const onNavigate = (route) => {
          const adapter = edgeUI.getAdapter?.(`navigation:${product}`);
          const handled = adapter?.open?.(route, { product });
          if (handled === true) return;
          invokeListeners(suppliedNavigate, route);
        };

        const slots = { ...(context.slots || {}) };
        if (useSharedNotifications) {
          slots.notifications = () =>
            h(EdgeNotificationCenter, {
              product,
              limit: Number(attrs.notificationLimit || 24),
            });
        }

        return h(OriginalShell, { ...attrs, onNavigate }, slots);
      };
    },
  });

  edgeUI.registerComponent("EdgeNotificationCenter", EdgeNotificationCenter, { replace: true });
  edgeUI.registerComponent("EdgeAppShell", EnhancedEdgeAppShell, { replace: true });
  edgeUI.registerAdapter("notifications:default", defaultNotificationProvider, { replace: true });
  edgeUI.__sharedShellEnhancementsInstalled = true;
  startIdentityEnhancer();
  return edgeUI;
}
