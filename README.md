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

For a fresh installation:

```bash
cd ~/frappe-bench
bench get-app https://github.com/olayemigod/processedge-edge-suite-ui.git --branch agent/edgeui-foundation
bench --site vetedge.local install-app edgesuite_ui
bench build --app edgesuite_ui
bench --site vetedge.local clear-cache
```

If `bench get-app` cloned the repository but stopped during the asset build, recover without touching the VetEdge worktree:

```bash
cd ~/frappe-bench

git -C apps/edgesuite_ui status --short
git -C apps/edgesuite_ui pull --ff-only origin agent/edgeui-foundation

test -d apps/edgesuite_ui/edgesuite_ui
grep -qxF edgesuite_ui sites/apps.txt || printf '%s\n' edgesuite_ui >> sites/apps.txt

bench build --app edgesuite_ui
bench --site vetedge.local install-app edgesuite_ui
bench --site vetedge.local migrate
bench --site vetedge.local clear-cache
bench clear-website-cache
```

The `grep` guard makes registration idempotent, so it will not add a duplicate line to `sites/apps.txt`. If `git status` reports local EdgeSuite UI changes, review or commit them before pulling. Do not switch the VetEdge branch while its worktree has uncommitted changes; the EdgeSuite UI build and installation do not require a VetEdge checkout.

Validate the installed app and asset contract:

```bash
bench --site vetedge.local list-apps
bench --site vetedge.local run-tests --app edgesuite_ui
test -f sites/assets/assets.json
grep -E 'edgeui(_compat)?\.bundle\.(js|css)' sites/assets/assets.json
```

The same app can be installed on RetailEdge or another product site without installing CoreEdge.

## Continuous integration

Pull requests and pushes to `main` run Python/Ruff contract checks and a reproducible frontend
syntax and bundle validation. The manual `workflow_dispatch` trigger additionally provisions a
clean Frappe v16 bench containing only Frappe and EdgeSuite UI, then builds, migrates, and tests
the app. CI never requires repository credentials or commits generated frontend assets.

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
