(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;

  const SHELL_SELECTOR = ".edge-app-shell";
  const SIDEBAR_SELECTOR = ".edge-sidebar";
  const BRAND_SELECTOR = ".edge-sidebar__brand";
  const SECTION_SELECTOR = ".edge-sidebar__section";
  const SECTION_TOGGLE_SELECTOR = ".edge-sidebar__section-toggle";
  const ITEM_SELECTOR = ".edge-sidebar-item";
  const ACTIVE_ITEM_SELECTOR = ".edge-sidebar-item.active, .edge-sidebar-item[aria-current='page']";
  const ENHANCED_CLASS = "edge-nav-shell-v2";
  const COLLAPSED_CLASS = "edge-nav-shell--collapsed";
  const TOGGLE_CLASS = "edge-nav-shell-toggle";
  const DESKTOP_QUERY = "(min-width: 62rem)";
  const installed = new WeakSet();
  let observer = null;
  let historyPatched = false;

  function currentUser() {
    return String(window.frappe?.session?.user || "guest").trim() || "guest";
  }

  function productKey(shell) {
    return (
      String(shell?.dataset?.edgeProduct || "edgesuite")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "edgesuite"
    );
  }

  function storageKey(shell) {
    return `edgeui:${currentUser()}:${productKey(shell)}:navigation-collapsed`;
  }

  function desktopMedia() {
    return window.matchMedia?.(DESKTOP_QUERY) || null;
  }

  function readCollapsed(shell) {
    try {
      return window.localStorage?.getItem(storageKey(shell)) === "1";
    } catch (_error) {
      return false;
    }
  }

  function persistCollapsed(shell, collapsed) {
    try {
      window.localStorage?.setItem(storageKey(shell), collapsed ? "1" : "0");
    } catch (_error) {
      // Browser storage is optional; the in-memory DOM state remains usable.
    }
  }

  function chevronMarkup(collapsed) {
    const path = collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6";
    return `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
  }

  function sectionLabel(toggle) {
    const nodes = [...(toggle?.children || [])];
    const textNode = nodes.find((node) => !node.classList?.contains("edge-icon"));
    return String(textNode?.textContent || toggle?.textContent || "Navigation").trim();
  }

  function itemLabel(item) {
    return String(item?.querySelector?.(".edge-sidebar-item__label")?.textContent || item?.textContent || "Navigation item").trim();
  }

  function slug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function currentResourceSlug() {
    try {
      return slug(new URL(window.location.href).searchParams.get("resource") || "");
    } catch (_error) {
      return "";
    }
  }

  function resourceItem(shell) {
    const resource = currentResourceSlug();
    if (!resource) return null;
    const singular = resource.endsWith("s") ? resource.slice(0, -1) : resource;
    const items = [...shell.querySelectorAll(ITEM_SELECTOR)];
    const scored = items
      .map((item, index) => {
        const label = slug(itemLabel(item));
        const isDashboard = label.endsWith("-dashboard") || label.includes("dashboard-");
        let score = 0;
        if (label === resource) score = 120;
        else if (singular !== resource && label === singular) score = 110;
        else if (label.startsWith(`${resource}-`)) score = 90;
        else if (singular !== resource && label.startsWith(`${singular}-`)) score = 85;
        else if (resource.startsWith(`${label}-`)) score = 70;
        else if (label.includes(resource)) score = 55;
        else if (singular !== resource && label.includes(singular)) score = 50;
        if (isDashboard && score) score = Math.min(score, 20);
        return { item, index, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index);
    return scored[0]?.item || null;
  }

  function syncActiveItemFromLocation(shell) {
    const candidate = resourceItem(shell);
    if (!candidate) return shell.querySelector(ACTIVE_ITEM_SELECTOR) || null;

    shell.querySelectorAll(ITEM_SELECTOR).forEach((item) => {
      const active = item === candidate;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    return candidate;
  }

  function updateTooltips(shell, collapsed) {
    shell.querySelectorAll(SECTION_TOGGLE_SELECTOR).forEach((toggle) => {
      const label = sectionLabel(toggle);
      if (collapsed) {
        toggle.setAttribute("title", label);
        toggle.setAttribute("aria-label", label);
      } else {
        toggle.removeAttribute("title");
        toggle.removeAttribute("aria-label");
      }
    });

    shell.querySelectorAll(ITEM_SELECTOR).forEach((item) => {
      const label = itemLabel(item);
      if (collapsed) {
        item.setAttribute("title", label);
        item.setAttribute("aria-label", label);
      } else {
        item.removeAttribute("title");
        item.removeAttribute("aria-label");
      }
    });
  }

  function applyState(shell, collapsed, options = {}) {
    const sidebar = shell.querySelector(SIDEBAR_SELECTOR);
    const button = shell.querySelector(`.${TOGGLE_CLASS}`);
    const media = desktopMedia();
    const desktop = media ? media.matches : true;
    const effectiveCollapsed = Boolean(collapsed && desktop);
    const widthToken = effectiveCollapsed
      ? "var(--edge-navigation-collapsed-width)"
      : "var(--edge-navigation-expanded-width)";

    shell.classList.toggle(COLLAPSED_CLASS, effectiveCollapsed);
    shell.dataset.edgeNavCollapsed = effectiveCollapsed ? "1" : "0";
    shell.style.setProperty("--edge-sidebar-width", widthToken);
    if (sidebar) {
      sidebar.dataset.edgeNavCollapsed = effectiveCollapsed ? "1" : "0";
      sidebar.style.width = widthToken;
    }

    if (button) {
      button.setAttribute("aria-expanded", effectiveCollapsed ? "false" : "true");
      button.setAttribute(
        "aria-label",
        effectiveCollapsed ? "Expand navigation" : "Collapse navigation",
      );
      button.setAttribute(
        "title",
        effectiveCollapsed ? "Expand navigation" : "Collapse navigation",
      );
      button.innerHTML = chevronMarkup(effectiveCollapsed);
    }

    updateTooltips(shell, effectiveCollapsed);
    if (options.persist !== false && desktop) persistCollapsed(shell, effectiveCollapsed);
  }

  function createCollapseToggle(shell) {
    const sidebar = shell.querySelector(SIDEBAR_SELECTOR);
    const brand = sidebar?.querySelector(BRAND_SELECTOR);
    if (!brand) return null;

    let button = brand.querySelector(`.${TOGGLE_CLASS}`);
    if (button) return button;

    if (!sidebar.id) sidebar.id = `edge-sidebar-${productKey(shell)}`;
    button = document.createElement("button");
    button.type = "button";
    button.className = TOGGLE_CLASS;
    button.setAttribute("aria-controls", sidebar.id);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyState(shell, !shell.classList.contains(COLLAPSED_CLASS));
    });
    brand.appendChild(button);
    return button;
  }

  function expandedSectionToggles(shell) {
    return [...shell.querySelectorAll(SECTION_TOGGLE_SELECTOR)].filter(
      (toggle) => toggle.getAttribute("aria-expanded") === "true",
    );
  }

  function activeSection(shell) {
    return shell.querySelector(ACTIVE_ITEM_SELECTOR)?.closest?.(SECTION_SELECTOR) || null;
  }

  function collapseOtherSections(shell, keepSection) {
    expandedSectionToggles(shell).forEach((toggle) => {
      const section = toggle.closest(SECTION_SELECTOR);
      if (!section || section === keepSection) return;
      toggle.click();
    });
  }

  function syncAccordionToActive(shell) {
    if (shell.classList.contains(COLLAPSED_CLASS)) return;
    syncActiveItemFromLocation(shell);
    const section = activeSection(shell);
    if (!section) return;
    const toggle = section.querySelector(SECTION_TOGGLE_SELECTOR);
    if (!toggle) return;

    if (toggle.getAttribute("aria-expanded") !== "true") toggle.click();
    window.setTimeout(() => collapseOtherSections(shell, section), 0);
  }

  function bindSectionAccordion(shell) {
    const sidebar = shell.querySelector(SIDEBAR_SELECTOR);
    if (!sidebar || sidebar.dataset.edgeNavAccordionBound === "1") return;
    sidebar.dataset.edgeNavAccordionBound = "1";

    sidebar.addEventListener("click", (event) => {
      const sectionToggle = event.target?.closest?.(SECTION_TOGGLE_SELECTOR);
      if (!sectionToggle || shell.classList.contains(COLLAPSED_CLASS)) return;
      const section = sectionToggle.closest(SECTION_SELECTOR);
      window.setTimeout(() => {
        if (sectionToggle.getAttribute("aria-expanded") === "true") {
          collapseOtherSections(shell, section);
        }
      }, 0);
    });
  }

  function bindRailSectionExpansion(shell) {
    const sidebar = shell.querySelector(SIDEBAR_SELECTOR);
    if (!sidebar || sidebar.dataset.edgeNavRailBound === "1") return;
    sidebar.dataset.edgeNavRailBound = "1";

    sidebar.addEventListener(
      "click",
      (event) => {
        if (!shell.classList.contains(COLLAPSED_CLASS)) return;
        const sectionToggle = event.target?.closest?.(SECTION_TOGGLE_SELECTOR);
        if (!sectionToggle) return;

        const section = sectionToggle.closest(SECTION_SELECTOR);
        const alreadyExpanded = sectionToggle.getAttribute("aria-expanded") === "true";
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        applyState(shell, false);

        window.setTimeout(() => {
          if (!alreadyExpanded) sectionToggle.click();
          window.setTimeout(() => collapseOtherSections(shell, section), 0);
        }, 0);
      },
      true,
    );
  }

  function bindResponsiveState(shell) {
    const media = desktopMedia();
    if (!media || shell.dataset.edgeNavMediaBound === "1") return;
    shell.dataset.edgeNavMediaBound = "1";
    media.addEventListener?.("change", (event) => {
      if (!event.matches) {
        applyState(shell, false, { persist: false });
        return;
      }
      applyState(shell, readCollapsed(shell), { persist: false });
    });
  }

  function installShell(shell) {
    if (!(shell instanceof Element)) return;
    shell.classList.add(ENHANCED_CLASS);
    createCollapseToggle(shell);
    bindSectionAccordion(shell);
    bindRailSectionExpansion(shell);
    bindResponsiveState(shell);

    if (!installed.has(shell)) installed.add(shell);
    // Vue product shells may rewrite the root class/style list on rerender. The
    // saved preference is therefore reapplied on every scan, not only on the
    // first mount, so desktop icon-rail state remains authoritative.
    applyState(shell, readCollapsed(shell), { persist: false });
    window.setTimeout(() => syncAccordionToActive(shell), 0);
  }

  function scan(root = document) {
    root.querySelectorAll?.(SHELL_SELECTOR).forEach(installShell);
    if (root.matches?.(SHELL_SELECTOR)) installShell(root);
    const ownerShell = root.closest?.(SHELL_SELECTOR);
    if (ownerShell) installShell(ownerShell);
  }

  function startObserver() {
    if (observer || !document.body || !window.MutationObserver) return;
    observer = new MutationObserver((records) => {
      const shells = new Set();
      for (const record of records) {
        const targetShell = record.target?.closest?.(SHELL_SELECTOR);
        if (targetShell) shells.add(targetShell);
        for (const node of record.addedNodes || []) {
          if (node.nodeType !== 1) continue;
          scan(node);
          const owner = node.closest?.(SHELL_SELECTOR);
          if (owner) shells.add(owner);
        }
      }
      shells.forEach((shell) => window.setTimeout(() => installShell(shell), 0));
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-current"],
    });
  }

  function patchHistory() {
    if (historyPatched || !window.history) return;
    historyPatched = true;
    for (const methodName of ["pushState", "replaceState"]) {
      const original = window.history[methodName];
      if (typeof original !== "function") continue;
      window.history[methodName] = function (...args) {
        const result = original.apply(this, args);
        window.setTimeout(install, 0);
        return result;
      };
    }
    window.addEventListener("popstate", () => window.setTimeout(install, 0));
  }

  function install() {
    patchHistory();
    scan();
    startObserver();
  }

  window.EdgeSuiteNavigation = Object.assign(window.EdgeSuiteNavigation || {}, {
    install,
    setCollapsed(shell, collapsed) {
      if (shell instanceof Element) applyState(shell, Boolean(collapsed));
    },
    isCollapsed(shell) {
      return Boolean(shell instanceof Element && shell.classList.contains(COLLAPSED_CLASS));
    },
    syncActiveSection(shell) {
      if (shell instanceof Element) syncAccordionToActive(shell);
    },
  });

  for (const eventName of ["page-change", "desktop_screen", "sidebar_setup"]) {
    document.addEventListener(eventName, () => window.setTimeout(install, 0));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
