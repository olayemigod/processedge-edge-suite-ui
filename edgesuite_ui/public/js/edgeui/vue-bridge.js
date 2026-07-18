// Shared Vue compatibility bridge for all EdgeSuite product bundles.
//
// Product loaders load edgeui.bundle.js before their own bundle. This module keeps
// the Vue runtime local to EdgeSuite UI and publishes the browser-compatible
// window.Vue surface without importing any CoreEdge frontend asset.
import * as Vue from "../../../../node_modules/vue/dist/vue.runtime.esm-bundler.js";

export * from "../../../../node_modules/vue/dist/vue.runtime.esm-bundler.js";
export { Vue };
export default Vue;

export function exposeVueBridge(target = globalThis) {
  if (!target) return Vue;

  // Preserve an existing compatible runtime, but always make the shared bridge
  // available when the product site does not already expose Vue.
  target.Vue = target.Vue || Vue;
  return target.Vue;
}
