import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const recoveryPath = new URL(
  "../edgesuite_ui/public/js/edgeui/product_menu_global_action_recovery.js",
  import.meta.url,
);
const bundlePath = new URL("../edgesuite_ui/public/js/edgeui.bundle.js", import.meta.url);

const [recovery, bundle] = await Promise.all([
  readFile(recoveryPath, "utf8"),
  readFile(bundlePath, "utf8"),
]);

assert.match(recovery, /const GLOBAL_ACTION_ID = "edge-product-global-action"/);
assert.match(recovery, /runtime\?\.getProductMenuConfig\?\.\(\)\?\.global_action/);
assert.match(recovery, /if \(document\.getElementById\(GLOBAL_ACTION_ID\)\) return true/);
assert.match(recovery, /runtime\.refreshProductMenu\?\.\(\)/);
assert.match(recovery, /runtime\.mountProductMenu\?\.\(\)/);
assert.match(recovery, /new target\.MutationObserver/);
assert.match(recovery, /observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
assert.match(recovery, /runtime\.recoverProductMenuGlobalAction = repair/);

assert.match(
  bundle,
  /import \{ installProductMenuGlobalActionRecovery \} from "\.\/edgeui\/product_menu_global_action_recovery";/,
);
assert.match(bundle, /installProductMenuGlobalActionRecovery\(runtime, globalThis\);/);
assert.match(bundle, /export \* from "\.\/edgeui\/product_menu_global_action_recovery";/);

console.log("Product menu global action recovery checks passed.");
