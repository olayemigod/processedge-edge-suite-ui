function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRoute(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .split(/[?#]/, 1)[0]
    .replace(/^\/+/, "")
    .toLowerCase();
}

function routeFromTarget(target) {
  const frappeRoute = target.frappe?.get_route?.();
  if (Array.isArray(frappeRoute) && frappeRoute.length) {
    return frappeRoute.map((part) => String(part || "")).join("/");
  }
  return target.location?.pathname || "";
}

function routeMatches(pattern, route) {
  const normalizedPattern = normalizeRoute(pattern);
  const normalizedRoute = normalizeRoute(route);
  if (!normalizedPattern || !normalizedRoute) return false;
  if (!normalizedPattern.includes("*")) {
    return normalizedRoute === normalizedPattern || normalizedRoute.startsWith(`${normalizedPattern}/`);
  }
  const escaped = normalizedPattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`).test(normalizedRoute);
}

function normalizeDescriptor(descriptor = {}) {
  if (!descriptor || typeof descriptor !== "object") {
    throw new TypeError("registerProduct() requires a product descriptor");
  }
  const key = normalizeKey(
    descriptor.key || descriptor.product_key || descriptor.product || descriptor.label,
  );
  if (!key) throw new TypeError("Product key must be a non-empty value");
  const label = String(descriptor.label || descriptor.product || key).trim() || key;
  const homeRoute = String(descriptor.home_route || descriptor.homeRoute || "").trim();
  const routePatterns = Array.isArray(descriptor.route_patterns || descriptor.routePatterns)
    ? [...(descriptor.route_patterns || descriptor.routePatterns)].filter(Boolean).map(String)
    : homeRoute
      ? [homeRoute]
      : [];
  return {
    ...descriptor,
    key,
    product_key: key,
    label,
    product: label,
    icon: String(descriptor.icon || "apps").trim() || "apps",
    home_route: homeRoute,
    route_patterns: routePatterns,
    available: descriptor.available !== false,
    activate: typeof descriptor.activate === "function" ? descriptor.activate : null,
  };
}

function normalizeAvailableProduct(product = {}) {
  const descriptor = normalizeDescriptor(product);
  return {
    key: descriptor.key,
    product_key: descriptor.key,
    label: descriptor.label,
    product: descriptor.product,
    icon: descriptor.icon,
    home_route: descriptor.home_route,
    route_patterns: descriptor.route_patterns,
    available: true,
  };
}

export function createProductContextController({ target = globalThis } = {}) {
  const descriptors = new Map();
  const authoritativeAvailability = new Map();
  const listeners = new Set();
  let availabilityResolved = false;
  let activeProductKey = "";
  let switching = false;

  function availableRecords() {
    if (availabilityResolved) return Array.from(authoritativeAvailability.values());
    return Array.from(descriptors.values())
      .filter((descriptor) => descriptor.available !== false)
      .map(normalizeAvailableProduct);
  }

  function combinedProduct(record) {
    if (!record) return null;
    const descriptor = descriptors.get(record.key) || {};
    return {
      ...descriptor,
      ...record,
      key: record.key,
      product_key: record.key,
      label: record.label || descriptor.label || record.key,
      product: record.product || record.label || descriptor.product || record.key,
      home_route: record.home_route || descriptor.home_route || "",
      route_patterns:
        record.route_patterns?.length ? record.route_patterns : descriptor.route_patterns || [],
      available: true,
    };
  }

  function getAvailableProducts() {
    return availableRecords().map(combinedProduct).filter(Boolean);
  }

  function isAvailable(key) {
    const normalizedKey = normalizeKey(key);
    return getAvailableProducts().some((product) => product.key === normalizedKey);
  }

  function firstAvailableKey() {
    return getAvailableProducts()[0]?.key || "";
  }

  function ensureActiveProduct(preferredKey = "") {
    const preferred = normalizeKey(preferredKey);
    if (preferred && isAvailable(preferred)) activeProductKey = preferred;
    if (!activeProductKey || !isAvailable(activeProductKey)) {
      activeProductKey = firstAvailableKey();
    }
    return getActiveProduct();
  }

  function getActiveProduct() {
    if (!activeProductKey) return null;
    const record = availableRecords().find((product) => product.key === activeProductKey);
    return combinedProduct(record);
  }

  function notify(reason, previousKey = "") {
    const detail = {
      reason,
      previous_product: previousKey || null,
      active_product: getActiveProduct(),
      available_products: getAvailableProducts(),
    };
    listeners.forEach((listener) => listener(detail));
    try {
      target.document?.dispatchEvent?.(
        new target.CustomEvent("edgesuite:product-context-changed", { detail }),
      );
    } catch (_error) {
      // CustomEvent may be unavailable in non-browser contract tests.
    }
    return detail;
  }

  function registerProduct(descriptor) {
    const normalized = normalizeDescriptor(descriptor);
    descriptors.set(normalized.key, {
      ...(descriptors.get(normalized.key) || {}),
      ...normalized,
    });
    const previousKey = activeProductKey;
    ensureActiveProduct(normalized.active ? normalized.key : activeProductKey);
    notify("registration", previousKey);
    return combinedProduct(normalizeAvailableProduct(descriptors.get(normalized.key)));
  }

  function setAvailableProducts(payload = {}) {
    const source = Array.isArray(payload)
      ? { available_products: payload }
      : payload && typeof payload === "object"
        ? payload
        : {};
    const products = Array.isArray(source.available_products)
      ? source.available_products
      : Array.isArray(source.products)
        ? source.products
        : [];
    authoritativeAvailability.clear();
    products.forEach((product) => {
      const normalized = normalizeAvailableProduct(product);
      authoritativeAvailability.set(normalized.key, normalized);
    });
    availabilityResolved = true;
    const previousKey = activeProductKey;
    ensureActiveProduct(source.active_product || source.activeProduct || activeProductKey);
    notify("availability", previousKey);
    return getState();
  }

  function clearAvailableProducts() {
    const previousKey = activeProductKey;
    authoritativeAvailability.clear();
    availabilityResolved = false;
    ensureActiveProduct(activeProductKey);
    notify("availability-reset", previousKey);
    return getState();
  }

  function resolveProductFromRoute(route = routeFromTarget(target)) {
    const normalizedRoute = normalizeRoute(route);
    if (!normalizedRoute) return null;
    const matches = getAvailableProducts().filter((product) =>
      (product.route_patterns || []).some((pattern) => routeMatches(pattern, normalizedRoute)),
    );
    matches.sort((left, right) => {
      const leftLength = Math.max(0, ...(left.route_patterns || []).map((item) => String(item).length));
      const rightLength = Math.max(0, ...(right.route_patterns || []).map((item) => String(item).length));
      return rightLength - leftLength;
    });
    return matches[0] || null;
  }

  function activateFromRoute(route = routeFromTarget(target)) {
    const product = resolveProductFromRoute(route);
    if (!product || product.key === activeProductKey) return product;
    const previousKey = activeProductKey;
    activeProductKey = product.key;
    notify("route", previousKey);
    return product;
  }

  function navigate(homeRoute) {
    if (!homeRoute) return false;
    if (typeof target.location?.assign === "function") {
      target.location.assign(homeRoute);
      return true;
    }
    if (target.frappe?.set_route) {
      target.frappe.set_route(...homeRoute.replace(/^\/+/, "").split("/").filter(Boolean));
      return true;
    }
    return false;
  }

  async function switchProduct(key, options = {}) {
    const normalizedKey = normalizeKey(key);
    const selected = getAvailableProducts().find((product) => product.key === normalizedKey);
    if (!selected) {
      throw new Error("This product is not currently available.");
    }
    if (switching) return getActiveProduct();
    if (selected.key === activeProductKey && options.force !== true) return selected;

    switching = true;
    const previousKey = activeProductKey;
    try {
      const descriptor = descriptors.get(selected.key) || selected;
      const activationResult = descriptor.activate
        ? await descriptor.activate({
            product: selected,
            previous_product: getActiveProduct(),
            available_products: getAvailableProducts(),
          })
        : null;
      activeProductKey = selected.key;
      notify("switch", previousKey);
      if (options.navigate !== false) {
        const route = activationResult?.home_route || activationResult?.route || selected.home_route;
        navigate(route);
      }
      return getActiveProduct();
    } finally {
      switching = false;
    }
  }

  function onChange(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Product context listener must be a function");
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getState() {
    return {
      availability_resolved: availabilityResolved,
      switching,
      active_product: getActiveProduct(),
      available_products: getAvailableProducts(),
      registered_products: Array.from(descriptors.keys()),
    };
  }

  return {
    registerProduct,
    setAvailableProducts,
    clearAvailableProducts,
    getAvailableProducts,
    getActiveProduct,
    getState,
    isAvailable,
    ensureActiveProduct,
    resolveProductFromRoute,
    activateFromRoute,
    switchProduct,
    onChange,
  };
}

export { normalizeKey as normalizeProductKey, normalizeRoute as normalizeProductRoute, routeMatches };
