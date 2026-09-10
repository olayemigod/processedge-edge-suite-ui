const SIDEBAR_OPEN_SECTION_KEY = "edgeOpenSidebarSection";
const SIDEBAR_RECONCILING_KEY = "edgeSidebarReconciling";
const SIDEBAR_ROUTE_PENDING_KEY = "edgeRoutePending";
const SIDEBAR_MANUAL_COLLAPSED_KEY = "edgeSidebarManualCollapsed";
const ROUTE_EVENT = "edgesuite-navigation-route-change";

function sectionIdentity(section) {
  if (!section) return "";
  return String(
    section.dataset?.sectionKey ||
      section.getAttribute?.("data-section-key") ||
      section.getAttribute?.("aria-label") ||
      section.querySelector?.(".edge-sidebar__section-title")?.textContent ||
      section.querySelector?.(".edge-sidebar__section-toggle")?.textContent ||
      "",
  ).trim();
}

function sectionExpanded(section) {
  const items = section?.querySelector?.(".edge-sidebar__items");
  return Boolean(section && !section.classList.contains("is-collapsed") && !items?.hidden);
}

function applySectionDomState(section, expanded) {
  if (!section) return;
  const toggle = section.querySelector?.(".edge-sidebar__section-toggle");
  const items = section.querySelector?.(".edge-sidebar__items");
  section.classList.toggle("is-expanded", expanded);
  section.classList.toggle("is-collapsed", !expanded);
  toggle?.setAttribute("aria-expanded", expanded ? "true" : "false");
  if (items) items.hidden = !expanded;
}

function setSectionExpanded(shell, section, expanded) {
  if (!shell || !section || sectionExpanded(section) === expanded) return;
  const toggle = section.querySelector?.(".edge-sidebar__section-toggle");
  if (!toggle) {
    applySectionDomState(section, expanded);
    return;
  }
  shell.dataset[SIDEBAR_RECONCILING_KEY] = "1";
  try {
    toggle.click();
    // Vue normally owns this state. During remounts or legacy/static shells the
    // click handler may not be attached yet, so reconcile the DOM immediately
    // instead of leaving a stale section expanded.
    if (sectionExpanded(section) !== expanded) applySectionDomState(section, expanded);
  } finally {
    delete shell.dataset[SIDEBAR_RECONCILING_KEY];
  }
}

function activeSection(sections) {
  return sections.find((section) =>
    section.querySelector('.edge-sidebar-item.active, .edge-sidebar-item[aria-current="page"]'),
  );
}

function enforceSidebar(shell) {
  if (!shell) return;
  shell.dataset.edgeMultiSection = "true";
  const sections = [...shell.querySelectorAll(".edge-sidebar__section")];
  if (!sections.length) return;

  const preferredIdentity = shell.dataset[SIDEBAR_OPEN_SECTION_KEY] || "";
  const preferred = preferredIdentity
    ? sections.find((section) => sectionIdentity(section) === preferredIdentity)
    : null;
  if (preferredIdentity && !preferred) delete shell.dataset[SIDEBAR_OPEN_SECTION_KEY];

  const active = activeSection(sections);
  const routePending = shell.dataset[SIDEBAR_ROUTE_PENDING_KEY] === "1";
  const manualCollapsed = shell.dataset[SIDEBAR_MANUAL_COLLAPSED_KEY] === "1";
  const expanded = sections.filter(sectionExpanded);

  // Navigation has priority exactly once. After the route has settled, users
  // may manually inspect another section or collapse every section, including
  // the section containing the current route.
  let keep = manualCollapsed ? null : preferred || expanded[0] || null;
  if (routePending && active) {
    keep = active;
    delete shell.dataset[SIDEBAR_OPEN_SECTION_KEY];
    delete shell.dataset[SIDEBAR_MANUAL_COLLAPSED_KEY];
    delete shell.dataset[SIDEBAR_ROUTE_PENDING_KEY];
  }

  if (keep && !sectionExpanded(keep)) setSectionExpanded(shell, keep, true);
  for (const section of sections) {
    if (section !== keep && sectionExpanded(section)) setSectionExpanded(shell, section, false);
  }
}

export function installSidebarAccordionRuntime(target = globalThis) {
  const document = target?.document;
  if (!document || target.__edgeSuiteSidebarAccordionRuntimeBound) return;
  target.__edgeSuiteSidebarAccordionRuntimeBound = true;

  let scheduled = false;
  const enforceAll = () => {
    scheduled = false;
    document.querySelectorAll(".edge-app-shell").forEach(enforceSidebar);
  };
  const scheduleEnforce = () => {
    if (scheduled) return;
    scheduled = true;
    const schedule = target.requestAnimationFrame || ((callback) => target.setTimeout?.(callback, 0));
    schedule?.(enforceAll);
  };

  document.addEventListener(
    "click",
    (event) => {
      const toggle = event.target?.closest?.(".edge-sidebar__section-toggle");
      if (!toggle) return;
      const section = toggle.closest(".edge-sidebar__section");
      const shell = toggle.closest(".edge-app-shell");
      if (!section || !shell || shell.dataset[SIDEBAR_RECONCILING_KEY] === "1") return;

      // In icon-rail mode a real section-header click is an expand-navigation
      // action first. Remember the chosen section so reconciliation reopens it
      // after the shell expands, even if the component's normal toggle handler
      // briefly marks that section collapsed during the same click.
      if (event.isTrusted !== false && shell.classList.contains("edge-nav-shell--collapsed")) {
        shell.dataset[SIDEBAR_OPEN_SECTION_KEY] = sectionIdentity(section);
        delete shell.dataset[SIDEBAR_MANUAL_COLLAPSED_KEY];
        scheduleEnforce();
        return;
      }

      // Product compatibility layers must not be able to undo an explicit user
      // accordion choice by calling toggle.click() from MutationObservers. The
      // shared runtime is the sole owner of section state; its own programmatic
      // clicks are allowed through SIDEBAR_RECONCILING_KEY above.
      if (
        event.isTrusted === false &&
        (shell.dataset[SIDEBAR_MANUAL_COLLAPSED_KEY] === "1" || shell.dataset[SIDEBAR_OPEN_SECTION_KEY])
      ) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        return;
      }

      if (sectionExpanded(section)) {
        delete shell.dataset[SIDEBAR_OPEN_SECTION_KEY];
        shell.dataset[SIDEBAR_MANUAL_COLLAPSED_KEY] = "1";
      } else {
        shell.dataset[SIDEBAR_OPEN_SECTION_KEY] = sectionIdentity(section);
        delete shell.dataset[SIDEBAR_MANUAL_COLLAPSED_KEY];
      }
      scheduleEnforce();
    },
    true,
  );

  const resetForNavigation = () => {
    document.querySelectorAll(".edge-app-shell").forEach((shell) => {
      delete shell.dataset[SIDEBAR_OPEN_SECTION_KEY];
      delete shell.dataset[SIDEBAR_MANUAL_COLLAPSED_KEY];
      shell.dataset[SIDEBAR_ROUTE_PENDING_KEY] = "1";
    });
    scheduleEnforce();
  };

  document.addEventListener("page-change", resetForNavigation);
  document.addEventListener(ROUTE_EVENT, resetForNavigation);
  target.frappe?.router?.on?.("change", resetForNavigation);
  if (target.MutationObserver && document.body) {
    const observer = new target.MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            record.addedNodes?.length ||
            record.removedNodes?.length ||
            (record.type === "attributes" && ["class", "hidden", "aria-expanded", "aria-current"].includes(record.attributeName)),
        )
      ) {
        scheduleEnforce();
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-expanded", "aria-current"],
    });
    target.__edgeSuiteSidebarAccordionObserver = observer;
  }
  scheduleEnforce();
}

export { SIDEBAR_OPEN_SECTION_KEY };
