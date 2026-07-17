# EdgeSuite UI integration contract

## Product ownership

Product applications own their root Vue component, API calls, workflow rules, permissions, and page loader. EdgeSuite UI provides the shared runtime and presentation components only.

## Loading the runtime

Install `edgesuite_ui` on the same Frappe site as the product application and load the local asset before the product bundle:

```javascript
await new Promise((resolve, reject) => {
  frappe.require("edgeui.bundle.js", resolve, reject);
});

if (!window.EdgeSuiteUI?.createEdgeApp) {
  throw new Error("EdgeSuite UI runtime failed to load");
}
```

During migration, existing product bundles may continue to use `window.EdgeUI`. Both names point to the same runtime object in version 0.x.

## Mounting a product page

```javascript
const app = window.EdgeSuiteUI.createEdgeApp(ProductPage, {
  pageName: "stock-expiry-monitor",
});

app.mount(targetElement);
```

Every registered base component is installed on the Vue application automatically and is also available through `window.EdgeSuiteUI.components`.

## Optional platform services

A product app may register a platform adapter at runtime:

```javascript
window.EdgeSuiteUI.registerAdapter("platform", {
  getContext: () => productPlatformService.getContext(),
  switchContext: (context) => productPlatformService.switchContext(context),
});
```

The absence or failure of this adapter must not prevent the product page from rendering. Product applications must provide a local fallback for optional platform capabilities.

## Migration constraints

- Do not import from `apps/coreedge` or another product repository.
- Do not call central CoreEdge APIs from shared components.
- Do not put product-specific business rules in EdgeSuite UI.
- Load assets from the local Frappe site.
- Keep the `window.EdgeUI` alias until VetEdge and RetailEdge consumers have migrated.
