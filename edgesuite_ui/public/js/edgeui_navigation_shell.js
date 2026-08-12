(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;

  const SHELL_SELECTOR = ".edge-app-shell";
  const SIDEBAR_SELECTOR = ".edge-sidebar";
  const BRAND_SELECTOR = ".edge-sidebar__brand";
  const SECTION_TOGGLE_SELECTOR = ".edge-sidebar__section-toggle";
  const ITEM_SELECTOR = ".edge-sidebar-item";
  const ENHANCED_CLASS = "edge-nav-shell-v2";
  const COLLAPSED_CLASS = "edge-nav-shell--collapsed";
  const TOGGLE_CLASS = "edge-nav-shell-toggle";
  const DESKTOP_QUERY = "(min-width: 62rem)";
  const installed = new WeakSet();
  let observer = null;

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

    shell.classList.toggle(COLLAPSED_CLASS, effectiveCollapsed);
    shell.dataset.edgeNavCollapsed = effectiveCollapsed ? "1" : "0";
    if (sidebar) sidebar.dataset.edgeNavCollapsed = effectiveCollapsed ? "1" : "0";

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
        applyState(shell, false);
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
    bindRailSectionExpansion(shell);
    bindResponsiveState(shell);

    if (!installed.has(shell)) {
      installed.add(shell);
      applyState(shell, readCollapsed(shell), { persist: false });
    } else {
      updateTooltips(shell, shell.classList.contains(COLLAPSED_CLASS));
    }
  }

  function scan(root = document) {
    root.querySelectorAll?.(SHELL_SELECTOR).forEach(installShell);
    if (root.matches?.(SHELL_SELECTOR)) installShell(root);
  }

  function startObserver() {
    if (observer || !document.body || !window.MutationObserver) return;
    observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes || []) {
          if (node.nodeType === 1) scan(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function install() {
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
