const QUICK_ACTION_SECTION_KEY = "quick-actions";
const FAVORITES_SECTION_KEY = "favorites";
const DENSITY_CONTROL_CLASS = "edge-product-menu__density";
const FAVORITE_CONTROL_CLASS = "edge-product-menu__favorite-control";
const FAVORITES_STORAGE_VERSION = "v1";

function normalizedQuickActions(config = {}) {
  const actions = Array.isArray(config.quick_actions)
    ? config.quick_actions
    : Array.isArray(config.quickActions)
      ? config.quickActions
      : [];
  const seen = new Set();
  return actions.filter((item) => {
    const identity = itemIdentity(item);
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return item?.visible !== false && item?.hidden !== 1;
  });
}

function withQuickActions(config = {}) {
  const actions = normalizedQuickActions(config);
  if (!actions.length) return config;
  const sections = Array.isArray(config.sections) ? [...config.sections] : [];
  if (sections.some((section) => section?.key === QUICK_ACTION_SECTION_KEY)) return config;
  const overviewIndex = sections.findIndex((section) => section?.key === "overview");
  const insertAt = overviewIndex >= 0 ? overviewIndex + 1 : 0;
  sections.splice(insertAt, 0, {
    key: QUICK_ACTION_SECTION_KEY,
    label: "Quick Actions",
    description: "Frequently used actions available to your current role",
    icon: "bolt",
    items: actions,
  });
  return { ...config, sections };
}

function normalizedProduct(config = {}) {
  return (
    String(config.product_key || config.product || "edgesuite")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "edgesuite"
  );
}

function currentUser(target) {
  return target?.frappe?.session?.user || "Guest";
}

function favoriteStorageKey(config, target) {
  return `edgeui:${normalizedProduct(config)}:favorites:${FAVORITES_STORAGE_VERSION}:${currentUser(target)}`;
}

function itemIdentity(item = {}) {
  const route = String(item.route || "").trim();
  if (route) return `route:${normalizePath(route)}`;
  const linkType = String(item.link_type || item.linkType || "Page").trim() || "Page";
  const linkTo = String(item.link_to || item.linkTo || "").trim();
  return linkTo ? `${linkType.toLowerCase()}:${linkTo}` : "";
}

function allItems(config = {}) {
  return (Array.isArray(config.sections) ? config.sections : [])
    .filter((section) => ![FAVORITES_SECTION_KEY, QUICK_ACTION_SECTION_KEY].includes(section?.key))
    .flatMap((section) => (Array.isArray(section?.items) ? section.items : []))
    .filter((item) => item?.visible !== false && item?.hidden !== 1 && itemIdentity(item));
}

function readFavoriteIds(config, target) {
  try {
    const payload = JSON.parse(target?.localStorage?.getItem(favoriteStorageKey(config, target)) || "[]");
    return new Set(Array.isArray(payload) ? payload.filter(Boolean).map(String) : []);
  } catch (_error) {
    return new Set();
  }
}

function writeFavoriteIds(config, target, ids) {
  try {
    target?.localStorage?.setItem(
      favoriteStorageKey(config, target),
      JSON.stringify([...ids].sort()),
    );
  } catch (_error) {
    // Browser storage is optional. Menu operation remains usable without it.
  }
}

function withFavorites(config = {}, target = globalThis) {
  const favorites = readFavoriteIds(config, target);
  if (!favorites.size) return config;
  const items = allItems(config).filter((item) => favorites.has(itemIdentity(item)));
  if (!items.length) return config;
  const sections = Array.isArray(config.sections) ? [...config.sections] : [];
  if (sections.some((section) => section?.key === FAVORITES_SECTION_KEY)) return config;
  const overviewIndex = sections.findIndex((section) => section?.key === "overview");
  sections.splice(overviewIndex >= 0 ? overviewIndex + 1 : 0, 0, {
    key: FAVORITES_SECTION_KEY,
    label: "Favorites",
    description: "Pages pinned for your account on this device",
    icon: "star",
    items: items.map((item) => ({ ...item, badge: item.badge || "Pinned" })),
  });
  return { ...config, sections };
}

function withNavigationExtras(config = {}, target = globalThis) {
  return withFavorites(withQuickActions(config), target);
}

function normalizePath(value) {
  const text = String(value || "").split(/[?#]/, 1)[0].trim();
  if (!text) return "";
  const path = text.startsWith("/") ? text : `/${text}`;
  return path.replace(/\/+$/, "") || "/";
}

function currentRouteParts(target) {
  const route = target?.frappe?.get_route?.();
  return Array.isArray(route) ? route.filter(Boolean).map(String) : [];
}

function itemIsCurrent(item, target) {
  const route = normalizePath(item?.route);
  const pathname = normalizePath(target?.location?.pathname);
  if (route && pathname && route === pathname) return true;
  const parts = currentRouteParts(target).map((part) => part.toLowerCase());
  const linkTo = String(item?.link_to || item?.linkTo || "").toLowerCase();
  if (!linkTo || !parts.length) return false;
  return parts.includes(linkTo) || parts.join("/").endsWith(`/${linkTo}`);
}

function currentMenuItem(config, target) {
  return allItems(config).find((item) => itemIsCurrent(item, target)) || null;
}

function installDensityControl(runtime, target) {
  const document = target?.document;
  if (!document) return;
  const panel = document.getElementById("edge-product-menu-dropdown");
  if (!panel || panel.querySelector(`.${DENSITY_CONTROL_CLASS}`)) return;
  const searchWrap = panel.querySelector(".edge-product-menu__search-wrap");
  if (!searchWrap) return;

  const select = document.createElement("select");
  select.className = DENSITY_CONTROL_CLASS;
  select.setAttribute("aria-label", "Display density");
  for (const [value, label] of [
    ["compact", "Compact"],
    ["comfortable", "Comfortable"],
    ["touch", "Touch"],
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }
  select.value = runtime.getDensity?.() || "compact";
  select.addEventListener("change", () => runtime.setDensity?.(select.value));
  searchWrap.appendChild(select);
}

function installFavoriteControl(runtime, target, sourceConfig, refreshMenu) {
  const document = target?.document;
  const panel = document?.getElementById("edge-product-menu-dropdown");
  if (!panel || panel.querySelector(`.${FAVORITE_CONTROL_CLASS}`) || !sourceConfig) return;
  const current = currentMenuItem(sourceConfig, target);
  if (!current) return;
  const header = panel.querySelector(".edge-product-menu__header");
  const close = panel.querySelector(".edge-product-menu__close");
  if (!header) return;

  const favorites = readFavoriteIds(sourceConfig, target);
  const identity = itemIdentity(current);
  const pinned = favorites.has(identity);
  const button = document.createElement("button");
  button.type = "button";
  button.className = FAVORITE_CONTROL_CLASS;
  button.dataset.pinned = pinned ? "1" : "0";
  button.setAttribute("aria-pressed", pinned ? "true" : "false");
  button.setAttribute("aria-label", pinned ? "Remove current page from Favorites" : "Pin current page to Favorites");
  button.title = button.getAttribute("aria-label");
  button.textContent = pinned ? "★ Pinned" : "☆ Pin page";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const next = readFavoriteIds(sourceConfig, target);
    if (next.has(identity)) next.delete(identity);
    else next.add(identity);
    writeFavoriteIds(sourceConfig, target, next);
    refreshMenu();
    target.requestAnimationFrame?.(() => runtime.openProductMenu?.());
  });
  header.insertBefore(button, close || null);
}

export function installProductMenuExtras(runtime, target = globalThis) {
  if (!runtime || runtime.__productMenuExtrasInstalled) return runtime;
  const originalRegister = runtime.registerProductMenu?.bind(runtime);
  if (!originalRegister) return runtime;

  let sourceConfig = null;
  const registerSource = () => {
    if (!sourceConfig) return null;
    return originalRegister(withNavigationExtras(sourceConfig, target));
  };
  runtime.registerProductMenu = function registerProductMenu(config) {
    sourceConfig = config && typeof config === "object" ? { ...config } : config;
    const registered = registerSource();
    target.requestAnimationFrame?.(refreshExtras);
    return registered;
  };
  runtime.getProductMenuSourceConfig = () => sourceConfig;
  runtime.getFavoriteMenuItems = () => {
    const ids = readFavoriteIds(sourceConfig || {}, target);
    return allItems(sourceConfig || {}).filter((item) => ids.has(itemIdentity(item)));
  };
  runtime.toggleFavoriteMenuItem = (item) => {
    if (!sourceConfig || !itemIdentity(item)) return false;
    const ids = readFavoriteIds(sourceConfig, target);
    const identity = itemIdentity(item);
    if (ids.has(identity)) ids.delete(identity);
    else ids.add(identity);
    writeFavoriteIds(sourceConfig, target, ids);
    registerSource();
    return ids.has(identity);
  };

  function refreshExtras() {
    installDensityControl(runtime, target);
    installFavoriteControl(runtime, target, sourceConfig, registerSource);
  }

  target.document?.addEventListener?.("page-change", refreshExtras);
  target.addEventListener?.("edgesuite:density-changed", refreshExtras);
  if (target.MutationObserver && target.document?.body) {
    const observer = new target.MutationObserver(refreshExtras);
    observer.observe(target.document.body, { childList: true, subtree: true });
    runtime.__productMenuExtrasObserver = observer;
  }

  runtime.__productMenuExtrasInstalled = true;
  return runtime;
}

export {
  DENSITY_CONTROL_CLASS,
  FAVORITE_CONTROL_CLASS,
  FAVORITES_SECTION_KEY,
  QUICK_ACTION_SECTION_KEY,
  withFavorites,
  withNavigationExtras,
  withQuickActions,
};
