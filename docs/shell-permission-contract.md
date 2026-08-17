# EdgeSuite Shell Permission Contract

## Purpose

`EdgeReportShell` and `EdgeDashboardShell` provide shared presentation and action surfaces. They do **not** authorize data access, printing, exporting, tenant scope, branch scope, company scope or business-document access.

Consuming product apps must calculate shell capabilities before enabling actions and must re-check the same authorization on the server endpoint that performs the action.

## Required permission mix

For every report/dashboard shell action, use this model:

`effective_capability = platform_capability_available AND product_setting_enabled AND scope_view_access AND action_authorization`

Where:

- **platform capability available** — EdgeSuite UI contains the shell/export/print runtime;
- **product setting enabled** — the consuming app/site/tenant has enabled the capability;
- **scope view access** — the current user may view that report/dashboard under the product's normal role, company, branch, tenant, practitioner or other access rules;
- **action authorization** — the product permits that user to perform the specific action. This may be the same as view access in a simple implementation or may use stricter Print/Export roles/permissions.

The shell boolean itself is presentation state only. `exportEnabled=true` or `printEnabled=true` must never be treated as authorization.

## Report shell

`EdgeReportShell` supports:

- `exportEnabled`
- `printEnabled`
- `exportBusy`
- `printBusy`
- `exportInitialOptions`
- `export` event
- `print` event

Recommended consuming-product flow:

1. Load the report capability context from a permission-aware product endpoint.
2. Set `exportEnabled = capabilities.can_export`.
3. Set `printEnabled = capabilities.can_print`.
4. When the user exports or prints, call a server endpoint that **re-runs the authorization check** before generating any data/file.
5. The server must independently apply the report filters, branch/company/tenant scope and underlying data permissions.

## Dashboard shell

`EdgeDashboardShell` uses the same authorization model, but dashboard export must remain dashboard-aware.

The shell emits dashboard exports with `artifact_kind = dashboard`. The consuming app should export only the dashboard datasets/widgets the user is authorized to see: KPI cards, charts, exception panels, rankings and compact tables.

Do not flatten a dashboard into an unrelated report merely to make export easier.

## Settings guidance for consuming apps

EdgeSuite does not prescribe product settings names, but consuming apps should normally provide product/site/tenant controls such as:

- Enable Report & Dashboard Printing
- Enable Report & Dashboard Export

Products may add stricter settings or role lists where bulk export needs stronger governance.

Settings are **policy gates**, not permission substitutes. A globally enabled setting does not grant access to a user who cannot view the scope.

## Permission guidance

At minimum:

- `can_view` must pass before Print or Export can be considered;
- users restricted to a branch/company/tenant must export/print only that same allowed scope;
- practitioner/self-view restrictions must also apply to exported/printed data;
- portal/external users must not gain internal report/dashboard access through export endpoints;
- server endpoints must never use `ignore_permissions` to make shell actions work;
- submitted accounting, stock, clinical or academic documents must never be mutated by reporting actions.

For sensitive or high-volume data, products should consider making Export stricter than Print/View.

## Recommended capability payload

A product capability endpoint may return:

```json
{
  "scope_name": "Consultation Register",
  "scope_type": "report",
  "can_view": true,
  "can_print": true,
  "can_export": false,
  "authorization_model": "settings_and_scope_access"
}
```

The product remains authoritative for how those booleans are calculated.

## Security rule

**Never trust the client-side shell state.**

Every export/print request must revalidate authorization server-side immediately before data extraction or document generation. The browser-facing shell controls are convenience/UI only.

## Download integrity

After authorization succeeds, consuming apps should use the shared EdgeSuite verified-download runtime so empty responses, HTML error pages, invalid PDF/XLSX signatures and MIME mismatches are rejected rather than downloaded as apparently corrupt files.
