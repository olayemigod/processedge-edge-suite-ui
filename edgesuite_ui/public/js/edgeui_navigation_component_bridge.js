(function () {
  "use strict";

  if (typeof window === "undefined") return;

  const BRIDGE_MARK = "__edgeNavigationComponentBridge";

  function runtime() {
    return window.EdgeSuiteUI || window.EdgeUI || null;
  }

  function normalizeRoute(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin) return raw;
      if (url.pathname === "/app" || url.pathname.startsWith("/app/")) {
        url.pathname = `/desk${url.pathname.slice(4)}`;
      }
      const pathname = (url.pathname.replace(/\/+$/, "") || "/");
      const params = [...url.searchParams.entries()].sort(([aKey, aValue], [bKey, bValue]) => {
        const keyOrder = aKey.localeCompare(bKey);
        return keyOrder || aValue.localeCompare(bValue);
      });
      const search = params.length
        ? `?${params.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")}`
        : "";
      return `${pathname}${search}`;
    } catch (_error) {
      return raw.replace(/^\/app(?=\/|$)/, "/desk").replace(/\/+$/, "");
    }
  }

  function routeParts(value) {
    const normalized = normalizeRoute(value);
    if (!normalized) return { normalized: "", pathname: "", params: new URLSearchParams() };
    try {
      const url = new URL(normalized, window.location.origin);
      return {
        normalized,
        pathname: url.pathname.replace(/\/+$/, "") || "/",
        params: new URLSearchParams(url.search),
      };
    } catch (_error) {
      return { normalized, pathname: normalized.split("?")[0], params: new URLSearchParams() };
    }
  }

  function flattenItems(menuItems) {
    const result = [];
    for (const entry of Array.isArray(menuItems) ? menuItems : []) {
      if (!entry || entry.visible === false || entry.hidden === 1) continue;
      if (Array.isArray(entry.items)) {
        for (const item of entry.items) {
          if (item?.route) result.push(item);
        }
      } else if (entry.route) {
        result.push(entry);
      }
    }
    return result;
  }

  function paramsSubset(candidate, current) {
    for (const [key, value] of candidate.entries()) {
      if (current.get(key) !== value) return false;
    }
    return true;
  }

  function resolveActiveRoute(attrs) {
    const items = flattenItems(attrs?.menuItems);
    if (!items.length) return attrs?.activeRoute || "";

    const current = routeParts(`${window.location.pathname}${window.location.search}`);
    const supplied = routeParts(attrs?.activeRoute || "");
    const candidates = items
      .map((item, index) => ({ item, index, parts: routeParts(item.route) }))
      .filter((entry) => entry.parts.normalized);

    const exactCurrent = candidates.find((entry) => entry.parts.normalized === current.normalized);
    if (exactCurrent) return exactCurrent.item.route;

    const suppliedMatch = candidates.find((entry) => entry.parts.normalized === supplied.normalized);
    if (suppliedMatch) return suppliedMatch.item.route;

    const samePath = candidates.filter((entry) => entry.parts.pathname === current.pathname);
    if (samePath.length) {
      const subsetMatches = samePath
        .filter((entry) => paramsSubset(entry.parts.params, current.params))
        .sort((a, b) => [...b.parts.params.keys()].length - [...a.parts.params.keys()].length || a.index - b.index);
      if (subsetMatches.length) return subsetMatches[0].item.route;

      // A route such as /desk/vetedge-resource-center defaults to the first
      // resource item when no query-string discriminator has been supplied.
      if (![...current.params.keys()].length) return samePath[0].item.route;
    }

    return attrs?.activeRoute || "";
  }

  function refreshDomNavigation() {
    window.setTimeout(() => {
      window.EdgeSuiteNavigation?.install?.();
    }, 0);
  }

  function installComponentBridge() {
    const edgeUI = runtime();
    const OriginalShell = edgeUI?.components?.EdgeAppShell;
    const Vue = edgeUI?.Vue;
    if (!edgeUI?.registerComponent || !OriginalShell || !Vue?.defineComponent || !Vue?.h) return false;
    if (OriginalShell[BRIDGE_MARK]) return true;

    const NavigationAwareEdgeAppShell = Vue.defineComponent({
      name: "NavigationAwareEdgeAppShell",
      inheritAttrs: false,
      setup(_props, context) {
        Vue.onMounted?.(refreshDomNavigation);
        Vue.onUpdated?.(refreshDomNavigation);
        return () => {
          const attrs = context.attrs || {};
          const activeRoute = resolveActiveRoute(attrs);
          return Vue.h(
            OriginalShell,
            {
              ...attrs,
              activeRoute,
            },
            context.slots,
          );
        };
      },
    });

    NavigationAwareEdgeAppShell[BRIDGE_MARK] = true;
    NavigationAwareEdgeAppShell.__edgeNavigationOriginalShell = OriginalShell;
    edgeUI.registerComponent("EdgeAppShell", NavigationAwareEdgeAppShell, { replace: true });
    refreshDomNavigation();
    return true;
  }

  function install() {
    const installed = installComponentBridge();
    refreshDomNavigation();
    return installed;
  }

  window.EdgeSuiteNavigationComponentBridge = Object.assign(
    window.EdgeSuiteNavigationComponentBridge || {},
    {
      install,
      normalizeRoute,
      resolveActiveRoute,
    },
  );

  for (const eventName of ["page-change", "desktop_screen", "sidebar_setup", "toolbar_setup"]) {
    document.addEventListener(eventName, () => window.setTimeout(install, 0));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
