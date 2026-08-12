(function () {
  "use strict";

  if (typeof window === "undefined") return;

  const BRIDGE_MARK = "__edgeNavigationComponentBridge";
  const ROUTE_EVENT = "edgesuite-navigation-route-change";

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
      const pathname = url.pathname.replace(/\/+$/, "") || "/";
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

  function parameterCount(params) {
    return [...params.keys()].length;
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

    const samePath = candidates.filter((entry) => entry.parts.pathname === current.pathname);
    if (samePath.length) {
      const subsetMatches = samePath
        .filter((entry) => paramsSubset(entry.parts.params, current.params))
        .sort((a, b) => parameterCount(b.parts.params) - parameterCount(a.parts.params) || a.index - b.index);
      if (subsetMatches.length) return subsetMatches[0].item.route;

      if (!parameterCount(current.params)) return samePath[0].item.route;
    }

    // Native Frappe document/detail routes extend the list route with a record
    // segment. Keep the corresponding sidebar item active for those child routes.
    const prefixMatches = candidates
      .filter(
        (entry) =>
          entry.parts.pathname !== "/" &&
          current.pathname.startsWith(`${entry.parts.pathname}/`) &&
          paramsSubset(entry.parts.params, current.params),
      )
      .sort(
        (a, b) =>
          b.parts.pathname.length - a.parts.pathname.length ||
          parameterCount(b.parts.params) - parameterCount(a.parts.params) ||
          a.index - b.index,
      );
    if (prefixMatches.length) return prefixMatches[0].item.route;

    // A supplied route is only trustworthy when it describes the same browser
    // path. A stale Dashboard activeRoute must never override the current page.
    const suppliedMatch = candidates.find((entry) => entry.parts.normalized === supplied.normalized);
    if (suppliedMatch && supplied.pathname === current.pathname) return suppliedMatch.item.route;

    return "";
  }

  function refreshDomNavigation() {
    window.setTimeout(() => {
      window.EdgeSuiteNavigation?.install?.();
    }, 0);
  }

  function announceRouteChange() {
    try {
      document.dispatchEvent(new CustomEvent(ROUTE_EVENT));
    } catch (_error) {
      document.dispatchEvent?.(new Event(ROUTE_EVENT));
    }
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
        const routeRevision = Vue.ref?.(0) || { value: 0 };
        const syncRoute = () => {
          routeRevision.value += 1;
          announceRouteChange();
          refreshDomNavigation();
        };

        Vue.onMounted?.(() => {
          document.addEventListener("page-change", syncRoute);
          window.addEventListener?.("popstate", syncRoute);
          window.addEventListener?.("hashchange", syncRoute);
          window.frappe?.router?.on?.("change", syncRoute);
          syncRoute();
        });
        Vue.onUpdated?.(refreshDomNavigation);
        Vue.onBeforeUnmount?.(() => {
          document.removeEventListener("page-change", syncRoute);
          window.removeEventListener?.("popstate", syncRoute);
          window.removeEventListener?.("hashchange", syncRoute);
          window.frappe?.router?.off?.("change", syncRoute);
        });

        return () => {
          // Reading the revision makes the wrapper reactive to Frappe route
          // changes even when product props themselves do not change.
          void routeRevision.value;
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
