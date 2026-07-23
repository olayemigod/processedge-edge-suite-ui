import * as Vue from "vue";

import { createProductContextController } from "./product_context";
import { createProductMenuController } from "./product_menu";

function assertName(name, kind) {
  if (typeof name !== "string" || !name.trim()) {
    throw new TypeError(`${kind} name must be a non-empty string`);
  }
  return name.trim();
}

export function createEdgeSuiteRuntime({ version, components = {} } = {}) {
  if (typeof version !== "string" || !version.trim()) {
    throw new TypeError("EdgeSuite UI runtime requires a version");
  }

  const componentRegistry = Object.create(null);
  const adapterRegistry = Object.create(null);
  const target = typeof globalThis !== "undefined" ? globalThis : {};
  const productContext = createProductContextController({ target });
  const productMenu = createProductMenuController({ target, productContext });

  const runtime = {
    version: version.trim(),
    Vue,
    createApp: Vue.createApp,
    components: componentRegistry,
    adapters: adapterRegistry,

    install(app) {
      if (!app || typeof app.component !== "function") {
        throw new TypeError("EdgeSuite UI install() requires a Vue application instance");
      }

      Object.entries(componentRegistry).forEach(([name, component]) => {
        app.component(name, component);
      });

      return app;
    },

    createEdgeApp(rootComponent, rootProps = null) {
      if (!rootComponent) {
        throw new TypeError("createEdgeApp() requires a root Vue component");
      }

      const app = Vue.createApp(rootComponent, rootProps || {});
      runtime.install(app);
      return app;
    },

    registerComponent(name, component, { replace = false } = {}) {
      const normalizedName = assertName(name, "Component");
      if (!component) {
        throw new TypeError(`Component ${normalizedName} is required`);
      }
      if (componentRegistry[normalizedName] && !replace) {
        throw new Error(`Component ${normalizedName} is already registered`);
      }

      componentRegistry[normalizedName] = component;
      runtime[normalizedName] = component;
      return component;
    },

    hasComponent(name) {
      return Boolean(componentRegistry[name]);
    },

    getComponent(name) {
      return componentRegistry[name] || null;
    },

    registerAdapter(name, adapter, { replace = false } = {}) {
      const normalizedName = assertName(name, "Adapter");
      if (!adapter || typeof adapter !== "object") {
        throw new TypeError(`Adapter ${normalizedName} must be an object`);
      }
      if (adapterRegistry[normalizedName] && !replace) {
        throw new Error(`Adapter ${normalizedName} is already registered`);
      }

      adapterRegistry[normalizedName] = adapter;
      return adapter;
    },

    getAdapter(name) {
      return adapterRegistry[name] || null;
    },

    registerProduct(descriptor) {
      return productContext.registerProduct(descriptor);
    },

    setAvailableProducts(payload) {
      return productContext.setAvailableProducts(payload);
    },

    clearAvailableProducts() {
      return productContext.clearAvailableProducts();
    },

    getAvailableProducts() {
      return productContext.getAvailableProducts();
    },

    getActiveProduct() {
      return productContext.getActiveProduct();
    },

    getProductContextState() {
      return productContext.getState();
    },

    switchProduct(productKey, options = {}) {
      return productContext.switchProduct(productKey, options);
    },

    resolveProductFromRoute(route) {
      return productContext.resolveProductFromRoute(route);
    },

    refreshActiveProductFromRoute(route) {
      return productContext.activateFromRoute(route);
    },

    onProductContextChange(listener) {
      return productContext.onChange(listener);
    },

    registerProductMenu(config) {
      return productMenu.register(config);
    },

    mountProductMenu() {
      return productMenu.mount();
    },

    refreshProductMenu() {
      return productMenu.refresh();
    },

    openProductMenu() {
      return productMenu.open();
    },

    closeProductMenu() {
      return productMenu.close();
    },

    toggleProductMenu() {
      return productMenu.toggle();
    },

    destroyProductMenu() {
      return productMenu.destroy();
    },

    getProductMenuConfig() {
      return productMenu.getConfig();
    },
  };

  Object.entries(components).forEach(([name, component]) => {
    runtime.registerComponent(name, component);
  });

  return runtime;
}

export function exposeEdgeSuiteRuntime(runtime, target = globalThis) {
  if (!runtime || typeof runtime.createEdgeApp !== "function") {
    throw new TypeError("A valid EdgeSuite UI runtime is required");
  }

  target.EdgeSuiteUI = runtime;

  // Temporary migration alias for product bundles that still read window.EdgeUI.
  target.EdgeUI = runtime;

  return runtime;
}
