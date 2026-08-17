# ProcessEdge EdgeSuite UI

Shared, independent EdgeSuite UI runtime and component library for ProcessEdge product apps.

## Purpose

EdgeSuite UI provides reusable product-shell, navigation, form, modal, document, reporting and interaction primitives without requiring a CoreEdge frontend installation. Product apps keep ownership of their business rules, permissions and backend services while consuming a consistent local UI runtime.

## Current shared capabilities

- Product App shell and menu
- Product/branch context presentation
- Professional page, dashboard and navigation components
- Form and document primitives
- Modal and multi-select runtime
- Shared workflow/save interaction bridges
- Theme/density and responsive shell enhancements
- Reporting provider runtime
- Shared report Export Builder for XLSX/CSV/PDF options and verified file downloads

## Reporting standard

The reporting runtime supports both ordinary Frappe Query Report providers and optimized server-paginated providers. Product apps register providers under product + report keys and remain responsible for permissions, tenant/company/branch rules and report business logic.

The Export Builder exposes current-page/all-filtered scope, raw-table vs presentation options, column selection and PDF orientation. Generated downloads are validated before saving so empty files, HTML error responses, invalid PDF/XLSX signatures and mismatched MIME types are rejected rather than presented as successful downloads.

See `docs/reporting-standard-v1.md` for the current contract and performance rules.

## Safety boundaries

EdgeSuite UI must not become an accounting, payment, stock or clinical authority. Submitted ERPNext accounting documents remain immutable through UI helpers. Product and Frappe permissions remain server-authoritative.

## Development

Use the repository CI and source-contract tests when extending shared runtime capabilities. Product-specific business logic belongs in the consuming app unless the behaviour is truly reusable across EdgeSuite products.
