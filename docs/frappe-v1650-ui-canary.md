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

The visual canary is a pure `frappe-ui@1.0.0` compatibility gate. It is not included in the normal EdgeSuite bundle and is not loaded by product apps.

```bash
cd ~/frappe-bench-v1650/apps/edgesuite_ui/frontend-canary
yarn install
yarn build
```

The build must resolve all of the following from one dependency graph:

- Vue 3.5+
- Frappe UI 1.0.0
- Vue Router 4
- Tailwind 3.4
- Vite 7

For a visual primitive check:

```bash
yarn dev
```

Open the URL printed by Vite. Confirm the page renders the Frappe UI button and form control with semantic styling and without Vue duplication, unresolved-package, router-injection or Tailwind token errors in the console.

## `@framework/ui` status on exact Frappe v16.50.0

Treat Framework UI as a separate compatibility gate from Frappe UI 1.0.

The exact Frappe v16.50.0 source has two confirmed incompatibilities with stable `frappe-ui@1.0.0`:

1. The `@framework/ui` root barrel reaches `ActivityTimeline/CommentItem.vue`, which imports the removed `frappe-ui/editor-style.css` subpath. Frappe later fixed that upstream by removing the redundant import because `frappe-ui/editor` loads its own styles.
2. The published `@framework/ui/FormLayout` subpath reaches `Fields/CodeEditorField.vue`, which imports `CodePreview` from `frappe-ui/code-editor`. Stable Frappe UI 1.0 no longer exports `CodePreview`. Frappe later rewrote this field while updating Framework UI against the Frappe UI 1.0 release-candidate API.

The `@framework/ui` package in v16.50 declares only a lower Frappe UI peer floor, so stable 1.0 satisfies dependency resolution even though these source-level API changes make the component graph fail to build.

Do not patch the pinned Framework release, add Rollup externals, restore removed Frappe UI exports, or downgrade Frappe UI to hide this mismatch. On exact Frappe v16.50.0, `@framework/ui` component adoption is blocked. Re-test it on a later Frappe v16 patch release that contains the upstream compatibility fixes, or on a separate disposable patched-Framework experiment without changing the baseline canary.

## Promotion gates

Do not upgrade any client cloud site until all of these pass:

1. EdgeSuite root checks pass on the isolated v16.50 bench.
2. Native Desk UI capabilities are detected without changing existing EdgeSuite behaviour.
3. The pure Frappe UI 1.0 canary builds with a single Vue runtime.
4. Light and dark mode render correctly.
5. RetailEdge installs on a separate local v16.50 site and passes its automated tests.
6. RetailEdge role/persona permission checks pass for read-only, write, create, submit and denied access cases.
7. RetailEdge Quick Entry and persistent-page navigation remain correct.
8. Reporting, fuzzy date controls, branch context, printing and document workflows remain correct.
9. EduEdge and VetEdge local smoke tests pass on the same Framework baseline.
10. Upgrade and rollback are proven on disposable local site copies before any staging or client deployment.

`@framework/ui` component adoption is not a promotion requirement for Frappe v16.50.0 because it is blocked by the upstream version skew described above. Keep that work deferred until the tested Frappe patch release is compatible with the selected stable Frappe UI version.

## Consumption rule

Product apps continue to consume EdgeSuite components and adapters. They must not call new Frappe Desk UI APIs or import `frappe-ui` / `@framework/ui` directly unless a product-specific requirement is explicitly approved.

On Frappe v16.50.0, EdgeSuite may delegate suitable primitives to confirmed native Desk APIs and may evaluate `frappe-ui@1.0.0` only through an isolated Vue/Vite surface after the pure canary passes. Do not consume `@framework/ui` components on this exact Framework tag.

Product workflow, permissions, navigation policy, branch context, reporting, printing and smart date behaviour remain owned by EdgeSuite or the product app as appropriate.
