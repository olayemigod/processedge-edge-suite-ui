const GET_CONTEXT_METHOD = "edgesuite_ui.api.product_context.get_product_context";
const SWITCH_PRODUCT_METHOD = "edgesuite_ui.api.product_context.switch_product";

function callFrappe(target, method, args = {}) {
  return new Promise((resolve, reject) => {
    if (!target.frappe?.call) {
      reject(new Error("Frappe product context API is unavailable."));
      return;
    }
    target.frappe.call({
      method,
      args,
      callback(response) {
        resolve(response?.message || {});
      },
      error(error) {
        reject(error);
      },
    });
  });
}

export function installProductContextBridge(runtime, target = globalThis) {
  if (!runtime?.setAvailableProducts || !runtime?.setProductSwitchHandler) return null;
  let loading = null;

  async function refresh() {
    if (loading) return loading;
    loading = callFrappe(target, GET_CONTEXT_METHOD)
      .then((context) => {
        runtime.setAvailableProducts(context || {});
        runtime.refreshActiveProductFromRoute?.();
        runtime.refreshProductMenu?.();
        return runtime.getProductContextState?.() || context;
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  runtime.setProductSwitchHandler(async ({ product }) => {
    const context = await callFrappe(target, SWITCH_PRODUCT_METHOD, {
      product_key: product.key || product.product_key,
    });
    runtime.setAvailableProducts(context || {});
    return context;
  });

  runtime.refreshAvailableProducts = refresh;

  const start = () => {
    refresh().catch((error) => {
      target.console?.warn?.("[EdgeSuiteUI] Product availability could not be loaded", error);
    });
  };

  if (target.document?.readyState === "loading") {
    target.document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  ["desktop_screen", "toolbar_setup"].forEach((eventName) => {
    target.document?.addEventListener?.(eventName, start);
  });

  return { refresh };
}

export { GET_CONTEXT_METHOD, SWITCH_PRODUCT_METHOD };
