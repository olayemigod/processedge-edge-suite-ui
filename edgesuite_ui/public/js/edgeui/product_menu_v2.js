import { edgeIconMarkup, productInitials } from "./icons";

const TRIGGER_ID = "edge-product-menu-trigger";
const HOST_ID = "edge-product-menu-host";
const PANEL_ID = "edge-product-menu-dropdown";
const OPEN_CLASS = "edge-product-menu--open";

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function userRoles(target) {
  const bootRoles = target.frappe?.boot?.user?.roles;
  const sessionRoles = target.frappe?.user_roles;
  return new Set([
    ...(Array.isArray(bootRoles) ? bootRoles : []),
    ...(Array.isArray(sessionRoles) ? sessionRoles : []),
  ]);
}

function itemIsVisible(target, item) {
  if (!item || item.visible === false || item.hidden === 1) return false;
  if (!Array.isArray(item.roles) || !item.roles.length) return true;
  const roles = userRoles(target);
  return item.roles.some((role) => roles.has(role));
}

function normalizeItem(item = {}) {
  return {
    label: String(item.label || "").trim(),
    description: String(item.description || item.subtitle || "").trim(),
    icon: String(item.icon || "list").trim() || "list",
    badge: item.badge == null ? "" : String(item.badge),
    keywords: Array.isArray(item.keywords)
      ? item.keywords.filter(Boolean).map(String)
      : String(item.keywords || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
    link_type: String(item.link_type || item.linkType || "Page").trim() || "Page",
    link_to: String(item.link_to || item.linkTo || "").trim(),
    route: String(item.route || "").trim(),
    visible: item.visible !== false && item.hidden !== 1,
    roles: Array.isArray(item.roles) ? item.roles.filter(Boolean) : [],
  };
}

function normalizeConfig(config = {}) {
  if (!config || typeof config !== "object") {
    throw new TypeError("registerProductMenu() requires a configuration object");
  }

  const product = String(config.product || "EdgeSuite").trim() || "EdgeSuite";
  const sections = (Array.isArray(config.sections) ? config.sections : [])
    .map((section) => ({
      label: String(section?.label || "").trim(),
      description: String(section?.description || "").trim(),
      icon: String(section?.icon || "layers").trim() || "layers",
      items: (Array.isArray(section?.items) ? section.items : []).map(normalizeItem),
    }))
    .filter((section) => section.label && section.items.length);

  return {
    product,
    subtitle: String(config.subtitle || config.description || "").trim(),
    sections,
    profile: config.profile && typeof config.profile === "object" ? { ...config.profile } : {},
    navigate: typeof config.navigate === "function" ? config.navigate : null,
    menu_source: String(config.menu_source || "product").trim() || "product",
  };
}

function currentRoute(target) {
  const route = target.frappe?.get_route?.();
  return (Array.isArray(route) ? route : [])
    .map((part) => String(part || "").toLowerCase())
    .join("/");
}

function itemIsActive(target, item) {
  const route = currentRoute(target);
  if (!route) return false;
  const directRoute = String(item.route || "").replace(/^\/+/, "").toLowerCase();
  const destination = String(item.link_to || "").toLowerCase();
  if (directRoute && (route === directRoute || route.endsWith(`/${directRoute}`))) return true;
  return Boolean(
    destination &&
      (route === destination ||
        route.endsWith(`/${destination}`) ||
        route.includes(`/${destination}/`)),
  );
}

function visibleNavbar(document) {
  const selectors = [
    ".navbar .navbar-nav.ms-auto",
    ".navbar .navbar-nav.ml-auto",
    ".navbar .navbar-right",
    ".navbar .navbar-nav:last-of-type",
    "header.navbar .navbar-nav",
    ".desktop-navbar .navbar-nav",
    "header.navbar",
    ".desktop-navbar",
    ".navbar",
  ];

  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector)).reverse();
    for (const node of nodes) {
      const box = node.getBoundingClientRect();
      const style = document.defaultView?.getComputedStyle?.(node);
      if (
        node.isConnected &&
        box.width > 0 &&
        box.height > 0 &&
        style?.visibility !== "hidden" &&
        style?.display !== "none"
      ) {
        return node;
      }
    }
  }
  return null;
}

function routeTo(target, config, item) {
  if (config.navigate) {
    config.navigate(item);
    return;
  }

  if (!target.frappe?.set_route) return;
  if (item.route) {
    target.frappe.set_route(...item.route.replace(/^\/+/, "").split("/").filter(Boolean));
  } else if (item.link_type === "Report") {
    target.frappe.set_route("query-report", item.link_to);
  } else if (item.link_type === "DocType") {
    target.frappe.set_route("List", item.link_to);
  } else {
    target.frappe.set_route(item.link_to);
  }
}

function matchesQuery(section, item, query) {
  if (!query) return true;
  const haystack = [
    section.label,
    section.description,
    item.label,
    item.description,
    item.link_to,
    item.route,
    ...item.keywords,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function createProductMenuController({ target = globalThis } = {}) {
  let config = null;
  let eventsBound = false;
  let mountQueued = false;
  let observer = null;
  let query = "";

  const document = () => target.document;
  const trigger = () => document()?.getElementById(TRIGGER_ID) || null;
  const panel = () => document()?.getElementById(PANEL_ID) || null;

  function positionPanel() {
    const menuTrigger = trigger();
    const menuPanel = panel();
    if (!menuTrigger || !menuPanel || menuPanel.hidden) return;

    const triggerBox = menuTrigger.getBoundingClientRect();
    const viewportWidth = target.innerWidth || document()?.documentElement?.clientWidth || 0;
    const viewportHeight = target.innerHeight || document()?.documentElement?.clientHeight || 0;
    const panelWidth = Math.min(680, Math.max(320, viewportWidth - 16));
    const left = Math.max(8, Math.min(triggerBox.right - panelWidth, viewportWidth - panelWidth - 8));
    menuPanel.style.top = `${Math.max(8, triggerBox.bottom + 8)}px`;
    menuPanel.style.left = `${left}px`;
    menuPanel.style.maxHeight = `${Math.max(280, viewportHeight - triggerBox.bottom - 20)}px`;
  }

  function visibleSections() {
    const normalizedQuery = query.trim().toLowerCase();
    return (config?.sections || [])
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item) => itemIsVisible(target, item))
          .filter((item) => matchesQuery(section, item, normalizedQuery)),
      }))
      .filter((section) => section.items.length);
  }

  function render() {
    const menuPanel = panel();
    if (!menuPanel || !config) return;

    const profile = config.profile || {};
    const profileName = profile.name || profile.full_name || "EdgeSuite User";
    const details = [profile.company, profile.branch].filter(Boolean).join(" · ");
    const sections = visibleSections();
    const itemCount = sections.reduce((total, section) => total + section.items.length, 0);

    menuPanel.innerHTML = `
      <header class="edge-product-menu__header">
        <div class="edge-product-menu__brand">
          <span class="edge-product-menu__brand-mark">${edgeIconMarkup(config.product === "EduEdge" ? "graduation" : "grid", { target })}</span>
          <span>
            <strong>${escapeHtml(config.product)}</strong>
            ${config.subtitle ? `<small>${escapeHtml(config.subtitle)}</small>` : ""}
          </span>
        </div>
        <button type="button" class="edge-product-menu__close" aria-label="Close product menu">
          ${edgeIconMarkup("close", { target })}
        </button>
      </header>
      <div class="edge-product-menu__profile">
        <span class="edge-product-menu__avatar">${escapeHtml(productInitials(profileName))}</span>
        <span class="edge-product-menu__identity">
          <strong>${escapeHtml(profileName)}</strong>
          ${profile.email ? `<small>${escapeHtml(profile.email)}</small>` : ""}
          ${details ? `<small>${escapeHtml(details)}</small>` : ""}
        </span>
        <span class="edge-product-menu__product">${escapeHtml(config.product)}</span>
      </div>
      <div class="edge-product-menu__search-wrap">
        <span class="edge-product-menu__search-icon">${edgeIconMarkup("search", { target })}</span>
        <input
          type="search"
          class="edge-product-menu__search"
          value="${escapeHtml(query)}"
          placeholder="Search ${escapeHtml(config.product)}"
          aria-label="Search ${escapeHtml(config.product)} menu"
          autocomplete="off"
        />
        <span class="edge-product-menu__result-count">${itemCount}</span>
      </div>
      <div class="edge-product-menu__sections" role="menu">
        ${
          sections.length
            ? sections
                .map(
                  (section) => `
            <section class="edge-product-menu__section" aria-label="${escapeHtml(section.label)}">
              <div class="edge-product-menu__section-heading">
                <span class="edge-product-menu__section-icon">${edgeIconMarkup(section.icon, { target })}</span>
                <span>
                  <h3>${escapeHtml(section.label)}</h3>
                  ${section.description ? `<p>${escapeHtml(section.description)}</p>` : ""}
                </span>
              </div>
              <div class="edge-product-menu__items">
                ${section.items
                  .map(
                    (item) => `
                  <button
                    type="button"
                    class="edge-product-menu__item${itemIsActive(target, item) ? " is-active" : ""}"
                    role="menuitem"
                    data-link-type="${escapeHtml(item.link_type)}"
                    data-link-to="${escapeHtml(item.link_to)}"
                    data-route="${escapeHtml(item.route)}"
                  >
                    <span class="edge-product-menu__item-icon" aria-hidden="true">${edgeIconMarkup(item.icon, { target })}</span>
                    <span class="edge-product-menu__item-copy">
                      <strong>${escapeHtml(item.label)}</strong>
                      ${item.description ? `<small>${escapeHtml(item.description)}</small>` : ""}
                    </span>
                    ${item.badge ? `<span class="edge-product-menu__item-badge">${escapeHtml(item.badge)}</span>` : ""}
                  </button>`,
                  )
                  .join("")}
              </div>
            </section>`,
                )
                .join("")
            : `
              <div class="edge-product-menu__empty">
                ${edgeIconMarkup("search", { target })}
                <strong>No menu item found</strong>
                <span>Try another keyword.</span>
              </div>`
        }
      </div>`;
  }

  function close() {
    const menuPanel = panel();
    const menuTrigger = trigger();
    if (menuPanel) menuPanel.hidden = true;
    if (menuTrigger) menuTrigger.setAttribute("aria-expanded", "false");
    document()?.documentElement?.classList.remove(OPEN_CLASS);
  }

  function open() {
    const menuPanel = panel();
    const menuTrigger = trigger();
    if (!menuPanel || !menuTrigger) return false;
    query = "";
    render();
    menuPanel.hidden = false;
    menuTrigger.setAttribute("aria-expanded", "true");
    document()?.documentElement?.classList.add(OPEN_CLASS);
    target.requestAnimationFrame?.(() => {
      positionPanel();
      menuPanel.querySelector(".edge-product-menu__search")?.focus();
    });
    return true;
  }

  function toggle() {
    return panel()?.hidden ? open() : (close(), false);
  }

  function mount() {
    const doc = document();
    if (!doc || !config || !config.sections.length) return false;

    let host = doc.getElementById(HOST_ID);
    let menuPanel = panel();
    if (host && menuPanel) {
      render();
      return true;
    }

    host?.remove();
    menuPanel?.remove();
    const navbar = visibleNavbar(doc);
    if (!navbar) return false;

    host = doc.createElement(navbar.matches("ul, ol") ? "li" : "span");
    host.id = HOST_ID;
    host.className = "edge-product-menu__host";

    const menuTrigger = doc.createElement("button");
    menuTrigger.id = TRIGGER_ID;
    menuTrigger.type = "button";
    menuTrigger.className = "edge-product-menu__trigger";
    menuTrigger.setAttribute("aria-label", `Open ${config.product} product menu`);
    menuTrigger.setAttribute("aria-haspopup", "menu");
    menuTrigger.setAttribute("aria-expanded", "false");
    menuTrigger.innerHTML = edgeIconMarkup("grid", { target });
    host.appendChild(menuTrigger);
    navbar.appendChild(host);

    menuPanel = doc.createElement("aside");
    menuPanel.id = PANEL_ID;
    menuPanel.className = "edge-product-menu";
    menuPanel.hidden = true;
    menuPanel.setAttribute("role", "dialog");
    menuPanel.setAttribute("aria-modal", "false");
    menuPanel.setAttribute("aria-label", `${config.product} product menu`);
    doc.body.appendChild(menuPanel);

    menuTrigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggle();
    });

    menuPanel.addEventListener("input", (event) => {
      if (!event.target.matches(".edge-product-menu__search")) return;
      query = event.target.value || "";
      render();
      const input = menuPanel.querySelector(".edge-product-menu__search");
      if (input) {
        input.focus();
        input.setSelectionRange(query.length, query.length);
      }
    });

    menuPanel.addEventListener("click", (event) => {
      if (event.target.closest(".edge-product-menu__close")) {
        close();
        return;
      }
      const itemNode = event.target.closest(".edge-product-menu__item");
      if (!itemNode) return;
      routeTo(target, config, {
        link_type: itemNode.dataset.linkType || "Page",
        link_to: itemNode.dataset.linkTo || "",
        route: itemNode.dataset.route || "",
      });
      close();
    });

    render();
    return true;
  }

  function scheduleMount() {
    if (mountQueued) return;
    mountQueued = true;
    const schedule =
      target.requestAnimationFrame || ((callback) => target.setTimeout?.(callback, 0));
    schedule?.(() => {
      mountQueued = false;
      mount();
    });
  }

  function bindEvents() {
    if (eventsBound || !document()) return;
    eventsBound = true;
    const doc = document();

    doc.addEventListener("click", (event) => {
      const menuPanel = panel();
      const menuTrigger = trigger();
      if (
        menuPanel &&
        !menuPanel.hidden &&
        !menuPanel.contains(event.target) &&
        !menuTrigger?.contains(event.target)
      ) {
        close();
      }
    });
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    target.addEventListener?.("resize", positionPanel);
    target.addEventListener?.("scroll", positionPanel, true);

    ["desktop_screen", "sidebar_setup", "toolbar_setup", "page-change"].forEach((eventName) => {
      doc.addEventListener(eventName, scheduleMount);
    });
    target.frappe?.router?.on?.("change", () => {
      close();
      scheduleMount();
    });

    if (target.MutationObserver && doc.body) {
      observer = new target.MutationObserver(() => {
        if (!trigger() || !panel()) scheduleMount();
      });
      observer.observe(doc.body, { childList: true, subtree: true });
    }
  }

  function register(nextConfig) {
    config = normalizeConfig(nextConfig);
    bindEvents();
    mount();
    scheduleMount();
    return config;
  }

  function refresh() {
    render();
    return mount();
  }

  function destroy() {
    close();
    document()?.getElementById(HOST_ID)?.remove();
    panel()?.remove();
    observer?.disconnect();
    observer = null;
    config = null;
    query = "";
  }

  return {
    register,
    mount,
    refresh,
    open,
    close,
    toggle,
    destroy,
    getConfig: () => config,
  };
}

export { HOST_ID, PANEL_ID, TRIGGER_ID };
