# Frappe v16.50 UI local validation

This validation is local-only. Do not use it on client cloud sites until the compatibility gates below pass.

## Repository validation

Keep the compatibility pull request in draft until local validation is complete. Standard pull-request CI must pass before the branch is used for product compatibility work. The full clean-bench Frappe integration check remains an additional gate and does not replace the local v16.50 validation below.

## Create an isolated bench

```bash
cd ~
bench init frappe-bench-v1650 --frappe-branch version-16
cd ~/frappe-bench-v1650

bench get-app erpnext --branch version-16

git -C apps/frappe fetch --tags
git -C apps/frappe switch -c local/v16.50-canary v16.50.0

git -C apps/erpnext fetch --tags
git -C apps/erpnext switch -c local/v16.50-canary v16.50.0
```

Confirm the versions before installing ProcessEdge apps:

```bash
bench version
node --version
```

Node must be at least `20.19.0` before building the Frappe UI 1.0 canary.

## Install EdgeSuite UI only

```bash
cd ~/frappe-bench-v1650
bench get-app https://github.com/olayemigod/processedge-edge-suite-ui.git \
  --branch agent/frappe-v1650-ui-canary

bench new-site edge1650.local
bench --site edge1650.local install-app edgesuite_ui
bench --site edge1650.local migrate
bench build --app edgesuite_ui
bench --site edge1650.local clear-cache
```

Run the EdgeSuite checks:

```bash
cd ~/frappe-bench-v1650/apps/edgesuite_ui
npm ci
npm test
```

The output must include:

```text
Frappe Desk UI adapter checks passed.
```

## Verify native Desk UI capabilities

Open `edge1650.local` and sign in. In the browser console run:

```javascript
window.EdgeSuiteUI.getAdapter("frappe-desk-ui").capabilities()
```

On Frappe v16.50 the expected result is:

```javascript
{
  dropdown: true,
  contextMenu: true,
  toast: true
}
```

Also confirm the Framework Component Explorer opens and that Dropdown, Context Menu and Toast examples render in both light and dark mode.

The adapter must remain safe on older v16 builds. If a native component does not exist, the corresponding EdgeSuite adapter call returns `null` rather than failing the product page.

## Build the isolated Frappe UI 1.0 canary

The canary is not included in the normal EdgeSuite bundle and is not loaded by product apps.

```bash
cd ~/frappe-bench-v1650/apps/edgesuite_ui/frontend-canary
yarn install
yarn build
```

The build must resolve all of the following from one host dependency graph:

- Vue 3.5+
- Frappe UI 1.0
- `@framework/ui` linked from `apps/frappe/ui`
- Vue Router 4
- Tailwind 3.4
- Vite 7

Frappe v16.50.0 has a known root-barrel compatibility edge: the `@framework/ui` root reaches `ActivityTimeline/CommentItem.vue`, which still imports the removed `frappe-ui/editor-style.css` subpath. Frappe later fixed this upstream by dropping that redundant stylesheet import because `frappe-ui/editor` already loads the editor styles. Do not patch the pinned Framework release or downgrade Frappe UI for this canary. Consume explicit published Framework UI subpaths such as `@framework/ui/FormLayout` until the upstream fix is present in the tested Framework release.

For a visual primitive check:

```bash
yarn dev
```

Open the URL printed by Vite. Confirm the page renders the Frappe UI button and form control with semantic styling and without Vue duplication, unresolved-package, router-injection or Tailwind token errors in the console.

The canary includes `FormLayout` from the explicit `@framework/ui/FormLayout` export in the compiled graph but intentionally does not mount it in the standalone visual check because full form rendering requires a live Frappe document/meta contract.

## Promotion gates

Do not upgrade any client cloud site until all of these pass:

1. EdgeSuite root checks pass on the isolated v16.50 bench.
2. Native Desk UI capabilities are detected without changing existing EdgeSuite behaviour.
3. The Frappe UI 1.0 canary builds with a single Vue runtime.
4. Light and dark mode render correctly.
5. RetailEdge installs on a separate local v16.50 site and passes its automated tests.
6. RetailEdge role/persona permission checks pass for read-only, write, create, submit and denied access cases.
7. RetailEdge Quick Entry and persistent-page navigation remain correct.
8. Reporting, fuzzy date controls, branch context, printing and document workflows remain correct.
9. EduEdge and VetEdge local smoke tests pass on the same Framework baseline.
10. Upgrade and rollback are proven on disposable local site copies before any staging or client deployment.

## Consumption rule

Product apps continue to consume EdgeSuite components and adapters. They must not call new Frappe Desk UI APIs or import `frappe-ui` / `@framework/ui` directly unless a product-specific requirement is explicitly approved.

Within EdgeSuite, prefer explicit published `@framework/ui` subpath exports over the package root while validating Frappe v16.50.0. Do not rely on the v16.50.0 root barrel until the upstream editor-style fix is included in the selected Framework release.

EdgeSuite may progressively delegate its internal primitives to Framework-native implementations after local compatibility is proven. Product workflow, permissions, navigation policy, branch context, reporting, printing and smart date behaviour remain owned by EdgeSuite or the product app as appropriate.
