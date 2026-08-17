# EdgeSuite UI

EdgeSuite UI is the independent, versioned user-interface runtime for ProcessEdge product applications.

It is intentionally separated from CoreEdge. Product applications such as VetEdge, RetailEdge, EduEdge, and future EdgeSuite products install and serve EdgeSuite UI locally, so operational pages remain usable when the central CoreEdge platform is unavailable.

## Architectural rules

- EdgeSuite UI must not import files from CoreEdge or any product application.
- Product applications own their pages, workflows, data access, permissions, and product bundles.
- EdgeSuite UI owns shared visual tokens, reusable Vue components, the application mounting contract, the product menu, and Frappe Desk visual integration.
- CoreEdge is an optional platform-service provider. Platform context is injected through adapters rather than imported into the UI runtime.
- Runtime assets are served locally from the installed `edgesuite_ui` Frappe app.
- `window.EdgeSuiteUI` is the canonical browser namespace.
- `window.EdgeUI` is retained as a temporary compatibility alias during migration.

## Version 0.2 professional UI

Version `0.2.0` upgrades the foundation with a simple, professional application experience inspired by the strongest VetEdge patterns while remaining product-neutral.

It provides:

- a responsive product shell with a sticky topbar and grouped navigation sidebar;
- a mobile off-canvas sidebar with accessible toggle and backdrop;
- shared SVG icons with Frappe icon reuse and an independent local fallback;
- product-brand colour overrides, including EduEdge blue and green;
- consistent page padding, section spacing, card spacing, maximum content width, radius, and shadow tokens;
- a searchable, sectioned product menu with descriptions, badges, profile context, active-route styling, and SVG icons;
- matching styling for native Frappe workspace sidebars used by EdgeSuite products;
- backward-compatible support for existing flat `menuItems` arrays and the `window.EdgeUI` alias.

The original `0.1.0` foundation remains intact: locally served assets, Vue mounting, component and adapter registries, shared page/dashboard components, and product-import isolation.

## Installation during development

For a fresh installation:

```bash
cd ~/frappe-bench
bench get-app https://github.com/olayemigod/processedge-edge-suite-ui.git --branch agent/fix-waffle-product-menu
bench --site eduedge.local install-app edgesuite_ui
bench build --app edgesuite_ui
bench --site eduedge.local clear-cache
```

For an existing checkout:

```bash
cd ~/frappe-bench

git -C apps/edgesuite_ui status --short
git -C apps/edgesuite_ui pull --ff-only origin agent/fix-waffle-product-menu

bench build --app edgesuite_ui
bench --site eduedge.local migrate
bench --site eduedge.local clear-cache
bench clear-website-cache
```

Replace `eduedge.local` with the applicable product site. If the worktree contains local changes, review or commit them before pulling.

Validate the installed app and asset contract:

```bash
bench --site eduedge.local list-apps
bench --site eduedge.local run-tests --app edgesuite_ui
test -f sites/assets/assets.json
grep -E 'edgeui(_compat|_professional)?\.bundle\.(js|css)|edgeui_professional\.css' sites/assets/assets.json
```

The app can be installed on VetEdge, RetailEdge, EduEdge, or another product site without installing CoreEdge.

## Product integration

Load `edgeui.bundle.js` before the product bundle, then mount the product-owned root component:

```javascript
const app = window.EdgeSuiteUI.createEdgeApp(ProductPage, props);
app.mount(targetElement);
```

Use grouped navigation data for the professional sidebar:

```javascript
const menuItems = [
  {
    label: "Overview",
    icon: "home",
    items: [
      {
        label: "Home",
        route: "/app/product-home",
        icon: "home",
        description: "Operational command centre",
      },
    ],
  },
];
```

Existing flat arrays remain supported by supplying `section` or `group` on each item.

The product menu uses the same section, item, icon, description, role, and route concepts through `window.EdgeSuiteUI.registerProductMenu(config)`.

See [`docs/integration-contract.md`](docs/integration-contract.md) and [`docs/professional-shell-and-menu.md`](docs/professional-shell-and-menu.md) for the complete contract.

## Shared reporting and export

The shared reporting runtime supports ordinary Frappe Query Report providers and optimized server-paginated providers. Product apps register providers under product + report keys and remain authoritative for permissions, tenant/company/branch rules and report business logic.

The shared `EdgeReportExportDialog` provides XLSX/CSV/PDF selection, current-page or all-filtered scope, raw-table vs presentation options, column selection, and PDF orientation. If all presentation options are disabled, the export contract explicitly requests the raw table only.

Generated downloads are validated before saving so empty responses, HTML error pages masquerading as files, invalid PDF/XLSX signatures and mismatched MIME types are rejected instead of being presented as successful downloads.

See [`docs/reporting-standard-v1.md`](docs/reporting-standard-v1.md) for the reporting, performance and export contract.

## Continuous integration

Pull requests and pushes to `main` run Python/Ruff contract checks and reproducible frontend syntax and bundle validation. The manual `workflow_dispatch` trigger additionally provisions a clean Frappe v16 bench containing only Frappe and EdgeSuite UI, then builds, migrates, and tests the app.

## Migration sequence

1. Establish the standalone runtime and asset contract. **Completed in v0.1.**
2. Add the professional shared shell, product menu, SVG icon system, and native sidebar styling. **Implemented in v0.2.**
3. Migrate product menu definitions and icon names in VetEdge, EduEdge, and RetailEdge.
4. Validate each product on desktop, tablet, and mobile.
5. Remove legacy product-local menu and styling fallbacks after all consumers are stable.
