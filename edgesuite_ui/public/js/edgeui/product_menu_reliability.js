const PANEL_ID = "edge-product-menu-dropdown";
const OPENED_EVENT = "edgesuite:product-menu-opened";
const FAVORITE_CONTROL_CLASS = "edge-product-menu__favorite-control";
const DENSITY_CONTROL_CLASS = "edge-product-menu__density";
const OPEN_SECTION_KEY = "edgeOpenSection";

function normalizePath(value) {
  let text = String(value || "").split(/[?#]/, 1)[0].trim();
  if (text.startsWith("route:")) text = text.slice(6);
  if (!text) return "";
  return (text.startsWith("/") ? text : `/${text}`).replace(/\/+$/, "") || "/";
}

function sectionIdentity(section) {
  return String(section?.getAttribute?.("aria-label") || "").trim();
}

function currentItem(runtime, target) {
  const config = runtime.getProductMenuSourceConfig?.() || runtime.getProductMenuConfig?.() || {};
  const pathname = normalizePath(target?.location?.pathname);
  for (const section of Array.isArray(config.sections) ? config.sections : []) {
    for (const item of Array.isArray(section?.items) ? section.items : []) {
      if (normalizePath(item?.route) === pathname) return item;
    }
  }
  const active = target?.document?.querySelector?.(
    `#${PANEL_ID} .edge-product-menu__item.is-active`,
  );
  if (!active) return null;
  return {
    route: active.dataset.route || "",
    link_type: active.dataset.linkType || "Page",
    link_to: active.dataset.linkTo || "",
  };
}

function itemIdentity(item = {}) {
  const route = normalizePath(item.route);
  if (route) return route;
  const linkType = String(item.link_type || item.linkType || "Page").trim().toLowerCase();
  const linkTo = String(item.link_to || item.linkTo || "").trim();
  return linkTo ? `${linkType}:${linkTo}` : "";
}

function itemPinned(runtime, item) {
  const identity = itemIdentity(item);
  return Boolean(
    identity &&
      (runtime.getFavoriteMenuItems?.() || []).some(
        (favorite) => itemIdentity(favorite) === identity,
      ),
  );
}

function prepareAccordion(panel) {
  if (!panel || panel.hidden) return;
  const query = String(panel.querySelector(".edge-product-menu__search")?.value || "").trim();
  const sections = [...panel.querySelectorAll(".edge-product-menu__section")];
  if (!sections.length) return;

  const preferredIdentity = panel.dataset[OPEN_SECTION_KEY] || "";
  const preferred = preferredIdentity
    ? sections.find((section) => sectionIdentity(section) === preferredIdentity)
    : null;
  const active = sections.find((section) =>
    section.querySelector(".edge-product-menu__item.is-active"),
  );
  const keep = query ? null : preferred || active || sections[0];

  for (const section of sections) {
    const heading = section.querySelector(".edge-product-menu__section-heading");
    const items = section.querySelector(".edge-product-menu__items");
    if (heading) {
      heading.tabIndex = 0;
      heading.setAttribute("role", "button");
    }
    const collapse = query ? false : section !== keep;
    section.classList.toggle("is-collapsed", collapse);
    if (items) items.hidden = collapse;
    heading?.setAttribute("aria-expanded", collapse ? "false" : "true");
  }
}

function toggleSection(panel, section) {
  if (!panel || !section) return;
  const query = String(panel.querySelector(".edge-product-menu__search")?.value || "").trim();
  if (query) return;
  const items = section.querySelector(".edge-product-menu__items");
  const currentlyOpen = Boolean(items && !items.hidden && !section.classList.contains("is-collapsed"));

  for (const sibling of panel.querySelectorAll(".edge-product-menu__section")) {
    const siblingItems = sibling.querySelector(".edge-product-menu__items");
    const collapse = sibling === section ? currentlyOpen : true;
    sibling.classList.toggle("is-collapsed", collapse);
    if (siblingItems) siblingItems.hidden = collapse;
    sibling.querySelector(".edge-product-menu__section-heading")?.setAttribute(
      "aria-expanded",
      collapse ? "false" : "true",
    );
  }

  if (currentlyOpen) delete panel.dataset[OPEN_SECTION_KEY];
  else panel.dataset[OPEN_SECTION_KEY] = sectionIdentity(section);
}

function installDensityControl(runtime, target, panel) {
  const searchWrap = panel?.querySelector?.(".edge-product-menu__search-wrap");
  if (!searchWrap) return;
  let select = searchWrap.querySelector(`.${DENSITY_CONTROL_CLASS}`);
  if (!select) {
    select = target.document.createElement("select");
    select.className = DENSITY_CONTROL_CLASS;
    select.setAttribute("aria-label", "Display density");
    for (const [value, label] of [
      ["compact", "Compact"],
      ["comfortable", "Comfortable"],
      ["touch", "Touch"],
    ]) {
      const option = target.document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    select.addEventListener("change", () => runtime.setDensity?.(select.value));
    searchWrap.appendChild(select);
  }
  select.value = runtime.getDensity?.() || "compact";
}

function installFavoriteControl(runtime, target, panel) {
  const searchWrap = panel?.querySelector?.(".edge-product-menu__search-wrap");
  const item = currentItem(runtime, target);
  if (!searchWrap || !item || !itemIdentity(item)) return;
  let button = searchWrap.querySelector(`.${FAVORITE_CONTROL_CLASS}`);
  if (!button) {
    button = target.document.createElement("button");
    button.type = "button";
    button.className = FAVORITE_CONTROL_CLASS;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      runtime.toggleCurrentPageFavorite?.();
      runtime.refreshProductMenu?.();
      target.requestAnimationFrame?.(() => refreshPanel(runtime, target));
    });
    searchWrap.appendChild(button);
  }
  const pinned = itemPinned(runtime, item);
  button.dataset.pinned = pinned ? "1" : "0";
  button.setAttribute("aria-pressed", pinned ? "true" : "false");
  button.setAttribute(
    "aria-label",
    pinned ? "Remove current page from Favorites" : "Add current page to Favorites",
  );
  button.title = button.getAttribute("aria-label");
  button.textContent = pinned ? "★ Current pinned" : "☆ Add current";
}

function refreshPanel(runtime, target) {
  const panel = target?.document?.getElementById?.(PANEL_ID);
  if (!panel || panel.hidden) return;
  prepareAccordion(panel);
  installDensityControl(runtime, target, panel);
  installFavoriteControl(runtime, target, panel);
}

export function installProductMenuReliability(runtime, target = globalThis) {
  if (!runtime || runtime.__productMenuReliabilityInstalled) return runtime;
  const document = target?.document;
  if (!document) return runtime;

  let observer = null;
  let scheduled = false;
  const scheduleRefresh = () => {
    if (scheduled) return;
    scheduled = true;
    const schedule = target.requestAnimationFrame || ((callback) => target.setTimeout?.(callback, 0));
    schedule?.(() => {
      scheduled = false;
      refreshPanel(runtime, target);
    });
  };

  document.addEventListener(
    "click",
    (event) => {
      const heading = event.target?.closest?.(".edge-product-menu__section-heading");
      if (!heading) return;
      const panel = heading.closest(`#${PANEL_ID}`);
      const section = heading.closest(".edge-product-menu__section");
      if (!panel || !section) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleSection(panel, section);
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      const heading = event.target?.closest?.(".edge-product-menu__section-heading");
      if (!heading || (event.key !== "Enter" && event.key !== " ")) return;
      const panel = heading.closest(`#${PANEL_ID}`);
      const section = heading.closest(".edge-product-menu__section");
      if (!panel || !section) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleSection(panel, section);
    },
    true,
  );

  target.addEventListener?.(OPENED_EVENT, () => {
    refreshPanel(runtime, target);
    scheduleRefresh();
    const panel = document.getElementById(PANEL_ID);
    if (target.MutationObserver && panel && !observer) {
      observer = new target.MutationObserver(scheduleRefresh);
      observer.observe(panel, { childList: true, subtree: true });
    }
  });
  target.addEventListener?.("edgesuite:favorites-changed", scheduleRefresh);
  target.addEventListener?.("edgesuite:density-changed", scheduleRefresh);
  document.addEventListener("page-change", scheduleRefresh);

  runtime.refreshProductMenuReliability = () => refreshPanel(runtime, target);
  runtime.__productMenuReliabilityObserver = observer;
  runtime.__productMenuReliabilityInstalled = true;
  return runtime;
}

export { OPENED_EVENT, refreshPanel };
