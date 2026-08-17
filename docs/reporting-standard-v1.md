# EdgeSuite Reporting Standard V1

## Goal

Provide one shared, product-neutral reporting contract for VetEdge, RetailEdge, EduEdge, AgricEdge and future EdgeSuite apps without forcing all reports into one backend implementation.

## Provider modes

### Query Report provider

Use for small/simple reports that can safely execute through the existing Frappe Query Report path.

Characteristics:
- no claim of server-side pagination;
- normalized columns/rows/summary/chart payload;
- optional separate export handler.

### Paginated provider

Use for large, high-use or low-data-sensitive reports where the backend query itself is bounded.

Characteristics:
- server-side `start` / `page_length` contract;
- default and hard maximum page length;
- summary and chart loaders independent from interactive row pagination where needed;
- full export is a separate handler and must not require the browser to fetch every page.

A response that slices an already-materialized full dataset is not considered query-level server pagination. Product integrations should label that state accurately and optimize it before treating it as a high-volume reference.

## Shared runtime

The shared EdgeSuite runtime exposes:

- `EdgeSuiteReports.registerProvider(product, key, provider)`;
- `EdgeSuiteReports.getProvider(product, key)`;
- `EdgeSuiteReports.hasProvider(product, key)`;
- `EdgeSuiteReports.listProviders(product)`;
- `EdgeSuiteReports.createQueryReportProvider(...)`;
- `EdgeSuiteReports.createPaginatedReportProvider(...)`;
- `EdgeSuiteReports.normalizePayload(...)`.

Providers are registered under a stable product + report key so product apps keep ownership of business logic and permissions while EdgeSuite owns the interaction contract.

## Performance requirements

- Do not load an entire master dataset to populate Link filters.
- Use bounded, permission-aware remote search for large Link fields.
- Large/high-use reports should use server filtering and query-level pagination.
- Summary cards and charts must not require downloading the complete interactive table.
- No continuous polling by the shared report runtime.
- Full export remains separate from interactive pagination.
- Product backends remain responsible for branch/company/tenant/role enforcement.

## Safety

The reporting runtime is read-oriented infrastructure. It must not:

- bypass Frappe permissions;
- mutate submitted accounting documents;
- perform stock/payment/clinical mutations;
- infer access merely from UI state;
- hide invalid export generation behind browser-warning suppression.

## VetEdge reference consumers

VetEdge PR #47 consumes this standard progressively using the implementations already present after PR #36:

- Stock Expiry Monitor is the canonical query-level paginated reference;
- Planned Treatment currently has a paged response but still materializes the full structured report before slicing, so it is explicitly marked optimization-pending rather than a query-level pagination reference;
- VetEdge Report Center is the generic Query Report host being upgraded to resolve shared providers first and fall back to the existing Query Report path.

Do not rebuild these reports merely to adopt the shared contract. Adapt them incrementally and preserve existing behaviour.

## Phase V1 boundaries

This first foundation intentionally does not yet implement:

- XLSX/CSV/PDF generation;
- print rendering;
- letterhead selection;
- saved views;
- scheduled delivery;
- report-specific business summaries.

Those belong to the subsequent shared Export/Print phase after the provider contract is validated by multiple report shapes.
