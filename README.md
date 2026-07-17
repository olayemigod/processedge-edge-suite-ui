# EdgeSuite UI

EdgeSuite UI is the independent, versioned user-interface runtime for ProcessEdge product applications.

It is intentionally separated from CoreEdge. Product applications such as VetEdge and RetailEdge install and serve EdgeSuite UI locally, so their operational pages remain usable when the central CoreEdge platform is unavailable.

## Architectural rules

- EdgeSuite UI must not import files from CoreEdge or any product application.
- Product applications own their pages, workflows, data access, and product bundles.
- EdgeSuite UI owns shared visual tokens, reusable Vue components, the application mounting contract, and Frappe Desk integration.
- CoreEdge is an optional platform-service provider. Platform context is injected through adapters rather than imported into the UI runtime.
- Runtime assets are served locally from the installed `edgesuite_ui` Frappe app.
- `window.EdgeSuiteUI` is the canonical browser namespace.
- `window.EdgeUI` is retained as a temporary compatibility alias during migration.

## Foundation included

Version `0.1.0` provides:

- An installable Frappe app with locally served JS and CSS bundles.
- A Vue runtime exposed through `window.EdgeSuiteUI`.
- The compatible `window.EdgeUI` alias and `createEdgeApp(rootComponent, props)` contract.
- Component and optional adapter registries.
- Initial shared components: app shell, page and dashboard layouts, page header, stat card, status badge, action bar, filter bar, and loading/empty/error states.
- Design tokens and responsive base styles.
- Regression tests that block imports from CoreEdge and product repositories.

## Installation during development

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/olayemigod/processedge-edge-suite-ui.git --branch agent/edgeui-foundation
bench --site vetedge.local install-app edgesuite_ui
bench build --app edgesuite_ui
bench --site vetedge.local clear-cache
```

The same app can be installed on RetailEdge or another product site without installing CoreEdge.

## Product integration

Load `edgeui.bundle.js` before the product bundle, then mount the product-owned root component:

```javascript
const app = window.EdgeSuiteUI.createEdgeApp(ProductPage, props);
app.mount(targetElement);
```

See [`docs/integration-contract.md`](docs/integration-contract.md) for the complete boundary and fallback rules.

## Migration sequence

1. Establish the standalone runtime and asset contract in this repository. **Completed in v0.1 foundation.**
2. Port the remaining shared components from CoreEdge without product or platform coupling.
3. Install EdgeSuite UI beside VetEdge and migrate the Stock Expiry Monitor as the reference integration.
4. Migrate RetailEdge pages.
5. Remove legacy EdgeUI asset delivery from CoreEdge after all consumers have moved.
