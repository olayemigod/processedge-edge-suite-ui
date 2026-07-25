# EdgeSuite Product App Switcher — Acceptance QA

## Purpose

Validate the shared Product App Switcher and active-product waffle on a controlled Frappe site containing the current EdgeSuite consumers.

This is a browser acceptance gate. Do not use a production client site and do not merge the switcher PRs before this checklist passes.

## Branch set under test

| App | Branch |
| --- | --- |
| EdgeSuite UI | `agent/edgeui-product-app-switcher` |
| RetailEdge | `agent/retailedge-product-app-switcher` |
| VetEdge | `agent/vetedge-product-app-switcher` |
| EduEdge | `agent/eduedge-integrated-foundation` |
| EdgePay | `agent/edgepay-edgesuite-product-surface` |
| CoreEdge | `agent/coreedge-edgesuite-consumer` |

Preserve all internal app identities. In particular, EdgePay remains `edgepayv1` internally and registers visible product key `edgepay`.

## Recommended test site

Use a disposable site such as `edgesuite-qa.local`. Do not install all branches on `posnext.local`, `vetedge.local`, or a client site merely for this test.

Before starting:

1. Confirm every app worktree is clean.
2. Fetch the branches above.
3. Take a bench/site backup where appropriate.
4. Confirm ERPNext, Payments, Frappe Education and the six EdgeSuite apps are available on the bench.

## Site preparation

Use the dependency versions already accepted by each product branch.

```bash
bench new-site edgesuite-qa.local

bench --site edgesuite-qa.local install-app erpnext
bench --site edgesuite-qa.local install-app payments
bench --site edgesuite-qa.local install-app education
bench --site edgesuite-qa.local install-app edgesuite_ui
bench --site edgesuite-qa.local install-app coreedge
bench --site edgesuite-qa.local install-app retailedge
bench --site edgesuite-qa.local install-app vetedge
bench --site edgesuite-qa.local install-app eduedge
bench --site edgesuite-qa.local install-app edgepayv1

bench --site edgesuite-qa.local set-config edge_platform_mode standalone
bench --site edgesuite-qa.local set-config coreedge_required 0
bench --site edgesuite-qa.local set-config allow_tests true

bench build --app edgesuite_ui
bench build --app coreedge
bench build --app retailedge
bench build --app vetedge
bench build --app eduedge
bench build --app edgepayv1

bench --site edgesuite-qa.local migrate
bench --site edgesuite-qa.local clear-cache
bench clear-website-cache
bench restart
```

If an app is already installed, do not run `install-app` again. Confirm the installed-app set instead:

```bash
bench --site edgesuite-qa.local list-apps
```

## Initial Administrator validation

Log in as `Administrator` and hard refresh the Desk.

Expected available product labels:

- RetailEdge
- Veterinary
- EduEdge
- EdgePay
- CoreEdge Platform

Installation alone must not make a product available to an unauthorised normal user. Administrator is used here only for the first combined-surface check.

## DOM uniqueness checks

Run the following in the browser console:

```javascript
({
  hosts: document.querySelectorAll('#edge-product-menu-host').length,
  waffles: document.querySelectorAll('#edge-product-menu-trigger').length,
  panels: document.querySelectorAll('#edge-product-menu-dropdown').length,
  selectors: document.querySelectorAll('#edge-product-app-switcher').length,
  products: [...(document.querySelector('#edge-product-app-switcher')?.options || [])]
    .map((option) => ({ key: option.value, label: option.textContent.trim() })),
})
```

Expected on the multi-product Administrator session:

- `hosts: 1`
- `waffles: 1`
- `panels: 1`
- `selectors: 1`
- no duplicate product key

A single-product user must have `selectors: 0` while retaining one active-product waffle when that product has menu sections.

## Server-authoritative context

Run:

```javascript
await frappe.call({
  method: 'edgesuite_ui.api.product_context.get_product_context',
})
```

Confirm:

1. `available_products` contains only products the current user may access.
2. Every descriptor has a stable key, label and Home route.
3. `active_product` is one of the returned keys.
4. No provider secrets, tenant secrets or internal credential values are returned.

Forged selection must fail:

```javascript
await frappe.call({
  method: 'edgesuite_ui.api.product_context.switch_product',
  args: { product_key: 'forged-product' },
})
```

Expected: a permission error stating that the product is not currently available.

## Product switching matrix

| Product | Expected key | Expected Home route |
| --- | --- | --- |
| RetailEdge | `retailedge` | `/app/retailedge-home` |
| Veterinary | `vetedge` | `/app/vetedge` |
| EduEdge | `eduedge` | `/app/eduedge-home` |
| EdgePay | `edgepay` | `/app/edgepay-home` |
| CoreEdge Platform | `coreedge` | `/app/coreedge` |

For each product:

1. Select it from Product App.
2. Confirm navigation to its Home route.
3. Confirm the selector retains the chosen product.
4. Open the waffle.
5. Confirm the panel `aria-label` names the active product.
6. Confirm only that product's navigation is rendered.
7. Open at least one menu item and return to Home.
8. Confirm no second selector, waffle or dropdown appears after route changes.

## Route-aware activation

Open each Home route directly in a new browser tab and confirm the correct active product is selected without first using the selector.

Also test at least one product-owned report/page route for each product. Route changes must not leave the previous product's menu active.

## Permission matrix

Use existing test users or create controlled users with actual product permissions.

### Single-product user

- Give access to only one operational product.
- Confirm only that product is returned by the server context.
- Confirm the Product App selector is hidden.
- Confirm forged requests for every other product fail.

### Multi-product operational user

- Give access to two or more operational products.
- Confirm only those authorised products appear.
- Confirm switching between them works and unregistered products remain absent.

### System Manager without platform role

- Confirm CoreEdge Platform is absent.
- A generic `System Manager` role must not grant CoreEdge product visibility.

### CoreEdge platform administrator

- Confirm CoreEdge Platform appears only for `Administrator`, `CoreEdge Super Admin`, or `CoreEdge Platform Admin`.
- Confirm normal product users do not see platform governance navigation.

### EdgePay operational user

- Confirm EdgePay Home, payment requests, registration readiness and approved information are available according to role.
- Confirm API keys, secret keys, contract codes, webhook secrets and live-call controls are not visible.

## Product-specific smoke checks

### RetailEdge

- RetailEdge Home loads.
- Existing POSNext opening/closing links remain within RetailEdge.
- Salesperson Performance Dashboard loads the canonical runtime.
- No sales, stock, banking or accounting document is changed by switching products.

### Veterinary

- Veterinary Home loads.
- Stock Expiry Monitor and Executive Dashboard load.
- Clinical Workspace, Front Desk Action Centre and Pricing Masters still open.
- No consultation, lab, vaccination, hospitalisation, invoice or stock record is changed by switching products.

### EduEdge

- EduEdge Home loads.
- Academic Operations, CBT Operations, Question Builder, Branch Governance and Report Cards load.
- Institution/Branch context and terminology switching remain intact.
- No submitted academic or accounting record is changed by switching products.

### EdgePay

- Payment summary and registration readiness load.
- Recent payment-request links work.
- Provider secrets and restricted controls are absent.
- No Payment Entry, Journal Entry, GL Entry or source invoice is created or changed by opening EdgePay Home.

### CoreEdge Platform

- CoreEdge appears only for explicit platform administrators.
- Product Activation Center and EdgeSuite UI Preview load.
- The preview uses `edgesuite_ui.bundle.js`, not CoreEdge's retained legacy runtime.
- Normal operational users cannot see CoreEdge Platform.

## Failure handling

Capture for every failure:

- route;
- logged-in user and roles;
- selected product;
- browser console error;
- Network response for `get_product_context` or `switch_product`;
- DOM uniqueness result;
- screenshot;
- relevant app commit SHA.

Do not work around a failure by exposing all installed apps, bypassing product permissions, loading the legacy global bundle, or granting broad platform roles.

## Acceptance decision

Approve the Product App Switcher phase only when:

- all automated consumer branches are green;
- the multi-product Administrator matrix passes;
- single-product and restricted-role visibility pass;
- EdgePay secrets remain protected;
- CoreEdge remains restricted;
- one selector, one waffle and one dropdown are consistently rendered;
- no business or accounting document mutation is observed.
